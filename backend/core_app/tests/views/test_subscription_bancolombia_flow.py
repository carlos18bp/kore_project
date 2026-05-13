"""Tests for the recurring-billing BANCOLOMBIA_TRANSFER flow on SubscriptionViewSet."""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Package, PaymentIntent, User


@pytest.fixture
def customer(db):
    """Create a customer used to authenticate against the Bancolombia endpoints."""
    return User.objects.create_user(
        email='bcol_cust@example.com', password='p',
        first_name='Ana', last_name='Ruiz', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    """Create an active package required to start a purchase."""
    return Package.objects.create(
        title='Silver', sessions_count=8, validity_days=30,
        price=240000, currency='COP', is_active=True,
    )


@pytest.mark.django_db
class TestBancolombiaStart:
    """POST /api/subscriptions/bancolombia/start/ returns authorization_url."""

    @patch(
        'core_app.views.subscription_views.create_bancolombia_transfer_token',
        return_value={
            'token_id': 'bcol_tok_xyz',
            'authorization_url': 'https://sucursal.bancolombia.com/auth/abc',
        },
    )
    def test_returns_authorization_url_and_persists_token(
        self, mock_token, api_client, customer, package,
    ):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-bancolombia-start')

        response = api_client.post(
            url,
            {
                'package_id': package.pk,
                'redirect_url': 'https://kore.app/checkout/callback',
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        body = response.json()
        assert body['authorization_url'] == 'https://sucursal.bancolombia.com/auth/abc'
        intent = PaymentIntent.objects.get(reference=body['reference'])
        assert intent.payment_method_type == 'BANCOLOMBIA_TRANSFER'
        assert intent.wompi_bancolombia_token_id == 'bcol_tok_xyz'
        assert intent.wompi_authorization_url.endswith('/auth/abc')

        token_kwargs = mock_token.call_args.kwargs
        assert token_kwargs['type_auth'] == 'TOKEN'
        assert token_kwargs['redirect_url'] == 'https://kore.app/checkout/callback'

    def test_requires_redirect_url(self, api_client, customer, package):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-bancolombia-start')
        response = api_client.post(url, {'package_id': package.pk}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestBancolombiaConfirm:
    """POST /api/subscriptions/bancolombia/confirm/ finalizes the purchase."""

    @patch(
        'core_app.views.subscription_views.create_transaction',
        return_value={'id': 'txn_bcol_001', 'status': 'PENDING'},
    )
    @patch(
        'core_app.views.subscription_views.create_payment_source',
        return_value=9999,
    )
    @patch(
        'core_app.views.subscription_views.poll_bancolombia_token_until_approved',
        return_value='bcol_tok_xyz',
    )
    def test_polls_token_and_creates_payment_source_and_transaction(
        self, _mock_poll, mock_source, mock_txn, api_client, customer, package,
    ):
        api_client.force_authenticate(user=customer)
        intent = PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='kore-test-bcol-001',
            wompi_bancolombia_token_id='bcol_tok_xyz',
            payment_method_type='BANCOLOMBIA_TRANSFER',
            amount=package.price, currency=package.currency,
            status=PaymentIntent.Status.PENDING,
        )

        url = reverse('subscription-bancolombia-confirm')
        response = api_client.post(url, {'reference': intent.reference}, format='json')

        assert response.status_code == status.HTTP_200_OK
        mock_source.assert_called_once()
        source_kwargs = mock_source.call_args.kwargs
        assert source_kwargs['token'] == 'bcol_tok_xyz'
        assert source_kwargs['source_type'] == 'BANCOLOMBIA_TRANSFER'
        assert 'payment_description' in source_kwargs['extra_fields']

        mock_txn.assert_called_once()
        txn_kwargs = mock_txn.call_args.kwargs
        assert txn_kwargs['payment_source_id'] == 9999
        assert txn_kwargs['recurrent'] is True

        intent.refresh_from_db()
        assert intent.payment_source_id == '9999'
        assert intent.wompi_transaction_id == 'txn_bcol_001'
