"""Tests for shared schedule constants and slot-generation helpers."""
# quality: disable test_too_short (boundary-value constant assertions, intentionally concise)

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from core_app.models import AvailabilitySlot, TrainerProfile, User
from core_app.services.slot_schedule import (
    BOOKING_HORIZON_DAYS,
    MAX_ROLLOVER_SESSIONS,
    WEEKLY_SCHEDULE,
    generate_slots_for_trainer,
)

BOGOTA = ZoneInfo('America/Bogota')
FIXED_NOW = datetime(2026, 3, 2, 10, 0, 0, tzinfo=BOGOTA)  # Monday


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='sched-trainer@kore.com', password='p', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, specialty='Strength')


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


# ── generate_slots_for_trainer ───────────────────────────────────────────

@pytest.mark.django_db
class TestGenerateSlotsForTrainer:
    def test_creates_slots_for_monday(self, trainer):
        """Generates slots on a Monday (FIXED_NOW is Monday)."""
        created = generate_slots_for_trainer(trainer=trainer, days=1, tz=BOGOTA)
        assert created > 0
        assert AvailabilitySlot.objects.filter(trainer=trainer).count() == created

    def test_skips_sunday(self, trainer):
        """No slots generated on Sunday."""
        # FIXED_NOW is Monday 2026-03-02. Sunday is day offset=6 (2026-03-08).
        # Generate only day 6 by using a far-future now that makes day 0-5 past.
        sunday_now = datetime(2026, 3, 8, 0, 0, 0, tzinfo=BOGOTA)
        from unittest.mock import patch
        with patch('core_app.services.slot_schedule.timezone') as mock_tz:
            mock_tz.now.return_value = sunday_now
            created = generate_slots_for_trainer(trainer=trainer, days=1, tz=BOGOTA)
        assert created == 0

    def test_generates_saturday_slots(self, trainer):
        """Saturday slots are generated with 06:00-13:00 window."""
        # Saturday is day offset=5 from Monday 2026-03-02 → 2026-03-07
        created = generate_slots_for_trainer(trainer=trainer, days=6, tz=BOGOTA)
        assert created > 0

        saturday = datetime(2026, 3, 7, tzinfo=BOGOTA).date()
        sat_start = datetime.combine(saturday, datetime.min.time().replace(hour=6), tzinfo=BOGOTA)
        sat_end = datetime.combine(saturday, datetime.min.time().replace(hour=13), tzinfo=BOGOTA)

        sat_slots = AvailabilitySlot.objects.filter(
            trainer=trainer,
            starts_at__gte=sat_start,
            starts_at__lt=sat_end,
        )
        assert sat_slots.count() > 0

        # No slots before 06:00 on Saturday
        early_sat_slots = AvailabilitySlot.objects.filter(
            trainer=trainer,
            starts_at__gte=datetime.combine(saturday, datetime.min.time().replace(hour=5), tzinfo=BOGOTA),
            starts_at__lt=sat_start,
        )
        assert early_sat_slots.count() == 0

    def test_idempotent(self, trainer):
        """Running twice produces the same count (get_or_create)."""
        created1 = generate_slots_for_trainer(trainer=trainer, days=3, tz=BOGOTA)
        created2 = generate_slots_for_trainer(trainer=trainer, days=3, tz=BOGOTA)
        assert created1 > 0
        assert created2 == 0

    def test_skips_past_slots(self, trainer):
        """Slots ending before now are not created."""
        # FIXED_NOW is 10:00 Monday. The 05:00-06:00 slot should be skipped.
        generate_slots_for_trainer(trainer=trainer, days=1, tz=BOGOTA)
        early_slot = AvailabilitySlot.objects.filter(
            trainer=trainer,
            ends_at__lte=FIXED_NOW,
        )
        assert early_slot.count() == 0
