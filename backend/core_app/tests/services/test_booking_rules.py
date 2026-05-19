"""Tests for booking scheduling business-rule helpers."""

import datetime as dt

import pytest

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.services.booking_rules import (
    ACTIVE_BOOKING_STATUSES,
    has_trainer_travel_buffer_conflict,
)


def _utc(y, m, d, h, minute=0):
    return dt.datetime(y, m, d, h, minute, tzinfo=dt.timezone.utc)


def _make_trainer(email):
    user = User.objects.create_user(email=email, password='p', role=User.Role.TRAINER)
    return TrainerProfile.objects.create(user=user, specialty='S')


def _make_booking(trainer, starts_at, ends_at, *, customer_email, package):
    """Create a Booking with starts_at/ends_at set directly."""
    return Booking.objects.create(
        customer=User.objects.create_user(email=customer_email, password='p'),
        package=package, trainer=trainer,
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

