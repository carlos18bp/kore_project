import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_app.models import Package, Payment, PaymentIntent, Subscription
from core_app.permissions import is_admin_user
from core_app.serializers.subscription_serializers import SubscriptionSerializer
from core_app.serializers.wompi_serializers import (
    PaymentIntentStatusSerializer,
    SubscriptionPaymentHistorySerializer,
    SubscriptionPurchaseSerializer,
)
from core_app.services.wompi_service import (
    WompiError,
    create_payment_source,
    create_transaction,
    generate_reference,
)

logger = logging.getLogger(__name__)


class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """Viewset for Subscription with purchase, cancel, pause, and resume actions.

    Customers see their own subscriptions (all statuses: active, expired,
    canceled, paused).  Admin users see all subscriptions across all customers.

    Endpoints:
        GET  /api/subscriptions/                    — list subscriptions
        GET  /api/subscriptions/{id}/               — retrieve a single subscription
        POST /api/subscriptions/purchase/            — purchase a new subscription
        POST /api/subscriptions/{id}/cancel/         — cancel a subscription
        POST /api/subscriptions/{id}/pause/          — pause a subscription
        POST /api/subscriptions/{id}/resume/         — resume a paused subscription
        GET  /api/subscriptions/{id}/payments/       — payment history
    """

    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return subscriptions filtered by the current user's role.

        Admin users receive the full queryset.  Customers receive only
        their own subscriptions.

        Returns:
            QuerySet: Subscription instances with related customer and package.
        """
        qs = Subscription.objects.select_related('customer', 'package').all()
        if is_admin_user(self.request.user):
            return qs
        return qs.filter(customer=self.request.user)

    @action(detail=False, methods=['post'], url_path='purchase')
    def purchase(self, request):
        """Initiate a subscription purchase via Wompi card tokenization.

        Receives a package_id and card_token, creates a payment source
        in Wompi, initiates a Wompi transaction, and stores a pending
        PaymentIntent.  The actual Payment and Subscription are created
        later by the webhook handler when the transaction is APPROVED.

        Args:
            request: DRF request with package_id and card_token in body.

        Returns:
            Response: Created PaymentIntent data for status polling.
        """
        serializer = SubscriptionPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        package = serializer.validated_data['package_id']
        card_token = serializer.validated_data['card_token']
        user = request.user

        amount_in_cents = int(package.price * 100)

        try:
            payment_source_id = create_payment_source(
                token=card_token,
                customer_email=user.email,
            )
        except WompiError as exc:
            logger.error('Payment source creation failed for user %s: %s', user.email, exc)
            return Response(
                {'detail': 'Failed to process payment method. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        reference = generate_reference()
        try:
            txn_data = create_transaction(
                amount_in_cents=amount_in_cents,
                currency=package.currency,
                customer_email=user.email,
                reference=reference,
                payment_source_id=payment_source_id,
                recurrent=True,
            )
        except WompiError as exc:
            logger.error('Transaction creation failed for user %s: %s', user.email, exc)
            return Response(
                {'detail': 'Payment processing failed. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        intent = PaymentIntent.objects.create(
            customer=user,
            package=package,
            reference=reference,
            wompi_transaction_id=str(txn_data.get('id', '')),
            payment_source_id=str(payment_source_id),
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        # TODO: Remove this dev-mode auto-approval once Wompi webhook is properly
        # configured with a public URL (e.g., ngrok/cloudflared tunnel). In production,
        # the webhook handler in wompi_views.py resolves the PaymentIntent to approved/failed.
        if settings.DEBUG:
            now = timezone.now()
            with db_transaction.atomic():
                subscription = Subscription.objects.create(
                    customer=user,
                    package=package,
                    sessions_total=package.sessions_count,
                    sessions_used=0,
                    status=Subscription.Status.ACTIVE,
                    starts_at=now,
                    expires_at=now + timedelta(days=package.validity_days),
                    payment_source_id=str(payment_source_id),
                    wompi_transaction_id=str(txn_data.get('id', '')),
                    next_billing_date=(now + timedelta(days=package.validity_days)).date(),
                )
                Payment.objects.create(
                    customer=user,
                    subscription=subscription,
                    amount=package.price,
                    currency=package.currency,
                    provider=Payment.Provider.WOMPI,
                    provider_reference=str(txn_data.get('id', '')),
                    status=Payment.Status.CONFIRMED,
                    confirmed_at=now,
                    metadata={
                        'wompi_reference': reference,
                        'payment_source_id': str(payment_source_id),
                        'dev_mode_auto_approved': True,
                    },
                )
                intent.status = PaymentIntent.Status.APPROVED
                intent.save(update_fields=['status', 'updated_at'])
            logger.info(
                '[DEV MODE] Auto-approved PaymentIntent %s → subscription %s',
                intent.pk, subscription.pk,
            )

        return Response(
            PaymentIntentStatusSerializer(intent).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='intent-status/(?P<reference>[^/.]+)')
    def intent_status(self, request, reference=None):
        """Poll the status of a PaymentIntent by its reference.

        The frontend calls this endpoint after initiating a purchase to
        check whether the webhook has resolved the intent to approved or
        failed.

        Args:
            request: DRF request.
            reference: The unique Wompi payment reference.

        Returns:
            Response: Current PaymentIntent status data.
        """
        try:
            intent = PaymentIntent.objects.select_related('package').get(
                reference=reference,
                customer=request.user,
            )
        except PaymentIntent.DoesNotExist:
            return Response(
                {'detail': 'Payment intent not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(PaymentIntentStatusSerializer(intent).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_subscription(self, request, pk=None):
        """Cancel an active or paused subscription.

        Sets status to canceled and clears next_billing_date.

        Args:
            request: DRF request.
            pk: Subscription primary key.

        Returns:
            Response: Updated subscription data.
        """
        subscription = self.get_object()
        if subscription.status not in (Subscription.Status.ACTIVE, Subscription.Status.PAUSED):
            return Response(
                {'detail': 'Only active or paused subscriptions can be canceled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        subscription.status = Subscription.Status.CANCELED
        subscription.next_billing_date = None
        subscription.save(update_fields=['status', 'next_billing_date', 'updated_at'])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=True, methods=['post'], url_path='pause')
    def pause_subscription(self, request, pk=None):
        """Pause an active subscription.

        Sets status to paused and records the pause timestamp.

        Args:
            request: DRF request.
            pk: Subscription primary key.

        Returns:
            Response: Updated subscription data.
        """
        subscription = self.get_object()
        if subscription.status != Subscription.Status.ACTIVE:
            return Response(
                {'detail': 'Only active subscriptions can be paused.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        subscription.status = Subscription.Status.PAUSED
        subscription.paused_at = timezone.now()
        subscription.save(update_fields=['status', 'paused_at', 'updated_at'])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=True, methods=['post'], url_path='resume')
    def resume_subscription(self, request, pk=None):
        """Resume a paused subscription.

        Restores status to active, clears paused_at, and recalculates
        next_billing_date based on the package validity.

        Args:
            request: DRF request.
            pk: Subscription primary key.

        Returns:
            Response: Updated subscription data.
        """
        subscription = self.get_object()
        if subscription.status != Subscription.Status.PAUSED:
            return Response(
                {'detail': 'Only paused subscriptions can be resumed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        now = timezone.now()
        subscription.status = Subscription.Status.ACTIVE
        subscription.paused_at = None
        subscription.next_billing_date = (
            now + timedelta(days=subscription.package.validity_days)
        ).date()
        subscription.save(update_fields=['status', 'paused_at', 'next_billing_date', 'updated_at'])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=True, methods=['get'], url_path='payments')
    def payment_history(self, request, pk=None):
        """Return the payment history for a specific subscription.

        Args:
            request: DRF request.
            pk: Subscription primary key.

        Returns:
            Response: List of payments associated with the subscription.
        """
        subscription = self.get_object()
        payments = Payment.objects.filter(subscription=subscription).order_by('-created_at')
        serializer = SubscriptionPaymentHistorySerializer(payments, many=True)
        return Response(serializer.data)
