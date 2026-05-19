"""Tests for subscription cleanup helpers."""

from datetime import datetime as dt
from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, Package, Subscription, User
from core_app.services.subscription_cleanup import CANCEL_REASON, cancel_future_bookings

FIXED_CLEANUP_NOW = timezone.make_aware(dt(2026, 3, 1, 10, 0, 0))


def _build_cleanup_fixtures(fixed_now):
    """Create a subscription with one future and one past booking."""
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
    future_booking = Booking.objects.create(
        customer=customer, package=package, subscription=subscription,
        status=Booking.Status.CONFIRMED,
        starts_at=fixed_now + timedelta(hours=8),
        ends_at=fixed_now + timedelta(hours=9),
    )
    past_booking = Booking.objects.create(
        customer=customer, package=package, subscription=subscription,
        status=Booking.Status.CONFIRMED,
        starts_at=fixed_now - timedelta(hours=8),
        ends_at=fixed_now - timedelta(hours=7),
    )
    return subscription, future_booking, past_booking


@pytest.mark.django_db
def test_cancel_future_bookings_cancels_future(monkeypatch):
    """Future booking is canceled when ``now`` is omitted."""
    fixed_now = FIXED_CLEANUP_NOW
    monkeypatch.setattr('django.utils.timezone.now', lambda: fixed_now)

    subscription, future_booking, _ = _build_cleanup_fixtures(fixed_now)

    canceled_count = cancel_future_bookings(subscription)

    future_booking.refresh_from_db()
    assert canceled_count == 1
    assert future_booking.status == Booking.Status.CANCELED
    assert future_booking.canceled_reason == CANCEL_REASON


@pytest.mark.django_db
def test_cancel_future_bookings_preserves_past_bookings(monkeypatch):
    """Past booking remains confirmed after cleanup."""
    fixed_now = FIXED_CLEANUP_NOW
    monkeypatch.setattr('django.utils.timezone.now', lambda: fixed_now)

    subscription, _, past_booking = _build_cleanup_fixtures(fixed_now)

    cancel_future_bookings(subscription)

    past_booking.refresh_from_db()
    assert past_booking.status == Booking.Status.CONFIRMED
