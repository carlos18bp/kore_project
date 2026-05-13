"""Shared schedule constants and slot-generation helpers.

Centralizes the weekly availability windows, booking horizon, rollover cap,
and the slot-generation function used by both the management command and the
daily maintenance task.
"""

from datetime import datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, TrainerProfile

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

SESSION_MINUTES = 60
SLOT_STEP_MINUTES = 15
MIN_ADVANCE_HOURS = 16
TRAVEL_BUFFER_MINUTES = 45
BUSINESS_TZ = ZoneInfo('America/Bogota')


def _expand_schedule(date_from, date_to, *, step_minutes, session_minutes, tz):
    """Yield candidate session start-times (aware, UTC) for [date_from, date_to).

    A candidate at local time t on day d is yielded iff [t, t+session] fits
    entirely within one of WEEKLY_SCHEDULE[d.weekday()] windows.
    """
    step = timedelta(minutes=step_minutes)
    session = timedelta(minutes=session_minutes)
    day = date_from
    while day < date_to:
        for start_hour, end_hour in WEEKLY_SCHEDULE.get(day.weekday(), []):
            window_start = datetime.combine(day, time(hour=start_hour), tzinfo=tz)
            window_end = datetime.combine(day, time(hour=end_hour), tzinfo=tz)
            cursor = window_start
            while cursor + session <= window_end:
                yield cursor.astimezone(dt_timezone.utc)
                cursor += step
        day += timedelta(days=1)


_ACTIVE_STATUSES = (Booking.Status.PENDING, Booking.Status.CONFIRMED)


def _session_minutes_for(trainer):
    return getattr(trainer, 'session_duration_minutes', None) or SESSION_MINUTES


def session_window(trainer, starts_at):
    """Return (starts_at, ends_at) for a session with this trainer."""
    return (starts_at, starts_at + timedelta(minutes=_session_minutes_for(trainer)))


def _blocked_by_bookings(starts_at, ends_at, bookings, buffer):
    for b in bookings:
        if starts_at < b.ends_at + buffer and ends_at > b.starts_at - buffer:
            return True
    return False


def compute_available_start_times(trainer, date_from, date_to, *, now=None):
    """Return {date: [aware UTC datetime, ...]} of bookable start-times.

    Only days with ≥1 free start-time appear as keys.  Applies the 16h
    advance cutoff and 30-day horizon relative to *now* (defaults to
    ``timezone.now()``).
    """
    if now is None:
        now = timezone.now()
    session_minutes = _session_minutes_for(trainer)
    session = timedelta(minutes=session_minutes)
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    min_start = now + timedelta(hours=MIN_ADVANCE_HOURS)
    horizon = now + timedelta(days=BOOKING_HORIZON_DAYS)

    range_start_utc = datetime.combine(date_from, time.min, tzinfo=BUSINESS_TZ).astimezone(dt_timezone.utc)
    range_end_utc = datetime.combine(date_to, time.min, tzinfo=BUSINESS_TZ).astimezone(dt_timezone.utc)
    bookings = list(
        Booking.objects.filter(
            trainer=trainer,
            status__in=_ACTIVE_STATUSES,
            starts_at__lt=range_end_utc + buffer,
            ends_at__gt=range_start_utc - buffer,
        ).only('starts_at', 'ends_at')
    )

    result = {}
    for start in _expand_schedule(
        date_from, date_to,
        step_minutes=SLOT_STEP_MINUTES,
        session_minutes=session_minutes,
        tz=BUSINESS_TZ,
    ):
        end = start + session
        if end <= now or start < min_start or start >= horizon:
            continue
        if _blocked_by_bookings(start, end, bookings, buffer):
            continue
        local_day = start.astimezone(BUSINESS_TZ).date()
        result.setdefault(local_day, []).append(start)
    return result


def is_start_time_available(trainer, starts_at, *, now=None):
    """True iff starts_at is a currently-bookable start-time for trainer."""
    local_day = starts_at.astimezone(BUSINESS_TZ).date()
    available = compute_available_start_times(
        trainer, local_day, local_day + timedelta(days=1), now=now,
    )
    return starts_at in available.get(local_day, [])


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
