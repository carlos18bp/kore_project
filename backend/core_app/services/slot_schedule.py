"""Shared schedule constants and slot-generation helpers.

Centralizes the weekly availability windows, booking horizon, rollover cap,
and the slot-generation function used by both the management command and the
daily maintenance task.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from core_app.models import AvailabilitySlot, TrainerProfile

# Weekly schedule: weekday (Monday=0 … Sunday=6) → list of (start_hour, end_hour)
WEEKLY_SCHEDULE = {
    0: [(5, 13), (16, 21)],   # Monday
    1: [(5, 13), (16, 21)],   # Tuesday
    2: [(5, 13), (16, 21)],   # Wednesday
    3: [(5, 13), (16, 21)],   # Thursday
    4: [(5, 13), (16, 21)],   # Friday
    5: [(6, 13)],              # Saturday
    # 6: Sunday — closed
}

BOOKING_HORIZON_DAYS = 30
MAX_ROLLOVER_SESSIONS = 2
SLOT_MAINTENANCE_FILL_DAYS = 35  # 30 + 5 buffer


def generate_slots_for_trainer(
    trainer,
    days,
    tz,
    slot_minutes=60,
    slot_step_minutes=15,
):
    """Generate availability slots for *trainer* over the next *days* days.

    Uses ``get_or_create`` so repeated calls are idempotent.

    Args:
        trainer: TrainerProfile instance.
        days: Number of calendar days starting from today (in *tz*).
        tz: ``ZoneInfo`` timezone used to interpret local times.
        slot_minutes: Duration of each session in minutes.
        slot_step_minutes: Start-time increment between slots.

    Returns:
        int: Number of newly created slots.
    """
    slot_duration = timedelta(minutes=slot_minutes)
    slot_step = timedelta(minutes=slot_step_minutes)

    now = timezone.now().astimezone(tz)
    start_date = now.date()

    created = 0

    for day_offset in range(days):
        current_date = start_date + timedelta(days=day_offset)

        windows = WEEKLY_SCHEDULE.get(current_date.weekday())
        if not windows:
            continue

        for start_hour, end_hour in windows:
            day_start = datetime.combine(
                current_date,
                time(hour=start_hour, minute=0, second=0),
                tzinfo=tz,
            )
            day_end = datetime.combine(
                current_date,
                time(hour=end_hour, minute=0, second=0),
                tzinfo=tz,
            )

            current_start = day_start
            while current_start < day_end:
                starts_at = current_start
                ends_at = current_start + slot_duration

                if ends_at > day_end:
                    break

                # Skip slots that would end in the past
                if ends_at <= now:
                    current_start += slot_step
                    continue

                _, was_created = AvailabilitySlot.objects.get_or_create(
                    starts_at=starts_at,
                    ends_at=ends_at,
                    defaults={
                        'trainer': trainer,
                        'is_active': True,
                        'is_blocked': False,
                        'blocked_reason': '',
                    },
                )
                if was_created:
                    created += 1

                current_start += slot_step

    return created
