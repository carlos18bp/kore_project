"""Tests for the send_expiring_subscription_reminders Huey task."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

import pytest

from core_app.models import Notification, Package, Subscription
from core_app.tasks import send_expiring_subscription_reminders

FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze timezone.now so reminder-window assertions remain deterministic."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def package(db):
    """Create an active package fixture used by reminder task scenarios."""
    return Package.objects.create(
        title='Expiry Pkg',
        sessions_count=10,
        price=Decimal('300000.00'),
        currency='COP',
        validity_days=30,
        is_active=True,
    )


@pytest.fixture
def non_recurring_expiring_sub(existing_user, package):
    """Create a non-recurring subscription that expires within reminder window."""
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=existing_user,
        package=package,
        sessions_total=10,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=25),
        expires_at=now + timedelta(days=5),
        is_recurring=False,
        payment_method_type='NEQUI',
    )


@pytest.mark.django_db
class TestSendExpiringSubscriptionReminders:
    """Validate reminder task processing, filtering, and side-effect behavior."""

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_sends_reminder_and_marks_email_sent(
        self, mock_send, non_recurring_expiring_sub
    ):
        """Marks reminder timestamp when notification is sent successfully."""
        mock_send.return_value = Notification(
            notification_type=Notification.Type.SUBSCRIPTION_EXPIRY_REMINDER,
            status=Notification.Status.SENT,
            sent_to=non_recurring_expiring_sub.customer.email,
        )

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 1, 'sent': 1}
        mock_send.assert_called_once_with(non_recurring_expiring_sub)

        non_recurring_expiring_sub.refresh_from_db()
        assert non_recurring_expiring_sub.expiry_email_sent_at is not None

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_does_not_mark_sent_on_failure(
        self, mock_send, non_recurring_expiring_sub
    ):
        """Leave expiry_email_sent_at empty when notification status is failed."""
        mock_send.return_value = Notification(
            notification_type=Notification.Type.SUBSCRIPTION_EXPIRY_REMINDER,
            status=Notification.Status.FAILED,
            sent_to=non_recurring_expiring_sub.customer.email,
        )

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 1, 'sent': 0}
        non_recurring_expiring_sub.refresh_from_db()
        assert non_recurring_expiring_sub.expiry_email_sent_at is None

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_skips_recurring_subscriptions(
        self, mock_send, existing_user, package
    ):
        """Skips recurring subscriptions from one-time expiry reminder workflow."""
        now = FIXED_NOW
        Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=25),
            expires_at=now + timedelta(days=5),
            is_recurring=True,
            payment_method_type='CARD',
            payment_source_id='ps-123',
        )

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 0, 'sent': 0}
        mock_send.assert_not_called()

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_skips_already_emailed_subscriptions(
        self, mock_send, non_recurring_expiring_sub
    ):
        """Skip subscriptions already marked as reminded in previous executions."""
        non_recurring_expiring_sub.expiry_email_sent_at = FIXED_NOW
        non_recurring_expiring_sub.save(update_fields=['expiry_email_sent_at'])

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 0, 'sent': 0}
        mock_send.assert_not_called()

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_skips_subscription_expiring_beyond_7_days(
        self, mock_send, existing_user, package
    ):
        """Skips subscriptions that are outside the seven-day reminder window."""
        now = FIXED_NOW
        Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=10),
            expires_at=now + timedelta(days=10),
            is_recurring=False,
            payment_method_type='PSE',
        )

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 0, 'sent': 0}
        mock_send.assert_not_called()

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_skips_expired_subscriptions(
        self, mock_send, existing_user, package
    ):
        """Skips subscriptions already expired before task execution time."""
        now = FIXED_NOW
        Subscription.objects.create(
            customer=existing_user,
            package=package,
            sessions_total=10,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=35),
            expires_at=now - timedelta(days=1),
            is_recurring=False,
            payment_method_type='NEQUI',
        )

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 0, 'sent': 0}
        mock_send.assert_not_called()

    @patch('core_app.tasks.send_subscription_expiry_reminder')
    def test_handles_none_notification_return(
        self, mock_send, non_recurring_expiring_sub
    ):
        """Treat None notification responses as unsent without timestamp updates."""
        mock_send.return_value = None

        result = send_expiring_subscription_reminders.call_local()

        assert result == {'processed': 1, 'sent': 0}
        non_recurring_expiring_sub.refresh_from_db()
        assert non_recurring_expiring_sub.expiry_email_sent_at is None
