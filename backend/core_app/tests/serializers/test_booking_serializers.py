"""Tests for BookingSerializer — starts_at-based validation and create."""

import datetime as dt

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from core_app.models import Booking, Package, Subscription, TrainerProfile, User
from core_app.serializers import BookingSerializer
from core_app.serializers.booking_serializers import NoTrainerAssignedException

# Wednesday 2025-01-15 10:00 Bogota = 15:00 UTC
FIXED_NOW = timezone.make_aware(dt.datetime(2025, 1, 15, 10, 0, 0))
# Thursday 2025-01-16 05:00 Bogota = 10:00 UTC — on 15-min grid, ~19h after FIXED_NOW
VALID_STARTS_AT = '2025-01-16T10:00:00Z'
VALID_STARTS_AT_DT = dt.datetime(2025, 1, 16, 10, 0, 0, tzinfo=dt.timezone.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def default_trainer(db):
    user = User.objects.create_user(email='trainer@example.com', password='p', role=User.Role.TRAINER)
    return TrainerProfile.objects.create(user=user, specialty='General')


@pytest.fixture
def customer(db, default_trainer):
    u = User.objects.create_user(email='cust@example.com', password='p')
    u.assigned_trainer = default_trainer
    u.save(update_fields=['assigned_trainer'])
    return u


@pytest.fixture
def package(db):
    return Package.objects.create(title='Pkg', is_active=True)


def _req(user):
    r = APIRequestFactory().post('/fake/')
    r.user = user
    return r


# ── Validation ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBookingSerializerValidation:
    def test_valid_starts_at_passes(self, customer, package):
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': VALID_STARTS_AT},
            context={'request': _req(customer)},
        )
        assert s.is_valid(), s.errors

    def test_off_grid_starts_at_rejected(self, customer, package):
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': '2025-01-16T10:07:00Z'},
            context={'request': _req(customer)},
        )
        assert not s.is_valid()
        assert 'starts_at' in s.errors

    def test_past_starts_at_rejected(self, customer, package):
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': '2025-01-01T10:00:00Z'},
            context={'request': _req(customer)},
        )
        assert not s.is_valid()
        assert 'starts_at' in s.errors

    def test_beyond_horizon_starts_at_rejected(self, customer, package):
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': '2025-03-20T10:00:00Z'},
            context={'request': _req(customer)},
        )
        assert not s.is_valid()
        assert 'starts_at' in s.errors

    def test_no_trainer_assigned_raises(self, package, db):
        u = User.objects.create_user(email='no_trainer@example.com', password='p')
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': VALID_STARTS_AT},
            context={'request': _req(u)},
        )
        with pytest.raises(NoTrainerAssignedException):
            s.is_valid(raise_exception=True)

    def test_unauthenticated_fails_validation(self, package, db):
        class AnonUser:
            is_authenticated = False
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': VALID_STARTS_AT},
            context={'request': _req(AnonUser())},
        )
        assert not s.is_valid()
        assert 'trainer_id' in s.errors

    def test_exhausted_subscription_rejected(self, customer, package):
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=5, sessions_used=5,
            status=Subscription.Status.ACTIVE,
            starts_at=FIXED_NOW, expires_at=FIXED_NOW + dt.timedelta(days=30),
        )
        s = BookingSerializer(
            data={
                'package_id': package.id,
                'starts_at': VALID_STARTS_AT,
                'subscription_id': sub.id,
            },
            context={'request': _req(customer)},
        )
        assert not s.is_valid()
        assert 'subscription_id' in s.errors


# ── Create ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestBookingSerializerCreate:
    def test_create_sets_starts_at_ends_at_customer_trainer(self, customer, package, default_trainer):
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': VALID_STARTS_AT},
            context={'request': _req(customer)},
        )
        assert s.is_valid(), s.errors
        booking = s.save()
        assert booking.starts_at == VALID_STARTS_AT_DT
        assert booking.ends_at == VALID_STARTS_AT_DT + dt.timedelta(minutes=60)
        assert booking.customer == customer
        assert booking.trainer == default_trainer
        assert booking.status == Booking.Status.PENDING

    def test_create_decrements_subscription(self, customer, package):
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=10, sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=FIXED_NOW, expires_at=FIXED_NOW + dt.timedelta(days=30),
        )
        s = BookingSerializer(
            data={
                'package_id': package.id,
                'starts_at': VALID_STARTS_AT,
                'subscription_id': sub.id,
            },
            context={'request': _req(customer)},
        )
        assert s.is_valid(), s.errors
        s.save()
        sub.refresh_from_db()
        assert sub.sessions_used == 3

    def test_read_representation_has_starts_at_ends_at(self, customer, package):
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': VALID_STARTS_AT},
            context={'request': _req(customer)},
        )
        s.is_valid(raise_exception=True)
        booking = s.save()
        output = BookingSerializer(booking).data
        assert 'starts_at' in output
        assert 'ends_at' in output
        assert 'slot' not in output
        assert isinstance(output['package'], dict)

    def test_race_condition_raises(self, customer, package, default_trainer):
        """Second create fails when trainer+time is already booked after validate()."""
        s = BookingSerializer(
            data={'package_id': package.id, 'starts_at': VALID_STARTS_AT},
            context={'request': _req(customer)},
        )
        assert s.is_valid(), s.errors
        # Another booking claims the same slot before s.save()
        other = User.objects.create_user(email='racer@example.com', password='p')
        Booking.objects.create(
            customer=other, package=package, trainer=default_trainer,
            status=Booking.Status.PENDING,
            starts_at=VALID_STARTS_AT_DT,
            ends_at=VALID_STARTS_AT_DT + dt.timedelta(minutes=60),
        )
        with pytest.raises(ValidationError):
            s.save()
