"""Unit tests for the recurring renewal application service.

Direct contract tests for ``apply_recurring_renewal`` — previously this
billing-critical module was only exercised indirectly through the billing
task and webhook tests.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone

from core_app.models import (
    Notification,
    Package,
    Payment,
    Subscription,
    SubscriptionRenewal,
    User,
)
from core_app.services.recurring_renewal import apply_recurring_renewal
from core_app.services.slot_schedule import MAX_ROLLOVER_SESSIONS

FIXED_NOW = timezone.make_aware(datetime(2026, 6, 1, 8, 0, 0))


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='renewal-apply@kore.com', password='p',
        first_name='Rita', last_name='Renewal', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Mensual', category='personalizado', sessions_count=8,
        session_duration_minutes=60, price=Decimal('200000'), currency='COP',
        validity_days=30, is_active=True,
    )


@pytest.fixture
def smaller_package(db):
    return Package.objects.create(
        title='Plan Ligero', category='personalizado', sessions_count=4,
        session_duration_minutes=60, price=Decimal('120000'), currency='COP',
        validity_days=15, is_active=True,
    )


@pytest.fixture
def subscription(customer, package):
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=8, sessions_used=6,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW - timedelta(days=30),
        expires_at=FIXED_NOW,
        next_billing_date=FIXED_NOW.date(),
    )


@pytest.fixture
def payment(customer, subscription):
    return Payment.objects.create(
        subscription=subscription, customer=customer,
        status=Payment.Status.CONFIRMED, amount=Decimal('200000'),
        currency='COP', provider=Payment.Provider.WOMPI,
        provider_reference='ref-renewal-1',
    )


@pytest.mark.django_db
class TestApplyRecurringRenewal:
    """Contract of apply_recurring_renewal for the task and webhook paths."""

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_noop_when_payment_already_recorded(self, mock_receipt, subscription, package, payment):
        """A payment already referenced by a renewal row is not applied twice."""
        SubscriptionRenewal.objects.create(
            subscription=subscription, kind=SubscriptionRenewal.Kind.AUTOMATIC,
            period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
            sessions_granted=8, package=package, payment=payment,
        )

        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        assert subscription.sessions_used == 6
        assert SubscriptionRenewal.objects.filter(payment=payment).count() == 1
        mock_receipt.assert_not_called()

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_rolls_over_leftover_sessions(self, mock_receipt, subscription, package, payment):
        """Remaining sessions are added on top of the package allowance."""
        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        leftover = 2
        assert subscription.sessions_total == package.sessions_count + leftover

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_rollover_is_capped_at_max(self, mock_receipt, subscription, package, payment):
        """Leftover sessions beyond MAX_ROLLOVER_SESSIONS do not carry over."""
        subscription.sessions_total = MAX_ROLLOVER_SESSIONS + 10
        subscription.sessions_used = 0
        subscription.save(update_fields=['sessions_total', 'sessions_used'])

        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        assert subscription.sessions_total == package.sessions_count + MAX_ROLLOVER_SESSIONS

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_resets_sessions_used(self, mock_receipt, subscription, payment):
        """The new cycle starts with zero used sessions."""
        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        assert subscription.sessions_used == 0

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_applies_pending_package_and_clears_it(
        self, mock_receipt, subscription, smaller_package, payment,
    ):
        """A scheduled plan change takes effect on renewal and is cleared."""
        subscription.pending_package = smaller_package
        subscription.save(update_fields=['pending_package'])

        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        assert subscription.package == smaller_package
        assert subscription.pending_package is None
        assert subscription.sessions_total == smaller_package.sessions_count + 2

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_advances_next_billing_date_from_previous(self, mock_receipt, subscription, package, payment):
        """next_billing_date moves forward validity_days from its previous value."""
        previous = subscription.next_billing_date

        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        assert subscription.next_billing_date == previous + timedelta(days=package.validity_days)

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_next_billing_date_falls_back_to_today_when_unset(
        self, mock_receipt, subscription, package, payment,
    ):
        """Without a previous next_billing_date the new one counts from today."""
        subscription.next_billing_date = None
        subscription.save(update_fields=['next_billing_date'])

        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        expected = FIXED_NOW.date() + timedelta(days=package.validity_days)
        assert subscription.next_billing_date == expected

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_extends_expiry_by_package_validity(self, mock_receipt, subscription, package, payment):
        """The period end lands validity_days after the (frozen) renewal moment."""
        apply_recurring_renewal(subscription, payment)

        subscription.refresh_from_db()
        assert subscription.expires_at == FIXED_NOW + timedelta(days=package.validity_days)

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_records_automatic_renewal_row(self, mock_receipt, subscription, package, payment):
        """The renewal history row links the payment and the granted sessions."""
        apply_recurring_renewal(subscription, payment)

        renewal = SubscriptionRenewal.objects.get(payment=payment)
        assert renewal.kind == SubscriptionRenewal.Kind.AUTOMATIC
        assert renewal.package == package
        assert renewal.sessions_granted == subscription.sessions_total

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_creates_payment_confirmed_notification(self, mock_receipt, subscription, payment):
        """A PAYMENT_CONFIRMED notification is created with the audit payload."""
        apply_recurring_renewal(subscription, payment)

        notification = Notification.objects.get(payment=payment)
        assert notification.notification_type == Notification.Type.PAYMENT_CONFIRMED
        assert notification.sent_to == subscription.customer.email
        assert notification.payload['subscription_id'] == subscription.id
        assert notification.payload['reference'] == payment.provider_reference

    @patch('core_app.services.recurring_renewal.send_payment_receipt')
    def test_sends_receipt_for_the_payment(self, mock_receipt, subscription, payment):
        """The receipt email goes out exactly once for the funding payment."""
        apply_recurring_renewal(subscription, payment)

        mock_receipt.assert_called_once_with(payment)
        assert mock_receipt.call_count == 1
