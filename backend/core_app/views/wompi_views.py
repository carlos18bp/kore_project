"""Views for Wompi payment gateway integration.

Provides endpoints for:
- Retrieving Wompi public configuration (public key, environment).
- Generating integrity signatures for transactions.
- Receiving and processing Wompi webhook events.
"""

import logging

from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core_app.models import Payment, Subscription
from core_app.services.wompi_service import (
    generate_integrity_signature,
    verify_event_checksum,
)

logger = logging.getLogger(__name__)


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
@permission_classes([IsAuthenticated])
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
            {'detail': 'reference and amount_in_cents are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        amount_in_cents = int(amount_in_cents)
    except (TypeError, ValueError):
        return Response(
            {'detail': 'amount_in_cents must be a valid integer.'},
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
            {'detail': 'Invalid checksum'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    event_type = event_body.get('event', '')
    data = event_body.get('data', {})

    if event_type == 'transaction.updated':
        _handle_transaction_updated(data)

    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


def _handle_transaction_updated(data):
    """Process a transaction.updated webhook event.

    Looks up the Payment by provider_reference (Wompi transaction ID)
    and updates its status based on the transaction result.

    Args:
        data: The 'data' dict from the webhook event body containing
              the transaction object.
    """
    transaction = data.get('transaction', {})
    txn_id = str(transaction.get('id', ''))
    txn_status = transaction.get('status', '')

    if not txn_id:
        logger.warning('Webhook transaction.updated missing transaction ID')
        return

    try:
        payment = Payment.objects.select_related('subscription').get(
            provider_reference=txn_id,
            provider=Payment.Provider.WOMPI,
        )
    except Payment.DoesNotExist:
        logger.warning('Payment not found for Wompi transaction %s', txn_id)
        return
    except Payment.MultipleObjectsReturned:
        logger.error('Multiple payments found for Wompi transaction %s', txn_id)
        return

    if txn_status == 'APPROVED':
        payment.status = Payment.Status.CONFIRMED
        payment.confirmed_at = timezone.now()
        payment.save(update_fields=['status', 'confirmed_at', 'updated_at'])
        logger.info('Payment %s confirmed via webhook (txn %s)', payment.pk, txn_id)

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
