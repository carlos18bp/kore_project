import pytest
from datetime import timedelta
from unittest.mock import MagicMock

from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, TrainerProfile, User
from core_app.services.ics_generator import generate_ics


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='trainer_ics@example.com', password='p',
        first_name='Germán', last_name='Franco', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    return TrainerProfile.objects.create(
        user=trainer_user, specialty='Functional', location='Studio X',
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='cust_ics@example.com', password='p',
        first_name='Juan', last_name='Pérez',
    )


@pytest.fixture
def package(db):
    return Package.objects.create(title='Pkg', is_active=True)


@pytest.fixture
def booking_with_trainer(customer, package, trainer_profile):
    now = timezone.now()
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
    def test_returns_bytes(self, booking_with_trainer):
        result = generate_ics(booking_with_trainer)
        assert isinstance(result, bytes)

    def test_contains_vcalendar_markers(self, booking_with_trainer):
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'BEGIN:VCALENDAR' in ics
        assert 'END:VCALENDAR' in ics
        assert 'BEGIN:VEVENT' in ics
        assert 'END:VEVENT' in ics

    def test_contains_trainer_name_in_summary(self, booking_with_trainer):
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'Germán Franco' in ics

    def test_contains_location(self, booking_with_trainer):
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'Studio X' in ics

    def test_contains_attendee_email(self, booking_with_trainer):
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'cust_ics@example.com' in ics

    def test_contains_dtstart_and_dtend(self, booking_with_trainer):
        ics = generate_ics(booking_with_trainer).decode('utf-8')
        assert 'DTSTART:' in ics
        assert 'DTEND:' in ics

    def test_works_without_trainer(self, customer, package):
        now = timezone.now()
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
