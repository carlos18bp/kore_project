"""Service tests for ICS calendar generation from booking data."""

from datetime import datetime, timedelta
from datetime import timezone as dt_tz

import pytest
from django.test import override_settings
from django.utils import timezone

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.services.ics_generator import (
    _format_dt_bogota,
    _format_dt_utc,
    generate_cancellation_ics,
    generate_ics,
)

FIXED_NOW = timezone.make_aware(datetime(2024, 1, 15, 10, 0, 0))


@pytest.fixture
def trainer_user(db):
    """Create a trainer user used for calendar summary and organizer metadata."""
    return User.objects.create_user(
        email='trainer_ics@example.com', password='p',
        first_name='Germán', last_name='Franco', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    """Create a trainer profile with specialty and location metadata."""
    return TrainerProfile.objects.create(
        user=trainer_user, specialty='Functional', location='Studio X',
    )


@pytest.fixture
def customer(db):
    """Create a customer user that receives the ICS attendee invite."""
    return User.objects.create_user(
        email='cust_ics@example.com', password='p',
        first_name='Juan', last_name='Pérez',
    )


@pytest.fixture
def package(db):
    """Create an active package used by booking fixtures."""
    return Package.objects.create(title='Pkg', is_active=True)


@pytest.fixture
def booking_with_trainer(customer, package, trainer_profile):
    """Create a confirmed booking linked to a trainer for ICS content assertions."""
    now = FIXED_NOW
    return Booking.objects.create(
        customer=customer, package=package,
        starts_at=now + timedelta(hours=25),
        ends_at=now + timedelta(hours=26),
        trainer=trainer_profile, status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
class TestIcsGenerator:
    """ICS payload structure and field coverage for booking calendar exports."""

    def test_returns_bytes(self, booking_with_trainer):
        """Return generated ICS payload as bytes ready for file responses."""
        result = generate_ics(booking_with_trainer)
        assert isinstance(result, bytes)

    def test_contains_vcalendar_markers(self, booking_with_trainer):
        """Include VCALENDAR/VEVENT block delimiters in generated payload."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'BEGIN:VCALENDAR' in ics
        assert 'END:VCALENDAR' in ics
        assert 'BEGIN:VEVENT' in ics
        assert 'END:VEVENT' in ics

    def test_contains_trainer_name_in_summary(self, booking_with_trainer):
        """Embed trainer full name in the event summary text."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'Germán Franco' in ics

    def test_contains_location(self, booking_with_trainer):
        """Embed trainer location in generated calendar event fields."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'Studio X' in ics

    def test_contains_customer_and_trainer_attendees(self, booking_with_trainer):
        """Include both customer and trainer as attendees with RSVP when trainer exists."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'ATTENDEE;CN=Juan Pérez;RSVP=TRUE:mailto:cust_ics@example.com' in ics
        assert 'ATTENDEE;CN=Germán Franco;RSVP=TRUE:mailto:trainer_ics@example.com' in ics

    def test_contains_attendee_email(self, booking_with_trainer):
        """Embed customer email as event attendee information."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'cust_ics@example.com' in ics

    @override_settings(DEFAULT_FROM_EMAIL='Agenda KÓRE <agenda@korehealths.com>')
    def test_organizer_uses_default_from_email_setting(self, booking_with_trainer):
        """Use DEFAULT_FROM_EMAIL as organizer metadata in generated ICS."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'ORGANIZER;CN=Agenda KÓRE:mailto:agenda@korehealths.com' in ics

    @override_settings(DEFAULT_FROM_EMAIL='invalid-from-email')
    def test_organizer_falls_back_when_default_from_email_invalid(self, booking_with_trainer):
        """Fallback organizer email when DEFAULT_FROM_EMAIL cannot be parsed."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'ORGANIZER;CN=KÓRE:mailto:noreply@korehealths.com' in ics

    def test_contains_dtstart_and_dtend(self, booking_with_trainer):
        """Include DTSTART and DTEND fields in UTC format for maximum compatibility."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'DTSTART:' in ics
        assert 'Z' in ics
        assert 'DTEND:' in ics
        assert 'Z' in ics
        # Verify no TZID is used (UTC format doesn't need it)
        assert 'TZID=America/Bogota' not in ics

    def test_works_without_trainer(self, customer, package):
        """Generate a valid ICS payload even when booking has no trainer assigned."""
        now = FIXED_NOW
        booking = Booking.objects.create(
            customer=customer, package=package,
            starts_at=now + timedelta(hours=25),
            ends_at=now + timedelta(hours=26),
            status=Booking.Status.CONFIRMED,
        )
        ics = generate_ics(booking).decode('utf-8')
        assert 'Entrenamiento KÓRE' in ics
        assert 'BEGIN:VCALENDAR' in ics

    def test_uid_is_deterministic_from_booking_pk(self, booking_with_trainer):
        """UID is derived from booking PK so cancellation ICS can match the original."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        expected_uid = f'UID:booking-{booking_with_trainer.pk}@korehealths.com'
        assert expected_uid in ics

    def test_deduplicates_attendees_when_customer_and_trainer_share_email(self):
        """Attendee appears only once when customer and trainer have the same email."""
        # quality: disable unverified_mock (mocks are input data structs; assertion is on rendered ICS output)
        from unittest.mock import MagicMock
        shared_email = 'shared@example.com'

        customer_mock = MagicMock()
        customer_mock.first_name = 'John'
        customer_mock.last_name = 'Doe'
        customer_mock.email = shared_email

        trainer_user_mock = MagicMock()
        trainer_user_mock.first_name = 'John'
        trainer_user_mock.last_name = 'Doe'
        trainer_user_mock.email = shared_email

        trainer_mock = MagicMock()
        trainer_mock.user = trainer_user_mock
        trainer_mock.location = 'Gym A'

        booking_mock = MagicMock()
        booking_mock.starts_at = datetime(2024, 6, 1, 10, 0, tzinfo=dt_tz.utc)
        booking_mock.ends_at = datetime(2024, 6, 1, 11, 0, tzinfo=dt_tz.utc)
        booking_mock.trainer = trainer_mock
        booking_mock.customer = customer_mock

        ics = generate_ics(booking_mock).decode('utf-8')
        assert ics.count(f'mailto:{shared_email}') == 1


class TestFormatDtUtc:
    """Unit tests for the _format_dt_utc helper."""

    def test_with_naive_datetime_treats_as_utc(self):
        """Naive datetime is treated as UTC and formatted with trailing Z."""
        result = _format_dt_utc(datetime(2024, 6, 1, 10, 30, 0))
        assert result == '20240601T103000Z'

    def test_with_aware_utc_datetime(self):
        """Aware UTC datetime is formatted correctly with trailing Z."""
        dt = datetime(2024, 6, 1, 10, 30, 0, tzinfo=dt_tz.utc)
        result = _format_dt_utc(dt)
        assert result == '20240601T103000Z'


@pytest.mark.django_db
class TestGenerateCancellationIcs:
    """ICS cancellation payload structure for removing events from attendee calendars."""

    def test_returns_bytes(self, booking_with_trainer):
        """Return generated cancellation ICS as bytes."""
        result = generate_cancellation_ics(booking_with_trainer)
        assert isinstance(result, bytes)

    def test_method_is_cancel(self, booking_with_trainer):
        """VCALENDAR METHOD must be CANCEL so clients remove the event."""
        ics = generate_cancellation_ics(booking_with_trainer).decode('utf-8')
        assert 'METHOD:CANCEL' in ics

    def test_status_is_cancelled(self, booking_with_trainer):
        """VEVENT STATUS must be CANCELLED."""
        ics = generate_cancellation_ics(booking_with_trainer).decode('utf-8')
        assert 'STATUS:CANCELLED' in ics

    def test_sequence_is_incremented(self, booking_with_trainer):
        """SEQUENCE must be 1 (higher than the original SEQUENCE:0) for clients to accept the cancel."""
        ics = generate_cancellation_ics(booking_with_trainer).decode('utf-8')
        assert 'SEQUENCE:1' in ics

    def test_uid_matches_original(self, booking_with_trainer):
        """UID in cancellation ICS matches UID in the original confirmation ICS."""
        original_ics = generate_ics(booking_with_trainer).decode('utf-8')
        cancel_ics = generate_cancellation_ics(booking_with_trainer).decode('utf-8')
        uid_line = f'UID:booking-{booking_with_trainer.pk}@korehealths.com'
        assert uid_line in original_ics
        assert uid_line in cancel_ics

    def test_contains_attendees(self, booking_with_trainer):
        """Cancellation ICS includes customer and trainer attendees."""
        ics = generate_cancellation_ics(booking_with_trainer).decode('utf-8')
        assert 'cust_ics@example.com' in ics
        assert 'trainer_ics@example.com' in ics

    def test_works_without_trainer(self, customer, package):
        """Generate valid cancellation ICS even when no trainer is assigned."""
        now = FIXED_NOW
        booking = Booking.objects.create(
            customer=customer, package=package,
            starts_at=now + timedelta(hours=25),
            ends_at=now + timedelta(hours=26),
            status=Booking.Status.CANCELED,
        )
        ics = generate_cancellation_ics(booking).decode('utf-8')
        assert 'METHOD:CANCEL' in ics
        assert 'BEGIN:VCALENDAR' in ics


class TestFormatDtBogota:
    """Unit tests for the _format_dt_bogota helper."""

    def test_with_aware_utc_datetime_converts_to_bogota(self):
        """Aware UTC datetime is converted to Bogotá local time (UTC-5)."""
        dt = datetime(2024, 6, 1, 20, 0, 0, tzinfo=dt_tz.utc)
        result = _format_dt_bogota(dt)
        # Bogotá is UTC-5, so 20:00 UTC → 15:00 Bogotá
        assert result == '20240601T150000'

    def test_with_naive_datetime_localizes_to_bogota(self):
        """Naive datetime is localized to Bogotá without UTC conversion."""
        result = _format_dt_bogota(datetime(2024, 6, 1, 10, 0, 0))
        assert result == '20240601T100000'
