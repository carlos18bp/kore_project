"""Tests for Wompi views (config, signature, webhook)."""

import hashlib
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import IntegrityError
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Payment, PaymentIntent, Subscription, User

WOMPI_SETTINGS = {
    'WOMPI_PUBLIC_KEY': 'pub_test_abc',
    'WOMPI_PRIVATE_KEY': 'prv_test_xyz',
    'WOMPI_INTEGRITY_KEY': 'test_integrity_secret',
    'WOMPI_EVENTS_KEY': 'test_events_secret',
    'WOMPI_API_BASE_URL': 'https://api-sandbox.co.uat.wompi.dev/v1',
    'WOMPI_ENVIRONMENT': 'test',
}


@pytest.mark.django_db
class TestWompiConfigView:
    """Covers public configuration endpoint behavior for Wompi checkout."""

    def test_returns_public_key_and_environment(self, api_client):
        """Config endpoint returns configured public key and environment."""
        with override_settings(**WOMPI_SETTINGS):
            url = reverse('wompi-config')
            response = api_client.get(url)
            assert response.status_code == status.HTTP_200_OK
            assert response.data['public_key'] == 'pub_test_abc'
            assert response.data['environment'] == 'test'

    def test_accessible_without_auth(self, api_client):
        """Config endpoint is accessible without authentication."""
        with override_settings(**WOMPI_SETTINGS):
            url = reverse('wompi-config')
            response = api_client.get(url)
            assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestGenerateSignatureView:
    """Covers signature generation endpoint contract and validation."""

    def test_accessible_without_authentication(self, api_client):
        """Signature endpoint allows anonymous access for checkout clients."""
        url = reverse('wompi-generate-signature')
        response = api_client.post(url, {
            'reference': 'ref-guest',
            'amount_in_cents': 150000,
            'currency': 'COP',
        }, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['reference'] == 'ref-guest'

    @override_settings(**WOMPI_SETTINGS)
    def test_generates_valid_signature(self, api_client, existing_user):
        """Signature endpoint returns signature payload for valid request data."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('wompi-generate-signature')
        response = api_client.post(url, {
            'reference': 'ref-123',
            'amount_in_cents': 5000000,
            'currency': 'COP',
        }, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'signature' in response.data
        assert response.data['reference'] == 'ref-123'

    @override_settings(**WOMPI_SETTINGS)
    def test_returns_400_without_required_fields(self, api_client, existing_user):
        """Signature endpoint rejects requests missing required fields."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('wompi-generate-signature')
        response = api_client.post(url, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestWompiWebhookView:
    """Covers webhook outcomes for direct payment records and subscriptions."""

    @pytest.fixture
    def subscription_with_payment(self, existing_user):
        """Create an active subscription with pending payment tied to webhook transaction id."""
        pkg = Package.objects.create(
            title='Pkg', price=Decimal('300000.00'), currency='COP',
            sessions_count=10, validity_days=30,
        )
        now = timezone.now()
        sub = Subscription.objects.create(
            customer=existing_user,
            package=pkg,
            sessions_total=10,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=30),
            payment_source_id='12345',
            wompi_transaction_id='txn-webhook-001',
        )
        payment = Payment.objects.create(
            customer=existing_user,
            subscription=sub,
            amount=Decimal('300000.00'),
            currency='COP',
            provider=Payment.Provider.WOMPI,
            provider_reference='txn-webhook-001',
            status=Payment.Status.PENDING,
        )
        return sub, payment

    def _build_event(self, txn_id, txn_status, amount=30000000):
        timestamp = 1530291411
        concat = f'{txn_id}{txn_status}{amount}{timestamp}{WOMPI_SETTINGS["WOMPI_EVENTS_KEY"]}'
        checksum = hashlib.sha256(concat.encode('utf-8')).hexdigest()
        return {
            'event': 'transaction.updated',
            'data': {
                'transaction': {
                    'id': txn_id,
                    'status': txn_status,
                    'amount_in_cents': amount,
                }
            },
            'signature': {
                'properties': [
                    'transaction.id',
                    'transaction.status',
                    'transaction.amount_in_cents',
                ],
                'checksum': checksum,
            },
            'timestamp': timestamp,
        }

    @override_settings(**WOMPI_SETTINGS)
    def test_approved_webhook_confirms_payment(self, api_client, subscription_with_payment):
        """Approved webhook updates pending payment to confirmed status."""
        sub, payment = subscription_with_payment
        event = self._build_event('txn-webhook-001', 'APPROVED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        payment.refresh_from_db()
        assert payment.status == Payment.Status.CONFIRMED
        assert payment.confirmed_at is not None

    @override_settings(**WOMPI_SETTINGS)
    def test_declined_webhook_fails_payment_and_expires_subscription(
        self, api_client, subscription_with_payment
    ):
        """Declined webhook fails payment and expires related subscription."""
        sub, payment = subscription_with_payment
        event = self._build_event('txn-webhook-001', 'DECLINED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        payment.refresh_from_db()
        assert payment.status == Payment.Status.FAILED

        sub.refresh_from_db()
        assert sub.status == Subscription.Status.EXPIRED

    @override_settings(**WOMPI_SETTINGS)
    def test_invalid_checksum_returns_401(self, api_client):
        """Webhook request with invalid checksum is rejected with 401."""
        event = {
            'event': 'transaction.updated',
            'data': {'transaction': {'id': 'x', 'status': 'APPROVED', 'amount_in_cents': 100}},
            'signature': {
                'properties': ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
                'checksum': 'bad_checksum',
            },
            'timestamp': 12345,
        }
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @override_settings(**WOMPI_SETTINGS)
    def test_invalid_amount_in_cents_returns_400(self, api_client, existing_user):
        """amount_in_cents that is not a valid integer returns 400 (lines 68-69)."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('wompi-generate-signature')
        response = api_client.post(url, {
            'reference': 'ref-bad',
            'amount_in_cents': 'not_a_number',
            'currency': 'COP',
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'entero válido' in response.data['detail']

    @override_settings(**WOMPI_SETTINGS)
    def test_webhook_missing_transaction_id(self, api_client):
        """Webhook with empty transaction ID is handled gracefully (lines 127-128)."""
        timestamp = 1530291411
        concat = f'{timestamp}{WOMPI_SETTINGS["WOMPI_EVENTS_KEY"]}'
        checksum = hashlib.sha256(concat.encode('utf-8')).hexdigest()
        event = {
            'event': 'transaction.updated',
            'data': {'transaction': {}},
            'signature': {
                'properties': [],
                'checksum': checksum,
            },
            'timestamp': timestamp,
        }
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

    @override_settings(**WOMPI_SETTINGS)
    def test_webhook_payment_not_found(self, api_client):
        """Payment.DoesNotExist is handled gracefully (lines 136-137)."""
        event = self._build_event('nonexistent-txn-999', 'APPROVED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

    @override_settings(**WOMPI_SETTINGS)
    def test_webhook_multiple_payments_found(self, api_client, subscription_with_payment):
        """MultipleObjectsReturned is handled gracefully (lines 135-140)."""
        sub, payment = subscription_with_payment
        # Create a duplicate payment with same provider_reference
        Payment.objects.create(
            customer=payment.customer,
            subscription=sub,
            amount=payment.amount,
            currency='COP',
            provider=Payment.Provider.WOMPI,
            provider_reference=payment.provider_reference,
            status=Payment.Status.PENDING,
        )
        event = self._build_event(payment.provider_reference, 'APPROVED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

    @override_settings(**WOMPI_SETTINGS)
    def test_voided_webhook_cancels_payment(self, api_client, subscription_with_payment):
        """VOIDED transaction sets payment to CANCELED (lines 160-163)."""
        sub, payment = subscription_with_payment
        event = self._build_event(payment.provider_reference, 'VOIDED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        payment.refresh_from_db()
        assert payment.status == Payment.Status.CANCELED

    @override_settings(**WOMPI_SETTINGS)
    def test_non_transaction_event_ignored(self, api_client):
        """Non-transaction.updated event is ignored (branch 106→109)."""
        timestamp = 1530291411
        concat = f'{timestamp}{WOMPI_SETTINGS["WOMPI_EVENTS_KEY"]}'
        checksum = hashlib.sha256(concat.encode('utf-8')).hexdigest()
        event = {
            'event': 'nequi_token.updated',
            'data': {},
            'signature': {
                'properties': [],
                'checksum': checksum,
            },
            'timestamp': timestamp,
        }
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

    @override_settings(**WOMPI_SETTINGS)
    def test_declined_without_subscription(self, api_client, existing_user):
        """DECLINED payment without subscription skips sub expiry (branch 153→exit)."""
        payment = Payment.objects.create(
            customer=existing_user,
            subscription=None,
            amount=Decimal('100000.00'),
            currency='COP',
            provider=Payment.Provider.WOMPI,
            provider_reference='txn-no-sub-001',
            status=Payment.Status.PENDING,
        )
        event = self._build_event('txn-no-sub-001', 'DECLINED', amount=10000000)
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        payment.refresh_from_db()
        assert payment.status == Payment.Status.FAILED

    @override_settings(**WOMPI_SETTINGS)
    def test_unrecognized_status_no_op(self, api_client, subscription_with_payment):
        """Unrecognized txn status (e.g. PENDING) is a no-op (branch 160→exit)."""
        sub, payment = subscription_with_payment
        event = self._build_event(payment.provider_reference, 'PENDING')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        payment.refresh_from_db()
        assert payment.status == Payment.Status.PENDING


@pytest.mark.django_db
class TestWebhookPaymentIntentResolution:
    """Tests for webhook-driven PaymentIntent → Subscription + Payment creation."""

    @pytest.fixture
    def pending_intent(self, existing_user):
        """Create a pending authenticated intent used for webhook resolution tests."""
        pkg = Package.objects.create(
            title='Intent Pkg', price=Decimal('500000.00'), currency='COP',
            sessions_count=12, validity_days=30,
        )
        return PaymentIntent.objects.create(
            customer=existing_user,
            package=pkg,
            reference='ref-intent-001',
            wompi_transaction_id='txn-intent-001',
            payment_source_id='ps-intent-001',
            amount=Decimal('500000.00'),
            currency='COP',
            status=PaymentIntent.Status.PENDING,
        )

    @pytest.fixture
    def pending_guest_intent(self):
        """Create a pending guest intent with temporary registration payload fields."""
        pkg = Package.objects.create(
            title='Guest Intent Pkg', price=Decimal('400000.00'), currency='COP',
            sessions_count=8, validity_days=45,
        )
        return PaymentIntent.objects.create(
            customer=None,
            package=pkg,
            reference='ref-guest-intent-001',
            wompi_transaction_id='txn-guest-intent-001',
            payment_source_id='ps-guest-intent-001',
            amount=Decimal('400000.00'),
            currency='COP',
            pending_email='guest.intent@example.com',
            pending_first_name='Guest',
            pending_last_name='Intent',
            pending_phone='3001231234',
            pending_password_hash='pbkdf2_sha256$260000$dummy$hashed',
            public_access_token='guest-access-token-001',
            status=PaymentIntent.Status.PENDING,
        )

    def _build_event(self, txn_id, txn_status, amount=50000000):
        timestamp = 1530291411
        concat = f'{txn_id}{txn_status}{amount}{timestamp}{WOMPI_SETTINGS["WOMPI_EVENTS_KEY"]}'
        checksum = hashlib.sha256(concat.encode('utf-8')).hexdigest()
        return {
            'event': 'transaction.updated',
            'data': {
                'transaction': {
                    'id': txn_id,
                    'status': txn_status,
                    'amount_in_cents': amount,
                }
            },
            'signature': {
                'properties': [
                    'transaction.id',
                    'transaction.status',
                    'transaction.amount_in_cents',
                ],
                'checksum': checksum,
            },
            'timestamp': timestamp,
        }

    @override_settings(**WOMPI_SETTINGS)
    def test_approved_creates_subscription_and_payment(self, api_client, pending_intent):
        """APPROVED webhook resolves intent → creates Subscription + Payment."""
        event = self._build_event('txn-intent-001', 'APPROVED')
        event['data']['transaction']['payment_method_type'] = 'CARD'
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        pending_intent.refresh_from_db()
        assert pending_intent.status == PaymentIntent.Status.APPROVED

        sub = Subscription.objects.get(customer=pending_intent.customer)
        assert sub.status == Subscription.Status.ACTIVE
        assert sub.payment_source_id == 'ps-intent-001'
        assert sub.payment_method_type == 'CARD'
        assert sub.is_recurring is True
        assert sub.next_billing_date is not None

    @override_settings(**WOMPI_SETTINGS)
    def test_approved_creates_confirmed_payment_for_intent(self, api_client, pending_intent):
        """Approved intent webhook creates a confirmed payment entry for created subscription."""
        event = self._build_event('txn-intent-001', 'APPROVED')
        event['data']['transaction']['payment_method_type'] = 'CARD'
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        sub = Subscription.objects.get(customer=pending_intent.customer)
        pay = Payment.objects.get(subscription=sub)
        assert pay.status == Payment.Status.CONFIRMED
        assert pay.confirmed_at is not None
        assert pay.amount == Decimal('500000.00')
        assert pay.provider == Payment.Provider.WOMPI

    @override_settings(**WOMPI_SETTINGS)
    @pytest.mark.parametrize('payment_method', ['PSE', 'NEQUI', 'BANCOLOMBIA_TRANSFER'])
    def test_approved_non_recurring_method_without_payment_source(self, api_client, existing_user, payment_method):
        """Non-recurring methods can approve without a reusable payment source."""
        pkg = Package.objects.create(
            title='PSE Pkg', price=Decimal('200000.00'), currency='COP',
            sessions_count=5, validity_days=20,
        )
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=pkg,
            reference='ref-pse-001',
            wompi_transaction_id='txn-pse-001',
            payment_source_id='',
            amount=Decimal('200000.00'),
            currency='COP',
            status=PaymentIntent.Status.PENDING,
        )

        event = self._build_event('txn-pse-001', 'APPROVED', amount=20000000)
        event['data']['transaction']['payment_method_type'] = payment_method
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.APPROVED

        sub = Subscription.objects.get(customer=existing_user)
        assert sub.payment_source_id == ''
        assert sub.payment_method_type == payment_method
        assert sub.is_recurring is False
        assert sub.next_billing_date is None

        pay = Payment.objects.get(subscription=sub)
        assert pay.status == Payment.Status.CONFIRMED

    @override_settings(**WOMPI_SETTINGS)
    def test_declined_marks_intent_failed(self, api_client, pending_intent):
        """DECLINED webhook marks intent as failed, no Subscription created."""
        event = self._build_event('txn-intent-001', 'DECLINED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        pending_intent.refresh_from_db()
        assert pending_intent.status == PaymentIntent.Status.FAILED

        assert Subscription.objects.filter(customer=pending_intent.customer).count() == 0
        assert Payment.objects.count() == 0

    @override_settings(**WOMPI_SETTINGS)
    def test_error_marks_intent_failed(self, api_client, pending_intent):
        """ERROR webhook marks intent as failed."""
        event = self._build_event('txn-intent-001', 'ERROR')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        pending_intent.refresh_from_db()
        assert pending_intent.status == PaymentIntent.Status.FAILED

    @override_settings(**WOMPI_SETTINGS)
    def test_voided_marks_intent_failed(self, api_client, pending_intent):
        """VOIDED webhook marks intent as failed."""
        event = self._build_event('txn-intent-001', 'VOIDED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        pending_intent.refresh_from_db()
        assert pending_intent.status == PaymentIntent.Status.FAILED

    @override_settings(**WOMPI_SETTINGS)
    def test_idempotent_approved_intent(self, api_client, pending_intent):
        """Duplicate APPROVED webhook for already-resolved intent is a no-op."""
        # First webhook resolves intent
        event = self._build_event('txn-intent-001', 'APPROVED')
        url = reverse('wompi-webhook')
        api_client.post(url, event, format='json')

        sub_count_before = Subscription.objects.count()
        pay_count_before = Payment.objects.count()

        # Second webhook should not create duplicates
        api_client.post(url, event, format='json')

        assert Subscription.objects.count() == sub_count_before
        assert Payment.objects.count() == pay_count_before

    @override_settings(**WOMPI_SETTINGS)
    def test_webhook_no_intent_no_payment_logs_warning(self, api_client):
        """Webhook for unknown txn with no intent and no payment is handled gracefully."""
        event = self._build_event('txn-unknown-999', 'APPROVED')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

    @override_settings(**WOMPI_SETTINGS)
    def test_webhook_reference_lookup_miss_without_payment_is_handled(self, api_client):
        """Webhook handles unknown pending-reference lookup miss before falling back to payment path."""
        event = self._build_event('txn-reference-miss-001', 'APPROVED')
        event['data']['transaction']['reference'] = 'ref-missing-001'

        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert PaymentIntent.objects.filter(reference='ref-missing-001').count() == 0

    @override_settings(**WOMPI_SETTINGS)
    def test_guest_intent_approved_creates_user_subscription_and_payment(self, api_client, pending_guest_intent):
        """Guest intent is converted into a real customer only when payment is approved."""
        event = self._build_event('txn-guest-intent-001', 'APPROVED', amount=40000000)
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        pending_guest_intent.refresh_from_db()
        assert pending_guest_intent.status == PaymentIntent.Status.APPROVED
        assert pending_guest_intent.customer is not None
        assert pending_guest_intent.customer.email == 'guest.intent@example.com'
        assert pending_guest_intent.pending_password_hash == ''

        sub = Subscription.objects.get(customer=pending_guest_intent.customer)
        assert sub.status == Subscription.Status.ACTIVE
        pay = Payment.objects.get(subscription=sub)
        assert pay.status == Payment.Status.CONFIRMED

    @override_settings(**WOMPI_SETTINGS)
    def test_guest_intent_declined_does_not_create_user(self, api_client, pending_guest_intent):
        """Guest intent declined/error paths must not create user accounts."""
        event = self._build_event('txn-guest-intent-001', 'DECLINED', amount=40000000)
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        pending_guest_intent.refresh_from_db()
        assert pending_guest_intent.status == PaymentIntent.Status.FAILED
        assert pending_guest_intent.customer is None
        assert pending_guest_intent.pending_password_hash == ''

        assert User.objects.filter(email='guest.intent@example.com').count() == 0

    @override_settings(**WOMPI_SETTINGS)
    def test_guest_intent_integrity_error_uses_existing_user_fallback(self, api_client, existing_user):
        """Guest intent resolves with existing user when create raises IntegrityError and user already exists."""
        pkg = Package.objects.create(
            title='Integrity Existing User',
            price=Decimal('220000.00'),
            currency='COP',
            sessions_count=6,
            validity_days=25,
        )
        intent = PaymentIntent.objects.create(
            customer=None,
            package=pkg,
            reference='ref-integrity-existing-001',
            wompi_transaction_id='txn-integrity-existing-001',
            payment_source_id='ps-integrity-existing-001',
            amount=Decimal('220000.00'),
            currency='COP',
            pending_email=existing_user.email,
            pending_first_name='Existing',
            pending_last_name='User',
            pending_password_hash='hashed',
            status=PaymentIntent.Status.PENDING,
        )

        event = self._build_event('txn-integrity-existing-001', 'APPROVED', amount=22000000)
        url = reverse('wompi-webhook')

        with patch('core_app.views.wompi_views.User.objects.create', side_effect=IntegrityError('dup')):
            response = api_client.post(url, event, format='json')

        assert response.status_code == status.HTTP_200_OK
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.APPROVED
        assert intent.customer_id == existing_user.id
        assert intent.pending_password_hash == ''
        assert Subscription.objects.filter(customer=existing_user).exists()
        assert Payment.objects.filter(customer=existing_user).exists()

    @override_settings(**WOMPI_SETTINGS)
    def test_intent_lookup_by_reference_rejects_unsupported_payment_method(self, api_client):
        """Marks intent as failed when reference lookup resolves unsupported payment method."""
        pkg = Package.objects.create(
            title='Ref Intent', price=Decimal('250000.00'), currency='COP',
            sessions_count=6, validity_days=30,
        )
        intent = PaymentIntent.objects.create(
            customer=None,
            package=pkg,
            reference='ref-unsupported-001',
            wompi_transaction_id='',
            payment_source_id='',
            amount=Decimal('250000.00'),
            currency='COP',
            pending_email='unsupported@example.com',
            pending_first_name='Unsupported',
            pending_last_name='Method',
            pending_password_hash='hashed',
            status=PaymentIntent.Status.PENDING,
        )

        event = self._build_event('txn-unsupported-001', 'APPROVED', amount=25000000)
        event['data']['transaction'].update({
            'reference': 'ref-unsupported-001',
            'payment_source_id': 'ps-unsupported-001',
            'payment_method_type': 'UNSUPPORTED_METHOD',
        })
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert intent.wompi_transaction_id == 'txn-unsupported-001'
        assert intent.payment_source_id == 'ps-unsupported-001'
        assert intent.pending_password_hash == ''

    @override_settings(**WOMPI_SETTINGS)
    def test_approved_intent_without_payment_source_creates_non_recurring(self, api_client, existing_user):
        """Creates non-recurring subscription when approved card intent has no payment source."""
        pkg = Package.objects.create(
            title='No Source', price=Decimal('150000.00'), currency='COP',
            sessions_count=4, validity_days=15,
        )
        intent = PaymentIntent.objects.create(
            customer=existing_user,
            package=pkg,
            reference='ref-no-source-001',
            wompi_transaction_id='txn-no-source-001',
            payment_source_id='',
            amount=Decimal('150000.00'),
            currency='COP',
            pending_password_hash='should-clear',
            status=PaymentIntent.Status.PENDING,
        )

        event = self._build_event('txn-no-source-001', 'APPROVED', amount=15000000)
        event['data']['transaction']['payment_method_type'] = 'CARD'
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.APPROVED

        sub = Subscription.objects.get(customer=existing_user)
        assert sub.is_recurring is False
        assert sub.next_billing_date is None
        assert sub.payment_source_id == ''
        assert sub.payment_method_type == 'CARD'

        assert Payment.objects.filter(
            subscription=sub, status=Payment.Status.CONFIRMED,
        ).exists()

    @override_settings(**WOMPI_SETTINGS)
    def test_guest_intent_missing_pending_payload_fails(self, api_client):
        """Fails guest intent when required pending customer payload is missing."""
        pkg = Package.objects.create(
            title='Missing Payload', price=Decimal('180000.00'), currency='COP',
            sessions_count=5, validity_days=20,
        )
        intent = PaymentIntent.objects.create(
            customer=None,
            package=pkg,
            reference='ref-missing-payload-001',
            wompi_transaction_id='txn-missing-payload-001',
            payment_source_id='ps-missing-payload-001',
            amount=Decimal('180000.00'),
            currency='COP',
            pending_email='',
            pending_password_hash='',
            status=PaymentIntent.Status.PENDING,
        )

        event = self._build_event('txn-missing-payload-001', 'APPROVED', amount=18000000)
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')
        assert response.status_code == status.HTTP_200_OK

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert intent.pending_password_hash == ''

    @override_settings(**WOMPI_SETTINGS)
    def test_guest_intent_integrity_error_without_existing_user_fails(self, api_client):
        """Fails guest intent when user creation raises integrity error and no fallback user exists."""
        pkg = Package.objects.create(
            title='Integrity Error', price=Decimal('220000.00'), currency='COP',
            sessions_count=6, validity_days=25,
        )
        intent = PaymentIntent.objects.create(
            customer=None,
            package=pkg,
            reference='ref-integrity-001',
            wompi_transaction_id='txn-integrity-001',
            payment_source_id='ps-integrity-001',
            amount=Decimal('220000.00'),
            currency='COP',
            pending_email='dup@example.com',
            pending_first_name='Dup',
            pending_last_name='User',
            pending_password_hash='hashed',
            status=PaymentIntent.Status.PENDING,
        )

        event = self._build_event('txn-integrity-001', 'APPROVED', amount=22000000)
        url = reverse('wompi-webhook')

        class EmptyQuerySet:
            @staticmethod
            def first():
                return None

        with patch('core_app.views.wompi_views.User.objects.create', side_effect=IntegrityError('dup')):
            with patch('core_app.views.wompi_views.User.objects.filter', return_value=EmptyQuerySet()):
                response = api_client.post(url, event, format='json')

        assert response.status_code == status.HTTP_200_OK
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert intent.pending_password_hash == ''

    @override_settings(**WOMPI_SETTINGS)
    def test_pending_intent_status_noop_keeps_pending(self, api_client, pending_intent):
        """Pending transaction status keeps matching pending intent unresolved and side-effect free."""
        event = self._build_event('txn-intent-001', 'PENDING')
        url = reverse('wompi-webhook')
        response = api_client.post(url, event, format='json')

        assert response.status_code == status.HTTP_200_OK

        pending_intent.refresh_from_db()
        assert pending_intent.status == PaymentIntent.Status.PENDING
        assert Subscription.objects.filter(customer=pending_intent.customer).count() == 0
        assert Payment.objects.count() == 0
