# Computed Availability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace materialized `AvailabilitySlot` rows + the daily slot-maintenance cron with on-the-fly availability computation from a single shared weekly schedule; `Booking` stores its own time window.

**Architecture:** A pure-function service (`core_app/services/slot_schedule.py`, rewritten in place) expands the weekly schedule over a date range, subtracts each trainer's active bookings (± 45-min travel buffer) and the past / 16h-advance / 30-day cutoffs, and returns the free start-times. A new `GET /api/availability/` endpoint serves them; the booking flow validates a chosen `starts_at` against the same logic under a `select_for_update` lock on the trainer; the frontend just fetches, renders, and posts. `AvailabilitySlot` is deleted; `Booking.slot` → `Booking.starts_at` / `Booking.ends_at`.

**Tech Stack:** Django 6.0 + DRF, MySQL/SQLite, pytest; Next.js 16 + React 19 + Zustand + Jest; spec at `docs/superpowers/specs/2026-05-13-availability-windows-design.md`.

**Reference facts (verified 2026-05-13 on dev DB):** 115 bookings, 0 with null slot, 113 active; 6259 slots. `TrainerProfile.session_duration_minutes` exists (default 60). The periodic task `core_app/tasks.py` (`@db_periodic_task(crontab(minute=30, hour=2))` near line 343) delegates to the `maintain_slots` command.

**Working rules:** `cd backend && source venv/bin/activate` before backend commands. Run only the touched test slice (max ~20 tests / 3 commands per cycle); never the full suite. Don't edit old migrations; add new ones. Don't rename `core_project`/`core_app`. Frontend tests: `cd frontend && npm test -- <path>`.

---

## File Map

**Backend — create:**
- `core_app/migrations/00XX_booking_starts_ends_nullable.py` — add `Booking.starts_at`/`ends_at` (nullable)
- `core_app/migrations/00XX_booking_backfill_times.py` — data migration: copy from `slot`
- `core_app/migrations/00XX_booking_drop_slot.py` — NOT NULL + drop `slot` + add constraints
- `core_app/migrations/00XX_delete_availabilityslot.py` — `DeleteModel(AvailabilitySlot)`
- `core_app/views/availability_views.py` — replaced contents (`AvailabilityView`)

**Backend — modify:**
- `core_app/services/slot_schedule.py` — rewrite (same path; new pure functions; drop slot generation)
- `core_app/services/booking_rules.py` — rewrite buffer check to `(trainer, starts_at, ends_at)`; drop slot helpers
- `core_app/models/booking.py` — replace `slot` FK with `starts_at`/`ends_at` + constraints
- `core_app/models/__init__.py`, `core_app/serializers/__init__.py`, `core_app/views/__init__.py` — drop `AvailabilitySlot*` exports
- `core_app/serializers/booking_serializers.py` — `slot_id` → `starts_at`; rewrite `validate`/`create`; drop nested `slot`
- `core_app/views/booking_views.py` — `cancel`/`reschedule` use `starts_at`; remove `occupied_day`; fix `slot__` lookups
- `core_app/urls/api_urls.py` — drop `availability-slots` router; add `availability/` route
- `core_app/admin.py` — drop `AvailabilitySlotAdmin`; `BookingAdmin` uses `starts_at`
- `core_app/services/ics_generator.py` — `booking.slot.*` → `booking.*`
- `core_app/services/subscription_cleanup.py` — `slot__starts_at` → `starts_at`; drop slot unblock
- `core_app/tasks.py` — delete the slot-maintenance periodic task
- `core_app/management/commands/create_fake_bookings.py`, `create_test_users.py`, `delete_fake_data.py` — drop slot usage
- `core_app/management/commands/create_fake_diagnostics.py` — only if it references slots (check)

**Backend — delete:**
- `core_app/models/availability.py`
- `core_app/serializers/availability_serializers.py`
- `core_app/management/commands/create_fake_slots.py`, `create_trainer_weekday_slots.py`, `maintain_slots.py`
- Tests for the above: `core_app/tests/commands/test_create_trainer_weekday_slots.py`, `core_app/tests/commands/test_maintain_slots.py`, `core_app/tests/serializers/test_availability_serializers.py`, and the `generate_slots_for_trainer` tests inside `core_app/tests/services/test_slot_schedule.py`

**Frontend — modify:**
- `lib/stores/bookingStore.ts` — `fetchAvailability`; drop `fetchTrainerDayBookings`; post `starts_at`/`new_starts_at`
- `app/(app)/book-session/page.tsx` — consume `/api/availability/`; remove `WEEKDAY_WINDOWS`/`slotsForDate`/virtual-slot resolution; tz fix
- `app/components/booking/TimeSlotPicker.tsx`, `BookingConfirmation.tsx`, `BookingSuccess.tsx`, `UpcomingSessionsCard.tsx`, `UpcomingSessionReminder.tsx`, `SessionDetailModal.tsx`, `UpcomingSessionsCard.tsx`, and any dashboard component reading `booking.slot.*` — read `booking.starts_at`/`ends_at`
- Their `*.test.*` files under `app/__tests__/...` — update fixtures (`slot:{starts_at}` → `starts_at`)

---

## Phase 0 — Pre-flight

### Task 0: Verify data is migration-clean

**Files:** none (read-only check)

- [ ] **Step 1: Confirm no bookings without a slot**

Run: `cd backend && source venv/bin/activate && python manage.py shell -c "from core_app.models import Booking; print('null slot:', Booking.objects.filter(slot__isnull=True).count(), '| total:', Booking.objects.count())"`
Expected: `null slot: 0 | total: <n>`. If non-zero, STOP and decide how to handle those bookings before continuing.

- [ ] **Step 2: Note the active-booking count for the post-migration assertion**

Run: `python manage.py shell -c "from core_app.models import Booking; print(Booking.objects.exclude(status='canceled').count())"`
Record the number — Task 13 asserts it's unchanged.

---

## Phase 1 — Service layer (`slot_schedule.py`)

> New pure functions are added alongside the existing `generate_slots_for_trainer` for now (it still references `AvailabilitySlot`, which is removed in Phase 6). Tests use a frozen `now`.

### Task 1: `_expand_schedule` — candidate start-times from the weekly schedule

**Files:**
- Modify: `core_app/services/slot_schedule.py`
- Test: `core_app/tests/services/test_slot_schedule.py`

- [ ] **Step 1: Add new constants to `core_app/services/slot_schedule.py`** (keep the existing `WEEKLY_SCHEDULE`, `BOOKING_HORIZON_DAYS`, `MAX_ROLLOVER_SESSIONS`, `generate_slots_for_trainer` for now)

```python
SESSION_MINUTES = 60
SLOT_STEP_MINUTES = 15
MIN_ADVANCE_HOURS = 16
TRAVEL_BUFFER_MINUTES = 45
BUSINESS_TZ = ZoneInfo('America/Bogota')
```

(`from zoneinfo import ZoneInfo`, `from datetime import datetime, time, timedelta` are already imported; add what's missing.)

- [ ] **Step 2: Write the failing test**

```python
# in test_slot_schedule.py
from core_app.services.slot_schedule import _expand_schedule, BUSINESS_TZ
from datetime import date, datetime
from zoneinfo import ZoneInfo

class TestExpandSchedule:
    def test_weekday_yields_morning_and_evening_starts(self):
        # 2026-05-18 is a Monday
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
        starts = list(_expand_schedule(date(2026, 5, 16), date(2026, 5, 17),
                                       step_minutes=15, session_minutes=60, tz=BUSINESS_TZ))
        # Sat 6-13: 60-min every 15 min → 25
        assert len(starts) == 25

    def test_sunday_empty(self):
        # 2026-05-17 is a Sunday
        starts = list(_expand_schedule(date(2026, 5, 17), date(2026, 5, 18),
                                       step_minutes=15, session_minutes=60, tz=BUSINESS_TZ))
        assert starts == []
```

- [ ] **Step 3: Run — expect failure** — `pytest core_app/tests/services/test_slot_schedule.py::TestExpandSchedule -v` → `ImportError: cannot import name '_expand_schedule'`

- [ ] **Step 4: Implement `_expand_schedule`**

```python
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
                yield cursor.astimezone(timezone.utc)
                cursor += step
        day += timedelta(days=1)
```

(`from datetime import timezone` may be needed, or use `django.utils.timezone.utc` — match what's already imported; `from django.utils import timezone` is already there, so use `timezone.utc`.)

- [ ] **Step 5: Run — expect pass** — `pytest core_app/tests/services/test_slot_schedule.py::TestExpandSchedule -v` → PASS

- [ ] **Step 6: Commit** — `git add core_app/services/slot_schedule.py core_app/tests/services/test_slot_schedule.py && git commit -m "feat(availability): _expand_schedule candidate generator"`

---

### Task 2: `compute_available_start_times` + `is_start_time_available` + `session_window`

**Files:**
- Modify: `core_app/services/slot_schedule.py`
- Test: `core_app/tests/services/test_slot_schedule.py`

- [ ] **Step 1: Write the failing test** (covers cutoffs and booking subtraction)

```python
# in test_slot_schedule.py
import datetime as dt
from django.utils import timezone as djtz
from core_app.models import Booking, Package, User
from core_app.services.slot_schedule import (
    compute_available_start_times, is_start_time_available, session_window,
)

@pytest.fixture
def package(db):
    return Package.objects.create(title='P', price='10.00', sessions_total=8)

def _utc(y, m, d, h, minute=0):
    return dt.datetime(y, m, d, h, minute, tzinfo=dt.timezone.utc)

class TestComputeAvailability:
    # FIXED_NOW is 2026-03-02 10:00 Bogota (Monday) from the autouse freeze fixture.

    def test_clean_week_counts(self, trainer):
        # date_from from a Monday far enough ahead to dodge the 16h cutoff
        days = compute_available_start_times(trainer, dt.date(2026, 5, 18), dt.date(2026, 5, 24))
        assert len(days[dt.date(2026, 5, 18)]) == 46   # Mon
        assert len(days[dt.date(2026, 5, 23)]) == 25   # Sat
        assert dt.date(2026, 5, 24) not in days        # Sun → no key (only days with free hours)

    def test_min_advance_cutoff(self, trainer):
        # now = 2026-03-02 10:00 Bogota = 15:00 UTC. +16h = 2026-03-03 07:00 UTC.
        days = compute_available_start_times(trainer, dt.date(2026, 3, 3), dt.date(2026, 3, 4))
        starts = days.get(dt.date(2026, 3, 3), [])
        # 2026-03-03 is Tuesday; window 5-13 Bogota = 10:00-18:00 UTC. Cutoff 07:00 UTC < 10:00,
        # so the whole morning window survives; assert the first one is exactly 10:00 UTC.
        assert _utc(2026, 3, 3, 10) in starts
        # and a start before the cutoff is excluded — craft one: Tuesday 5-13 Bogota all > cutoff,
        # so instead assert nothing starts before now: min(starts) >= now+16h
        assert min(starts) >= _utc(2026, 3, 3, 7)

    def test_horizon_cutoff(self, trainer):
        # now+30d = 2026-04-01 15:00 UTC. A candidate on 2026-04-02 must be excluded.
        days = compute_available_start_times(trainer, dt.date(2026, 4, 1), dt.date(2026, 4, 3))
        assert dt.date(2026, 4, 2) not in days

    def test_booking_blocks_overlapping_starts_with_buffer(self, trainer, package):
        # Booked 2026-05-18 (Mon) 12:00→13:00 Bogota = 17:00→18:00 UTC.
        b_start = _utc(2026, 5, 18, 17)
        Booking.objects.create(
            customer=User.objects.create_user(email='c1@k.com', password='p'),
            package=package, trainer=trainer, status=Booking.Status.PENDING,
            starts_at=b_start, ends_at=b_start + dt.timedelta(minutes=60),
        )
        days = compute_available_start_times(trainer, dt.date(2026, 5, 18), dt.date(2026, 5, 19))
        starts = days[dt.date(2026, 5, 18)]
        # buffer ±45m → blocked window [16:15, 18:45) UTC. Candidates in [16:15, 18:45) are excluded.
        assert _utc(2026, 5, 18, 17) not in starts          # the booked one
        assert _utc(2026, 5, 18, 16, 30) not in starts      # 16:30→17:30 overlaps [16:15,18:45)
        assert _utc(2026, 5, 18, 16, 15) not in starts
        assert _utc(2026, 5, 18, 16) in starts              # 16:00→17:00 ends at 17:00 > 16:15 → also blocked? no: 17:00 > 16:15 AND 16:00 < 18:45 → OVERLAPS → excluded
        # correct expectation: a candidate [s, s+60] is blocked iff s < 18:45 and s+60 > 16:15 → s in (15:15, 18:45)
        # so 16:00 IS blocked; the first surviving morning start is 10:00 UTC (05:00 Bogota), last before block is 15:00 UTC (10:00 Bogota)
        assert _utc(2026, 5, 18, 15) in starts
        assert _utc(2026, 5, 18, 15, 15) not in starts

    def test_is_start_time_available(self, trainer, package):
        assert is_start_time_available(trainer, _utc(2026, 5, 18, 10)) is True       # Mon 05:00 Bogota, in window
        assert is_start_time_available(trainer, _utc(2026, 5, 18, 10, 7)) is False   # not on the 15-min grid
        assert is_start_time_available(trainer, _utc(2026, 5, 17, 10)) is False      # Sunday
        assert is_start_time_available(trainer, _utc(2026, 1, 1, 10)) is False       # in the past

    def test_session_window(self, trainer):
        s = _utc(2026, 5, 18, 10)
        assert session_window(trainer, s) == (s, s + dt.timedelta(minutes=60))
```

> When writing the real implementation, double-check the buffer arithmetic and adjust the exact timestamps in the test to match — the rule is: candidate `[s, s+session]` is blocked by booking `[bs, be]` iff `s < be + buffer` and `s + session > bs - buffer`.

- [ ] **Step 2: Run — expect failure** — `pytest core_app/tests/services/test_slot_schedule.py::TestComputeAvailability -v` → ImportError

- [ ] **Step 3: Implement** (append to `slot_schedule.py`)

```python
from core_app.models import Booking  # safe: Booking imports slot_schedule? no — check; if circular, import inside function

_ACTIVE_STATUSES = (Booking.Status.PENDING, Booking.Status.CONFIRMED)


def _session_minutes_for(trainer):
    return getattr(trainer, 'session_duration_minutes', None) or SESSION_MINUTES


def session_window(trainer, starts_at):
    return (starts_at, starts_at + timedelta(minutes=_session_minutes_for(trainer)))


def _blocked_by_bookings(starts_at, ends_at, bookings, buffer):
    for b in bookings:
        if starts_at < b.ends_at + buffer and ends_at > b.starts_at - buffer:
            return True
    return False


def compute_available_start_times(trainer, date_from, date_to, *, now=None):
    """Return {date: [aware UTC datetime, ...]} of bookable start-times.

    Only days with ≥1 free start-time appear as keys.
    """
    if now is None:
        now = timezone.now()
    session_minutes = _session_minutes_for(trainer)
    session = timedelta(minutes=session_minutes)
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    min_start = now + timedelta(hours=MIN_ADVANCE_HOURS)
    horizon = now + timedelta(days=BOOKING_HORIZON_DAYS)

    range_start_utc = datetime.combine(date_from, time.min, tzinfo=BUSINESS_TZ).astimezone(timezone.utc)
    range_end_utc = datetime.combine(date_to, time.min, tzinfo=BUSINESS_TZ).astimezone(timezone.utc)
    bookings = list(
        Booking.objects.filter(
            trainer=trainer, status__in=_ACTIVE_STATUSES,
            starts_at__lt=range_end_utc + buffer, ends_at__gt=range_start_utc - buffer,
        ).only('starts_at', 'ends_at')
    )

    result = {}
    for start in _expand_schedule(date_from, date_to,
                                  step_minutes=SLOT_STEP_MINUTES,
                                  session_minutes=session_minutes, tz=BUSINESS_TZ):
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
    available = compute_available_start_times(trainer, local_day, local_day + timedelta(days=1), now=now)
    return starts_at in available.get(local_day, [])
```

> If `from core_app.models import Booking` at module level causes a circular import (likely, since `booking.py` currently imports `availability.py` and the models package wires everything), import `Booking` lazily inside the functions instead. Verify with `python -c "import core_app.services.slot_schedule"`.

- [ ] **Step 4: Run — expect pass** — `pytest core_app/tests/services/test_slot_schedule.py -v` (whole file; ≤20 tests)

- [ ] **Step 5: Commit** — `git add core_app/services/slot_schedule.py core_app/tests/services/test_slot_schedule.py && git commit -m "feat(availability): compute_available_start_times + is_start_time_available"`

---

### Task 3: Rewrite `booking_rules.has_trainer_travel_buffer_conflict`

**Files:**
- Modify: `core_app/services/booking_rules.py`
- Test: `core_app/tests/services/test_booking_rules.py`

- [ ] **Step 1: Rewrite the failing tests** in `test_booking_rules.py` to the new signature

```python
from datetime import datetime, timedelta, timezone as tz
from core_app.services.booking_rules import has_trainer_travel_buffer_conflict
from core_app.models import Booking, Package, User, TrainerProfile

def _utc(*a): return datetime(*a, tzinfo=tz.utc)

class TestTravelBufferConflict:
    def test_no_bookings_no_conflict(self, db):
        t = TrainerProfile.objects.create(user=User.objects.create_user(email='t@k.com', password='p'), specialty='S')
        assert has_trainer_travel_buffer_conflict(t, _utc(2026, 5, 18, 10), _utc(2026, 5, 18, 11)) is False

    def test_overlap_within_buffer_is_conflict(self, db):
        t = TrainerProfile.objects.create(user=User.objects.create_user(email='t2@k.com', password='p'), specialty='S')
        p = Package.objects.create(title='P', price='1.00', sessions_total=1)
        bs = _utc(2026, 5, 18, 12)
        Booking.objects.create(customer=User.objects.create_user(email='c@k.com', password='p'),
                               package=p, trainer=t, status=Booking.Status.PENDING,
                               starts_at=bs, ends_at=bs + timedelta(minutes=60))
        # candidate 11:30-12:30 → within ±45m of [12:00,13:00] → conflict
        assert has_trainer_travel_buffer_conflict(t, _utc(2026, 5, 18, 11, 30), _utc(2026, 5, 18, 12, 30)) is True
        # candidate 9:00-10:00 → 2h before → no conflict
        assert has_trainer_travel_buffer_conflict(t, _utc(2026, 5, 18, 9), _utc(2026, 5, 18, 10)) is False

    def test_exclude_booking_id(self, db):
        t = TrainerProfile.objects.create(user=User.objects.create_user(email='t3@k.com', password='p'), specialty='S')
        p = Package.objects.create(title='P', price='1.00', sessions_total=1)
        bs = _utc(2026, 5, 18, 12)
        b = Booking.objects.create(customer=User.objects.create_user(email='c2@k.com', password='p'),
                                   package=p, trainer=t, status=Booking.Status.PENDING,
                                   starts_at=bs, ends_at=bs + timedelta(minutes=60))
        assert has_trainer_travel_buffer_conflict(t, bs, bs + timedelta(minutes=60), exclude_booking_id=b.id) is False
```

- [ ] **Step 2: Run — expect failure** — `pytest core_app/tests/services/test_booking_rules.py -v`

- [ ] **Step 3: Rewrite `core_app/services/booking_rules.py`**

```python
"""Booking scheduling business-rule helpers (trainer travel-buffer check)."""

from datetime import timedelta

from core_app.models import Booking
from core_app.services.slot_schedule import TRAVEL_BUFFER_MINUTES

ACTIVE_BOOKING_STATUSES = (Booking.Status.PENDING, Booking.Status.CONFIRMED)


def has_trainer_travel_buffer_conflict(trainer, starts_at, ends_at, *, exclude_booking_id=None):
    """Return True if [starts_at, ends_at] is within ±TRAVEL_BUFFER_MINUTES of
    any active booking for *trainer*."""
    if trainer is None:
        return False
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    qs = Booking.objects.filter(
        trainer=trainer, status__in=ACTIVE_BOOKING_STATUSES,
        starts_at__lt=ends_at + buffer, ends_at__gt=starts_at - buffer,
    )
    if exclude_booking_id is not None:
        qs = qs.exclude(pk=exclude_booking_id)
    return qs.exists()
```

(Delete `resolve_effective_trainer_id` and `build_trainer_buffer_slot_conflict_q`. If a circular import arises from `from core_app.services.slot_schedule import TRAVEL_BUFFER_MINUTES`, define `TRAVEL_BUFFER_MINUTES = 45` locally and have `slot_schedule` import it from here instead — pick one home and keep it DRY.)

- [ ] **Step 4: Run — expect pass** — `pytest core_app/tests/services/test_booking_rules.py -v`

- [ ] **Step 5: Commit** — `git add core_app/services/booking_rules.py core_app/tests/services/test_booking_rules.py && git commit -m "refactor(availability): travel-buffer check operates on (trainer, starts_at, ends_at)"`

---

## Phase 2 — Model & migrations (add new fields, backfill)

### Task 4: Add `Booking.starts_at` / `ends_at` (nullable) + backfill migration

**Files:**
- Modify: `core_app/models/booking.py`
- Create: `core_app/migrations/00XX_booking_starts_ends_nullable.py`, `core_app/migrations/00XX_booking_backfill_times.py`
- Test: `core_app/tests/models/` (add `test_booking_backfill_migration.py`) — optional but recommended

- [ ] **Step 1: Add nullable fields to `core_app/models/booking.py`** (keep `slot` for now)

```python
    starts_at = models.DateTimeField(null=True, blank=True, db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
```

- [ ] **Step 2: Make the schema migration** — `python manage.py makemigrations core_app -n booking_starts_ends_nullable`

- [ ] **Step 3: Write the data migration** (`python manage.py makemigrations core_app --empty -n booking_backfill_times`, then fill it):

```python
from django.db import migrations


def copy_slot_times(apps, schema_editor):
    Booking = apps.get_model('core_app', 'Booking')
    for b in Booking.objects.select_related('slot').iterator():
        if b.slot_id and (b.starts_at is None or b.ends_at is None):
            b.starts_at = b.slot.starts_at
            b.ends_at = b.slot.ends_at
            b.save(update_fields=['starts_at', 'ends_at'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [('core_app', '00XX_booking_starts_ends_nullable')]
    operations = [migrations.RunPython(copy_slot_times, noop)]
```

- [ ] **Step 4: Run the migrations and verify** — `python manage.py migrate core_app` then `python manage.py shell -c "from core_app.models import Booking; print(Booking.objects.filter(slot__isnull=False, starts_at__isnull=True).count())"` → `0`

- [ ] **Step 5: Commit** — `git add core_app/models/booking.py core_app/migrations/ && git commit -m "feat(booking): add nullable starts_at/ends_at + backfill from slot"`

---

## Phase 3 — Booking serializer

### Task 5: `BookingSerializer` — accept `starts_at`, validate against computed availability

**Files:**
- Modify: `core_app/serializers/booking_serializers.py`
- Test: `core_app/tests/serializers/test_booking_serializers.py`

- [ ] **Step 1: Rewrite the relevant tests** in `test_booking_serializers.py` (one observable behavior each):

```python
# Replace slot-based fixtures with starts_at-based ones. Freeze now.
# - test_create_with_valid_start_time_succeeds → POST {package_id, starts_at, subscription_id};
#     booking.starts_at == sent; booking.ends_at == sent + 60m; sub.sessions_used incremented.
# - test_start_time_off_grid_rejected → starts_at = X:07 → ValidationError {'starts_at': ...}
# - test_start_time_in_past_rejected
# - test_customer_without_trainer → NoTrainerAssignedException (code 'no_trainer_assigned')
# - test_subscription_without_sessions_rejected
# (Use the existing test file's helpers/fixtures for users, packages, subscriptions.)
```

- [ ] **Step 2: Run — expect failure** — `pytest core_app/tests/serializers/test_booking_serializers.py -v`

- [ ] **Step 3: Rewrite `BookingSerializer`** in `core_app/serializers/booking_serializers.py`:
  - Remove `slot = AvailabilitySlotSerializer(read_only=True)` and `slot_id = PrimaryKeyRelatedField(...)` and the import of `AvailabilitySlotSerializer` / `AvailabilitySlot`.
  - Add write field `starts_at = serializers.DateTimeField(write_only=True)` (and keep `trainer_id`, `subscription_id`, `package_id`).
  - Add read fields `starts_at = serializers.DateTimeField(read_only=True)` — wait, can't have both names; instead make `starts_at` a normal model field on the serializer (drop `write_only`) and add `ends_at` read-only. So: `fields = (... 'starts_at', 'ends_at', ...)` (no nested `slot`), with `starts_at` writable, `ends_at` read-only.
  - `get_program_day_exercises`: `obj.slot.starts_at.date()` → `obj.starts_at.date()`.
  - `validate()`:

```python
def validate(self, attrs):
    request = self.context.get('request')
    customer = getattr(request, 'user', None) if request else None
    if customer is not None and getattr(customer, 'is_authenticated', False):
        if getattr(customer, 'role', None) == 'customer':
            assigned = getattr(customer, 'assigned_trainer', None)
            if assigned is None:
                raise NoTrainerAssignedException()
            attrs['trainer'] = assigned
    trainer = attrs.get('trainer')
    starts_at = attrs.get('starts_at')
    if trainer is None:
        raise serializers.ValidationError({'trainer_id': 'Se requiere un entrenador.'})
    if not is_start_time_available(trainer, starts_at):
        raise serializers.ValidationError({'starts_at': 'Ese horario no está disponible.'})
    attrs['ends_at'] = session_window(trainer, starts_at)[1]
    subscription = attrs.get('subscription')
    if subscription and subscription.sessions_remaining <= 0:
        raise serializers.ValidationError({'subscription_id': 'La suscripción no tiene sesiones disponibles.'})
    return attrs
```

  - `create()`:

```python
def create(self, validated_data):
    request = self.context.get('request')
    customer = getattr(request, 'user', None)
    if not customer or not customer.is_authenticated:
        raise serializers.ValidationError('Autenticación requerida.')
    trainer = validated_data['trainer']
    starts_at = validated_data['starts_at']
    subscription = validated_data.get('subscription')
    with transaction.atomic():
        TrainerProfile.objects.select_for_update().get(pk=trainer.pk)
        if not is_start_time_available(trainer, starts_at, now=timezone.now()):
            raise serializers.ValidationError({'starts_at': 'Ese horario ya no está disponible.'})
        if subscription:
            sub = Subscription.objects.select_for_update().get(pk=subscription.pk)
            if sub.sessions_remaining <= 0:
                raise serializers.ValidationError({'subscription_id': 'La suscripción no tiene sesiones disponibles.'})
            sub.sessions_used = db_models.F('sessions_used') + 1
            sub.save(update_fields=['sessions_used'])
            validated_data['subscription'] = sub
        booking = Booking.objects.create(customer=customer, status=Booking.Status.PENDING, **validated_data)
    return booking
```

  - Imports: `from core_app.services.slot_schedule import is_start_time_available, session_window`; keep `TrainerProfile`, `Subscription`, `Booking`, `Package`, `transaction`, `db_models`, `timezone`.

- [ ] **Step 4: Run — expect pass** — `pytest core_app/tests/serializers/test_booking_serializers.py -v`

- [ ] **Step 5: Commit** — `git add core_app/serializers/booking_serializers.py core_app/tests/serializers/test_booking_serializers.py && git commit -m "refactor(booking): serializer validates starts_at against computed availability"`

---

## Phase 4 — Booking views

### Task 6: `cancel` + `reschedule` use `starts_at`; remove `occupied_day`; fix `slot__` lookups

**Files:**
- Modify: `core_app/views/booking_views.py`
- Test: `core_app/tests/views/test_booking_views.py`, `core_app/tests/views/test_booking_views_extended.py`

- [ ] **Step 1: Update/rewrite the affected tests** — `cancel` (status→canceled; no slot side-effect), `reschedule` (body `{"new_starts_at": "<iso>"}`; <24h → 400; off-grid → 400; success → 201 with new `starts_at`), `upcoming-reminder` (orders by `starts_at`). Remove tests for `occupied-day`.

- [ ] **Step 2: Run — expect failure** — `pytest core_app/tests/views/test_booking_views.py core_app/tests/views/test_booking_views_extended.py -v`

- [ ] **Step 3: Edit `core_app/views/booking_views.py`:**
  - `cancel`: delete the block that loads `slot` and sets `slot.is_blocked = False`/`slot.save(...)`; keep `booking.status = CANCELED`, `canceled_reason`, `_cancel_guest_booking_for_slot(booking)` (the helper itself: it queries `Booking.objects.filter(slot=...)` — change to `filter(trainer=host_booking.trainer, starts_at=host_booking.starts_at)`).
  - `_maybe_create_guest_booking`: `slot=host_booking.slot` → `starts_at=host_booking.starts_at, ends_at=host_booking.ends_at`.
  - `reschedule`: replace the `new_slot_id`/`AvailabilitySlot.objects.get` logic with:

```python
new_starts_at = request.data.get('new_starts_at')
if not new_starts_at:
    return Response({'detail': 'El campo new_starts_at es obligatorio.'}, status=400)
new_starts_at = serializers.DateTimeField().to_internal_value(new_starts_at)  # parse/validate ISO
# (also keep the existing ≥24h check on booking.starts_at)
with transaction.atomic():
    TrainerProfile.objects.select_for_update().get(pk=booking.trainer_id)
    if not is_start_time_available(booking.trainer, new_starts_at, now=timezone.now()):
        return Response({'detail': 'El nuevo horario no está disponible.'}, status=400)
    booking.status = Booking.Status.CANCELED
    booking.canceled_reason = 'Reprogramada por el usuario.'
    booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])
    _, new_end = session_window(booking.trainer, new_starts_at)
    new_booking = Booking.objects.create(
        customer=booking.customer, package=booking.package, trainer=booking.trainer,
        subscription=booking.subscription, status=Booking.Status.PENDING,
        starts_at=new_starts_at, ends_at=new_end,
    )
    _cancel_guest_booking_for_slot(booking)
    _maybe_create_guest_booking(new_booking)
send_booking_reschedule(booking, new_booking)
return Response(self.get_serializer(new_booking).data, status=201)
```

  - Replace any `time_until = booking.slot.starts_at - timezone.now()` → `booking.starts_at`.
  - `upcoming_reminder`: `filter(slot__starts_at__gt=...)` → `filter(starts_at__gt=...)`; `order_by('slot__starts_at')` → `order_by('starts_at')`; `select_related('customer','package','slot','trainer__user','subscription')` → drop `'slot'`.
  - **Delete** the entire `occupied_day` action.
  - Update imports: drop `AvailabilitySlot`, `has_trainer_travel_buffer_conflict` (or keep if still used elsewhere in the file — it's now `(trainer, starts_at, ends_at)`); add `is_start_time_available`, `session_window`, `TrainerProfile`; drop `BOOKING_HORIZON_DAYS` if unused (it's used in `slot_schedule` now). Keep the `≥30d` check inside `is_start_time_available` (it already does it).

- [ ] **Step 4: Run — expect pass** — `pytest core_app/tests/views/test_booking_views.py core_app/tests/views/test_booking_views_extended.py -v`

- [ ] **Step 5: Commit** — `git add core_app/views/booking_views.py core_app/tests/views/test_booking_views.py core_app/tests/views/test_booking_views_extended.py && git commit -m "refactor(booking): cancel/reschedule on starts_at; drop occupied-day endpoint"`

---

## Phase 5 — Availability API

### Task 7: `GET /api/availability/` + remove `AvailabilitySlotViewSet`

**Files:**
- Modify (replace contents): `core_app/views/availability_views.py`
- Modify: `core_app/urls/api_urls.py`, `core_app/views/__init__.py`, `core_app/serializers/__init__.py`, `core_app/admin.py`
- Delete: `core_app/serializers/availability_serializers.py`, `core_app/tests/serializers/test_availability_serializers.py`
- Test: `core_app/tests/views/test_availability_views.py` (rewrite)

- [ ] **Step 1: Rewrite `test_availability_views.py`:**

```python
import datetime as dt
import pytest
from rest_framework.test import APIClient
from core_app.models import User, TrainerProfile, CustomerProfile

@pytest.fixture
def trainer(db):
    return TrainerProfile.objects.create(user=User.objects.create_user(email='t@k.com', password='p', role=User.Role.TRAINER), specialty='S')

class TestAvailabilityEndpoint:
    def test_requires_auth(self, db):
        assert APIClient().get('/api/availability/?trainer=1').status_code == 401

    def test_returns_days_with_free_starts(self, trainer):
        c = User.objects.create_user(email='c@k.com', password='p', role=User.Role.CUSTOMER)
        client = APIClient(); client.force_authenticate(c)
        r = client.get(f'/api/availability/?trainer={trainer.id}')
        assert r.status_code == 200
        body = r.json()
        assert body['trainer_id'] == trainer.id
        assert body['session_minutes'] == 60
        # every value is a non-empty list of ISO timestamps; no Sundays
        for day, starts in body['days'].items():
            assert starts
            assert dt.date.fromisoformat(day).weekday() != 6

    def test_missing_trainer_uses_assigned(self, trainer):
        c = User.objects.create_user(email='c2@k.com', password='p', role=User.Role.CUSTOMER)
        CustomerProfile.objects.filter(user=c).update(assigned_trainer=trainer)  # adapt to how assignment is stored
        client = APIClient(); client.force_authenticate(c)
        assert client.get('/api/availability/').status_code == 200

    def test_missing_trainer_no_assigned_400(self, db):
        c = User.objects.create_user(email='c3@k.com', password='p', role=User.Role.CUSTOMER)
        client = APIClient(); client.force_authenticate(c)
        assert client.get('/api/availability/').status_code == 400
```

> Check how `user.assigned_trainer` is actually wired (it's a property/relation on `User` — see `auth`/`CustomerProfile`); adapt the fixture accordingly.

- [ ] **Step 2: Run — expect failure** — `pytest core_app/tests/views/test_availability_views.py -v`

- [ ] **Step 3: Replace `core_app/views/availability_views.py` contents:**

```python
from datetime import datetime, timedelta

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import TrainerProfile
from core_app.services.slot_schedule import (
    BOOKING_HORIZON_DAYS, _session_minutes_for, compute_available_start_times,
)


class AvailabilityView(APIView):
    """GET /api/availability/?trainer=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>

    Returns only days with ≥1 free start-time.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trainer = self._resolve_trainer(request)
        if trainer is None:
            return Response({'detail': 'Se requiere un entrenador (parámetro trainer).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            date_from = self._parse_date(request.query_params.get('from')) or datetime.now().date()
            date_to = self._parse_date(request.query_params.get('to')) or (date_from + timedelta(days=BOOKING_HORIZON_DAYS))
        except ValueError:
            return Response({'detail': 'Fecha inválida (use YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        date_to = min(date_to, date_from + timedelta(days=BOOKING_HORIZON_DAYS))
        days = compute_available_start_times(trainer, date_from, date_to)
        return Response({
            'trainer_id': trainer.id,
            'session_minutes': _session_minutes_for(trainer),
            'days': {d.isoformat(): [t.isoformat().replace('+00:00', 'Z') for t in starts]
                     for d, starts in sorted(days.items())},
        })

    @staticmethod
    def _parse_date(s):
        return datetime.strptime(s, '%Y-%m-%d').date() if s else None

    @staticmethod
    def _resolve_trainer(request):
        tid = request.query_params.get('trainer')
        if tid:
            return TrainerProfile.objects.filter(pk=tid).first()
        return getattr(request.user, 'assigned_trainer', None)
```

- [ ] **Step 4: Wire the URL** in `core_app/urls/api_urls.py`: remove the `router.register(r'availability-slots', AvailabilitySlotViewSet, ...)` line; add `path('availability/', AvailabilityView.as_view(), name='availability')` to `urlpatterns`. Update the import (`from core_app.views import AvailabilityView`).

- [ ] **Step 5: Clean exports/admin** — in `core_app/views/__init__.py` replace `AvailabilitySlotViewSet` export with `AvailabilityView`; in `core_app/serializers/__init__.py` drop `AvailabilitySlotSerializer`; delete `core_app/serializers/availability_serializers.py` and `core_app/tests/serializers/test_availability_serializers.py`; in `core_app/admin.py` delete `AvailabilitySlotAdmin` and the `AvailabilitySlot` import, and in `BookingAdmin` replace `'slot'` with `'starts_at'` in `list_display` and remove `'slot'` from `autocomplete_fields`.

- [ ] **Step 6: Run — expect pass** — `pytest core_app/tests/views/test_availability_views.py -v` and `python manage.py check`

- [ ] **Step 7: Commit** — `git add -A core_app/views core_app/urls core_app/serializers core_app/admin.py core_app/tests/views/test_availability_views.py && git commit -m "feat(availability): GET /api/availability/ replaces AvailabilitySlot CRUD"`

---

## Phase 6 — Drop `AvailabilitySlot`, finalize `Booking`, remove dead code

### Task 8: Update remaining backend consumers (ics, cleanup)

**Files:**
- Modify: `core_app/services/ics_generator.py`, `core_app/services/subscription_cleanup.py`
- Test: `core_app/tests/services/test_ics_generator.py`, `core_app/tests/services/test_subscription_cleanup.py`

- [ ] **Step 1: Update the tests** — fixtures build `Booking(starts_at=..., ends_at=...)` instead of `Booking(slot=...)`. ICS: assert `DTSTART`/`DTEND` come from `booking.starts_at`/`ends_at`. Cleanup: assert future bookings get canceled (no slot assertions).

- [ ] **Step 2: Run — expect failure** — `pytest core_app/tests/services/test_ics_generator.py core_app/tests/services/test_subscription_cleanup.py -v`

- [ ] **Step 3: Edit** — `ics_generator.py`: remove `slot = booking.slot`; use `booking.starts_at`/`booking.ends_at` directly everywhere (`_format_dt_utc(booking.starts_at)`, `booking.starts_at.astimezone(BOGOTA_TZ)`, etc.). `subscription_cleanup.py`: `filter(... slot__starts_at__gte=now)` → `filter(... starts_at__gte=now)`; remove the import of `AvailabilitySlot` and any slot-unblock code; drop `select_related('slot')`.

- [ ] **Step 4: Run — expect pass** — `pytest core_app/tests/services/test_ics_generator.py core_app/tests/services/test_subscription_cleanup.py -v`

- [ ] **Step 5: Commit** — `git add core_app/services/ics_generator.py core_app/services/subscription_cleanup.py core_app/tests/services/ && git commit -m "refactor(booking): ICS + subscription cleanup read booking.starts_at"`

---

### Task 9: Finalize `Booking` (NOT NULL, drop `slot`, constraints) + delete `AvailabilitySlot`

**Files:**
- Modify: `core_app/models/booking.py`, `core_app/models/__init__.py`
- Delete: `core_app/models/availability.py`
- Create: `core_app/migrations/00XX_booking_finalize_times.py`, `core_app/migrations/00XX_delete_availabilityslot.py`
- Modify: `core_app/services/slot_schedule.py` (remove `generate_slots_for_trainer`, `SLOT_MAINTENANCE_FILL_DAYS`)
- Test: `core_app/tests/models/test_booking.py` (or wherever booking model tests live) — constraint test

- [ ] **Step 1: Edit `core_app/models/booking.py`** — remove `slot` field and the `from core_app.models.availability import AvailabilitySlot` import; make `starts_at`/`ends_at` non-null (`models.DateTimeField(db_index=True)`); add `Meta.constraints`:

```python
class Meta:
    ordering = ('-created_at',)
    constraints = [
        models.CheckConstraint(condition=models.Q(ends_at__gt=models.F('starts_at')), name='booking_ends_after_starts'),
        models.UniqueConstraint(
            fields=('trainer', 'starts_at', 'customer'),
            condition=~models.Q(status='canceled'),
            name='unique_active_trainer_session_per_customer',
        ),
    ]
```

- [ ] **Step 2: Remove dead code from `slot_schedule.py`** — delete `generate_slots_for_trainer`, `SLOT_MAINTENANCE_FILL_DAYS`, and the now-unused `time` import if applicable (keep `WEEKLY_SCHEDULE`, `BOOKING_HORIZON_DAYS`, `MAX_ROLLOVER_SESSIONS`, the new functions).

- [ ] **Step 3: Delete `core_app/models/availability.py`** and remove `AvailabilitySlot` from `core_app/models/__init__.py`.

- [ ] **Step 4: makemigrations** — `python manage.py makemigrations core_app -n booking_finalize_times` (alters `starts_at`/`ends_at` to NOT NULL, removes `slot`, adds constraints) — review the generated migration; then `python manage.py makemigrations core_app -n delete_availabilityslot` (the `DeleteModel`). They may be combined into one migration by Django — that's fine.

- [ ] **Step 5: Add a model constraint test** in `core_app/tests/models/test_booking.py`:

```python
import datetime as dt, pytest
from django.db import IntegrityError
from core_app.models import Booking, Package, User, TrainerProfile

def test_no_two_active_bookings_same_trainer_time_customer(db):
    t = TrainerProfile.objects.create(user=User.objects.create_user(email='t@k.com', password='p'), specialty='S')
    p = Package.objects.create(title='P', price='1.00', sessions_total=1)
    c = User.objects.create_user(email='c@k.com', password='p')
    s = dt.datetime(2026, 5, 18, 17, tzinfo=dt.timezone.utc)
    Booking.objects.create(customer=c, package=p, trainer=t, status=Booking.Status.PENDING, starts_at=s, ends_at=s+dt.timedelta(minutes=60))
    with pytest.raises(IntegrityError):
        Booking.objects.create(customer=c, package=p, trainer=t, status=Booking.Status.PENDING, starts_at=s, ends_at=s+dt.timedelta(minutes=60))
```

- [ ] **Step 6: Migrate + check + test** — `python manage.py migrate core_app && python manage.py check && pytest core_app/tests/models/test_booking.py -v`

- [ ] **Step 7: Commit** — `git add -A core_app/models core_app/migrations core_app/services/slot_schedule.py core_app/tests/models/ && git commit -m "feat(booking): drop AvailabilitySlot; Booking owns its time window + constraints"`

---

### Task 10: Delete slot commands + the maintenance periodic task; fix data commands

**Files:**
- Delete: `core_app/management/commands/{create_fake_slots,create_trainer_weekday_slots,maintain_slots}.py` and `core_app/tests/commands/{test_create_trainer_weekday_slots,test_maintain_slots}.py`
- Modify: `core_app/tasks.py`, `core_app/management/commands/{create_fake_bookings,create_test_users,delete_fake_data}.py`; check `create_fake_diagnostics.py`
- Test: `core_app/tests/commands/test_create_fake_*` (the touched ones)

- [ ] **Step 1: Delete the three slot commands and their two test files.**

- [ ] **Step 2: `core_app/tasks.py`** — delete the `@db_periodic_task(crontab(minute=30, hour=2))` task that calls `maintain_slots` (and any helper/import it pulls in). `python manage.py check` and `python -c "import core_app.tasks"` must pass.

- [ ] **Step 3: `create_fake_bookings.py`** — remove `AvailabilitySlot` import; instead of fetching/locking a slot, pick a `starts_at` from `_expand_schedule(...)` (filtered past the 16h cutoff) and create `Booking(starts_at=..., ends_at=...)`. Remove the `select_for_update`/`is_blocked` logic.

- [ ] **Step 4: `create_test_users.py`** — delete `_create_slots` and its call; `_create_bookings` builds bookings with `starts_at`/`ends_at` (reuse `_expand_schedule` or hardcode a couple of future weekday times). `delete_fake_data.py` — remove the line that deletes `AvailabilitySlot`.

- [ ] **Step 5: `create_fake_diagnostics.py`** — `grep -n AvailabilitySlot core_app/management/commands/create_fake_diagnostics.py`; if it references slots, fix the same way; if not, no change. (Note: this file is already in the working tree as modified — coordinate.)

- [ ] **Step 6: Smoke-test the data commands** — on a scratch DB: `python manage.py migrate && python manage.py create_test_users && python manage.py create_fake_bookings --help` (or run it small); then `pytest core_app/tests/commands/ -k "fake or test_users" -v` (≤20 tests; split into ≤3 commands if needed).

- [ ] **Step 7: Commit** — `git add -A core_app/management core_app/tasks.py core_app/tests/commands && git commit -m "chore(availability): remove slot commands + maintenance cron; data commands create bookings directly"`

---

## Phase 7 — Frontend

### Task 11: `bookingStore` — `fetchAvailability`, post `starts_at`

**Files:**
- Modify: `frontend/lib/stores/bookingStore.ts`
- Test: `frontend/app/__tests__/stores/bookingStore.test.ts`

- [ ] **Step 1: Update the store tests** — `fetchAvailability(trainerId, from?, to?)` calls `GET /availability/?trainer=...` and stores `availabilityByDay: Record<string, string[]>`; `createBooking` posts `{ package_id, starts_at, trainer_id, subscription_id }`; `rescheduleBooking(id, newStartsAt)` posts `{ new_starts_at }`. Remove tests for `fetchSlots` / `fetchTrainerDayBookings`.

- [ ] **Step 2: Run — expect failure** — `cd frontend && npm test -- app/__tests__/stores/bookingStore.test.ts`

- [ ] **Step 3: Edit `bookingStore.ts`** — rename/replace `fetchSlots` → `fetchAvailability`; delete `fetchTrainerDayBookings` and `dayBookedSlots`/`dayAvailabilityLoading` state; add `availabilityByDay`; change the `Slot` type to `{ starts_at: string; ends_at: string; trainer_id: number | null }`; `createBooking` / `rescheduleBooking` send `starts_at` / `new_starts_at`. Keep `fetchBookings`, `fetchTrainers`, `fetchSubscriptions`, `reset`, `step`, etc.

- [ ] **Step 4: Run — expect pass** — `npm test -- app/__tests__/stores/bookingStore.test.ts`

- [ ] **Step 5: Commit** — `git add frontend/lib/stores/bookingStore.ts frontend/app/__tests__/stores/bookingStore.test.ts && git commit -m "refactor(frontend): bookingStore consumes /availability and posts starts_at"`

---

### Task 12: `book-session/page.tsx` — consume `/availability/`, drop virtual slots

**Files:**
- Modify: `frontend/app/(app)/book-session/page.tsx`
- Test: `frontend/app/__tests__/views/BookSessionPage.test.tsx`

- [ ] **Step 1: Update `BookSessionPage.test.tsx`** — mock `useBookingStore` so `availabilityByDay` has e.g. `{ '2026-05-18': ['2026-05-18T10:00:00Z', ...] }`; assert the calendar enables `2026-05-18`, the slot picker shows the times, picking one calls `createBooking` with that `starts_at`. Remove assertions about virtual-slot resolution / `fetchSlots`.

- [ ] **Step 2: Run — expect failure** — `cd frontend && npm test -- app/__tests__/views/BookSessionPage.test.tsx`

- [ ] **Step 3: Edit `book-session/page.tsx`:**
  - Delete: `WEEKDAY_WINDOWS`, `WEEKDAY_WINDOWS`-derived `availableDates`, `slotsForDate`, `hasTravelBufferConflict`, the local constants `SLOT_STEP_MINUTES`/`TRAVEL_BUFFER_MINUTES`/`DEFAULT_SESSION_DURATION_MINUTES`/`AVAILABILITY_HORIZON_DAYS`, `toDateKey` if now unused, the `fetchTrainerDayBookings` effect, and the entire virtual-slot resolution block in `handleConfirm`.
  - Add: `useEffect` that, when `trainer?.id` is known (and not reschedule, or for reschedule the booking's trainer), calls `fetchAvailability(trainer.id)`.
  - `availableDates` = `new Set(Object.keys(availabilityByDay))`.
  - The day's time list = `availabilityByDay[selectedDate] ?? []`, mapped into the `TimeSlotPicker`'s expected shape (each item carries `starts_at` and the derived `ends_at` — or just `starts_at` and let the picker format it).
  - `handleConfirm`: `await createBooking({ package_id: activeSub.package.id, starts_at: selectedSlot.starts_at, trainer_id: trainer?.id, subscription_id: activeSub.id })`. On error, the store's `error` is already shown via `BookingConfirmation`'s `error` prop; after a 400, call `fetchAvailability(trainer.id)` to refresh.
  - Reschedule path: `await rescheduleBooking(rescheduleBookingId, selectedSlot.starts_at)`.
  - Display: format times with `new Date(starts_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })` — never construct `new Date('...T..:..:..')` without a zone.
  - Keep: the "sin entrenador asignado" and "necesitas plan activo" early returns, the subscription progress strip, `UpcomingSessionsCard`, the success modal.

- [ ] **Step 4: Run — expect pass** — `npm test -- app/__tests__/views/BookSessionPage.test.tsx`

- [ ] **Step 5: Commit** — `git add "frontend/app/(app)/book-session/page.tsx" frontend/app/__tests__/views/BookSessionPage.test.tsx && git commit -m "refactor(frontend): book-session renders backend availability; remove virtual slots + tz bug"`

---

### Task 13: Sweep components reading `booking.slot.*`

**Files:**
- Modify: `frontend/app/components/booking/{TimeSlotPicker,BookingConfirmation,BookingSuccess,UpcomingSessionsCard,UpcomingSessionReminder,SessionDetailModal}.tsx` and any dashboard component; their `app/__tests__/...` files
- Also: any TS types describing a `Booking` (e.g. in `bookingStore.ts` or a `types` file) — `slot: {...}` → `starts_at: string; ends_at: string`

- [ ] **Step 1: Find every reader** — `cd frontend && grep -rn "\.slot\.\|slot:\s*{" app lib --include=*.ts --include=*.tsx | grep -v __tests__` and also in tests `grep -rn "\.slot\.\|slot:" app/__tests__`. Make the full list.

- [ ] **Step 2: Apply the mechanical transform** — `booking.slot.starts_at` → `booking.starts_at`, `booking.slot.ends_at` → `booking.ends_at`; in TS types replace the nested `slot` object with `starts_at: string; ends_at: string`; in test fixtures replace `slot: { starts_at: '...', ends_at: '...' }` with `starts_at: '...', ends_at: '...'`. For any time formatting that built a local `Date` from a date+time string, switch to `new Date(isoString)` + `toLocaleString('es-CO', { timeZone: 'America/Bogota', ... })`.

- [ ] **Step 3: Run the touched component tests** — `npm test -- app/__tests__/components/booking` (and the dashboard ones if touched) — split into ≤3 commands of ≤20 tests if needed.

- [ ] **Step 4: Build check** — `npm run build` (must succeed — static export; tsc must pass). If it fails on a missed `.slot.`, fix and re-run.

- [ ] **Step 5: Commit** — `git add -A frontend/app frontend/lib && git commit -m "refactor(frontend): components read booking.starts_at/ends_at"`

---

## Phase 8 — Final verification

### Task 14: Residue grep + end-to-end smoke + post-migration assertion

**Files:** none (verification)

- [ ] **Step 1: Backend residue grep** — `cd backend && grep -rn "AvailabilitySlot\|slot_id\|\.slot\.\|slot__\|generate_slots_for_trainer\|occupied-day\|occupied_day" core_app --include=*.py | grep -v migrations` → expect only legitimate hits (e.g. none, or comments). Fix any straggler.

- [ ] **Step 2: Frontend residue grep** — `cd frontend && grep -rn "fetchSlots\|fetchTrainerDayBookings\|WEEKDAY_WINDOWS\|new Slot\|\.slot\." app lib --include=*.ts --include=*.tsx | grep -v __tests__` → expect none.

- [ ] **Step 3: Post-migration data assertion** (run after migrations on a copy of prod data, or on dev) — `python manage.py shell -c "from core_app.models import Booking; print(Booking.objects.exclude(status='canceled').count())"` → must equal the number recorded in Task 0 Step 2.

- [ ] **Step 4: `python manage.py check` + targeted test batches** — run the touched backend tests in ≤3 commands of ≤20: e.g. `pytest core_app/tests/services/test_slot_schedule.py core_app/tests/services/test_booking_rules.py -v`; `pytest core_app/tests/serializers/test_booking_serializers.py core_app/tests/views/test_booking_views.py -v`; `pytest core_app/tests/views/test_availability_views.py core_app/tests/services/test_ics_generator.py core_app/tests/services/test_subscription_cleanup.py core_app/tests/models/test_booking.py -v`. All green.

- [ ] **Step 5: Frontend test batch + build** — `npm test -- app/__tests__/stores/bookingStore.test.ts app/__tests__/views/BookSessionPage.test.tsx`; `npm test -- app/__tests__/components/booking`; `npm run build`. All green.

- [ ] **Step 6: Manual smoke (dev)** — start both servers; log in as a customer with an assigned trainer; go to "Agendar sesión"; pick a weekday → times appear; confirm → success; the booking shows the right Bogota time; cancel it → the time reappears in the calendar; reschedule another → works. Also: `curl -s "http://192.168.56.10:8000/api/availability/?trainer=<id>" -H "Authorization: Bearer <token>"` returns days with starts.

- [ ] **Step 7: Update memory-bank if warranted** — if `docs/methodology/architecture.md` describes the slot model, update it (this is a meaningful runtime-surface change). Commit separately: `git commit -m "docs: update architecture for computed availability"`.

---

## Self-review notes

- **Spec coverage:** §5 model → Tasks 4, 9. §6 service → Tasks 1–3. §7.1 API → Task 7. §7.2 serializer → Task 5. §7.3 views → Task 6. §7.4 ics/cleanup/admin/exports → Tasks 6, 7, 8, 9. §8 frontend → Tasks 11–13. §9 migration/cleanup → Tasks 4, 9, 10. §10 tests → embedded in each task + Task 14. §11 risks → addressed (duo: constraint includes `customer`, Task 9; legacy null-slot: Task 0; no hotfix: by omission; deploy order: Task 14 note).
- **Decisions honored:** no hotfix (no such task); `/availability/` returns only days with free starts (Task 7 Step 3); 15-min grid kept; file `slot_schedule.py` not renamed.
- **Known soft spots to confirm during execution:** (1) how `user.assigned_trainer` is actually stored — adjust Task 7 fixture/resolver; (2) potential circular import for `Booking` inside `slot_schedule.py` — fall back to lazy import; (3) whether `makemigrations` collapses Task 9's two migrations into one — fine either way; (4) exact buffer-arithmetic timestamps in Task 2's test — adjust to the rule stated.
