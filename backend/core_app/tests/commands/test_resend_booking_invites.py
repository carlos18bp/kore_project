"""Tests for the resend_booking_invites management command."""

from datetime import datetime, timedelta
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, User


def _create_trainer():
    """Create a trainer user with associated TrainerProfile."""
    from core_app.models.trainer_profile import TrainerProfile

    user = User.objects.create_user(
        email='trainer@test.com', password='pass', role=User.Role.TRAINER,
        first_name='Test', last_name='Trainer',
    )
    profile = TrainerProfile.objects.create(user=user, location='Test Location')
    return profile


def _create_booking(*, customer_email, trainer_profile, status, starts_at, package=None):
    """Create a booking with related objects for testing."""
    customer = User.objects.create_user(
        email=customer_email, password='pass', role=User.Role.CUSTOMER,
        first_name='Client', last_name='Test',
    )
    if package is None:
        package = Package.objects.create(
            title='Test Package', sessions_count=4, validity_days=30, price='100000.00',
        )
    slot = AvailabilitySlot.objects.create(
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=1),
        is_active=True,
        is_blocked=True,
    )
    return Booking.objects.create(
        customer=customer,
        trainer=trainer_profile,
        package=package,
        slot=slot,
        status=status,
    )


@pytest.mark.django_db
def test_no_bookings_found_shows_warning():
    """Command outputs warning when no bookings match criteria."""
    out = StringIO()
    call_command('resend_booking_invites', '--dry-run', stdout=out)
    assert 'No bookings found' in out.getvalue()


@pytest.mark.django_db
def test_dry_run_does_not_send_emails():
    """Dry run lists bookings but does not actually send emails."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    _create_booking(
        customer_email='client1@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )

    out = StringIO()
    call_command('resend_booking_invites', '--dry-run', stdout=out)
    output = out.getvalue()
    assert 'DRY RUN' in output
    assert 'client1@test.com' in output or 'Client Test' in output
    assert '1 sent' in output or 'Completed' in output


@pytest.mark.django_db
def test_specific_booking_id_filters_correctly():
    """Command with --booking-id only processes that specific booking."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    b1 = _create_booking(
        customer_email='client-a@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )
    _create_booking(
        customer_email='client-b@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future + timedelta(days=1),
    )

    out = StringIO()
    call_command('resend_booking_invites', '--dry-run', f'--booking-id={b1.pk}', stdout=out)
    output = out.getvalue()
    assert 'Found 1 booking' in output


@pytest.mark.django_db
def test_before_date_filter():
    """Command with --before filters bookings created before the given date."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=10)
    _create_booking(
        customer_email='old@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )

    out = StringIO()
    tomorrow = (timezone.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    call_command('resend_booking_invites', '--dry-run', f'--before={tomorrow}', stdout=out)
    output = out.getvalue()
    assert 'Found 1 booking' in output


@pytest.mark.django_db
def test_invalid_date_format_raises_error():
    """Command raises CommandError for invalid --before date format."""
    with pytest.raises(CommandError, match='Invalid date format'):
        call_command('resend_booking_invites', '--before=not-a-date')


@pytest.mark.django_db
def test_excludes_past_bookings():
    """Command only includes future bookings, not past ones."""
    trainer = _create_trainer()
    past = timezone.now() - timedelta(days=5)
    _create_booking(
        customer_email='past@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=past,
    )

    out = StringIO()
    call_command('resend_booking_invites', '--dry-run', stdout=out)
    assert 'No bookings found' in out.getvalue()


@pytest.mark.django_db
def test_excludes_canceled_bookings():
    """Command excludes bookings with canceled status."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    _create_booking(
        customer_email='canceled@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CANCELED,
        starts_at=future,
    )

    out = StringIO()
    call_command('resend_booking_invites', '--dry-run', stdout=out)
    assert 'No bookings found' in out.getvalue()


@pytest.mark.django_db
@patch('core_app.management.commands.resend_booking_invites.send_template_email', return_value=True)
@patch('core_app.management.commands.resend_booking_invites.generate_ics', return_value=b'ICS_DATA')
def test_successful_send(mock_ics, mock_email):
    """Command sends email and ICS attachment on successful execution."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    _create_booking(
        customer_email='success@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )

    out = StringIO()
    call_command('resend_booking_invites', stdout=out)
    output = out.getvalue()
    assert '1 sent' in output
    assert '0 errors' in output
    mock_email.assert_called_once()
    mock_ics.assert_called_once()

    call_args = mock_email.call_args
    assert call_args.kwargs['template_name'] == 'booking_confirmation'
    attachments = call_args.kwargs['attachments']
    assert len(attachments) == 1
    assert attachments[0][0] == 'session.ics'


@pytest.mark.django_db
@patch('core_app.management.commands.resend_booking_invites.send_template_email', return_value=False)
@patch('core_app.management.commands.resend_booking_invites.generate_ics', return_value=b'ICS_DATA')
def test_failed_send_counted_as_error(mock_ics, mock_email):
    """Command counts failed email sends in the error tally."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    _create_booking(
        customer_email='fail@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )

    out = StringIO()
    call_command('resend_booking_invites', stdout=out)
    output = out.getvalue()
    assert '0 sent' in output
    assert '1 errors' in output


@pytest.mark.django_db
@patch('core_app.management.commands.resend_booking_invites.generate_ics', side_effect=Exception('ICS error'))
def test_exception_during_send_counted_as_error(mock_ics):
    """Command catches exceptions during processing and counts as error."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    _create_booking(
        customer_email='exception@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )

    out = StringIO()
    call_command('resend_booking_invites', stdout=out)
    output = out.getvalue()
    assert '0 sent' in output
    assert '1 errors' in output
    assert 'ICS error' in output


@pytest.mark.django_db
@patch('core_app.management.commands.resend_booking_invites.send_template_email', return_value=True)
@patch('core_app.management.commands.resend_booking_invites.generate_ics', return_value=b'ICS_DATA')
def test_sends_to_both_customer_and_trainer(mock_ics, mock_email):
    """Command includes trainer email in recipients when available."""
    trainer = _create_trainer()
    future = timezone.now() + timedelta(days=5)
    _create_booking(
        customer_email='both@test.com',
        trainer_profile=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=future,
    )

    out = StringIO()
    call_command('resend_booking_invites', stdout=out)

    call_args = mock_email.call_args
    recipients = call_args.kwargs['to_emails']
    assert 'both@test.com' in recipients
    assert 'trainer@test.com' in recipients


@pytest.mark.django_db
@patch('core_app.management.commands.resend_booking_invites.send_template_email', return_value=True)
@patch('core_app.management.commands.resend_booking_invites.generate_ics', return_value=b'ICS_DATA')
def test_sends_only_to_customer_when_no_trainer(mock_ics, mock_email):
    """Command sends only to customer when booking has no trainer assigned."""
    customer = User.objects.create_user(
        email='solo@test.com', password='pass', role=User.Role.CUSTOMER,
        first_name='Solo', last_name='Client',
    )
    package = Package.objects.create(
        title='Pkg', sessions_count=4, validity_days=30, price='100000.00',
    )
    future = timezone.now() + timedelta(days=5)
    slot = AvailabilitySlot.objects.create(
        starts_at=future, ends_at=future + timedelta(hours=1),
        is_active=True, is_blocked=True,
    )
    Booking.objects.create(
        customer=customer, trainer=None,
        package=package, slot=slot, status=Booking.Status.CONFIRMED,
    )

    out = StringIO()
    call_command('resend_booking_invites', stdout=out)

    call_args = mock_email.call_args
    recipients = call_args.kwargs['to_emails']
    assert recipients == ['solo@test.com']
    context = call_args.kwargs['context']
    assert context['trainer_name'] == 'Por asignar'
