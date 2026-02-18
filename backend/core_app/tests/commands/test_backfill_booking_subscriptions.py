"""Tests for backfill_booking_subscriptions management command."""

from datetime import timedelta
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, Subscription, User


@pytest.mark.django_db
def test_backfill_assigns_subscription_for_unambiguous_booking():
    out = StringIO()
    customer = User.objects.create_user(
        email='backfill_customer@example.com', password='test', role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(title='Backfill Package', sessions_count=4, validity_days=30)
    now = timezone.now()
    subscription = Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=4,
        sessions_used=1,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=5),
        expires_at=now + timedelta(days=25),
    )
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot,
    )

    call_command('backfill_booking_subscriptions', stdout=out)

    booking.refresh_from_db()
    assert booking.subscription_id == subscription.id
    assert '- updated: 1' in out.getvalue()


@pytest.mark.django_db
def test_backfill_skips_ambiguous_matches():
    out = StringIO()
    customer = User.objects.create_user(
        email='backfill_ambiguous@example.com', password='test', role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(title='Ambiguous Package', sessions_count=4, validity_days=30)
    now = timezone.now()
    Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=4,
        sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=10),
        expires_at=now + timedelta(days=20),
    )
    Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=4,
        sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=5),
        expires_at=now + timedelta(days=25),
    )
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot,
    )

    call_command('backfill_booking_subscriptions', stdout=out)

    booking.refresh_from_db()
    assert booking.subscription_id is None
    assert '- skipped (ambiguous): 1' in out.getvalue()


@pytest.mark.django_db
def test_backfill_filters_by_customer_package_and_limit():
    """Ensure customer/package filters and limit restrict scanned bookings."""
    out = StringIO()
    customer = User.objects.create_user(
        email='backfill_limit@example.com', password='test', role=User.Role.CUSTOMER,
    )
    other_customer = User.objects.create_user(
        email='backfill_other@example.com', password='test', role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(title='Filtered Package', sessions_count=4, validity_days=30)
    other_package = Package.objects.create(title='Other Package', sessions_count=4, validity_days=30)
    now = timezone.now()
    subscription = Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=4,
        sessions_used=1,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=5),
        expires_at=now + timedelta(days=25),
    )
    slot_one = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    slot_two = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=3),
        ends_at=now + timedelta(hours=4),
    )
    booking_one = Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot_one,
    )
    booking_two = Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot_two,
    )
    other_slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=5),
        ends_at=now + timedelta(hours=6),
    )
    Booking.objects.create(
        customer=other_customer,
        package=other_package,
        slot=other_slot,
    )

    call_command(
        'backfill_booking_subscriptions',
        customer_id=customer.id,
        package_id=package.id,
        limit=1,
        stdout=out,
    )

    booking_one.refresh_from_db()
    booking_two.refresh_from_db()
    assert booking_one.subscription_id == subscription.id
    assert booking_two.subscription_id is None
    assert '- scanned: 1' in out.getvalue()
    assert '- updated: 1' in out.getvalue()


@pytest.mark.django_db
def test_backfill_dry_run_skips_saving_but_reports():
    """Ensure dry-run does not persist updates but reports them."""
    out = StringIO()
    customer = User.objects.create_user(
        email='backfill_dry@example.com', password='test', role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(title='Dry Package', sessions_count=2, validity_days=30)
    now = timezone.now()
    Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=2,
        sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=29),
    )
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot,
    )

    call_command('backfill_booking_subscriptions', dry_run=True, stdout=out)

    booking.refresh_from_db()
    assert booking.subscription_id is None
    assert '- updated: 1' in out.getvalue()
    assert 'Dry-run: no changes were saved.' in out.getvalue()


@pytest.mark.django_db
def test_backfill_skips_when_no_subscription_match():
    """Ensure bookings without matching subscriptions are counted as skipped."""
    out = StringIO()
    customer = User.objects.create_user(
        email='backfill_nomatch@example.com', password='test', role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(title='No Match Package', sessions_count=4, validity_days=30)
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot,
    )

    call_command('backfill_booking_subscriptions', stdout=out)

    booking.refresh_from_db()
    assert booking.subscription_id is None
    assert '- skipped (no match): 1' in out.getvalue()


@pytest.mark.django_db
def test_backfill_skips_legacy_booking_without_slot():
    """Legacy bookings without slots are counted as skipped."""
    out = StringIO()

    class FakeQuerySet(list):
        def filter(self, **kwargs):
            return self

        def order_by(self, *args, **kwargs):
            return self

    fake_booking = SimpleNamespace(slot_id=None)
    fake_qs = FakeQuerySet([fake_booking])

    with patch(
        'core_app.management.commands.backfill_booking_subscriptions.Booking.objects.select_related',
        return_value=fake_qs,
    ):
        call_command('backfill_booking_subscriptions', stdout=out)

    assert '- scanned: 1' in out.getvalue()
    assert '- skipped (no match): 1' in out.getvalue()
