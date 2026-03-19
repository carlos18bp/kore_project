"""Tests for the auto_complete_past_bookings Huey task."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, User
from core_app.tasks import auto_complete_past_bookings


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='auto-complete@test.com', password='pass',
        first_name='Auto', last_name='Complete', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Test Pkg', sessions_count=4, validity_days=30, price='100000.00',
    )


def _create_booking(customer, package, *, status, slot_ends_at):
    slot = AvailabilitySlot.objects.create(
        starts_at=slot_ends_at - timedelta(hours=1),
        ends_at=slot_ends_at,
        is_active=True, is_blocked=True,
    )
    return Booking.objects.create(
        customer=customer, package=package,
        slot=slot, status=status,
    )


@pytest.mark.django_db
def test_completes_past_pending_bookings(customer, package):
    """Mark past pending bookings as confirmed."""
    past = timezone.now() - timedelta(hours=2)
    booking = _create_booking(customer, package, status=Booking.Status.PENDING, slot_ends_at=past)

    result = auto_complete_past_bookings.call_local()

    booking.refresh_from_db()
    assert booking.status == Booking.Status.CONFIRMED
    assert result['completed'] == 1


@pytest.mark.django_db
def test_ignores_future_pending_bookings(customer, package):
    """Do not complete future pending bookings."""
    future = timezone.now() + timedelta(hours=2)
    booking = _create_booking(customer, package, status=Booking.Status.PENDING, slot_ends_at=future)

    result = auto_complete_past_bookings.call_local()

    booking.refresh_from_db()
    assert booking.status == Booking.Status.PENDING
    assert result['completed'] == 0


@pytest.mark.django_db
def test_ignores_already_confirmed_bookings(customer, package):
    """Do not modify already confirmed bookings."""
    past = timezone.now() - timedelta(hours=2)
    booking = _create_booking(customer, package, status=Booking.Status.CONFIRMED, slot_ends_at=past)

    result = auto_complete_past_bookings.call_local()

    booking.refresh_from_db()
    assert booking.status == Booking.Status.CONFIRMED
    assert result['completed'] == 0


@pytest.mark.django_db
def test_noop_when_no_pending_bookings():
    """Return zero completed when no pending bookings exist."""
    result = auto_complete_past_bookings.call_local()
    assert result['completed'] == 0
