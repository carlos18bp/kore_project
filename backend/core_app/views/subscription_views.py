import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core_app.models import Package, Payment, PaymentIntent, Subscription, User
from core_app.permissions import is_admin_user
from core_app.serializers import UserSerializer
from core_app.serializers.subscription_serializers import SubscriptionSerializer
from core_app.serializers.wompi_serializers import (
    CheckoutPreparationSerializer,
    PaymentIntentStatusSerializer,
    SubscriptionCheckoutPrepareSerializer,
    SubscriptionPaymentHistorySerializer,
    SubscriptionPurchaseSerializer,
)
from core_app.services.wompi_service import (
    WompiError,
    create_payment_source,
    create_transaction,
    get_transaction_by_id,
    generate_integrity_signature,
    generate_reference,
)
from core_app.views.wompi_views import (
    ALLOWED_INITIAL_PAYMENT_METHOD_TYPES,
    _resolve_payment_intent,
)

logger = logging.getLogger(__name__)
REGISTRATION_TOKEN_SALT = 'kore-pre-register-v1'


def _attempt_wompi_fallback_resolution(intent):
    """Attempt to resolve a pending PaymentIntent via the Wompi API.

    Args:
        intent: PaymentIntent instance that may still be pending.
    """
    if intent.status != PaymentIntent.Status.PENDING or not intent.wompi_transaction_id:
        return

    try:
        txn = get_transaction_by_id(intent.wompi_transaction_id)
    except WompiError as exc:
        logger.warning('Failed to fetch Wompi transaction %s: %s', intent.wompi_transaction_id, exc)
        return

    txn_status = txn.get('status', '')
    payment_source_id = txn.get('payment_source_id')
    payment_method_type = str(txn.get('payment_method_type', '')).upper()

    update_fields = []
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


class SubscriptionViewSet(viewsets.ModelViewSet):
    """Viewset for Subscription with purchase and cancel actions.

    Customers see their own subscriptions (all statuses: active, expired,
    canceled).  Admin users see all subscriptions across all customers.

    Endpoints:
        GET  /api/subscriptions/                    — list subscriptions
        GET  /api/subscriptions/{id}/               — retrieve a single subscription
        POST /api/subscriptions/purchase/            — purchase a new subscription
        POST /api/subscriptions/prepare-checkout/     — prepare Wompi Checkout flow
        POST /api/subscriptions/{id}/cancel/         — cancel a subscription
        GET  /api/subscriptions/{id}/payments/       — payment history
    """

    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Allow guest access only to purchase and intent-status actions."""
        if self.action in ('purchase', 'intent_status', 'prepare_checkout'):
            return [AllowAny()]
        return [permission() for permission in self.permission_classes]

    @action(detail=False, methods=['post'], url_path='prepare-checkout')
    def prepare_checkout(self, request):
        """Prepare a Wompi Checkout transaction for a subscription purchase.

        Generates the reference and integrity signature, creates a pending
        PaymentIntent, and returns the checkout data for the frontend widget.

        Args:
            request: DRF request with package_id and optional registration_token.

        Returns:
            Response: Checkout preparation payload (reference, signature, amount).
        """
        serializer = SubscriptionCheckoutPrepareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        package = serializer.validated_data['package_id']
        registration_token = serializer.validated_data.get('registration_token', '')
        user = request.user if request.user.is_authenticated else None
        registration_payload = None

        if user is None:
            if not registration_token:
                return Response(
                    {'detail': 'El campo registration_token es obligatorio para el checkout de invitado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            max_age = int(getattr(settings, 'REGISTRATION_TOKEN_MAX_AGE_SECONDS', 3600))
            try:
                registration_payload = signing.loads(
                    registration_token,
                    salt=REGISTRATION_TOKEN_SALT,
                    max_age=max_age,
                )
            except signing.SignatureExpired:
                return Response(
                    {'detail': 'El registro expiró. Completa el formulario de nuevo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except signing.BadSignature:
                return Response(
                    {'detail': 'El registro es inválido. Intenta nuevamente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            required_fields = ('email', 'first_name', 'last_name', 'password_hash')
            if any(not str(registration_payload.get(field, '')).strip() for field in required_fields):
                return Response(
                    {'detail': 'El registro es inválido. Intenta nuevamente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            guest_email = str(registration_payload['email']).strip().lower()
            if User.objects.filter(email=guest_email).exists():
                return Response(
                    {'detail': 'Ya existe una cuenta con este correo. Inicia sesión.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            registration_payload['email'] = guest_email

        amount_in_cents = int(package.price * 100)
        reference = generate_reference()
        signature = generate_integrity_signature(reference, amount_in_cents, package.currency)

        intent = PaymentIntent.objects.create(
            customer=user,
            package=package,
            reference=reference,
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            pending_email=registration_payload['email'] if registration_payload else '',
            pending_first_name=registration_payload['first_name'] if registration_payload else '',
            pending_last_name=registration_payload['last_name'] if registration_payload else '',
            pending_phone=registration_payload.get('phone', '') if registration_payload else '',
            pending_password_hash=registration_payload['password_hash'] if registration_payload else '',
            public_access_token=secrets.token_urlsafe(32) if user is None else '',
            status=PaymentIntent.Status.PENDING,
        )

        response_data = {
            'reference': reference,
            'signature': signature,
            'amount_in_cents': amount_in_cents,
            'currency': package.currency,
            'package_title': package.title,
        }
        if user is None:
            response_data['checkout_access_token'] = intent.public_access_token

        response_serializer = CheckoutPreparationSerializer(data=response_data)
        response_serializer.is_valid(raise_exception=True)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

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

    def create(self, request, *args, **kwargs):
        """Disallow direct subscription creation via the collection endpoint.

        Subscriptions are created through the purchase workflow or webhook.

        Args:
            request: DRF request.

        Returns:
            Response: 405 Method Not Allowed.
        """
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

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
        registration_token = serializer.validated_data.get('registration_token', '')
        user = request.user if request.user.is_authenticated else None
        registration_payload = None

        if user is None:
            if not registration_token:
                return Response(
                    {'detail': 'El campo registration_token es obligatorio para el checkout de invitado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            max_age = int(getattr(settings, 'REGISTRATION_TOKEN_MAX_AGE_SECONDS', 3600))
            try:
                registration_payload = signing.loads(
                    registration_token,
                    salt=REGISTRATION_TOKEN_SALT,
                    max_age=max_age,
                )
            except signing.SignatureExpired:
                return Response(
                    {'detail': 'El registro expiró. Completa el formulario de nuevo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except signing.BadSignature:
                return Response(
                    {'detail': 'El registro es inválido. Intenta nuevamente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            required_fields = ('email', 'first_name', 'last_name', 'password_hash')
            if any(not str(registration_payload.get(field, '')).strip() for field in required_fields):
                return Response(
                    {'detail': 'El registro es inválido. Intenta nuevamente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            guest_email = str(registration_payload['email']).strip().lower()
            if User.objects.filter(email=guest_email).exists():
                return Response(
                    {'detail': 'Ya existe una cuenta con este correo. Inicia sesión.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            registration_payload['email'] = guest_email

        customer_email = user.email if user is not None else registration_payload['email']

        amount_in_cents = int(package.price * 100)

        try:
            payment_source_id = create_payment_source(
                token=card_token,
                customer_email=customer_email,
            )
        except WompiError as exc:
            logger.error('Payment source creation failed for email %s: %s', customer_email, exc)
            return Response(
                {'detail': 'No se pudo procesar el método de pago. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        reference = generate_reference()
        try:
            txn_data = create_transaction(
                amount_in_cents=amount_in_cents,
                currency=package.currency,
                customer_email=customer_email,
                reference=reference,
                payment_source_id=payment_source_id,
                recurrent=True,
            )
        except WompiError as exc:
            logger.error('Transaction creation failed for email %s: %s', customer_email, exc)
            return Response(
                {'detail': 'Falló el procesamiento del pago. Intenta de nuevo.'},
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
            pending_email=registration_payload['email'] if registration_payload else '',
            pending_first_name=registration_payload['first_name'] if registration_payload else '',
            pending_last_name=registration_payload['last_name'] if registration_payload else '',
            pending_phone=registration_payload.get('phone', '') if registration_payload else '',
            pending_password_hash=registration_payload['password_hash'] if registration_payload else '',
            public_access_token=secrets.token_urlsafe(32) if user is None else '',
            status=PaymentIntent.Status.PENDING,
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
        if request.user.is_authenticated:
            try:
                intent = PaymentIntent.objects.select_related('package', 'customer').get(
                    reference=reference,
                    customer=request.user,
                )
            except PaymentIntent.DoesNotExist:
                return Response(
                    {'detail': 'No se encontró la intención de pago.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            access_token = str(request.query_params.get('access_token', '')).strip()
            if not access_token:
                return Response(
                    {'detail': 'No se proporcionaron credenciales de autenticación.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            try:
                intent = PaymentIntent.objects.select_related('package', 'customer').get(
                    reference=reference,
                    public_access_token=access_token,
                )
            except PaymentIntent.DoesNotExist:
                return Response(
                    {'detail': 'No se encontró la intención de pago.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        transaction_id = str(request.query_params.get('transaction_id', '')).strip()
        if transaction_id and intent.wompi_transaction_id != transaction_id:
            intent.wompi_transaction_id = transaction_id
            intent.save(update_fields=['wompi_transaction_id', 'updated_at'])

        if intent.status == PaymentIntent.Status.PENDING and intent.wompi_transaction_id:
            _attempt_wompi_fallback_resolution(intent)
            intent.refresh_from_db()

        response_data = PaymentIntentStatusSerializer(intent).data
        if (
            not request.user.is_authenticated
            and intent.status == PaymentIntent.Status.APPROVED
            and intent.customer is not None
        ):
            refresh = RefreshToken.for_user(intent.customer)
            response_data['auto_login'] = {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(intent.customer).data,
            }

        return Response(response_data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_subscription(self, request, pk=None):
        """Cancel an active subscription.

        Sets status to canceled and clears next_billing_date.

        Args:
            request: DRF request.
            pk: Subscription primary key.

        Returns:
            Response: Updated subscription data.
        """
        subscription = self.get_object()
        if subscription.status != Subscription.Status.ACTIVE:
            return Response(
                {'detail': 'Solo se pueden cancelar suscripciones activas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        subscription.status = Subscription.Status.CANCELED
        subscription.next_billing_date = None
        subscription.save(update_fields=['status', 'next_billing_date', 'updated_at'])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=False, methods=['get'], url_path='expiry-reminder')
    def expiry_reminder(self, request):
        """Return the current user's expiring non-recurring subscription.

        Looks for an active subscription that is not recurring, expires within
        the next 7 days, and has not been shown in the UI yet.

        Returns:
            Response: Subscription data or 204 with no body when none match.
        """
        now = timezone.now()
        cutoff = now + timedelta(days=7)
        subscription = (
            Subscription.objects.select_related('package')
            .filter(
                customer=request.user,
                status=Subscription.Status.ACTIVE,
                is_recurring=False,
                expiry_email_sent_at__isnull=True,
                expiry_ui_sent_at__isnull=True,
                expires_at__gte=now,
                expires_at__lte=cutoff,
            )
            .order_by('expires_at')
            .first()
        )

        if not subscription:
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = self.get_serializer(subscription)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='expiry-reminder/ack')
    def expiry_reminder_ack(self, request, pk=None):
        """Mark the expiry reminder as shown in the UI.

        Sets ``expiry_ui_sent_at`` only for active, non-recurring subscriptions.

        Returns:
            Response: ``{"status": "ok"}`` when updated or already acknowledged.
        """
        subscription = self.get_object()
        if subscription.status != Subscription.Status.ACTIVE or subscription.is_recurring:
            return Response(
                {'detail': 'Solo aplica a suscripciones activas no recurrentes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if subscription.expiry_ui_sent_at is None:
            subscription.expiry_ui_sent_at = timezone.now()
            subscription.save(update_fields=['expiry_ui_sent_at', 'updated_at'])
        return Response({'status': 'ok'})

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
