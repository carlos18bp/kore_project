import logging
import secrets
import time
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from django.db.models import Q

from core_app.models import Package, Payment, PaymentIntent, Subscription, SubscriptionGuest, User
from core_app.permissions import is_admin_user
from core_app.serializers import UserSerializer
from core_app.serializers.subscription_serializers import AdminSubscriptionSerializer, SubscriptionSerializer
from core_app.serializers.wompi_serializers import (
    CheckoutPreparationSerializer,
    PaymentIntentStatusSerializer,
    SubscriptionCheckoutPrepareSerializer,
    SubscriptionPurchaseAlternativeSerializer,
    SubscriptionPaymentHistorySerializer,
    SubscriptionPurchaseSerializer,
)
from core_app.services.wompi_service import (
    WompiError,
    create_payment_source,
    create_transaction,
    create_transaction_with_payment_method,
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
REDIRECT_POLL_METHODS = {'PSE', 'BANCOLOMBIA_TRANSFER'}


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


def _extract_async_payment_url(transaction_data):
    """Extract async payment redirect URL from a Wompi transaction payload."""
    payment_method_data = transaction_data.get('payment_method', {})
    if not isinstance(payment_method_data, dict):
        return ''

    extra = payment_method_data.get('extra', {})
    if not isinstance(extra, dict):
        return ''

    return str(extra.get('async_payment_url', '')).strip()


def _poll_async_payment_url(transaction_id, max_attempts=12, wait_seconds=1):
    """Poll Wompi for a short time to retrieve an async payment URL if available."""
    for attempt in range(max_attempts):
        try:
            txn = get_transaction_by_id(transaction_id)
        except WompiError as exc:
            logger.warning(
                'Failed to poll transaction %s for async payment URL: %s',
                transaction_id,
                exc,
            )
            return ''

        async_payment_url = _extract_async_payment_url(txn)
        if async_payment_url:
            return async_payment_url

        if attempt < max_attempts - 1:
            time.sleep(wait_seconds)

    return ''


class SubscriptionViewSet(viewsets.ModelViewSet):
    """Viewset for Subscription with purchase and cancel actions.

    Customers see their own subscriptions (all statuses: active, expired,
    canceled).  Admin users see all subscriptions across all customers.

    Endpoints:
        GET  /api/subscriptions/                    — list subscriptions
        GET  /api/subscriptions/{id}/               — retrieve a single subscription
        POST /api/subscriptions/purchase/            — purchase a new subscription
        POST /api/subscriptions/purchase-alternative/ — purchase with non-card methods
        POST /api/subscriptions/prepare-checkout/     — prepare Wompi Checkout flow
        POST /api/subscriptions/{id}/cancel/         — cancel a subscription
        GET  /api/subscriptions/{id}/payments/       — payment history
    """

    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if is_admin_user(self.request.user) and self.action in (
            'list', 'retrieve', 'partial_update', 'admin_renew',
        ):
            return AdminSubscriptionSerializer
        return SubscriptionSerializer

    def get_permissions(self):
        """Allow guest access only to purchase and intent-status actions."""
        if self.action in ('purchase', 'purchase_alternative', 'intent_status', 'prepare_checkout'):
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
        """Return subscriptions for the current user.

        Admin users receive all subscriptions.  Customers receive their own
        subscriptions plus any active guest subscription they have been
        accepted into.
        """
        qs = Subscription.objects.select_related('customer', 'package').all()
        if is_admin_user(self.request.user):
            search = self.request.query_params.get('search', '').strip()
            status_filter = self.request.query_params.get('status', '').strip()
            if search:
                qs = qs.filter(
                    Q(customer__email__icontains=search)
                    | Q(customer__first_name__icontains=search)
                    | Q(customer__last_name__icontains=search)
                )
            if status_filter in Subscription.Status.values:
                qs = qs.filter(status=status_filter)
            return qs
        return qs.filter(
            Q(customer=self.request.user) |
            Q(guest_link__guest=self.request.user, guest_link__status=SubscriptionGuest.STATUS_ACCEPTED)
        ).distinct()

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
        installments = serializer.validated_data.get('installments', 1)
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
                installments=installments,
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

    @action(detail=False, methods=['post'], url_path='purchase-alternative')
    def purchase_alternative(self, request):
        """Initiate a subscription purchase via non-card Wompi methods.

        Supports NEQUI, PSE, and BANCOLOMBIA_TRANSFER. These methods are
        treated as non-recurring and resolved asynchronously by webhook.
        """
        serializer = SubscriptionPurchaseAlternativeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        package = serializer.validated_data['package_id']
        payment_method = serializer.validated_data['payment_method']
        phone_number = str(serializer.validated_data.get('phone_number', '')).strip()
        pse_data = serializer.validated_data.get('pse_data') or {}
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
        reference = generate_reference()

        customer_data = None
        if payment_method == 'NEQUI':
            payment_method_payload = {
                'type': 'NEQUI',
                'phone_number': phone_number,
            }
        elif payment_method == 'PSE':
            payment_method_payload = {
                'type': 'PSE',
                'user_type': pse_data['user_type'],
                'user_legal_id_type': pse_data['user_legal_id_type'],
                'user_legal_id': pse_data['user_legal_id'],
                'financial_institution_code': pse_data['financial_institution_code'],
                'payment_description': f'Suscripción KÓRE - {package.title}',
            }
            customer_data = {
                'phone_number': pse_data['phone_number'],
                'full_name': pse_data['full_name'],
            }
        else:
            payment_method_payload = {
                'type': 'BANCOLOMBIA_TRANSFER',
                'user_type': 'PERSON',
                'payment_description': f'Suscripción KÓRE - {package.title}',
            }

        try:
            txn_data = create_transaction_with_payment_method(
                amount_in_cents=amount_in_cents,
                currency=package.currency,
                customer_email=customer_email,
                reference=reference,
                payment_method=payment_method_payload,
                customer_data=customer_data,
            )
        except WompiError as exc:
            logger.error(
                'Alternative transaction creation failed for email %s (%s): %s',
                customer_email,
                payment_method,
                exc,
            )
            return Response(
                {'detail': 'Falló el procesamiento del pago. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        transaction_id = str(txn_data.get('id', ''))
        redirect_url = _extract_async_payment_url(txn_data)
        if not redirect_url and payment_method in REDIRECT_POLL_METHODS and transaction_id:
            redirect_url = _poll_async_payment_url(transaction_id)

        intent = PaymentIntent.objects.create(
            customer=user,
            package=package,
            reference=reference,
            wompi_transaction_id=transaction_id,
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

        response_data = PaymentIntentStatusSerializer(intent).data
        response_data['redirect_url'] = redirect_url or None

        return Response(response_data, status=status.HTTP_201_CREATED)

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

    @action(detail=True, methods=['post'], url_path='invite-guest')
    def invite_guest(self, request, pk=None):
        """Invite a guest to share this duo subscription.

        Only the host (owner) of an active semi_personalizado plan can invite.
        Creates or replaces the SubscriptionGuest record and sends the email.

        Body: { "email": "guest@example.com" }
        Returns 201 with { "status": "pending", "invited_email": "..." }
        """
        from core_app.services.email_service import send_duo_invitation

        subscription = self.get_object()

        if subscription.customer_id != request.user.pk:
            return Response(
                {'detail': 'Solo el anfitrión puede invitar a un compañero/a.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if subscription.status != Subscription.Status.ACTIVE:
            return Response(
                {'detail': 'La suscripción debe estar activa para invitar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if subscription.package.category != 'semi_personalizado':
            return Response(
                {'detail': 'Solo el plan Pareja permite invitar a un compañero/a.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = str(request.data.get('email', '')).strip().lower()
        if not email:
            return Response({'detail': 'El campo email es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if email == request.user.email.lower():
            return Response(
                {'detail': 'No puedes invitarte a ti mismo/a.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            existing = subscription.guest_link
            if existing.status == SubscriptionGuest.STATUS_ACCEPTED:
                return Response(
                    {'detail': 'Ya hay un compañero/a activo/a en esta suscripción.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            existing.invited_email = email
            existing.guest = None
            existing.token = SubscriptionGuest.generate_token()
            existing.status = SubscriptionGuest.STATUS_PENDING
            existing.accepted_at = None
            existing.save()
            guest_link = existing
        except SubscriptionGuest.DoesNotExist:
            guest_link = SubscriptionGuest.objects.create(
                subscription=subscription,
                invited_email=email,
                token=SubscriptionGuest.generate_token(),
                status=SubscriptionGuest.STATUS_PENDING,
            )

        from django.conf import settings as django_settings
        base_url = getattr(django_settings, 'FRONTEND_BASE_URL', 'https://korehealths.com')
        accept_url = f'{base_url}/accept-invite?token={guest_link.token}'
        host_name = f'{request.user.first_name} {request.user.last_name}'.strip() or request.user.email
        send_duo_invitation(guest_link, host_name, accept_url)

        return Response(
            {'status': 'pending', 'invited_email': email},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='revoke-guest')
    def revoke_guest(self, request, pk=None):
        """Revoke the guest invitation for this subscription.

        Sets guest_link status to 'revoked' and clears the guest FK.

        Returns 200 with { "status": "revoked" }
        """
        subscription = self.get_object()

        if subscription.customer_id != request.user.pk:
            return Response(
                {'detail': 'Solo el anfitrión puede revocar la invitación.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            guest_link = subscription.guest_link
        except SubscriptionGuest.DoesNotExist:
            return Response(
                {'detail': 'Esta suscripción no tiene invitado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        guest_link.status = SubscriptionGuest.STATUS_REVOKED
        guest_link.guest = None
        guest_link.save(update_fields=['status', 'guest', 'updated_at'])
        return Response({'status': 'revoked'})

    def partial_update(self, request, *args, **kwargs):
        """Allow admins to patch subscription fields directly.

        Writable fields: status, sessions_total, sessions_used,
        starts_at, expires_at, is_recurring, next_billing_date.
        Returns 403 for non-admin callers.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        subscription = self.get_object()
        serializer = self.get_serializer(subscription, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='admin-renew')
    def admin_renew(self, request, pk=None):
        """Manually renew a subscription as a cash payment. Admin-only.

        Creates a new active Subscription and a CASH Payment record,
        then marks the original subscription as expired.
        Returns 403 for non-admin callers.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        old_sub = self.get_object()
        now = timezone.now()

        new_sub = Subscription.objects.create(
            customer=old_sub.customer,
            package=old_sub.package,
            sessions_total=old_sub.package.sessions_count,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=old_sub.package.validity_days),
            is_recurring=False,
        )

        if old_sub.status != Subscription.Status.EXPIRED:
            old_sub.status = Subscription.Status.EXPIRED
            old_sub.save(update_fields=['status', 'updated_at'])

        Payment.objects.create(
            subscription=new_sub,
            customer=old_sub.customer,
            status=Payment.Status.CONFIRMED,
            amount=old_sub.package.price,
            currency=old_sub.package.currency,
            provider=Payment.Provider.CASH,
            confirmed_at=now,
            metadata={
                'renewed_from_subscription_id': old_sub.pk,
                'renewed_by_admin': request.user.email,
            },
        )

        return Response(
            self.get_serializer(new_sub, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

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
