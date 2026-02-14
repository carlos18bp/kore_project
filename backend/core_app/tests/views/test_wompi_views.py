"""Tests for Wompi views (config, signature, webhook)."""

import hashlib
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Payment, Subscription, User

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
    def test_returns_public_key_and_environment(self, api_client):
        with override_settings(**WOMPI_SETTINGS):
            url = reverse('wompi-config')
            response = api_client.get(url)
            assert response.status_code == status.HTTP_200_OK
            assert response.data['public_key'] == 'pub_test_abc'
            assert response.data['environment'] == 'test'

    def test_accessible_without_auth(self, api_client):
        with override_settings(**WOMPI_SETTINGS):
            url = reverse('wompi-config')
            response = api_client.get(url)
            assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestGenerateSignatureView:
    def test_requires_authentication(self, api_client):
        url = reverse('wompi-generate-signature')
        response = api_client.post(url, {}, format='json')
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    @override_settings(**WOMPI_SETTINGS)
    def test_generates_valid_signature(self, api_client, existing_user):
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
        api_client.force_authenticate(user=existing_user)
        url = reverse('wompi-generate-signature')
        response = api_client.post(url, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestWompiWebhookView:
    @pytest.fixture
    def subscription_with_payment(self, existing_user):
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
