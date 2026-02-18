"""Views for Wompi payment gateway integration.

Provides endpoints for:
- Retrieving Wompi public configuration (public key, environment).
- Generating integrity signatures for transactions.
- Receiving and processing Wompi webhook events.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction as db_transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core_app.models import Payment, PaymentIntent, Subscription, User
from core_app.services.email_service import send_payment_receipt
from core_app.services.wompi_service import (
    generate_integrity_signature,
    verify_event_checksum,
)

logger = logging.getLogger(__name__)
ALLOWED_INITIAL_PAYMENT_METHOD_TYPES = {
    # TODO: Confirm Wompi payment_method_type codes for cash and SU+ Pay with the client.
    'CARD',
    'NEQUI',
    'BANCOLOMBIA_TRANSFER',
    'PSE',
}
RECURRING_PAYMENT_METHOD_TYPES = {
    'CARD',
}


@api_view(['GET'])
@permission_classes([AllowAny])
def wompi_config(request):
    """Return Wompi public configuration.

    Returns the public key and environment so the frontend can initialize
    the Wompi Widget without exposing secret keys.

    Returns:
        Response: JSON with public_key and environment.
    """
    return Response({
        'public_key': settings.WOMPI_PUBLIC_KEY,
        'environment': settings.WOMPI_ENVIRONMENT,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def generate_signature(request):
    """Generate an integrity signature for a Wompi transaction.

    Expects reference, amount_in_cents, and currency in the request body.
    The signature is computed server-side to protect the integrity secret.

    Returns:
        Response: JSON with signature and reference.
    """
    reference = request.data.get('reference', '')
    amount_in_cents = request.data.get('amount_in_cents')
    currency = request.data.get('currency', 'COP')

    if not reference or not amount_in_cents:
        return Response(
            {'detail': 'Los campos reference y amount_in_cents son obligatorios.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        amount_in_cents = int(amount_in_cents)
    except (TypeError, ValueError):
        return Response(
            {'detail': 'amount_in_cents debe ser un entero válido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    signature = generate_integrity_signature(reference, amount_in_cents, currency)
    return Response({
        'signature': signature,
        'reference': reference,
    })


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def wompi_webhook(request):
    """Handle Wompi webhook events.

    Validates the event checksum and processes transaction.updated events.
    For APPROVED transactions, confirms the associated Payment.
    For DECLINED/ERROR transactions, marks the Payment as failed.

    Returns:
        Response: HTTP 200 to acknowledge receipt (required by Wompi).
    """
    event_body = request.data

    if not verify_event_checksum(event_body):
        logger.warning('Invalid Wompi webhook checksum received')
        return Response(
            {'detail': 'Checksum inválido.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    event_type = event_body.get('event', '')
    data = event_body.get('data', {})

    if event_type == 'transaction.updated':
        _handle_transaction_updated(data)

    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


def _handle_transaction_updated(data):
    """Process a transaction.updated webhook event.

    Two paths:
    1. **Initial purchase**: looks up a pending PaymentIntent by
       wompi_transaction_id.  On APPROVED, creates Payment + Subscription
       atomically.  On DECLINED/ERROR, marks the intent as failed.
    2. **Recurring billing**: if no PaymentIntent matches but a Payment
       record exists (created by the recurring billing task), updates
       its status as before.

    Args:
        data: The 'data' dict from the webhook event body containing
              the transaction object.
    """
    transaction = data.get('transaction', {})
    txn_id = str(transaction.get('id', ''))
    txn_status = transaction.get('status', '')
    txn_reference = str(transaction.get('reference', '')).strip()
    payment_source_id = transaction.get('payment_source_id')
    payment_method_type = str(transaction.get('payment_method_type', '')).upper()

    if not txn_id:
        logger.warning('Webhook transaction.updated missing transaction ID')
        return

    # --- Path 1: Resolve a PaymentIntent (initial purchase) ---
    try:
        intent = PaymentIntent.objects.select_related(
            'customer', 'package',
        ).get(wompi_transaction_id=txn_id)
    except PaymentIntent.DoesNotExist:
        intent = None

    if intent is None and txn_reference:
        try:
            intent = PaymentIntent.objects.select_related(
                'customer', 'package',
            ).get(reference=txn_reference, status=PaymentIntent.Status.PENDING)
        except PaymentIntent.DoesNotExist:
            intent = None

    if intent is not None:
        update_fields = []
        if txn_id and intent.wompi_transaction_id != txn_id:
            intent.wompi_transaction_id = txn_id
            update_fields.append('wompi_transaction_id')
        if payment_source_id and not intent.payment_source_id:
            intent.payment_source_id = str(payment_source_id)
            update_fields.append('payment_source_id')
        if update_fields:
            intent.save(update_fields=update_fields + ['updated_at'])
        if payment_method_type and payment_method_type not in ALLOWED_INITIAL_PAYMENT_METHOD_TYPES:
            logger.warning(
                'PaymentIntent %s uses unsupported method %s',
                intent.pk,
                payment_method_type,
            )
            intent.status = PaymentIntent.Status.FAILED
            intent.pending_password_hash = ''
            intent.save(update_fields=['status', 'pending_password_hash', 'updated_at'])
            return
        _resolve_payment_intent(intent, txn_status, payment_method_type)
        return

    # --- Path 2: Update an existing Payment (recurring billing) ---
    try:
        payment = Payment.objects.select_related('subscription').get(
            provider_reference=txn_id,
            provider=Payment.Provider.WOMPI,
        )
    except Payment.DoesNotExist:
        logger.warning('No PaymentIntent or Payment found for Wompi txn %s', txn_id)
        return
    except Payment.MultipleObjectsReturned:
        logger.error('Multiple payments found for Wompi transaction %s', txn_id)
        return

    _update_existing_payment(payment, txn_id, txn_status)


def _resolve_payment_intent(intent, txn_status, payment_method_type=''):
    """Resolve a PaymentIntent based on webhook transaction status.

    On APPROVED: creates Payment + Subscription in a single atomic
    transaction and marks the intent as approved.
    On DECLINED/ERROR: marks the intent as failed.
    Idempotent: if the intent is already resolved, does nothing.

    Args:
        intent: PaymentIntent instance.
        txn_status: Wompi transaction status string.
        payment_method_type: Wompi payment method type from the webhook.
    """
    if intent.status != PaymentIntent.Status.PENDING:
        logger.info(
            'PaymentIntent %s already resolved (%s), skipping',
            intent.pk, intent.status,
        )
        return

    normalized_method = str(payment_method_type or '').upper()
    is_recurring = (
        normalized_method in RECURRING_PAYMENT_METHOD_TYPES
        if normalized_method
        else True
    )

    if txn_status == 'APPROVED':
        if is_recurring and not intent.payment_source_id:
            logger.info(
                'PaymentIntent %s has no reusable payment source; '
                'approving as non-recurring',
                intent.pk,
            )
            is_recurring = False
        now = timezone.now()
        package = intent.package
        next_billing_date = None
        if is_recurring:
            next_billing_date = (now + timedelta(days=package.validity_days)).date()

        customer = intent.customer
        if customer is None:
            if not intent.pending_email or not intent.pending_password_hash:
                logger.error(
                    'PaymentIntent %s approved without pending registration payload',
                    intent.pk,
                )
                intent.status = PaymentIntent.Status.FAILED
                intent.pending_password_hash = ''
                intent.save(update_fields=['status', 'pending_password_hash', 'updated_at'])
                return

            try:
                customer = User.objects.create(
                    email=intent.pending_email,
                    first_name=intent.pending_first_name,
                    last_name=intent.pending_last_name,
                    phone=intent.pending_phone,
                    role=User.Role.CUSTOMER,
                    password=intent.pending_password_hash,
                )
            except IntegrityError:
                customer = User.objects.filter(email=intent.pending_email).first()
                if customer is None:
                    logger.error(
                        'Failed to resolve customer for PaymentIntent %s (email=%s)',
                        intent.pk,
                        intent.pending_email,
                    )
                    intent.status = PaymentIntent.Status.FAILED
                    intent.pending_password_hash = ''
                    intent.save(update_fields=['status', 'pending_password_hash', 'updated_at'])
                    return

            intent.customer = customer
            intent.pending_password_hash = ''
            intent.save(update_fields=['customer', 'pending_password_hash', 'updated_at'])

        with db_transaction.atomic():
            subscription = Subscription.objects.create(
                customer=customer,
                package=package,
                sessions_total=package.sessions_count,
                sessions_used=0,
                status=Subscription.Status.ACTIVE,
                starts_at=now,
                expires_at=now + timedelta(days=package.validity_days),
                payment_source_id=intent.payment_source_id,
                payment_method_type=normalized_method,
                is_recurring=is_recurring,
                wompi_transaction_id=intent.wompi_transaction_id,
                next_billing_date=next_billing_date,
            )

            payment = Payment.objects.create(
                customer=customer,
                subscription=subscription,
                amount=intent.amount,
                currency=intent.currency,
                provider=Payment.Provider.WOMPI,
                provider_reference=intent.wompi_transaction_id,
                status=Payment.Status.CONFIRMED,
                confirmed_at=now,
                metadata={
                    'wompi_reference': intent.reference,
                    'payment_source_id': intent.payment_source_id,
                },
            )

            intent.status = PaymentIntent.Status.APPROVED
            intent.save(update_fields=['status', 'updated_at'])

        logger.info(
            'PaymentIntent %s approved → subscription %s created (txn %s)',
            intent.pk, subscription.pk, intent.wompi_transaction_id,
        )

        send_payment_receipt(payment)

    elif txn_status in ('DECLINED', 'ERROR', 'VOIDED'):
        intent.status = PaymentIntent.Status.FAILED
        intent.pending_password_hash = ''
        intent.save(update_fields=['status', 'pending_password_hash', 'updated_at'])
        logger.warning(
            'PaymentIntent %s failed (txn %s, status %s)',
            intent.pk, intent.wompi_transaction_id, txn_status,
        )


def _update_existing_payment(payment, txn_id, txn_status):
    """Update an existing Payment record from a webhook (recurring billing).

    Args:
        payment: Payment instance with related subscription.
        txn_id: Wompi transaction ID string.
        txn_status: Wompi transaction status string.
    """
    if txn_status == 'APPROVED':
        payment.status = Payment.Status.CONFIRMED
        payment.confirmed_at = timezone.now()
        payment.save(update_fields=['status', 'confirmed_at', 'updated_at'])
        logger.info('Payment %s confirmed via webhook (txn %s)', payment.pk, txn_id)

        send_payment_receipt(payment)

    elif txn_status in ('DECLINED', 'ERROR'):
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=['status', 'updated_at'])
        logger.warning('Payment %s failed via webhook (txn %s, status %s)', payment.pk, txn_id, txn_status)

        if payment.subscription and payment.subscription.status == Subscription.Status.ACTIVE:
            subscription = payment.subscription
            subscription.status = Subscription.Status.EXPIRED
            subscription.next_billing_date = None
            subscription.save(update_fields=['status', 'next_billing_date', 'updated_at'])
            logger.warning('Subscription %s expired due to failed payment', subscription.pk)

    elif txn_status == 'VOIDED':
        payment.status = Payment.Status.CANCELED
        payment.save(update_fields=['status', 'updated_at'])
        logger.info('Payment %s voided via webhook (txn %s)', payment.pk, txn_id)
