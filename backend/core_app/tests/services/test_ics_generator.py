"""Service tests for ICS calendar generation from booking data."""

from datetime import datetime, timedelta

import pytest
from django.test import override_settings
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, TrainerProfile, User
from core_app.services.ics_generator import generate_ics

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
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=25),
        ends_at=now + timedelta(hours=26),
        trainer=trainer_profile,
    )
    return Booking.objects.create(
        customer=customer, package=package, slot=slot,
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
        """Include both customer and trainer as attendees when trainer exists."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'ATTENDEE;CN=Juan Pérez:mailto:cust_ics@example.com' in ics
        assert 'ATTENDEE;CN=Germán Franco:mailto:trainer_ics@example.com' in ics

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
        """Include DTSTART and DTEND fields to define event boundaries."""
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'DTSTART:' in ics
        assert 'DTEND:' in ics

    def test_works_without_trainer(self, customer, package):
        """Generate a valid ICS payload even when booking has no trainer assigned."""
        now = FIXED_NOW
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=25),
            ends_at=now + timedelta(hours=26),
        )
        booking = Booking.objects.create(
            customer=customer, package=package, slot=slot,
            status=Booking.Status.CONFIRMED,
        )
        ics = generate_ics(booking).decode('utf-8')
        assert 'Entrenamiento KÓRE' in ics
        assert 'BEGIN:VCALENDAR' in ics
