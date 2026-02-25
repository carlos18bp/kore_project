"""Tests for the recurring billing Huey task."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

import pytest

from core_app.models import Notification, Package, Payment, Subscription, User
from core_app.services.wompi_service import WompiError
from core_app.tasks import _bill_subscription, process_recurring_billing

DUE_REFERENCE = datetime(2000, 1, 15, 10, 0, tzinfo=dt_timezone.utc)
FUTURE_REFERENCE = datetime(2100, 1, 15, 10, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def customer(db):
    """Create a customer eligible for recurring billing flows."""
    return User.objects.create_user(
        email='billing@kore.com',
        password='testpass123',
        first_name='Billing',
        last_name='User',
    )


@pytest.fixture
def package(db):
    """Create a recurring package with deterministic billing values."""
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
    """Create an active recurring subscription that is due for billing."""
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=10,
        sessions_used=5,
        status=Subscription.Status.ACTIVE,
        starts_at=DUE_REFERENCE - timedelta(days=30),
        expires_at=DUE_REFERENCE,
        payment_source_id='12345',
        next_billing_date=DUE_REFERENCE.date(),
    )


@pytest.fixture
def future_subscription(customer, package):
    """Create an active recurring subscription with billing scheduled in the future."""
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=10,
        sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=FUTURE_REFERENCE,
        expires_at=FUTURE_REFERENCE + timedelta(days=30),
        payment_source_id='67890',
        next_billing_date=(FUTURE_REFERENCE + timedelta(days=30)).date(),
    )


@pytest.mark.django_db
class TestProcessRecurringBilling:
    """Behavior of the recurring billing task over due and skipped subscriptions."""

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_bills_due_subscriptions_returns_success_counts(
        self, mock_ref, mock_txn, due_subscription, future_subscription
    ):
        """Report one processed and successful charge when only one subscription is due."""
        mock_ref.return_value = 'kore-ref-001'
        mock_txn.return_value = {'id': 'txn-recurring-001', 'status': 'APPROVED'}

        result = process_recurring_billing.call_local()

        assert result['processed'] == 1
        assert result['succeeded'] == 1
        assert result['failed'] == 0

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_bills_due_subscriptions_resets_usage_and_advances_billing(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Reset usage and move billing date forward after an approved recurring charge."""
        mock_ref.return_value = 'kore-ref-001'
        mock_txn.return_value = {'id': 'txn-recurring-001', 'status': 'APPROVED'}
        previous_billing_date = due_subscription.next_billing_date

        process_recurring_billing.call_local()

        due_subscription.refresh_from_db()
        assert due_subscription.sessions_used == 0
        assert due_subscription.sessions_total == 10
        assert due_subscription.next_billing_date > previous_billing_date

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_bills_due_subscriptions_creates_payment_and_notification(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Create confirmed payment and success notification for approved recurring charge."""
        mock_ref.return_value = 'kore-ref-001'
        mock_txn.return_value = {'id': 'txn-recurring-001', 'status': 'APPROVED'}

        process_recurring_billing.call_local()

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
        """Skip processing subscriptions whose next billing date has not arrived yet."""
        result = process_recurring_billing.call_local()

        assert result['processed'] == 0
        assert result['succeeded'] == 0
        assert result['failed'] == 0
        mock_txn.assert_not_called()

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_skips_non_recurring_subscriptions(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Skip subscriptions explicitly marked as non-recurring."""
        due_subscription.is_recurring = False
        due_subscription.save()

        result = process_recurring_billing.call_local()

        assert result['processed'] == 0
        mock_txn.assert_not_called()

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_skips_subscriptions_without_payment_source(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Skip due subscriptions when no payment source is configured."""
        due_subscription.payment_source_id = ''
        due_subscription.save()

        result = process_recurring_billing.call_local()

        assert result['processed'] == 0
        mock_txn.assert_not_called()

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_handles_wompi_error_gracefully(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Count failed charges and avoid creating payments when WOMPI raises errors."""
        mock_ref.return_value = 'kore-ref-fail'
        mock_txn.side_effect = WompiError('payment failed')

        result = process_recurring_billing.call_local()

        assert result['processed'] == 1
        assert result['succeeded'] == 0
        assert result['failed'] == 1

        assert Payment.objects.filter(subscription=due_subscription).count() == 0

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_pending_transaction_creates_pending_payment(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Persist pending payment and keep usage unchanged when gateway stays pending."""
        mock_ref.return_value = 'kore-ref-pending'
        mock_txn.return_value = {'id': 'txn-pending-001', 'status': 'PENDING'}

        result = process_recurring_billing.call_local()

        assert result['succeeded'] == 1

        payment = Payment.objects.get(subscription=due_subscription)
        assert payment.status == Payment.Status.PENDING

        due_subscription.refresh_from_db()
        # next_billing_date should NOT advance for pending transactions
        assert due_subscription.sessions_used == 5


@pytest.mark.django_db
class TestBillSubscription:
    """Direct billing helper behavior for success and failure paths."""

    @patch('core_app.tasks.create_transaction')
    @patch('core_app.tasks.generate_reference')
    def test_creates_payment_and_advances_billing(
        self, mock_ref, mock_txn, due_subscription
    ):
        """Bill subscription successfully and reset consumed sessions for next cycle."""
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
        """Bubble WOMPI errors and preserve subscription/payment state on failure."""
        mock_ref.return_value = 'kore-ref-err'
        mock_txn.side_effect = WompiError('charge failed')
        original_sessions_used = due_subscription.sessions_used

        with pytest.raises(WompiError):
            _bill_subscription(due_subscription)

        due_subscription.refresh_from_db()
        assert due_subscription.sessions_used == original_sessions_used
        assert Payment.objects.filter(subscription=due_subscription).count() == 0
