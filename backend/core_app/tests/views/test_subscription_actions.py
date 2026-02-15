"""Tests for Subscription purchase, cancel, pause, resume, and payment history actions."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Payment, PaymentIntent, Subscription, User
from core_app.tests.helpers import get_results


@pytest.fixture
def package(db):
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


@pytest.fixture
def paused_subscription(existing_user, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=existing_user,
        package=package,
        sessions_total=10,
        sessions_used=2,
        status=Subscription.Status.PAUSED,
        starts_at=now,
        expires_at=now + timedelta(days=30),
        payment_source_id='ps-456',
        paused_at=now,
    )


@pytest.mark.django_db
class TestSubscriptionPurchase:
    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_creates_payment_intent(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
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

        # PaymentIntent created, but NO Subscription or Payment yet
        assert PaymentIntent.objects.filter(customer=existing_user).count() == 1
        intent = PaymentIntent.objects.get(customer=existing_user)
        assert intent.payment_source_id == '9999'
        assert intent.wompi_transaction_id == 'txn-001'
        assert intent.status == PaymentIntent.Status.PENDING
        assert intent.amount == Decimal('300000.00')

        assert Subscription.objects.filter(customer=existing_user).count() == 0
        assert Payment.objects.count() == 0

    def test_purchase_requires_auth(self, api_client, package):
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_abc',
        }, format='json')
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_returns_502_on_wompi_source_error(
        self, mock_create_source, api_client, existing_user, package
    ):
        from core_app.services.wompi_service import WompiError
        mock_create_source.side_effect = WompiError('source fail')

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-purchase')
        response = api_client.post(url, {
            'package_id': package.id,
            'card_token': 'tok_test_fail',
        }, format='json')
        assert response.status_code == status.HTTP_502_BAD_GATEWAY

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_purchase_returns_502_on_wompi_txn_error(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
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
class TestIntentStatusEndpoint:
    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_intent_status_returns_pending(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
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
        api_client.force_authenticate(user=existing_user)
        status_url = reverse('subscription-intent-status', args=['nonexistent-ref'])
        response = api_client.get(status_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_intent_status_requires_auth(self, api_client):
        status_url = reverse('subscription-intent-status', args=['any-ref'])
        response = api_client.get(status_url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    @patch('core_app.views.subscription_views.create_transaction')
    @patch('core_app.views.subscription_views.create_payment_source')
    def test_intent_status_only_visible_to_owner(
        self, mock_create_source, mock_create_txn, api_client, existing_user, package
    ):
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
    def test_cancel_active_subscription(self, api_client, existing_user, active_subscription):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-cancel-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'canceled'

        active_subscription.refresh_from_db()
        assert active_subscription.status == Subscription.Status.CANCELED
        assert active_subscription.next_billing_date is None

    def test_cancel_paused_subscription(self, api_client, existing_user, paused_subscription):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-cancel-subscription', args=[paused_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'canceled'

    def test_cancel_already_canceled_returns_400(self, api_client, existing_user, active_subscription):
        active_subscription.status = Subscription.Status.CANCELED
        active_subscription.save()

        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-cancel-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSubscriptionPause:
    def test_pause_active_subscription(self, api_client, existing_user, active_subscription):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-pause-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'paused'

        active_subscription.refresh_from_db()
        assert active_subscription.paused_at is not None

    def test_pause_paused_subscription_returns_400(self, api_client, existing_user, paused_subscription):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-pause-subscription', args=[paused_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSubscriptionResume:
    def test_resume_paused_subscription(self, api_client, existing_user, paused_subscription):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-resume-subscription', args=[paused_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'active'

        paused_subscription.refresh_from_db()
        assert paused_subscription.paused_at is None
        assert paused_subscription.next_billing_date is not None

    def test_resume_active_subscription_returns_400(self, api_client, existing_user, active_subscription):
        api_client.force_authenticate(user=existing_user)
        url = reverse('subscription-resume-subscription', args=[active_subscription.id])
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSubscriptionPaymentHistory:
    def test_returns_payments_for_subscription(self, api_client, existing_user, active_subscription):
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
        url = reverse('subscription-payment-history', args=[active_subscription.id])
        response = api_client.get(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
