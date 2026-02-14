"""Tests for the recurring billing Celery task."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone

from core_app.models import Notification, Package, Payment, Subscription, User
from core_app.tasks import _bill_subscription, process_recurring_billing


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='billing@kore.com',
        password='testpass123',
        first_name='Billing',
        last_name='User',
    )


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
def due_subscription(customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=10,
        sessions_used=5,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=30),
        expires_at=now,
        payment_source_id='12345',
        next_billing_date=now.date(),
    )


@pytest.fixture
def future_subscription(customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=10,
        sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=30),
        payment_source_id='67890',
        next_billing_date=(now + timedelta(days=30)).date(),
    )


@pytest.mark.django_db
class TestProcessRecurringBilling:
    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_bills_due_subscriptions(
        self, mock_ref, mock_txn, due_subscription, future_subscription
    ):
        mock_ref.return_value = 'kore-ref-001'
        mock_txn.return_value = {'id': 'txn-recurring-001', 'status': 'APPROVED'}

        result = process_recurring_billing()

        assert result['processed'] == 1
        assert result['succeeded'] == 1
        assert result['failed'] == 0

        due_subscription.refresh_from_db()
        assert due_subscription.sessions_used == 0
        assert due_subscription.sessions_total == 10
        assert due_subscription.next_billing_date == (
            timezone.now().date() + timedelta(days=30)
        )

        assert Payment.objects.filter(subscription=due_subscription).count() == 1
        payment = Payment.objects.get(subscription=due_subscription)
        assert payment.status == Payment.Status.CONFIRMED
        assert payment.provider_reference == 'kore-ref-001'

        assert Notification.objects.filter(
            sent_to=due_subscription.customer.email,
            notification_type=Notification.Type.PAYMENT_CONFIRMED,
        ).count() == 1

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_skips_future_subscriptions(
        self, mock_ref, mock_txn, future_subscription
    ):
        result = process_recurring_billing()

        assert result['processed'] == 0
        assert result['succeeded'] == 0
        assert result['failed'] == 0
        mock_txn.assert_not_called()

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_skips_paused_subscriptions(
        self, mock_ref, mock_txn, due_subscription
    ):
        due_subscription.status = Subscription.Status.PAUSED
        due_subscription.save()

        result = process_recurring_billing()

        assert result['processed'] == 0
        mock_txn.assert_not_called()

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_skips_subscriptions_without_payment_source(
        self, mock_ref, mock_txn, due_subscription
    ):
        due_subscription.payment_source_id = ''
        due_subscription.save()

        result = process_recurring_billing()

        assert result['processed'] == 0
        mock_txn.assert_not_called()

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_handles_wompi_error_gracefully(
        self, mock_ref, mock_txn, due_subscription
    ):
        from core_app.services.wompi_service import WompiError
        mock_ref.return_value = 'kore-ref-fail'
        mock_txn.side_effect = WompiError('payment failed')

        result = process_recurring_billing()

        assert result['processed'] == 1
        assert result['succeeded'] == 0
        assert result['failed'] == 1

        assert Payment.objects.filter(subscription=due_subscription).count() == 0

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_pending_transaction_creates_pending_payment(
        self, mock_ref, mock_txn, due_subscription
    ):
        mock_ref.return_value = 'kore-ref-pending'
        mock_txn.return_value = {'id': 'txn-pending-001', 'status': 'PENDING'}

        result = process_recurring_billing()

        assert result['succeeded'] == 1

        payment = Payment.objects.get(subscription=due_subscription)
        assert payment.status == Payment.Status.PENDING

        due_subscription.refresh_from_db()
        # next_billing_date should NOT advance for pending transactions
        assert due_subscription.sessions_used == 5


@pytest.mark.django_db
class TestBillSubscription:
    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_creates_payment_and_advances_billing(
        self, mock_ref, mock_txn, due_subscription
    ):
        mock_ref.return_value = 'kore-ref-direct'
        mock_txn.return_value = {'id': 'txn-direct-001', 'status': 'APPROVED'}

        _bill_subscription(due_subscription)

        payment = Payment.objects.get(subscription=due_subscription)
        assert payment.amount == Decimal('300000.00')
        assert payment.currency == 'COP'
        assert payment.provider == Payment.Provider.WOMPI

        due_subscription.refresh_from_db()
        assert due_subscription.sessions_used == 0

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_raises_on_wompi_error(
        self, mock_ref, mock_txn, due_subscription
    ):
        from core_app.services.wompi_service import WompiError
        mock_ref.return_value = 'kore-ref-err'
        mock_txn.side_effect = WompiError('charge failed')

        with pytest.raises(WompiError):
            _bill_subscription(due_subscription)
