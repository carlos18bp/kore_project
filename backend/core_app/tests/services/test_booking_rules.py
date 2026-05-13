"""Tests for booking scheduling business-rule helpers."""

import datetime as dt

import pytest

from core_app.models import AvailabilitySlot, Booking, Package, TrainerProfile, User
from core_app.services.booking_rules import (
    ACTIVE_BOOKING_STATUSES,
    build_trainer_buffer_slot_conflict_q,
    has_trainer_travel_buffer_conflict,
)


def _utc(y, m, d, h, minute=0):
    return dt.datetime(y, m, d, h, minute, tzinfo=dt.timezone.utc)


def _make_trainer(email):
    user = User.objects.create_user(email=email, password='p', role=User.Role.TRAINER)
    return TrainerProfile.objects.create(user=user, specialty='S')


def _make_booking(trainer, starts_at, ends_at, *, customer_email, package):
    """Create a Booking with starts_at/ends_at set (slot used to satisfy NOT NULL)."""
    slot = AvailabilitySlot.objects.create(trainer=trainer, starts_at=starts_at, ends_at=ends_at)
    return Booking.objects.create(
        customer=User.objects.create_user(email=customer_email, password='p'),
        package=package, trainer=trainer, slot=slot,
        status=Booking.Status.PENDING,
        starts_at=starts_at, ends_at=ends_at,
    )


# ── has_trainer_travel_buffer_conflict (new signature) ───────────────────────

@pytest.mark.django_db
class TestTravelBufferConflict:
    def test_no_bookings_no_conflict(self):
        t = _make_trainer('t@k.com')
        assert has_trainer_travel_buffer_conflict(t, _utc(2026, 5, 18, 10), _utc(2026, 5, 18, 11)) is False

    def test_overlap_within_buffer_is_conflict(self):
        t = _make_trainer('t2@k.com')
        p = Package.objects.create(title='P', is_active=True)
        bs = _utc(2026, 5, 18, 12)
        _make_booking(t, bs, bs + dt.timedelta(minutes=60), customer_email='c@k.com', package=p)
        # 11:30-12:30 → within ±45m of [12:00, 13:00] → conflict
        assert has_trainer_travel_buffer_conflict(t, _utc(2026, 5, 18, 11, 30), _utc(2026, 5, 18, 12, 30)) is True
        # 9:00-10:00 → 2h gap → no conflict (10:45 < 12:00)
        assert has_trainer_travel_buffer_conflict(t, _utc(2026, 5, 18, 9), _utc(2026, 5, 18, 10)) is False

    def test_exclude_booking_id(self):
        t = _make_trainer('t3@k.com')
        p = Package.objects.create(title='P', is_active=True)
        bs = _utc(2026, 5, 18, 12)
        b = _make_booking(t, bs, bs + dt.timedelta(minutes=60), customer_email='c2@k.com', package=p)
        # excluding own booking → no conflict
        assert has_trainer_travel_buffer_conflict(t, bs, bs + dt.timedelta(minutes=60), exclude_booking_id=b.id) is False

    def test_none_trainer_returns_false(self):
        assert has_trainer_travel_buffer_conflict(None, _utc(2026, 5, 18, 10), _utc(2026, 5, 18, 11)) is False


# ── build_trainer_buffer_slot_conflict_q (slot-based; used by availability_views) ─

@pytest.mark.django_db
def test_build_trainer_buffer_slot_conflict_q_excludes_conflicting_slots_only():
    """Generated Q excludes slots in the trainer buffer window but keeps boundary slots."""
    trainer = _make_trainer('q-trainer@example.com')
    other_trainer = _make_trainer('q-other-trainer@example.com')
    customer = User.objects.create_user(email='q-customer@example.com', password='p')
    package = Package.objects.create(title='Q Package', is_active=True)

    now = _utc(2026, 5, 18, 9)
    booked_slot = AvailabilitySlot.objects.create(
        starts_at=now + dt.timedelta(hours=2),
        ends_at=now + dt.timedelta(hours=3),
        trainer=trainer,
        is_blocked=True,
    )
    booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=booked_slot,
        trainer=trainer,
        status=Booking.Status.CONFIRMED,
    )

    conflict_slot = AvailabilitySlot.objects.create(
        starts_at=now + dt.timedelta(hours=3, minutes=30),
        ends_at=now + dt.timedelta(hours=4, minutes=30),
        trainer=trainer,
    )
    boundary_slot = AvailabilitySlot.objects.create(
        starts_at=now + dt.timedelta(hours=3, minutes=45),
        ends_at=now + dt.timedelta(hours=4, minutes=45),
        trainer=trainer,
    )
    other_trainer_slot = AvailabilitySlot.objects.create(
        starts_at=now + dt.timedelta(hours=3, minutes=15),
        ends_at=now + dt.timedelta(hours=4, minutes=15),
        trainer=other_trainer,
    )

    conflict_q = build_trainer_buffer_slot_conflict_q(
        Booking.objects.filter(pk=booking.pk).select_related('slot')
    )
    available_ids = set(AvailabilitySlot.objects.exclude(conflict_q).values_list('id', flat=True))

    assert conflict_slot.id not in available_ids
    assert boundary_slot.id in available_ids
    assert other_trainer_slot.id in available_ids


@pytest.mark.django_db
def test_build_conflict_q_skips_booking_without_trainer():
    """Bookings with no trainer on slot or booking are skipped."""
    customer = User.objects.create_user(email='skip-cust@example.com', password='p')
    package = Package.objects.create(title='Skip Package', is_active=True)

    slot_no_trainer = AvailabilitySlot.objects.create(
        starts_at=_utc(2026, 5, 18, 11),
        ends_at=_utc(2026, 5, 18, 12),
        trainer=None,
    )
    Booking.objects.create(
        customer=customer,
        package=package,
        slot=slot_no_trainer,
        trainer=None,
        status=Booking.Status.CONFIRMED,
    )

    conflict_q = build_trainer_buffer_slot_conflict_q(
        Booking.objects.filter(slot=slot_no_trainer).select_related('slot'),
    )
    assert not conflict_q
