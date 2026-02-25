"""Tests for Subscription purchase, cancel, and payment history actions."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth.hashers import make_password
from django.core import signing
from django.test import override_settings
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Payment, PaymentIntent, Subscription, User

REGISTRATION_TOKEN_SALT = 'kore-pre-register-v1'


@pytest.fixture
def package(db):
    """Return an active package fixture used by subscription purchase tests."""
    return Package.objects.create(
        title='Test Program',
        sessions_count=10,
        price=Decimal('300000.00'),
        currency='COP',
        validity_days=30,
        is_active=True,
    )


@pytest.fixture
def active_subscription(existing_user, package):
    """Return an active recurring subscription for cancellation and history tests."""
    now = timezone.now()
    return Subscription.objects.create(
        customer=existing_user,
        package=package,
        sessions_total=10,
        sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=30),
        payment_source_id='ps-123',
        next_billing_date=(now + timedelta(days=30)).date(),
    )


@pytest.mark.django_db
class TestSubscriptionPurchase:
    """Covers authenticated and guest subscription purchase endpoint behavior."""

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_creates_pending_intent_response(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
        """Returns pending intent payload when Wompi transaction is pending."""
        mock_create_source.return_value = 9999
        mock_create_txn.return_value = {'id': 'txn-001', 'status': 'PENDING'}

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_abc123',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'pending'
        assert 'reference' in response.data
        assert response.data['wompi_transaction_id'] == 'txn-001'
        assert response.data['package_title'] == package.title

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_persists_pending_intent_fields(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
        """Persists payment source, transaction id, and pending status on intent."""
        mock_create_source.return_value = 9999
        mock_create_txn.return_value = {'id': 'txn-001', 'status': 'PENDING'}

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_abc123',
        }, format='json')

        assert PaymentIntent.objects.filter(customer=existing_user).count() == 1
        intent = PaymentIntent.objects.get(customer=existing_user)
        assert intent.payment_source_id == '9999'
        assert intent.wompi_transaction_id == 'txn-001'
        assert intent.status == PaymentIntent.Status.PENDING
        assert intent.amount == Decimal('300000.00')

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_pending_intent_does_not_create_subscription_or_payment(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
        """Pending purchase does not create subscription or payment records yet."""
        mock_create_source.return_value = 9999
        mock_create_txn.return_value = {'id': 'txn-001', 'status': 'PENDING'}

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_abc123',
        }, format='json')

        # PaymentIntent created, but NO Subscription or Payment yet
        assert Subscription.objects.filter(customer=existing_user).count() == 0
        assert Payment.objects.count() == 0

        create_txn_kwargs = mock_create_txn.call_args.kwargs
        assert create_txn_kwargs['installments'] == 1

    def test_guest_purchase_requires_registration_token(self, api_client, package):
        """Guest purchase requests are rejected when registration_token is missing."""
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_abc',
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'registration_token' in response.data['detail']

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_guest_purchase_creates_intent_without_customer(
        self, mock_create_source, mock_create_txn, api_client, package
    ):
        """Guest purchase creates anonymous intent with public checkout access token."""
        mock_create_source.return_value = 3333
        mock_create_txn.return_value = {'id': 'txn-guest-001', 'status': 'PENDING'}

        registration_token = signing.dumps(
            {
                'email': 'guest_checkout@example.com',
                'first_name': 'Guest',
                'last_name': 'Checkout',
                'phone': '3001112233',
                'password_hash': make_password('guest-password-123'),
            },
            salt=REGISTRATION_TOKEN_SALT,
        )

        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_guest',
            'registration_token': registration_token,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'pending'
        assert response.data['checkout_access_token']

        intent = PaymentIntent.objects.get(reference=response.data['reference'])
        assert intent.customer is None
        assert intent.pending_email == 'guest_checkout@example.com'
        assert intent.public_access_token == response.data['checkout_access_token']

    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_returns_502_on_wompi_source_error(
        self, mock_create_source, api_client, existing_user, package
    ):
        """Purchase returns 502 when payment source creation fails at provider."""
        from core_app.services.wompi_service import WompiError
        mock_create_source.side_effect = WompiError('source fail')

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_fail',
        }, format='json')
        assert response.status_code == status.HTTP_502_BAD_GATEWAY


@pytest.mark.django_db
class TestSubscriptionPurchaseAlternative:
    def test_guest_purchase_alternative_requires_registration_token(self, api_client, package):
        url = reverse('subscription-purchase-alternative')
        response = api_client.post(url, {
            'package_id': package.id,
            'payment_method': 'NEQUI',
            'phone_number': '3107654321',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'registration_token' in response.data['detail']

    @patch('core_app.views.subscription_views.create_transaction_with_payment_method')
    def test_nequi_purchase_creates_pending_intent(
        self, mock_create_txn, api_client, existing_user, package
    ):
        mock_create_txn.return_value = {
            'id': 'txn-nequi-001',
            'status': 'PENDING',
        }

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase-alternative')
        response = api_client.post(url, {
            'package_id': package.id,
            'payment_method': 'NEQUI',
            'phone_number': '3107654321',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'pending'
        assert response.data['redirect_url'] is None
        assert response.data['wompi_transaction_id'] == 'txn-nequi-001'

        intent = PaymentIntent.objects.get(reference=response.data['reference'])
        assert intent.customer == existing_user
        assert intent.payment_source_id == ''

        create_txn_kwargs = mock_create_txn.call_args.kwargs
        assert create_txn_kwargs['payment_method']['type'] == 'NEQUI'
        assert create_txn_kwargs['payment_method']['phone_number'] == '3107654321'

    @patch('core_app.views.subscription_views.create_transaction_with_payment_method')
    def test_pse_purchase_returns_redirect_url_from_transaction(
        self, mock_create_txn, api_client, existing_user, package
    ):
        mock_create_txn.return_value = {
            'id': 'txn-pse-001',
            'status': 'PENDING',
            'payment_method': {
                'extra': {
                    'async_payment_url': 'https://payments.wompi.test/pse-redirect',
                },
            },
        }

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase-alternative')
        response = api_client.post(url, {
            'package_id': package.id,
            'payment_method': 'PSE',
            'pse_data': {
                'financial_institution_code': '1007',
                'user_type': 0,
                'user_legal_id_type': 'CC',
                'user_legal_id': '1234567890',
                'full_name': 'Juan Perez',
                'phone_number': '573107654321',
            },
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['redirect_url'] == 'https://payments.wompi.test/pse-redirect'

    @patch('core_app.views.subscription_views.time.sleep', return_value=None)
    @patch('core_app.views.subscription_views.get_transaction_by_id')
    @patch('core_app.views.subscription_views.create_transaction_with_payment_method')
    def test_bancolombia_purchase_polls_shortly_for_redirect_url(
        self,
        mock_create_txn,
        mock_get_transaction,
        mock_sleep,
        api_client,
        existing_user,
        package,
    ):
        mock_create_txn.return_value = {
            'id': 'txn-bancolombia-001',
            'status': 'PENDING',
        }
        mock_get_transaction.side_effect = [
            {'id': 'txn-bancolombia-001', 'payment_method': {'extra': {}}},
            {
                'id': 'txn-bancolombia-001',
                'payment_method': {
                    'extra': {
                        'async_payment_url': 'https://payments.wompi.test/bancolombia-redirect',
                    },
                },
            },
        ]

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase-alternative')
        response = api_client.post(url, {
            'package_id': package.id,
            'payment_method': 'BANCOLOMBIA_TRANSFER',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['redirect_url'] == 'https://payments.wompi.test/bancolombia-redirect'
        assert mock_get_transaction.call_count >= 2

    @patch('core_app.views.subscription_views.create_transaction_with_payment_method')
    def test_purchase_alternative_returns_502_on_wompi_error(
        self, mock_create_txn, api_client, existing_user, package
    ):
        from core_app.services.wompi_service import WompiError

        mock_create_txn.side_effect = WompiError('alt fail')

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase-alternative')
        response = api_client.post(url, {
            'package_id': package.id,
            'payment_method': 'NEQUI',
            'phone_number': '3107654321',
        }, format='json')

        assert response.status_code == status.HTTP_502_BAD_GATEWAY


@pytest.mark.django_db
class TestSubscriptionPurchaseValidation:

    def test_purchase_rejects_expired_registration_token(self, api_client, package):
        """Expired registration tokens are rejected before purchase intent creation."""
        with patch(
            'core_app.views.subscription_views.signing.loads',
            side_effect=signing.SignatureExpired('expired'),
        ):
            url = reverse('subscription-purchase')
            response = api_client.post(url, {
                'package_id': package.id,
                'card_token': 'tok_test_expired',
                'registration_token': 'bad-token',
            }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'expiró' in response.data['detail']

    def test_purchase_rejects_invalid_registration_token(self, api_client, package):
        """Malformed registration tokens are rejected with a 400 response."""
        with patch(
            'core_app.views.subscription_views.signing.loads',
            side_effect=signing.BadSignature('bad'),
        ):
            url = reverse('subscription-purchase')
            response = api_client.post(url, {
                'package_id': package.id,
                'card_token': 'tok_test_bad',
                'registration_token': 'bad-token',
            }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    def test_purchase_rejects_registration_payload_missing_fields(self, api_client, package):
        """Registration tokens missing required fields are rejected."""
        with patch('core_app.views.subscription_views.signing.loads', return_value={'email': 'a@b.com'}):
            url = reverse('subscription-purchase')
            response = api_client.post(url, {
                'package_id': package.id,
                'card_token': 'tok_test_missing',
                'registration_token': 'missing-fields-token',
            }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    def test_purchase_rejects_existing_guest_email(self, api_client, existing_user, package):
        """Rejects guest purchase when registration token email already exists."""
        registration_token = signing.dumps(
            {
                'email': existing_user.email,
                'first_name': 'Guest',
                'last_name': 'Existing',
                'password_hash': make_password('guest-pass'),
            },
            salt=REGISTRATION_TOKEN_SALT,
        )

        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_existing',
            'registration_token': registration_token,
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Ya existe una cuenta' in response.data['detail']

    def test_purchase_rejects_installments_different_than_one(self, api_client, existing_user, package):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_installments',
            'installments': 2,
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'installments' in response.data

    @override_settings(DEBUG=True)
    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_does_not_auto_approve_in_debug(
        self,
        mock_create_source,
        mock_create_txn,
        api_client,
        existing_user,
        package,
    ):
        """Debug mode still keeps purchase intent pending and side-effect free."""
        mock_create_source.return_value = 2222
        mock_create_txn.return_value = {'id': 'txn-debug-001', 'status': 'PENDING'}

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_debug',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'pending'

        intent = PaymentIntent.objects.get(reference=response.data['reference'])
        assert intent.status == PaymentIntent.Status.PENDING
        assert Subscription.objects.filter(customer=existing_user).count() == 0
        assert Payment.objects.filter(customer=existing_user).count() == 0

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_returns_502_on_wompi_txn_error(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
        """Purchase returns 502 when transaction creation fails at provider."""
        from core_app.services.wompi_service import WompiError
        mock_create_source.return_value = 9999
        mock_create_txn.side_effect = WompiError('txn fail')

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_fail',
        }, format='json')
        assert response.status_code == status.HTTP_502_BAD_GATEWAY


@pytest.mark.django_db
class TestSubscriptionPrepareCheckout:
    """Covers checkout-preparation behavior for guest and authenticated users."""

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_requires_registration_token_for_guest(self, api_client, package):
        """Guest checkout preparation requires a valid registration token."""
        url = reverse('subscription-prepare-checkout')
        response = api_client.post(url, {'package_id': package.id}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'registration_token' in response.data['detail']

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_rejects_expired_registration_token(self, api_client, package):
        """Expired registration tokens are rejected during checkout preparation."""
        with patch(
            'core_app.views.subscription_views.signing.loads',
            side_effect=signing.SignatureExpired('expired'),
        ):
            url = reverse('subscription-prepare-checkout')
            response = api_client.post(url, {
                'package_id': package.id,
                'registration_token': 'expired-token',
            }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'expiró' in response.data['detail']

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_rejects_invalid_registration_token(self, api_client, package):
        """Invalid token signatures are rejected during checkout preparation."""
        with patch(
            'core_app.views.subscription_views.signing.loads',
            side_effect=signing.BadSignature('bad'),
        ):
            url = reverse('subscription-prepare-checkout')
            response = api_client.post(url, {
                'package_id': package.id,
                'registration_token': 'bad-token',
            }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_rejects_missing_registration_fields(self, api_client, package):
        """Checkout preparation rejects tokens missing required registration fields."""
        with patch('core_app.views.subscription_views.signing.loads', return_value={'email': 'guest@kore.com'}):
            url = reverse('subscription-prepare-checkout')
            response = api_client.post(url, {
                'package_id': package.id,
                'registration_token': 'missing-fields',
            }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_rejects_existing_email(self, api_client, existing_user, package):
        """Guest checkout preparation rejects emails already tied to users."""
        registration_token = signing.dumps(
            {
                'email': existing_user.email,
                'first_name': 'Guest',
                'last_name': 'Existing',
                'password_hash': make_password('guest-pass'),
            },
            salt=REGISTRATION_TOKEN_SALT,
        )

        url = reverse('subscription-prepare-checkout')
        response = api_client.post(url, {
            'package_id': package.id,
            'registration_token': registration_token,
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Ya existe una cuenta' in response.data['detail']

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_returns_access_token_for_guest(self, api_client, package):
        """Guest checkout preparation returns public access token and pending fields."""
        registration_token = signing.dumps(
            {
                'email': 'guest@kore.com',
                'first_name': 'Guest',
                'last_name': 'Checkout',
                'phone': '3000000000',
                'password_hash': make_password('guest-pass'),
            },
            salt=REGISTRATION_TOKEN_SALT,
        )

        url = reverse('subscription-prepare-checkout')
        response = api_client.post(url, {
            'package_id': package.id,
            'registration_token': registration_token,
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['checkout_access_token']

        intent = PaymentIntent.objects.get(reference=response.data['reference'])
        assert intent.customer is None
        assert intent.pending_email == 'guest@kore.com'
        assert intent.pending_first_name == 'Guest'

    @override_settings(WOMPI_INTEGRITY_KEY='test_integrity_key')
    def test_prepare_checkout_authenticated_does_not_include_access_token(self, api_client, existing_user, package):
        """Authenticated checkout preparation omits guest-only access tokens."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-prepare-checkout')
        response = api_client.post(url, {'package_id': package.id}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert 'checkout_access_token' not in response.data

        intent = PaymentIntent.objects.get(reference=response.data['reference'])
        assert intent.customer == existing_user


@pytest.mark.django_db
class TestIntentStatusEndpoint:
    """Validates subscription intent status visibility and lifecycle responses."""

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_intent_status_returns_pending(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
        """Intent status endpoint returns pending for newly created pending intents."""
        mock_create_source.return_value = 9999
        mock_create_txn.return_value = {'id': 'txn-status-001', 'status': 'PENDING'}

        api_client.force_authenticate(user=existing_user)
        # Create intent via purchase
        purchase_url = reverse('subscription-purchase')
        resp = api_client.post(purchase_url, {
            'package_id': package.id,
            'card_token': 'tok_test_status',
        }, format='json')
        reference = resp.data['reference']

        # Poll status
        status_url = reverse('subscription-intent-status', args=[reference])
        response = api_client.get(status_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'pending'
        assert response.data['reference'] == reference

    def test_intent_status_not_found(self, api_client, existing_user):
        """Intent status returns 404 when reference does not exist for the user."""
        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=['nonexistent-ref'])
        response = api_client.get(status_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_intent_status_requires_auth(self, api_client):
        """Intent status endpoint requires authentication for protected intents."""
        status_url = reverse('subscription-intent-status', args=['any-ref'])
        response = api_client.get(status_url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_guest_intent_status_visible_with_access_token(self, api_client, package):
        """Guest intent is retrievable when the correct public access token is provided."""
        intent = PaymentIntent.objects.create(
            customer=None,
            package=package,
            reference='ref-guest-status-001',
            wompi_transaction_id='txn-guest-status-001',
            payment_source_id='ps-guest-status-001',
            amount=package.price,
            currency=package.currency,
            pending_email='guest@example.com',
            pending_first_name='Guest',
            pending_last_name='Status',
            pending_password_hash='hashed-pass',
            public_access_token='guest-access-token-123',
            status=PaymentIntent.Status.PENDING,
        )

        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(f'{status_url}?access_token=guest-access-token-123')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['reference'] == intent.reference
        assert response.data['status'] == 'pending'

    def test_guest_intent_status_invalid_access_token_returns_404(self, api_client, package):
        """Guest intent remains hidden when access token is missing or incorrect."""
        intent = PaymentIntent.objects.create(
            customer=None,
            package=package,
            reference='ref-guest-status-002',
            wompi_transaction_id='txn-guest-status-002',
            payment_source_id='ps-guest-status-002',
            amount=package.price,
            currency=package.currency,
            pending_email='guest2@example.com',
            pending_first_name='Guest',
            pending_last_name='Status',
            pending_password_hash='hashed-pass',
            public_access_token='guest-access-token-456',
            status=PaymentIntent.Status.PENDING,
        )

        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(f'{status_url}?access_token=wrong-token')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_guest_intent_status_returns_auto_login_when_approved(self, api_client, existing_user, package):
        """Approved guest intent response includes auto-login payload for linked user."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-guest-status-003',
            wompi_transaction_id='txn-guest-status-003',
            payment_source_id='ps-guest-status-003',
            amount=package.price,
            currency=package.currency,
            public_access_token='guest-access-token-789',
            status=PaymentIntent.Status.APPROVED,
        )

        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(f'{status_url}?access_token=guest-access-token-789')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['reference'] == intent.reference
        assert 'auto_login' in response.data
        assert response.data['auto_login']['user']['email'] == existing_user.email

    @patch('core_app.views.wompi_views.send_payment_receipt')
    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_intent_status_fallback_approved_returns_approved_payload(
        self, mock_get_transaction, mock_send_receipt, api_client, existing_user, package
    ):
        """Fallback transaction lookup returns approved payload when provider confirms approval."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-fallback-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        mock_get_transaction.return_value = {
            'id': 'txn-fallback-001',
            'status': 'APPROVED',
            'payment_source_id': 'ps-fallback-001',
            'payment_method_type': 'CARD',
        }

        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(f'{status_url}?transaction_id=txn-fallback-001')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'approved'
        assert response.data['wompi_transaction_id'] == 'txn-fallback-001'

    @patch('core_app.views.wompi_views.send_payment_receipt')
    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_intent_status_fallback_approved_updates_intent_and_subscription(
        self, mock_get_transaction, mock_send_receipt, api_client, existing_user, package
    ):
        """Fallback approved flow updates intent and creates recurring subscription data."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-fallback-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        mock_get_transaction.return_value = {
            'id': 'txn-fallback-001',
            'status': 'APPROVED',
            'payment_source_id': 'ps-fallback-001',
            'payment_method_type': 'CARD',
        }

        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=[intent.reference])
        api_client.get(f'{status_url}?transaction_id=txn-fallback-001')

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.APPROVED
        assert intent.wompi_transaction_id == 'txn-fallback-001'
        assert intent.payment_source_id == 'ps-fallback-001'

        subscription = Subscription.objects.get(customer=existing_user)
        assert subscription.payment_method_type == 'CARD'
        assert subscription.is_recurring is True
        assert subscription.next_billing_date is not None

    @patch('core_app.views.wompi_views.send_payment_receipt')
    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_intent_status_fallback_approved_creates_payment_and_sends_receipt(
        self, mock_get_transaction, mock_send_receipt, api_client, existing_user, package
    ):
        """Fallback approved flow creates payment record and sends receipt once."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-fallback-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        mock_get_transaction.return_value = {
            'id': 'txn-fallback-001',
            'status': 'APPROVED',
            'payment_source_id': 'ps-fallback-001',
            'payment_method_type': 'CARD',
        }

        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=[intent.reference])
        api_client.get(f'{status_url}?transaction_id=txn-fallback-001')

        subscription = Subscription.objects.get(customer=existing_user)
        payment = Payment.objects.get(subscription=subscription)
        assert payment.provider_reference == 'txn-fallback-001'
        mock_get_transaction.assert_called_once_with('txn-fallback-001')
        mock_send_receipt.assert_called_once_with(payment)

    @patch('core_app.views.wompi_views.send_payment_receipt')
    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_intent_status_fallback_card_no_source_marks_non_recurring(
        self, mock_get_transaction, mock_send_receipt, api_client, existing_user, package
    ):
        """Card approval without payment source marks subscription as non-recurring."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-fallback-nosrc-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        mock_get_transaction.return_value = {
            'id': 'txn-fallback-nosrc-001',
            'status': 'APPROVED',
            'payment_source_id': None,
            'payment_method_type': 'CARD',
        }

        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(f'{status_url}?transaction_id=txn-fallback-nosrc-001')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'approved'

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.APPROVED

        subscription = Subscription.objects.get(customer=existing_user)
        assert subscription.payment_method_type == 'CARD'
        assert subscription.is_recurring is False
        assert subscription.payment_source_id == ''
        assert subscription.next_billing_date is None

    @patch('core_app.views.wompi_views.send_payment_receipt')
    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_intent_status_fallback_card_no_source_creates_payment_and_receipt(
        self, mock_get_transaction, mock_send_receipt, api_client, existing_user, package
    ):
        """Card approval without source still creates payment and sends receipt."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-fallback-nosrc-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        mock_get_transaction.return_value = {
            'id': 'txn-fallback-nosrc-001',
            'status': 'APPROVED',
            'payment_source_id': None,
            'payment_method_type': 'CARD',
        }

        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=[intent.reference])
        api_client.get(f'{status_url}?transaction_id=txn-fallback-nosrc-001')

        subscription = Subscription.objects.get(customer=existing_user)
        payment = Payment.objects.get(subscription=subscription)
        assert payment.provider_reference == 'txn-fallback-nosrc-001'
        mock_get_transaction.assert_called_once_with('txn-fallback-nosrc-001')
        mock_send_receipt.assert_called_once_with(payment)

    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_guest_intent_status_fallback_declined(
        self, mock_get_transaction, api_client, package
    ):
        """Declined guest fallback marks intent failed without creating side effects."""
        intent = PaymentIntent.objects.create(
            customer=None,
            package=package,
            reference='ref-fallback-guest-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            pending_email='guest@example.com',
            public_access_token='guest-access-token-999',
            status=PaymentIntent.Status.PENDING,
        )

        mock_get_transaction.return_value = {
            'id': 'txn-fallback-guest-001',
            'status': 'DECLINED',
            'payment_source_id': '',
            'payment_method_type': 'PSE',
        }

        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(
            f'{status_url}?access_token=guest-access-token-999&transaction_id=txn-fallback-guest-001'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'failed'

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert intent.wompi_transaction_id == 'txn-fallback-guest-001'
        assert Subscription.objects.count() == 0
        assert Payment.objects.count() == 0
        mock_get_transaction.assert_called_once_with('txn-fallback-guest-001')

    def test_fallback_resolution_returns_early_when_intent_is_not_pending(self, existing_user, package):
        """Fallback helper exits immediately when intent status is not pending."""
        from core_app.views.subscription_views import _attempt_wompi_fallback_resolution

        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-helper-early-exit-001',
            wompi_transaction_id='txn-helper-early-exit-001',
            payment_source_id='ps-helper-early-exit-001',
            amount=package.price,
            currency=package.currency,
            status=PaymentIntent.Status.APPROVED,
        )

        with patch('core_app.views.subscription_views.get_transaction_by_id') as mock_get_transaction:
            _attempt_wompi_fallback_resolution(intent)

        mock_get_transaction.assert_not_called()
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.APPROVED

    @patch('core_app.views.subscription_views.get_transaction_by_id')
    def test_intent_status_fallback_unsupported_method_marks_intent_failed(
        self, mock_get_transaction, api_client, existing_user, package
    ):
        """Fallback poll marks intent failed when provider reports unsupported method type."""
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=package,
            reference='ref-fallback-unsupported-001',
            wompi_transaction_id='txn-fallback-unsupported-001',
            payment_source_id='',
            amount=package.price,
            currency=package.currency,
            pending_password_hash='temporary-hash',
            status=PaymentIntent.Status.PENDING,
        )
        mock_get_transaction.return_value = {
            'id': 'txn-fallback-unsupported-001',
            'status': 'APPROVED',
            'payment_source_id': 'ps-fallback-unsupported-001',
            'payment_method_type': 'UNSUPPORTED_METHOD',
        }

        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=[intent.reference])
        response = api_client.get(status_url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'failed'

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert intent.pending_password_hash == ''
        assert Subscription.objects.filter(customer=existing_user).count() == 0
        assert Payment.objects.count() == 0

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_intent_status_only_visible_to_owner(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
        """Intent status endpoint hides intents from authenticated non-owners."""
        mock_create_source.return_value = 9999
        mock_create_txn.return_value = {'id': 'txn-owner-001', 'status': 'PENDING'}

        api_client.force_authenticate(user=existing_user)
        purchase_url = reverse('subscription-purchase')
        resp = api_client.post(purchase_url, {
            'package_id': package.id,
            'card_token': 'tok_test_owner',
        }, format='json')
        reference = resp.data['reference']

        # Different user should not see it
        other_user = User.objects.create_user(
            email='other_intent@example.com', password='p',
            first_name='Other', last_name='User', role=User.Role.CUSTOMER,
        )
        api_client.force_authenticate(user=other_user)
        status_url = reverse('subscription-intent-status', args=[reference])
        response = api_client.get(status_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestSubscriptionCancel:
    """Covers cancellation outcomes for active and inactive subscriptions."""

    def test_cancel_active_subscription(self, api_client, existing_user, active_subscription):
        """Cancel endpoint marks active subscriptions as canceled and clears next billing."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-cancel-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'canceled'

        active_subscription.refresh_from_db()
        assert active_subscription.status == Subscription.Status.CANCELED
        assert active_subscription.next_billing_date is None

    def test_cancel_inactive_subscription_returns_400(self, api_client, existing_user, active_subscription):
        """Cancel endpoint rejects subscriptions that are no longer active."""
        active_subscription.status = Subscription.Status.EXPIRED
        active_subscription.save(update_fields=['status'])

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-cancel-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cancel_already_canceled_returns_400(self, api_client, existing_user, active_subscription):
        """Cancel endpoint returns 400 when subscription is already canceled."""
        active_subscription.status = Subscription.Status.CANCELED
        active_subscription.save()

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-cancel-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSubscriptionRouting:
    """Ensures legacy pause/resume routes remain unregistered."""

    def test_pause_endpoint_is_not_registered(self, active_subscription):
        """Pause endpoint reverse lookup fails because route is intentionally absent."""
        with pytest.raises(NoReverseMatch) as exc_info:
            reverse('subscription-pause-subscription', args=[active_subscription.id])
        assert 'subscription-pause-subscription' in str(exc_info.value)

    def test_resume_endpoint_is_not_registered(self, active_subscription):
        """Resume endpoint reverse lookup fails because route is intentionally absent."""
        with pytest.raises(NoReverseMatch) as exc_info:
            reverse('subscription-resume-subscription', args=[active_subscription.id])
        assert 'subscription-resume-subscription' in str(exc_info.value)


@pytest.mark.django_db
class TestSubscriptionPaymentHistory:
    """Covers payment history retrieval and authentication requirements."""

    def test_returns_payments_for_subscription(self, api_client, existing_user, active_subscription):
        """Returns all payment entries associated to the requested subscription."""
        Payment.objects.create(
            customer=existing_user,
            subscription=active_subscription,
            amount=Decimal('300000.00'),
            provider=Payment.Provider.WOMPI,
            status=Payment.Status.CONFIRMED,
        )
        Payment.objects.create(
            customer=existing_user,
            subscription=active_subscription,
            amount=Decimal('300000.00'),
            provider=Payment.Provider.WOMPI,
            status=Payment.Status.PENDING,
        )

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-payment-history', args=[active_subscription.id])
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_payment_history_requires_auth(self, api_client, active_subscription):
        """Payment history endpoint denies unauthenticated access."""
        url = reverse('subscription-payment-history', args=[active_subscription.id])
        response = api_client.get(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


@pytest.mark.django_db
class TestExpiryReminder:
    """Tests for GET /api/subscriptions/expiry-reminder/."""

    @pytest.fixture
    def non_recurring_expiring_subscription(self, existing_user, package):
        """Return a non-recurring active subscription nearing expiration."""
        now = timezone.now()
        return Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=25),
            expires_at=now + timedelta(days=5),
            is_recurring=False,
            payment_method_type='NEQUI',
        )

    @pytest.fixture
    def reference_now(self):
        """Provide a shared reference timestamp for expiry reminder scenarios."""
        return timezone.now()

    def test_returns_expiring_non_recurring_subscription(
        self, api_client, existing_user, non_recurring_expiring_subscription
    ):
        """Reminder endpoint returns the eligible non-recurring expiring subscription."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == non_recurring_expiring_subscription.id

    def test_returns_204_when_no_expiring_subscription(self, api_client, existing_user):
        """Reminder endpoint returns 204 when no subscription matches reminder criteria."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert response.content == b''

    def test_ignores_recurring_subscription(self, api_client, existing_user, package, reference_now):
        """Expiry reminder ignores recurring subscriptions even when close to expiry."""
        Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            status=Subscription.Status.ACTIVE,
            starts_at=reference_now - timedelta(days=25),
            expires_at=reference_now + timedelta(days=5),
            is_recurring=True,
            payment_method_type='CARD',
            payment_source_id='ps-123',
        )
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_ignores_subscription_expiring_beyond_7_days(self, api_client, existing_user, package, reference_now):
        """Expiry reminder ignores non-recurring subscriptions expiring after seven days."""
        Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            status=Subscription.Status.ACTIVE,
            starts_at=reference_now - timedelta(days=10),
            expires_at=reference_now + timedelta(days=10),
            is_recurring=False,
            payment_method_type='PSE',
        )
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_ignores_already_ui_acknowledged_subscription(
        self, api_client, existing_user, non_recurring_expiring_subscription
    ):
        """Reminder endpoint skips subscriptions already acknowledged in UI."""
        non_recurring_expiring_subscription.expiry_ui_sent_at = (
            non_recurring_expiring_subscription.expires_at - timedelta(days=1)
        )
        non_recurring_expiring_subscription.save(update_fields=['expiry_ui_sent_at'])

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_ignores_already_email_sent_subscription(
        self, api_client, existing_user, non_recurring_expiring_subscription
    ):
        """Reminder endpoint skips subscriptions that already received reminder email."""
        non_recurring_expiring_subscription.expiry_email_sent_at = (
            non_recurring_expiring_subscription.expires_at - timedelta(days=1)
        )
        non_recurring_expiring_subscription.save(update_fields=['expiry_email_sent_at'])

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_requires_auth(self, api_client):
        """Reminder endpoint requires authentication."""
        url = reverse('subscription-expiry-reminder')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestExpiryReminderAck:
    """Tests for POST /api/subscriptions/{id}/expiry-reminder/ack/."""

    @pytest.fixture
    def non_recurring_active_subscription(self, existing_user, package):
        """Return an active non-recurring subscription for ack endpoint tests."""
        now = timezone.now()
        return Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=25),
            expires_at=now + timedelta(days=5),
            is_recurring=False,
            payment_method_type='BANCOLOMBIA_TRANSFER',
        )

    def test_ack_sets_expiry_ui_sent_at(
        self, api_client, existing_user, non_recurring_active_subscription
    ):
        """Ack endpoint sets UI reminder timestamp when first acknowledged."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder-ack', args=[non_recurring_active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'ok'

        non_recurring_active_subscription.refresh_from_db()
        assert non_recurring_active_subscription.expiry_ui_sent_at is not None

    def test_ack_idempotent_does_not_overwrite(
        self, api_client, existing_user, non_recurring_active_subscription
    ):
        """Ack endpoint preserves existing reminder timestamp when called repeatedly."""
        first_ts = non_recurring_active_subscription.expires_at - timedelta(days=1)
        non_recurring_active_subscription.expiry_ui_sent_at = first_ts
        non_recurring_active_subscription.save(update_fields=['expiry_ui_sent_at'])

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder-ack', args=[non_recurring_active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK

        non_recurring_active_subscription.refresh_from_db()
        assert non_recurring_active_subscription.expiry_ui_sent_at == first_ts

    def test_ack_rejects_recurring_subscription(self, api_client, existing_user, active_subscription):
        """Ack endpoint rejects recurring subscriptions."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder-ack', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_ack_rejects_canceled_subscription(
        self, api_client, existing_user, non_recurring_active_subscription
    ):
        """Ack endpoint rejects subscriptions that are already canceled."""
        non_recurring_active_subscription.status = Subscription.Status.CANCELED
        non_recurring_active_subscription.save(update_fields=['status'])

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-expiry-reminder-ack', args=[non_recurring_active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_ack_requires_auth(self, api_client, non_recurring_active_subscription):
        """Ack endpoint requires authentication."""
        url = reverse('subscription-expiry-reminder-ack', args=[non_recurring_active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
