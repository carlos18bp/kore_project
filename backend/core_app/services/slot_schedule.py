"""Shared schedule constants and computed-availability helpers."""

from datetime import datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.utils import timezone

from core_app.models import Booking, TrainerProfile, TrainerUnavailability

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


def compute_available_start_times(
    trainer, date_from, date_to, *, now=None, min_advance_hours=MIN_ADVANCE_HOURS,
):
    """Return {date: [aware UTC datetime, ...]} of bookable start-times.

    Only days with ≥1 free start-time appear as keys.  Applies the
    ``min_advance_hours`` advance cutoff (defaults to the customer-facing
    16h rule) and the 30-day horizon relative to *now* (defaults to
    ``timezone.now()``).  Trainer-initiated flows can pass
    ``min_advance_hours=0`` to bypass the advance cutoff.
    """
    if now is None:
        now = timezone.now()
    session_minutes = _session_minutes_for(trainer)
    session = timedelta(minutes=session_minutes)
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    min_start = now + timedelta(hours=min_advance_hours)
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

    # Whole-day blocks the trainer set up. Treated as if every slot on those
    # local Bogota dates were already taken — neither customer nor trainer can
    # pick a slot on a blocked date going forward.
    blocked_dates = set(
        TrainerUnavailability.objects.filter(
            trainer=trainer,
            date__gte=date_from,
            date__lt=date_to,
        ).values_list('date', flat=True)
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
        local_day = start.astimezone(BUSINESS_TZ).date()
        if local_day in blocked_dates:
            continue
        if _blocked_by_bookings(start, end, bookings, buffer):
            continue
        result.setdefault(local_day, []).append(start)
    return result


def is_start_time_available(
    trainer, starts_at, *, now=None, min_advance_hours=MIN_ADVANCE_HOURS,
):
    """True iff starts_at is a currently-bookable start-time for trainer."""
    local_day = starts_at.astimezone(BUSINESS_TZ).date()
    available = compute_available_start_times(
        trainer,
        local_day,
        local_day + timedelta(days=1),
        now=now,
        min_advance_hours=min_advance_hours,
    )
    return starts_at in available.get(local_day, [])
