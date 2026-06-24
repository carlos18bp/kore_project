import logging
import secrets
import time
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from django.db.models import Count, ProtectedError, Q

from core_app.models import Package, Payment, PaymentIntent, Subscription, SubscriptionGuest, SubscriptionRenewal, User
from core_app.permissions import is_admin_user
from core_app.serializers import UserSerializer
from core_app.serializers.subscription_serializers import AdminSubscriptionSerializer, SubscriptionSerializer
from core_app.serializers.renewal_history_serializers import RenewalHistoryItemSerializer
from core_app.services.renewal_history_service import build_renewal_timeline, record_renewal
from core_app.services.slot_schedule import MAX_ROLLOVER_SESSIONS
from core_app.serializers.wompi_serializers import (
    CheckoutPreparationSerializer,
    PaymentIntentStatusSerializer,
    SubscriptionBancolombiaStartSerializer,
    SubscriptionCheckoutPrepareSerializer,
    SubscriptionNequiStartSerializer,
    SubscriptionPurchaseAlternativeSerializer,
    SubscriptionPaymentHistorySerializer,
    SubscriptionPurchaseSerializer,
    SubscriptionTokenizedConfirmSerializer,
)
from core_app.services.admin_subscription_service import (
    ALLOWED_OFFLINE_METHODS,
    create_subscription_for_admin,
    evolve_subscription_for_admin,
)
from core_app.services.wompi_service import (
    WompiError,
    create_bancolombia_transfer_token,
    create_nequi_token,
    create_payment_source,
    create_transaction,
    create_transaction_with_payment_method,
    get_transaction_by_id,
    generate_integrity_signature,
    generate_reference,
    poll_bancolombia_token_until_approved,
    poll_nequi_token_until_approved,
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
        if self.action in (
            'purchase',
            'purchase_alternative',
            'intent_status',
            'prepare_checkout',
            'nequi_start',
            'nequi_confirm',
            'bancolombia_start',
            'bancolombia_confirm',
        ):
            return [AllowAny()]
        return [permission() for permission in self.permission_classes]

    def _resolve_user_and_registration_payload(self, request, registration_token):
        """Validate the request user or guest registration token.

        For authenticated requests, returns ``(user, None)``. For guest
        requests, validates the signed registration token, ensures the
        email is not already taken, and returns ``(None, payload_dict)``.

        Returns:
            tuple(error_response_or_None, user, registration_payload).
            If the first element is not None it is a DRF Response that the
            caller must return immediately.
        """
        if request.user.is_authenticated:
            return None, request.user, None

        if not registration_token:
            return (
                Response(
                    {'detail': 'El campo registration_token es obligatorio para el checkout de invitado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None, None,
            )

        max_age = int(getattr(settings, 'REGISTRATION_TOKEN_MAX_AGE_SECONDS', 3600))
        try:
            payload = signing.loads(
                registration_token,
                salt=REGISTRATION_TOKEN_SALT,
                max_age=max_age,
            )
        except signing.SignatureExpired:
            return (
                Response(
                    {'detail': 'El registro expiró. Completa el formulario de nuevo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None, None,
            )
        except signing.BadSignature:
            return (
                Response(
                    {'detail': 'El registro es inválido. Intenta nuevamente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None, None,
            )

        required = ('email', 'first_name', 'last_name', 'password_hash')
        if any(not str(payload.get(field, '')).strip() for field in required):
            return (
                Response(
                    {'detail': 'El registro es inválido. Intenta nuevamente.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None, None,
            )

        guest_email = str(payload['email']).strip().lower()
        if User.objects.filter(email=guest_email).exists():
            return (
                Response(
                    {'detail': 'Ya existe una cuenta con este correo. Inicia sesión.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None, None,
            )
        payload['email'] = guest_email
        return None, None, payload

    def _load_pending_intent(self, request, reference, expected_method):
        """Load a PENDING PaymentIntent by reference for authenticated or guest user.

        For guest requests, authenticates via ``public_access_token`` query param.

        Returns:
            tuple(error_response_or_None, intent).
        """
        if request.user.is_authenticated:
            try:
                intent = PaymentIntent.objects.select_related('package', 'customer').get(
                    reference=reference,
                    customer=request.user,
                )
            except PaymentIntent.DoesNotExist:
                return (
                    Response(
                        {'detail': 'No se encontró la intención de pago.'},
                        status=status.HTTP_404_NOT_FOUND,
                    ),
                    None,
                )
        else:
            access_token = str(
                request.data.get('access_token') or request.query_params.get('access_token', '')
            ).strip()
            if not access_token:
                return (
                    Response(
                        {'detail': 'No se proporcionaron credenciales de autenticación.'},
                        status=status.HTTP_401_UNAUTHORIZED,
                    ),
                    None,
                )
            try:
                intent = PaymentIntent.objects.select_related('package', 'customer').get(
                    reference=reference,
                    public_access_token=access_token,
                )
            except PaymentIntent.DoesNotExist:
                return (
                    Response(
                        {'detail': 'No se encontró la intención de pago.'},
                        status=status.HTTP_404_NOT_FOUND,
                    ),
                    None,
                )

        if intent.status != PaymentIntent.Status.PENDING:
            return (
                Response(
                    {'detail': 'La intención de pago ya fue resuelta.'},
                    status=status.HTTP_409_CONFLICT,
                ),
                None,
            )

        if expected_method and intent.payment_method_type != expected_method:
            return (
                Response(
                    {'detail': 'El método de pago no coincide con esta intención.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None,
            )

        return None, intent

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

        This returns the FULL scope (every term) so that retrieve / patch /
        renew / delete can resolve any subscription id. The ``list`` action
        collapses this to one canonical membership per customer for display.
        """
        qs = Subscription.objects.select_related('customer', 'package').all()
        if is_admin_user(self.request.user):
            search = self.request.query_params.get('search', '').strip()
            status_filter = self.request.query_params.get('status', '').strip()
            category_filter = self.request.query_params.get('category', '').strip()
            if search:
                qs = qs.filter(
                    Q(customer__email__icontains=search)
                    | Q(customer__first_name__icontains=search)
                    | Q(customer__last_name__icontains=search)
                    | Q(package__title__icontains=search)
                    | Q(guest_link__invited_email__icontains=search)
                )
            if status_filter in Subscription.Status.values:
                qs = qs.filter(status=status_filter)
            if category_filter in {'personalizado', 'semi_personalizado', 'terapeutico'}:
                qs = qs.filter(package__category=category_filter)
            return qs.distinct()
        return qs.filter(
            Q(customer=self.request.user) |
            Q(guest_link__guest=self.request.user, guest_link__status=SubscriptionGuest.STATUS_ACCEPTED)
        ).distinct()

    @staticmethod
    def _canonical_subscription_ids(queryset):
        """Collapse a subscription queryset to one canonical id per customer.

        The canonical row is the active one if present, otherwise the most
        recently created. Past terms remain in the DB and surface via the
        renewal-history timeline. Used by both ``list`` and ``category_counts``
        so the category tab totals match the rows actually shown.
        """
        canonical_ids: dict[int, int] = {}
        best_rank: dict[int, tuple] = {}
        for sub in queryset.order_by('-created_at'):
            rank = (
                1 if sub.status == Subscription.Status.ACTIVE else 0,
                sub.created_at.timestamp(),
            )
            if sub.customer_id not in best_rank or rank > best_rank[sub.customer_id]:
                best_rank[sub.customer_id] = rank
                canonical_ids[sub.customer_id] = sub.id
        return list(canonical_ids.values())

    def list(self, request, *args, **kwargs):
        """List subscriptions collapsed to ONE canonical membership per customer.

        For each customer, the canonical row is the active one if present,
        otherwise the most recently created. Past terms remain in the DB and
        surface via the renewal-history timeline. For a customer viewing their
        own page, this naturally keeps one own membership plus any guest
        subscription (the guest row belongs to a different customer_id).
        """
        queryset = self.get_queryset()
        canonical_ids = self._canonical_subscription_ids(queryset)
        canonical_qs = (
            Subscription.objects
            .select_related('customer', 'package')
            .filter(id__in=canonical_ids)
            .order_by('-created_at')
        )
        page = self.paginate_queryset(canonical_qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(canonical_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='category-counts')
    def category_counts(self, request):
        """Return canonical-membership counts per package category (admin only).

        Lets the admin subscriptions screen show real totals on the category
        tabs upfront, instead of only the count for the active filter. Counts
        the SAME canonical membership the collapsed list shows (one per
        customer), so the tab totals match the rows actually displayed.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        counts = {'semi_personalizado': 0, 'personalizado': 0, 'terapeutico': 0}
        canonical_ids = self._canonical_subscription_ids(
            Subscription.objects.select_related('package').all()
        )
        rows = (
            Subscription.objects
            .filter(id__in=canonical_ids)
            .values('package__category')
            .annotate(total=Count('id'))
        )
        for row in rows:
            category = row['package__category']
            if category in counts:
                counts[category] = row['total']
        return Response(counts)

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
            payment_method_type='CARD',
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
            payment_method_type=payment_method,
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

    @action(detail=False, methods=['post'], url_path='nequi/start')
    def nequi_start(self, request):
        """Start a NEQUI recurring subscription purchase.

        Calls Wompi ``POST /tokens/nequi`` with the customer's phone number.
        The customer must approve the subscription from their Nequi app
        before calling :func:`nequi_confirm`.

        Returns:
            Response: PaymentIntent data with the Nequi token id and
            ``status='PENDING_USER_APPROVAL'`` for the frontend.
        """
        serializer = SubscriptionNequiStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        package = serializer.validated_data['package_id']
        phone_number = serializer.validated_data['phone_number'].strip()
        registration_token = serializer.validated_data.get('registration_token', '')

        error_resp, user, registration_payload = self._resolve_user_and_registration_payload(
            request, registration_token,
        )
        if error_resp is not None:
            return error_resp

        try:
            token_id = create_nequi_token(phone_number)
        except WompiError as exc:
            logger.error('Nequi token creation failed: %s', exc)
            return Response(
                {'detail': 'No se pudo iniciar el pago con Nequi. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        reference = generate_reference()
        intent = PaymentIntent.objects.create(
            customer=user,
            package=package,
            reference=reference,
            wompi_transaction_id='',
            payment_source_id='',
            payment_method_type='NEQUI',
            wompi_nequi_token_id=str(token_id),
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
        response_data['nequi_token_id'] = str(token_id)
        response_data['await_user_approval'] = True
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='nequi/confirm')
    def nequi_confirm(self, request):
        """Confirm a NEQUI subscription after the customer approves the token.

        Polls Wompi ``/tokens/nequi/{id}`` until APPROVED, creates the
        payment source (recurring fuente de pago) and issues the initial
        transaction with ``recurrent=True``.
        """
        serializer = SubscriptionTokenizedConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reference = serializer.validated_data['reference']

        error_resp, intent = self._load_pending_intent(request, reference, expected_method='NEQUI')
        if error_resp is not None:
            return error_resp

        if not intent.wompi_nequi_token_id:
            return Response(
                {'detail': 'Esta intención de pago no tiene un token Nequi asociado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_email = intent.customer.email if intent.customer else intent.pending_email

        try:
            poll_nequi_token_until_approved(intent.wompi_nequi_token_id)
        except WompiError as exc:
            logger.warning('Nequi token %s not approved: %s', intent.wompi_nequi_token_id, exc)
            intent.status = PaymentIntent.Status.FAILED
            intent.pending_password_hash = ''
            intent.save(update_fields=['status', 'pending_password_hash', 'updated_at'])
            return Response(
                {'detail': 'No se aprobó el pago en Nequi. Vuelve a intentar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment_source_id = create_payment_source(
                token=intent.wompi_nequi_token_id,
                customer_email=customer_email,
                source_type='NEQUI',
            )
        except WompiError as exc:
            logger.error('Nequi payment source creation failed: %s', exc)
            return Response(
                {'detail': 'No se pudo guardar el método de pago. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            txn = create_transaction(
                amount_in_cents=int(intent.amount * 100),
                currency=intent.currency,
                customer_email=customer_email,
                reference=intent.reference,
                payment_source_id=payment_source_id,
                recurrent=True,
            )
        except WompiError as exc:
            logger.error('Nequi initial transaction failed: %s', exc)
            return Response(
                {'detail': 'Falló el cobro inicial. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        intent.payment_source_id = str(payment_source_id)
        intent.wompi_transaction_id = str(txn.get('id', ''))
        intent.save(update_fields=[
            'payment_source_id', 'wompi_transaction_id', 'updated_at',
        ])

        return Response(PaymentIntentStatusSerializer(intent).data)

    @action(detail=False, methods=['post'], url_path='bancolombia/start')
    def bancolombia_start(self, request):
        """Start a BANCOLOMBIA_TRANSFER recurring subscription purchase.

        Calls Wompi ``POST /tokens/bancolombia_transfer`` with ``type_auth='TOKEN'``
        to obtain an ``authorization_url`` the customer must visit to log
        into Bancolombia and authorize the recurring debit. Afterwards the
        frontend calls :func:`bancolombia_confirm`.
        """
        serializer = SubscriptionBancolombiaStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        package = serializer.validated_data['package_id']
        redirect_url = serializer.validated_data['redirect_url']
        registration_token = serializer.validated_data.get('registration_token', '')

        error_resp, user, registration_payload = self._resolve_user_and_registration_payload(
            request, registration_token,
        )
        if error_resp is not None:
            return error_resp

        try:
            token_data = create_bancolombia_transfer_token(
                redirect_url=redirect_url, type_auth='TOKEN',
            )
        except WompiError as exc:
            logger.error('Bancolombia token creation failed: %s', exc)
            return Response(
                {'detail': 'No se pudo iniciar el pago con Bancolombia. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        reference = generate_reference()
        intent = PaymentIntent.objects.create(
            customer=user,
            package=package,
            reference=reference,
            wompi_transaction_id='',
            payment_source_id='',
            payment_method_type='BANCOLOMBIA_TRANSFER',
            wompi_bancolombia_token_id=str(token_data['token_id']),
            wompi_authorization_url=token_data.get('authorization_url') or '',
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
        response_data['authorization_url'] = token_data.get('authorization_url') or ''
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='bancolombia/confirm')
    def bancolombia_confirm(self, request):
        """Confirm a BANCOLOMBIA_TRANSFER subscription after authorization.

        Called by the frontend after Bancolombia redirects the customer back.
        Polls the token until APPROVED, creates the payment source and the
        recurring initial transaction.
        """
        serializer = SubscriptionTokenizedConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reference = serializer.validated_data['reference']

        error_resp, intent = self._load_pending_intent(
            request, reference, expected_method='BANCOLOMBIA_TRANSFER',
        )
        if error_resp is not None:
            return error_resp

        if not intent.wompi_bancolombia_token_id:
            return Response(
                {'detail': 'Esta intención de pago no tiene un token Bancolombia asociado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_email = intent.customer.email if intent.customer else intent.pending_email

        try:
            poll_bancolombia_token_until_approved(intent.wompi_bancolombia_token_id)
        except WompiError as exc:
            logger.warning(
                'Bancolombia token %s not approved: %s',
                intent.wompi_bancolombia_token_id, exc,
            )
            intent.status = PaymentIntent.Status.FAILED
            intent.pending_password_hash = ''
            intent.save(update_fields=['status', 'pending_password_hash', 'updated_at'])
            return Response(
                {'detail': 'No se autorizó la suscripción en Bancolombia. Vuelve a intentar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment_source_id = create_payment_source(
                token=intent.wompi_bancolombia_token_id,
                customer_email=customer_email,
                source_type='BANCOLOMBIA_TRANSFER',
                extra_fields={
                    'payment_description': f'Suscripción KÓRE - {intent.package.title}',
                },
            )
        except WompiError as exc:
            logger.error('Bancolombia payment source creation failed: %s', exc)
            return Response(
                {'detail': 'No se pudo guardar el método de pago. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            txn = create_transaction(
                amount_in_cents=int(intent.amount * 100),
                currency=intent.currency,
                customer_email=customer_email,
                reference=intent.reference,
                payment_source_id=payment_source_id,
                recurrent=True,
            )
        except WompiError as exc:
            logger.error('Bancolombia initial transaction failed: %s', exc)
            return Response(
                {'detail': 'Falló el cobro inicial. Intenta de nuevo.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        intent.payment_source_id = str(payment_source_id)
        intent.wompi_transaction_id = str(txn.get('id', ''))
        intent.save(update_fields=[
            'payment_source_id', 'wompi_transaction_id', 'updated_at',
        ])

        return Response(PaymentIntentStatusSerializer(intent).data)

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
        """Manually renew a subscription in place as a cash payment. Admin-only.

        Extends the SAME subscription (no new row is created): reactivates it,
        pushes ``expires_at`` by the package validity, rolls over remaining
        sessions, records a CASH ``Payment`` and a ``SubscriptionRenewal``
        history row. Only allowed when the subscription is expired or canceled.
        Returns 403 for non-admin callers, 400 if the sub is still active.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        sub = self.get_object()
        if sub.status not in (
            Subscription.Status.EXPIRED,
            Subscription.Status.CANCELED,
        ):
            return Response(
                {'detail': 'Sólo se puede renovar una suscripción expirada o cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        package = sub.package
        now = timezone.now()
        period_end = now + timedelta(days=package.validity_days)
        leftover = max(sub.sessions_total - sub.sessions_used, 0)
        rollover = min(leftover, MAX_ROLLOVER_SESSIONS)

        with transaction.atomic():
            payment = Payment.objects.create(
                subscription=sub,
                customer=sub.customer,
                status=Payment.Status.CONFIRMED,
                amount=package.price,
                currency=package.currency,
                provider=Payment.Provider.CASH,
                confirmed_at=now,
                metadata={'renewed_by_admin': request.user.email},
            )

            sub.status = Subscription.Status.ACTIVE
            sub.starts_at = now
            sub.expires_at = period_end
            sub.sessions_total = package.sessions_count + rollover
            sub.sessions_used = 0
            sub.billing_failed_at = None
            sub.save(update_fields=[
                'status', 'starts_at', 'expires_at',
                'sessions_total', 'sessions_used', 'billing_failed_at', 'updated_at',
            ])

            record_renewal(
                subscription=sub,
                kind=SubscriptionRenewal.Kind.MANUAL,
                period_start=now,
                period_end=period_end,
                sessions_granted=sub.sessions_total,
                package=package,
                payment=payment,
                actor_email=request.user.email,
            )

        return Response(
            self.get_serializer(sub, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['delete'], url_path='admin-delete')
    def admin_delete(self, request, pk=None):
        """Permanently delete a subscription. Admin-only.

        Intended to undo a subscription created by mistake so a correct one
        can be created. The subscription's ``Payment`` records and guest link
        (if any) are removed too; related ``Booking`` rows survive but lose
        their subscription link (the FK is ``SET_NULL``). Returns 403 for
        non-admin callers, 409 if some other protected relation blocks it.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        sub = self.get_object()
        try:
            with transaction.atomic():
                SubscriptionGuest.objects.filter(subscription=sub).delete()
                Payment.objects.filter(subscription=sub).delete()
                sub.delete()
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar: la suscripción tiene registros vinculados que lo impiden.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='admin-create')
    def admin_create(self, request):
        """Create a new subscription or evolve an active one. Admin-only.

        Two sub-flows driven by the ``action`` field of the payload:

        - ``action="create"`` requires the customer to have zero active
          subscriptions. Builds a brand new Subscription and Payment.
        - ``action="evolve"`` requires exactly one active subscription and a
          strictly larger ``new_package`` (price AND sessions_count). The
          existing subscription is mutated in place; only the delta is
          recorded as a new Payment.

        Returns 409 when ``action`` mismatches the customer's actual state so
        the frontend can swap modes without losing the form.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        payload = request.data or {}
        requested_action = str(payload.get('action', '')).strip().lower()
        if requested_action not in {'create', 'evolve'}:
            return Response(
                {'detail': 'action must be "create" or "evolve".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_id = payload.get('customer_id')
        package_id = payload.get('package_id')
        payment_method = str(payload.get('payment_method', '')).strip().lower()
        notes = str(payload.get('notes', '')).strip()

        if payment_method not in {p.value for p in ALLOWED_OFFLINE_METHODS}:
            return Response(
                {'detail': 'payment_method must be "cash" or "transfer".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            customer = User.objects.get(pk=customer_id, role=User.Role.CUSTOMER, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {'detail': 'customer_id is invalid or the user is not an active customer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            package = Package.objects.get(pk=package_id, is_active=True)
        except (Package.DoesNotExist, ValueError, TypeError):
            return Response(
                {'detail': 'package_id is invalid or the package is inactive.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_subs = list(
            Subscription.objects.filter(
                customer=customer,
                status=Subscription.Status.ACTIVE,
            )
        )

        if requested_action == 'create':
            if active_subs:
                return Response(
                    {
                        'detail': 'Customer already has an active subscription. Use action=evolve.',
                        'expected_action': 'evolve',
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            starts_at = payload.get('starts_at')
            expires_at = payload.get('expires_at')
            if not starts_at or not expires_at:
                return Response(
                    {'detail': 'starts_at and expires_at are required for action=create.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from django.utils.dateparse import parse_datetime, parse_date

            def _coerce(value):
                if isinstance(value, str):
                    parsed = parse_datetime(value)
                    if parsed is None:
                        date_only = parse_date(value)
                        if date_only is None:
                            return None
                        parsed = timezone.datetime.combine(
                            date_only, timezone.datetime.min.time()
                        )
                    if timezone.is_naive(parsed):
                        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
                    return parsed
                return value

            starts_at = _coerce(starts_at)
            expires_at = _coerce(expires_at)
            if not starts_at or not expires_at or starts_at > expires_at:
                return Response(
                    {'detail': 'starts_at and expires_at must be valid dates with starts_at <= expires_at.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                sessions_used = int(payload.get('sessions_used', 0))
            except (ValueError, TypeError):
                return Response(
                    {'detail': 'sessions_used must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if sessions_used < 0 or sessions_used > package.sessions_count:
                return Response(
                    {'detail': 'sessions_used must be between 0 and the package sessions_count.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            subscription = create_subscription_for_admin(
                customer=customer,
                package=package,
                payment_method=payment_method,
                starts_at=starts_at,
                expires_at=expires_at,
                sessions_used=sessions_used,
                notes=notes,
                actor=request.user,
            )
            return Response(
                AdminSubscriptionSerializer(subscription, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )

        # action == 'evolve'
        if not active_subs:
            return Response(
                {
                    'detail': 'Customer has no active subscription. Use action=create.',
                    'expected_action': 'create',
                },
                status=status.HTTP_409_CONFLICT,
            )
        if len(active_subs) > 1:
            return Response(
                {'detail': 'Customer has multiple active subscriptions; resolve manually.'},
                status=status.HTTP_409_CONFLICT,
            )

        current = active_subs[0]
        if package.pk == current.package_id:
            return Response(
                {'detail': 'New package is the same as the current one. Choose a larger package.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if package.price <= current.package.price:
            return Response(
                {'detail': 'Downgrade blocked: new package price must be greater than the current one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if package.sessions_count <= current.sessions_total:
            return Response(
                {'detail': 'Downgrade blocked: new package must have more sessions than the current one.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subscription = evolve_subscription_for_admin(
            current_subscription=current,
            new_package=package,
            payment_method=payment_method,
            notes=notes,
            actor=request.user,
        )
        return Response(
            AdminSubscriptionSerializer(subscription, context={'request': request}).data,
            status=status.HTTP_200_OK,
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

    @action(detail=True, methods=['get'], url_path='renewal-history')
    def renewal_history(self, request, pk=None):
        """Return the full renewal timeline for the subscription's customer.

        Combines append-only SubscriptionRenewal records with legacy
        subscription rows (those with no records) into one period timeline,
        newest first. Access is gated by ``get_object`` (admins see any;
        customers see their own / accepted guest subscriptions).
        """
        subscription = self.get_object()
        timeline = build_renewal_timeline(subscription.customer)
        serializer = RenewalHistoryItemSerializer(timeline, many=True)
        return Response(serializer.data)
