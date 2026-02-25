"""Tests for subscription cleanup helpers."""

from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, Subscription, User
from core_app.services.subscription_cleanup import CANCEL_REASON, cancel_future_bookings

FIXED_CLEANUP_NOW = timezone.now()


def _build_cleanup_fixtures(fixed_now):
    """Create the shared subscription, future slot/booking, and past slot/booking."""
    customer = User.objects.create_user(
        email='cleanup-now-none@example.com',
        password='p',
        role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(
        title='Cleanup Package',
        sessions_count=6,
        validity_days=30,
        price='120000.00',
    )
    subscription = Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=6,
        sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=fixed_now - timedelta(days=3),
        expires_at=fixed_now + timedelta(days=27),
    )
    future_slot = AvailabilitySlot.objects.create(
        starts_at=fixed_now + timedelta(hours=8),
        ends_at=fixed_now + timedelta(hours=9),
        is_active=True,
        is_blocked=True,
    )
    past_slot = AvailabilitySlot.objects.create(
        starts_at=fixed_now - timedelta(hours=8),
        ends_at=fixed_now - timedelta(hours=7),
        is_active=True,
        is_blocked=True,
    )
    future_booking = Booking.objects.create(
        customer=customer, package=package, subscription=subscription,
        slot=future_slot, status=Booking.Status.CONFIRMED,
    )
    past_booking = Booking.objects.create(
        customer=customer, package=package, subscription=subscription,
        slot=past_slot, status=Booking.Status.CONFIRMED,
    )
    return subscription, future_booking, future_slot, past_booking, past_slot


@pytest.mark.django_db
def test_cancel_future_bookings_cancels_future_and_unblocks_slot(monkeypatch):
    """Future booking is canceled and its slot unblocked when ``now`` is omitted."""
    fixed_now = FIXED_CLEANUP_NOW
    monkeypatch.setattr('django.utils.timezone.now', lambda: fixed_now)

    subscription, future_booking, future_slot, _past_booking, _past_slot = (
        _build_cleanup_fixtures(fixed_now)
    )

    canceled_count = cancel_future_bookings(subscription)

    future_booking.refresh_from_db()
    future_slot.refresh_from_db()
    assert canceled_count == 1
    assert future_booking.status == Booking.Status.CANCELED
    assert future_booking.canceled_reason == CANCEL_REASON
    assert future_slot.is_blocked is False


@pytest.mark.django_db
def test_cancel_future_bookings_preserves_past_bookings(monkeypatch):
    """Past booking remains confirmed and its slot stays blocked after cleanup."""
    fixed_now = FIXED_CLEANUP_NOW
    monkeypatch.setattr('django.utils.timezone.now', lambda: fixed_now)

    subscription, _future_booking, _future_slot, past_booking, past_slot = (
        _build_cleanup_fixtures(fixed_now)
    )

    cancel_future_bookings(subscription)

    past_booking.refresh_from_db()
    past_slot.refresh_from_db()
    assert past_booking.status == Booking.Status.CONFIRMED
    assert past_slot.is_blocked is True
