"""Tests for email_service.py — covers exception handling path (lines 70-72)."""

from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Notification,
    Package,
    Payment,
    Subscription,
    TrainerProfile,
    User,
)
from core_app.services.email_service import (
    send_booking_cancellation,
    send_booking_confirmation,
    send_booking_reschedule,
    send_payment_receipt,
    send_subscription_expiry_reminder,
    send_template_email,
)

FIXED_NOW = timezone.make_aware(timezone.datetime(2025, 2, 3, 9, 0, 0), timezone.get_current_timezone())


def _fixed_now():
    return FIXED_NOW


@pytest.mark.django_db
class TestSendTemplateEmail:
    """Validate generic template email helper behavior."""

    @patch('core_app.services.email_service.EmailMessage')
    @patch('core_app.services.email_service.render_to_string', return_value='<html></html>')
    def test_send_failure_returns_false(self, mock_render, mock_email_cls):
        """Email send() exception is caught and returns False (lines 70-72)."""
        mock_instance = MagicMock()
        mock_instance.send.side_effect = Exception('SMTP failure')
        mock_email_cls.return_value = mock_instance

        result = send_template_email(
            template_name='booking_confirmation',
            subject='Test',
            to_emails=['test@example.com'],
        )

        assert result is False
        mock_instance.send.assert_called_once()

    @patch('core_app.services.email_service.EmailMessage')
    @patch('core_app.services.email_service.render_to_string', return_value='<html></html>')
    def test_send_success_returns_true(self, mock_render, mock_email_cls):
        """Successful send returns True."""
        mock_instance = MagicMock()
        mock_instance.send.return_value = 1
        mock_email_cls.return_value = mock_instance

        result = send_template_email(
            template_name='booking_confirmation',
            subject='Test',
            to_emails=['test@example.com'],
            attachments=[('file.ics', b'data', 'text/calendar')],
        )

        assert result is True
        mock_instance.send.assert_called_once()


@pytest.mark.django_db
class TestBookingEmailNotifications:
    """Validate booking-related email notification helpers."""

    def test_send_booking_confirmation_creates_sent_notification(self):
        """Ensure confirmation emails record a sent notification and attachment."""
        customer = User.objects.create_user(
            email='booking_confirm@example.com', password='pass', first_name='Ana', last_name='Perez',
        )
        trainer_user = User.objects.create_user(
            email='trainer_confirm@example.com', password='pass', first_name='Tom', last_name='Lee',
            role=User.Role.TRAINER,
        )
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Strength', location='Studio 1')
        package = Package.objects.create(title='Pack', sessions_count=4, validity_days=30, price=Decimal('100.00'))
        now = _fixed_now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=1, hours=1),
            is_active=True,
            is_blocked=False,
        )
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=slot,
            trainer=trainer,
            status=Booking.Status.CONFIRMED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            notification = send_booking_confirmation(booking)

        assert notification.notification_type == Notification.Type.BOOKING_CONFIRMED
        assert notification.status == Notification.Status.SENT
        assert notification.sent_to == customer.email
        assert notification.booking == booking
        assert mock_send.call_args.kwargs['attachments']

    def test_send_booking_cancellation_records_failed_notification(self):
        """Ensure cancellations record failed notifications when email fails."""
        customer = User.objects.create_user(
            email='booking_cancel@example.com', password='pass', first_name='Lia', last_name='Gomez',
        )
        package = Package.objects.create(title='Pack', sessions_count=2, validity_days=30, price=Decimal('80.00'))
        now = _fixed_now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=1),
            is_active=True,
            is_blocked=False,
        )
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=slot,
            status=Booking.Status.CANCELED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=False):
            notification = send_booking_cancellation(booking)

        assert notification.notification_type == Notification.Type.BOOKING_CANCELED
        assert notification.status == Notification.Status.FAILED

    def test_send_booking_reschedule_passes_old_slot_context(self):
        """Ensure reschedule emails include the prior slot in context."""
        customer = User.objects.create_user(
            email='booking_reschedule@example.com', password='pass', first_name='Mia', last_name='Torres',
        )
        package = Package.objects.create(title='Pack', sessions_count=3, validity_days=30, price=Decimal('90.00'))
        now = _fixed_now()
        old_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=1, hours=1),
            is_active=True,
            is_blocked=False,
        )
        new_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(days=3),
            ends_at=now + timedelta(days=3, hours=1),
            is_active=True,
            is_blocked=False,
        )
        old_booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=old_slot,
            status=Booking.Status.CANCELED,
        )
        new_booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=new_slot,
            status=Booking.Status.CONFIRMED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            notification = send_booking_reschedule(old_booking, new_booking)

        context = mock_send.call_args.kwargs['context']
        assert context['old_slot_start'] == old_slot.starts_at
        assert context['old_slot_end'] == old_slot.ends_at
        assert notification.notification_type == Notification.Type.BOOKING_RESCHEDULED


@pytest.mark.django_db
class TestPaymentReceiptEmail:
    """Validate payment receipt email helper behaviors."""

    def test_send_payment_receipt_creates_notification_for_customer(self):
        """Ensure payment receipt emails store a sent notification."""
        customer = User.objects.create_user(
            email='receipt@example.com', password='pass', first_name='Leo', last_name='Diaz',
        )
        package = Package.objects.create(title='Pack', sessions_count=5, validity_days=30, price=Decimal('120.00'))
        now = _fixed_now()
        subscription = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=5,
            sessions_used=1,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=1),
            expires_at=now + timedelta(days=29),
        )
        payment = Payment.objects.create(
            customer=customer,
            subscription=subscription,
            amount=Decimal('120.00'),
            currency='COP',
            provider_reference='ref-123',
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True):
            notification = send_payment_receipt(payment)

        assert notification.notification_type == Notification.Type.RECEIPT_EMAIL
        assert notification.status == Notification.Status.SENT
        assert notification.sent_to == customer.email

    def test_send_payment_receipt_returns_none_without_customer(self):
        """Ensure missing customers skip notifications for payment receipts."""
        payment = SimpleNamespace(customer=None, pk=999)

        result = send_payment_receipt(payment)

        assert result is None
        assert Notification.objects.count() == 0


@pytest.mark.django_db
class TestSubscriptionExpiryReminderEmail:
    """Validate subscription expiry reminder email behaviors."""

    def test_send_subscription_expiry_reminder_creates_notification(self):
        """Ensure expiry reminders record a sent notification."""
        customer = User.objects.create_user(
            email='expiry@example.com', password='pass', first_name='Nora', last_name='Vega',
        )
        package = Package.objects.create(title='Pack', sessions_count=6, validity_days=30, price=Decimal('140.00'))
        now = _fixed_now()
        subscription = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=6,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=20),
            expires_at=now + timedelta(days=5),
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True):
            notification = send_subscription_expiry_reminder(subscription)

        assert notification.notification_type == Notification.Type.SUBSCRIPTION_EXPIRY_REMINDER
        assert notification.status == Notification.Status.SENT
        assert notification.payload['subscription_id'] == subscription.pk

    def test_send_subscription_expiry_reminder_returns_none_without_customer(self):
        """Ensure missing customers skip expiry reminder notifications."""
        subscription = SimpleNamespace(customer=None, pk=456)

        result = send_subscription_expiry_reminder(subscription)

        assert result is None
        assert Notification.objects.count() == 0
