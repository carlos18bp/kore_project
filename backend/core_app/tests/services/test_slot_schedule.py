"""Tests for shared schedule constants and slot-generation helpers."""
# quality: disable test_too_short (boundary-value constant assertions, intentionally concise)

import datetime as dt
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.services.slot_schedule import (
    BOOKING_HORIZON_DAYS,
    MAX_ROLLOVER_SESSIONS,
    WEEKLY_SCHEDULE,
    _expand_schedule,
    BUSINESS_TZ,
    compute_available_start_times,
    is_start_time_available,
    session_window,
)

BOGOTA = ZoneInfo('America/Bogota')
FIXED_NOW = datetime(2026, 3, 2, 10, 0, 0, tzinfo=BOGOTA)  # Monday


def _utc(y, m, d, h, minute=0):
    return dt.datetime(y, m, d, h, minute, tzinfo=dt.timezone.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='sched-trainer@kore.com', password='p', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, specialty='Strength')


@pytest.fixture
def package(db):
    return Package.objects.create(title='P', is_active=True)


# ── Constants ────────────────────────────────────────────────────────────

class TestWeeklySchedule:
    def test_saturday_included(self):
        """Saturday (weekday=5) should have windows."""
        assert 5 in WEEKLY_SCHEDULE
        assert WEEKLY_SCHEDULE[5] == [(6, 13)]

    def test_sunday_excluded(self):
        """Sunday (weekday=6) should not be in the schedule."""
        assert 6 not in WEEKLY_SCHEDULE

    def test_monday_through_friday_have_two_windows(self):
        """Mon-Fri should each have morning + evening windows."""
        for day in range(5):
            assert day in WEEKLY_SCHEDULE
            assert len(WEEKLY_SCHEDULE[day]) == 2

    def test_saturday_window_starts_at_six(self):
        """Saturday morning window starts at 06:00."""
        assert WEEKLY_SCHEDULE[5][0][0] == 6

    def test_horizon_is_30(self):
        assert BOOKING_HORIZON_DAYS == 30

    def test_max_rollover_is_2(self):
        assert MAX_ROLLOVER_SESSIONS == 2



# ── _expand_schedule ─────────────────────────────────────────────────────

class TestExpandSchedule:
    def test_weekday_yields_morning_and_evening_starts(self):
        # 2026-05-18 is a Monday
        from datetime import date
        starts = list(_expand_schedule(date(2026, 5, 18), date(2026, 5, 19),
                                       step_minutes=15, session_minutes=60, tz=BUSINESS_TZ))
        # Mon windows 5-13 & 16-21: 60-min sessions every 15 min that fit → 29 + 17 = 46
        assert len(starts) == 46
        first = starts[0].astimezone(BUSINESS_TZ)
        last_morning = [s for s in starts if s.astimezone(BUSINESS_TZ).hour < 14][-1].astimezone(BUSINESS_TZ)
        assert (first.hour, first.minute) == (5, 0)
        assert (last_morning.hour, last_morning.minute) == (12, 0)   # 12:00→13:00 is the last that fits
        assert all(s.tzinfo is not None for s in starts)             # aware

    def test_saturday_one_window(self):
        # 2026-05-16 is a Saturday
        from datetime import date
        starts = list(_expand_schedule(date(2026, 5, 16), date(2026, 5, 17),
                                       step_minutes=15, session_minutes=60, tz=BUSINESS_TZ))
        # Sat 6-13: 60-min every 15 min → 25
        assert len(starts) == 25

    def test_sunday_empty(self):
        # 2026-05-17 is a Sunday
        from datetime import date
        starts = list(_expand_schedule(date(2026, 5, 17), date(2026, 5, 18),
                                       step_minutes=15, session_minutes=60, tz=BUSINESS_TZ))
        assert starts == []


# ── compute_available_start_times / is_start_time_available / session_window ──

@pytest.mark.django_db
class TestComputeAvailability:
    # FIXED_NOW = 2026-03-02T15:00Z (Monday), min_start = 03-03T07:00Z, horizon = 04-01T15:00Z

    def test_clean_week_counts(self, trainer):
        # Mon 2026-03-09, Sat 2026-03-14 — within 30-day horizon; date_to 03-16 includes Sun 03-15
        days = compute_available_start_times(trainer, dt.date(2026, 3, 9), dt.date(2026, 3, 16))
        assert len(days[dt.date(2026, 3, 9)]) == 46    # Mon: 29 morning + 17 evening
        assert len(days[dt.date(2026, 3, 14)]) == 25   # Sat: 25
        assert dt.date(2026, 3, 15) not in days         # Sun → no key

    def test_min_advance_cutoff(self, trainer):
        # min_start = 2026-03-03T07:00Z; Tue morning window 10:00-18:00Z — all > cutoff
        days = compute_available_start_times(trainer, dt.date(2026, 3, 3), dt.date(2026, 3, 4))
        starts = days.get(dt.date(2026, 3, 3), [])
        assert _utc(2026, 3, 3, 10) in starts
        assert min(starts) >= _utc(2026, 3, 3, 7)

    def test_horizon_cutoff(self, trainer):
        # horizon = 2026-04-01T15:00Z; all candidates on 2026-04-02 start after horizon
        days = compute_available_start_times(trainer, dt.date(2026, 4, 1), dt.date(2026, 4, 3))
        assert dt.date(2026, 4, 2) not in days

    def test_booking_blocks_overlapping_starts_with_buffer(self, trainer, package):
        # Booking Mon 2026-03-09 17:00→18:00 UTC (12:00→13:00 Bogota).
        # Buffer ±45min: blocked open interval (15:15, 18:45) UTC.
        # Rule: candidate [s, s+60] blocked iff s < be+buffer AND s+session > bs-buffer.
        b_start = _utc(2026, 3, 9, 17)
        Booking.objects.create(
            customer=User.objects.create_user(email='c1@k.com', password='p'),
            package=package, trainer=trainer,
            status=Booking.Status.PENDING,
            starts_at=b_start, ends_at=b_start + dt.timedelta(minutes=60),
        )
        days = compute_available_start_times(trainer, dt.date(2026, 3, 9), dt.date(2026, 3, 10))
        starts = days[dt.date(2026, 3, 9)]
        # Blocked (strictly: s ∈ (15:15, 18:45) UTC)
        assert _utc(2026, 3, 9, 17) not in starts       # booked slot itself
        assert _utc(2026, 3, 9, 16, 30) not in starts   # 16:30+60=17:30 > 16:15 → blocked
        assert _utc(2026, 3, 9, 16, 15) not in starts   # blocked
        assert _utc(2026, 3, 9, 15, 30) not in starts   # 15:30+60=16:30 > 16:15 → first blocked
        # Free (at or before boundary)
        assert _utc(2026, 3, 9, 15) in starts            # 15:00+60=16:00 not > 16:15 → free
        assert _utc(2026, 3, 9, 15, 15) in starts        # 15:15+60=16:15 not strictly > 16:15 → free

    def test_is_start_time_available(self, trainer):
        assert is_start_time_available(trainer, _utc(2026, 3, 9, 10)) is True    # Mon on grid
        assert is_start_time_available(trainer, _utc(2026, 3, 9, 10, 7)) is False # off 15-min grid
        assert is_start_time_available(trainer, _utc(2026, 3, 15, 10)) is False   # Sunday
        assert is_start_time_available(trainer, _utc(2026, 1, 1, 10)) is False    # past

    def test_session_window(self, trainer):
        s = _utc(2026, 3, 9, 10)
        assert session_window(trainer, s) == (s, s + dt.timedelta(minutes=60))
