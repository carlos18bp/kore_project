"""Tests for the expire_subscriptions management command."""

from datetime import datetime, timedelta
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, Subscription, User
from core_app.services.subscription_cleanup import CANCEL_REASON

EXPIRED_REFERENCE = timezone.make_aware(datetime(2025, 2, 1, 9, 0, 0), timezone.get_current_timezone())
ACTIVE_REFERENCE = timezone.make_aware(datetime(2100, 2, 1, 9, 0, 0), timezone.get_current_timezone())
PAST_SLOT_START = timezone.make_aware(datetime(2000, 1, 10, 10, 0, 0), timezone.get_current_timezone())
FUTURE_SLOT_START = timezone.make_aware(datetime(2100, 1, 10, 10, 0, 0), timezone.get_current_timezone())


def _create_subscription(
    *,
    email: str,
    starts_at: datetime,
    expires_at: datetime,
    sessions_total: int = 4,
    sessions_used: int = 2,
    next_billing_date=None,
) -> Subscription:
    customer = User.objects.create_user(email=email, password='pass')
    package = Package.objects.create(
        title=f'Package for {email}',
        sessions_count=sessions_total,
        validity_days=30,
        price='200000.00',
    )
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=package.sessions_count,
        sessions_used=sessions_used,
        status=Subscription.Status.ACTIVE,
        starts_at=starts_at,
        expires_at=expires_at,
        next_billing_date=next_billing_date or starts_at.date(),
    )


def _create_confirmed_booking(subscription: Subscription, *, starts_at: datetime) -> tuple[Booking, AvailabilitySlot]:
    slot = AvailabilitySlot.objects.create(
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=1),
        is_active=True,
        is_blocked=True,
    )
    booking = Booking.objects.create(
        customer=subscription.customer,
        package=subscription.package,
        slot=slot,
        subscription=subscription,
        status=Booking.Status.CONFIRMED,
    )
    return booking, slot


@pytest.mark.django_db
def test_expires_subscription_and_sets_usage_to_total():
    """Expires due subscriptions, clears billing date, and consumes remaining sessions."""
    subscription = _create_subscription(
        email='expire@example.com',
        starts_at=EXPIRED_REFERENCE - timedelta(days=10),
        expires_at=EXPIRED_REFERENCE - timedelta(days=1),
        sessions_total=4,
        sessions_used=2,
        next_billing_date=EXPIRED_REFERENCE.date(),
    )

    out = StringIO()
    call_command('expire_subscriptions', stdout=out)

    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.EXPIRED
    assert subscription.next_billing_date is None
    assert subscription.sessions_used == subscription.sessions_total
    assert 'processed: 1' in out.getvalue()


@pytest.mark.django_db
def test_cancels_future_booking_and_unblocks_slot_for_expired_subscription():
    """Cancels future confirmed bookings for expired subscriptions and frees their slots."""
    subscription = _create_subscription(
        email='future-booking@example.com',
        starts_at=EXPIRED_REFERENCE - timedelta(days=5),
        expires_at=EXPIRED_REFERENCE - timedelta(days=1),
        next_billing_date=EXPIRED_REFERENCE.date(),
    )
    future_booking, future_slot = _create_confirmed_booking(subscription, starts_at=FUTURE_SLOT_START)

    out = StringIO()
    call_command('expire_subscriptions', stdout=out)

    future_booking.refresh_from_db()
    future_slot.refresh_from_db()
    assert future_booking.status == Booking.Status.CANCELED
    assert future_booking.canceled_reason == CANCEL_REASON
    assert future_slot.is_blocked is False
    assert 'bookings_canceled: 1' in out.getvalue()


@pytest.mark.django_db
def test_keeps_past_booking_unchanged_for_expired_subscription():
    """Leaves past bookings untouched when expiring subscriptions."""
    subscription = _create_subscription(
        email='past-booking@example.com',
        starts_at=EXPIRED_REFERENCE - timedelta(days=5),
        expires_at=EXPIRED_REFERENCE - timedelta(days=1),
        next_billing_date=EXPIRED_REFERENCE.date(),
    )
    past_booking, past_slot = _create_confirmed_booking(subscription, starts_at=PAST_SLOT_START)

    out = StringIO()
    call_command('expire_subscriptions', stdout=out)

    past_booking.refresh_from_db()
    past_slot.refresh_from_db()
    assert past_booking.status == Booking.Status.CONFIRMED
    assert past_slot.is_blocked is True
    assert 'bookings_canceled: 0' in out.getvalue()


@pytest.mark.django_db
def test_noop_when_no_expired_subscriptions():
    """Does not mutate active subscriptions when nothing is expired."""
    subscription = _create_subscription(
        email='future@example.com',
        starts_at=ACTIVE_REFERENCE,
        expires_at=ACTIVE_REFERENCE + timedelta(days=5),
        sessions_total=3,
        sessions_used=1,
        next_billing_date=ACTIVE_REFERENCE.date(),
    )

    out = StringIO()
    call_command('expire_subscriptions', stdout=out)

    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.ACTIVE
    assert subscription.next_billing_date == ACTIVE_REFERENCE.date()
    output = out.getvalue()
    assert 'processed: 0' in output
    assert 'bookings_canceled: 0' in output


@pytest.mark.django_db
def test_skips_processing_when_locked_row_no_longer_eligible():
    """Skips processing when row lock reload returns a subscription that is no longer active."""
    subscription = _create_subscription(
        email='expire-race-guard@example.com',
        starts_at=EXPIRED_REFERENCE - timedelta(days=10),
        expires_at=EXPIRED_REFERENCE - timedelta(days=1),
        sessions_total=4,
        sessions_used=2,
        next_billing_date=EXPIRED_REFERENCE.date(),
    )

    out = StringIO()
    with patch(
        'core_app.management.commands.expire_subscriptions.Subscription.objects.select_for_update'
    ) as mock_select_for_update:
        locked_sub = Subscription.objects.get(pk=subscription.pk)
        locked_sub.status = Subscription.Status.CANCELED
        mock_select_for_update.return_value.get.return_value = locked_sub
        call_command('expire_subscriptions', stdout=out)

    subscription.refresh_from_db()
    assert subscription.status == Subscription.Status.ACTIVE
    assert 'processed: 0' in out.getvalue()
