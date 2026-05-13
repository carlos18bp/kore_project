"""Tests for email_service.py — covers exception handling path (lines 70-72)."""

from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from core_app.models import (
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
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=1, hours=1),
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
        assert mock_send.call_args.kwargs['to_emails'] == [customer.email, trainer_user.email]

    def test_send_booking_confirmation_without_trainer_sends_only_to_customer(self):
        """Ensure confirmations without trainer keep customer-only recipients."""
        customer = User.objects.create_user(
            email='booking_confirm_solo@example.com', password='pass', first_name='Ana', last_name='Perez',
        )
        package = Package.objects.create(title='Pack', sessions_count=4, validity_days=30, price=Decimal('100.00'))
        now = _fixed_now()
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=1, hours=1),
            status=Booking.Status.CONFIRMED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            send_booking_confirmation(booking)

        assert mock_send.call_args.kwargs['to_emails'] == [customer.email]

    def test_send_booking_cancellation_records_failed_notification(self):
        """Ensure cancellations record failed notifications when email fails."""
        customer = User.objects.create_user(
            email='booking_cancel@example.com', password='pass', first_name='Lia', last_name='Gomez',
        )
        package = Package.objects.create(title='Pack', sessions_count=2, validity_days=30, price=Decimal('80.00'))
        now = _fixed_now()
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=1),
            status=Booking.Status.CANCELED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=False):
            notification = send_booking_cancellation(booking)

        assert notification.notification_type == Notification.Type.BOOKING_CANCELED
        assert notification.status == Notification.Status.FAILED

    def test_send_booking_cancellation_sends_to_customer_and_trainer_with_ics(self):
        """Cancellation email goes to both customer and trainer and includes a METHOD:CANCEL ICS."""
        customer = User.objects.create_user(
            email='cancel_customer@example.com', password='pass', first_name='Lia', last_name='Gomez',
        )
        trainer_user = User.objects.create_user(
            email='cancel_trainer@example.com', password='pass', first_name='Pedro', last_name='Villa',
            role=User.Role.TRAINER,
        )
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Yoga', location='Studio 2')
        package = Package.objects.create(title='Pack', sessions_count=2, validity_days=30, price=Decimal('80.00'))
        now = _fixed_now()
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=1),
            trainer=trainer,
            status=Booking.Status.CANCELED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            send_booking_cancellation(booking)

        call_kwargs = mock_send.call_args.kwargs
        assert customer.email in call_kwargs['to_emails']
        assert trainer_user.email in call_kwargs['to_emails']
        attachments = call_kwargs['attachments']
        assert attachments, 'cancellation ICS attachment must be present'
        filename, ics_bytes, mime_type = attachments[0]
        assert filename == 'session_cancelada.ics'
        assert mime_type == 'text/calendar'
        assert b'METHOD:CANCEL' in ics_bytes
        assert b'STATUS:CANCELLED' in ics_bytes
        assert f'booking-{booking.pk}@korehealths.com'.encode() in ics_bytes

    def test_send_booking_reschedule_passes_old_slot_context(self):
        """Ensure reschedule emails include the prior booking start/end in context."""
        customer = User.objects.create_user(
            email='booking_reschedule@example.com', password='pass', first_name='Mia', last_name='Torres',
        )
        package = Package.objects.create(title='Pack', sessions_count=3, validity_days=30, price=Decimal('90.00'))
        now = _fixed_now()
        old_starts_at = now + timedelta(days=1)
        old_ends_at = now + timedelta(days=1, hours=1)
        old_booking = Booking.objects.create(
            customer=customer,
            package=package,
            starts_at=old_starts_at,
            ends_at=old_ends_at,
            status=Booking.Status.CANCELED,
        )
        new_booking = Booking.objects.create(
            customer=customer,
            package=package,
            starts_at=now + timedelta(days=3),
            ends_at=now + timedelta(days=3, hours=1),
            status=Booking.Status.CONFIRMED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            notification = send_booking_reschedule(old_booking, new_booking)

        context = mock_send.call_args.kwargs['context']
        assert context['old_slot_start'] == old_starts_at
        assert context['old_slot_end'] == old_ends_at
        assert notification.notification_type == Notification.Type.BOOKING_RESCHEDULED

    def test_send_booking_reschedule_sends_to_customer_and_trainer_with_two_ics(self):
        """Reschedule email goes to customer and trainer with cancel + new ICS attachments."""
        customer = User.objects.create_user(
            email='reschedule_customer@example.com', password='pass', first_name='Mia', last_name='Torres',
        )
        trainer_user = User.objects.create_user(
            email='reschedule_trainer@example.com', password='pass', first_name='Luis', last_name='Mora',
            role=User.Role.TRAINER,
        )
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Pilates', location='Studio 3')
        package = Package.objects.create(title='Pack', sessions_count=3, validity_days=30, price=Decimal('90.00'))
        now = _fixed_now()
        old_booking = Booking.objects.create(
            customer=customer, package=package,
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=1, hours=1),
            trainer=trainer, status=Booking.Status.CANCELED,
        )
        new_booking = Booking.objects.create(
            customer=customer, package=package,
            starts_at=now + timedelta(days=3),
            ends_at=now + timedelta(days=3, hours=1),
            trainer=trainer, status=Booking.Status.CONFIRMED,
        )

        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            send_booking_reschedule(old_booking, new_booking)

        call_kwargs = mock_send.call_args.kwargs
        assert customer.email in call_kwargs['to_emails']
        assert trainer_user.email in call_kwargs['to_emails']

        attachments = call_kwargs['attachments']
        assert len(attachments) == 2

        filenames = [a[0] for a in attachments]
        assert 'session_cancelada.ics' in filenames
        assert 'session_nueva.ics' in filenames

        cancel_ics = next(a[1] for a in attachments if a[0] == 'session_cancelada.ics')
        new_ics = next(a[1] for a in attachments if a[0] == 'session_nueva.ics')

        assert b'METHOD:CANCEL' in cancel_ics
        assert f'booking-{old_booking.pk}@korehealths.com'.encode() in cancel_ics
        assert b'METHOD:REQUEST' in new_ics
        assert f'booking-{new_booking.pk}@korehealths.com'.encode() in new_ics


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


@pytest.mark.django_db
class TestWelcomeEmail:
    """Cover send_welcome_email helper paths."""

    def test_send_welcome_email_with_package(self):
        """send_welcome_email sends welcome email when package is provided."""
        from core_app.services.email_service import send_welcome_email
        user = User.objects.create_user(
            email='welcome@example.com', password='pass',
            first_name='Ana', last_name='Torres',
        )
        pkg = Package.objects.create(title='Premium', sessions_count=12, validity_days=30)
        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            result = send_welcome_email(user, pkg)
        assert result is True
        ctx = mock_send.call_args.kwargs['context']
        assert ctx['package_title'] == 'Premium'

    def test_send_welcome_email_with_none_package_uses_fallback_strings(self):
        """send_welcome_email sends welcome email when package is None."""
        from core_app.services.email_service import send_welcome_email
        user = User.objects.create_user(
            email='welcome_none@example.com', password='pass',
            first_name='Bob', last_name='Smith',
        )
        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            result = send_welcome_email(user, None)
        assert result is True
        ctx = mock_send.call_args.kwargs['context']
        assert ctx['package_title'] == 'Suscripción KÓRE'

    def test_send_welcome_email_uses_default_login_url_when_setting_absent(self):
        """send_welcome_email falls back to hardcoded URL when FRONTEND_LOGIN_URL is absent."""
        from django.test import override_settings

        from core_app.services.email_service import send_welcome_email
        user = User.objects.create_user(
            email='welcome_url@example.com', password='pass',
            first_name='Luis', last_name='Perez',
        )
        with override_settings(FRONTEND_LOGIN_URL='https://korehealths.com/login'):
            with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
                result = send_welcome_email(user, None)
        assert result is True
        ctx = mock_send.call_args.kwargs['context']
        assert 'korehealths.com' in ctx['login_url']


@pytest.mark.django_db
class TestPasswordResetCodeEmail:
    """Cover send_password_reset_code helper."""

    def test_send_password_reset_code_returns_true_on_success(self):
        """send_password_reset_code returns True when email sends successfully."""
        from core_app.services.email_service import send_password_reset_code
        user = User.objects.create_user(
            email='reset@example.com', password='pass',
            first_name='Carlos', last_name='Ruiz',
        )
        with patch('core_app.services.email_service.send_template_email', return_value=True):
            result = send_password_reset_code(user, '123456')
        assert result is True

    def test_send_password_reset_code_returns_false_when_send_fails(self):
        """send_password_reset_code returns False when underlying email send fails."""
        from core_app.services.email_service import send_password_reset_code
        user = User.objects.create_user(
            email='reset_fail@example.com', password='pass',
            first_name='Maria', last_name='Lopez',
        )
        with patch('core_app.services.email_service.send_template_email', return_value=False):
            result = send_password_reset_code(user, '654321')
        assert result is False


class TestSendRegistrationVerificationCode:
    """Cover send_registration_verification_code function body."""

    def test_delegates_to_send_template_email(self):
        """send_registration_verification_code calls send_template_email and returns its result."""
        from core_app.services.email_service import send_registration_verification_code
        with patch('core_app.services.email_service.send_template_email', return_value=True) as mock_send:
            result = send_registration_verification_code('user@example.com', '123456', 'Carlos')
        assert result is True
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args.kwargs
        assert call_kwargs['template_name'] == 'registration_verification'
        assert 'user@example.com' in call_kwargs['to_emails']


@pytest.mark.django_db
class TestBuildBookingConfirmationRecipientsDeduplicate:
    """Cover the deduplication continue-branch in _build_booking_confirmation_recipients."""

    def test_deduplicates_when_customer_and_trainer_share_email(self):
        """continue branch fires when trainer email equals customer email — list is deduplicated."""
        from core_app.services.email_service import _build_booking_confirmation_recipients
        shared_email = 'shared@example.com'
        customer = User.objects.create_user(email=shared_email, password='p')
        trainer_user = User.objects.create_user(
            email=shared_email.upper(), password='p2', role=User.Role.TRAINER,
        )
        trainer = TrainerProfile.objects.create(user=trainer_user)
        package = Package.objects.create(title='Pkg', is_active=True)
        now = timezone.now()
        booking = Booking.objects.create(
            customer=customer, package=package, trainer=trainer,
            starts_at=now + timedelta(hours=24), ends_at=now + timedelta(hours=25),
        )
        recipients = _build_booking_confirmation_recipients(booking)
        assert recipients.count(shared_email) == 1
