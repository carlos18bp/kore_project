"""Tests for the recurring-billing NEQUI flow on SubscriptionViewSet."""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Package, PaymentIntent, User


@pytest.fixture
def customer(db):
    """Create a customer used to authenticate against the NEQUI endpoints."""
    return User.objects.create_user(
        email='nequi_cust@example.com', password='p',
        first_name='Lina', last_name='Pérez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    """Create an active package required to start a purchase."""
    return Package.objects.create(
        title='Bronze', sessions_count=4, validity_days=30,
        price=120000, currency='COP', is_active=True,
    )


@pytest.mark.django_db
class TestNequiStart:
    """POST /api/subscriptions/nequi/start/ initiates tokenization."""

    @patch('core_app.views.subscription_views.create_nequi_token', return_value='nequi_tok_xyz')
    def test_creates_intent_with_nequi_token_id(self, _mock_token, api_client, customer, package):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-nequi-start')

        response = api_client.post(
            url, {'package_id': package.pk, 'phone_number': '3001112233'}, format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body['nequi_token_id'] == 'nequi_tok_xyz'
        assert body['await_user_approval'] is True
        intent = PaymentIntent.objects.get(reference=body['reference'])
        assert intent.payment_method_type == 'NEQUI'
        assert intent.wompi_nequi_token_id == 'nequi_tok_xyz'
        assert intent.status == PaymentIntent.Status.PENDING
        assert intent.customer == customer

    def test_rejects_missing_phone_number(self, api_client, customer, package):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-nequi-start')
        response = api_client.post(url, {'package_id': package.pk}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestNequiConfirm:
    """POST /api/subscriptions/nequi/confirm/ finalizes the purchase."""

    @patch(
        'core_app.views.subscription_views.create_transaction',
        return_value={'id': 'txn_recurring_001', 'status': 'PENDING'},
    )
    @patch(
        'core_app.views.subscription_views.create_payment_source',
        return_value=4242,
    )
    @patch(
        'core_app.views.subscription_views.poll_nequi_token_until_approved',
        return_value='nequi_tok_xyz',
    )
    def test_creates_payment_source_and_recurring_transaction(
        self, _mock_poll, mock_source, mock_txn, api_client, customer, package,
    ):
        api_client.force_authenticate(user=customer)
        intent = PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='kore-test-nequi-001',
            wompi_nequi_token_id='nequi_tok_xyz',
            payment_method_type='NEQUI',
            amount=package.price, currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        url = reverse('subscription-nequi-confirm')
        response = api_client.post(url, {'reference': intent.reference}, format='json')

        assert response.status_code == status.HTTP_200_OK
        mock_source.assert_called_once()
        source_kwargs = mock_source.call_args.kwargs
        assert source_kwargs['token'] == 'nequi_tok_xyz'
        assert source_kwargs['source_type'] == 'NEQUI'
        mock_txn.assert_called_once()
        txn_kwargs = mock_txn.call_args.kwargs
        assert txn_kwargs['payment_source_id'] == 4242
        assert txn_kwargs['recurrent'] is True

        intent.refresh_from_db()
        assert intent.payment_source_id == '4242'
        assert intent.wompi_transaction_id == 'txn_recurring_001'

    def test_rejects_intent_without_token_id(self, api_client, customer, package):
        api_client.force_authenticate(user=customer)
        intent = PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='kore-test-nequi-002',
            payment_method_type='NEQUI',
            amount=package.price, currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )
        url = reverse('subscription-nequi-confirm')
        response = api_client.post(url, {'reference': intent.reference}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
