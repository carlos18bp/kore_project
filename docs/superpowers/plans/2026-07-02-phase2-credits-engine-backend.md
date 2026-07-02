# Phase 2 Part 1 — Credits Engine Core (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the credit-economy engine: ledger + wallet + settings models, earning/loss rules hooked onto Phase 1 signals, streaks with milestone bonuses, day-close task, attendance confirmation, physical tests, and the balance/history/review APIs.

**Architecture:** Append-only `CreditTransaction` ledger with a denormalized `CreditWallet` (always reconstructible). Rules fire via the project's proven pattern: `post_save` receiver → `transaction.on_commit` → Huey task. A day-close periodic task (23:57 UTC, after `close_daily_logs`) evaluates streaks, no-shows and pending expiry. Business logic lives in `services/credit_engine.py` + `services/credit_day_close.py`, never in views.

**Tech Stack:** Django 6.0 + DRF 3.16, Huey (Redis), pytest, MySQL 8 (prod) / SQLite (dev).

**Spec:** `docs/superpowers/specs/2026-07-01-phase2-credits-engine-design.md` — read it first.

## Global Constraints

- Branch: `feat/01072026-phase2-credits-engine-core` (off `july-release`). Commit after every task.
- Code/identifiers/comments in English; **customer-facing `description` strings in Spanish**.
- Do NOT modify existing Phase 1 logic; additive fields/models only. Never edit old migrations.
- Engine failures must never break the triggering user save (swallow + log, risk-score style).
- Idempotency everywhere: ledger unique constraint `(customer, action, reference_type, reference_id)`; use `get_or_create`.
- Tests: run ONLY the file you just wrote (`cd backend && source venv/bin/activate && pytest core_app/tests/... -v`). Never the full suite; ≤20 tests per batch. CI is the final gate.
- Migrations: `python manage.py makemigrations core_app` — accept auto-generated numbers/names shown below (adjust if numbering differs).
- Frontend is OUT of scope for this plan (separate follow-up plan for trainer mini-UI).

---

### Task 1: Credit models (`CreditSettings`, `CreditWallet`, `CreditTransaction`)

**Files:**
- Create: `backend/core_app/models/credit.py`
- Modify: `backend/core_app/models/__init__.py` (add import + `__all__` entries)
- Create: migration via `makemigrations`
- Test: `backend/core_app/tests/models/test_credit_models.py`

**Interfaces:**
- Produces: `CreditSettings` (SingletonModel, `.load()`), `CreditWallet` (`customer`, `balance`, `current_streak`, `longest_streak`, `last_active_date`), `CreditTransaction` (`Action` and `Status` TextChoices, unique constraint `uq_credit_tx_reference`). Later tasks import from `core_app.models.credit`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/models/test_credit_models.py
import pytest
from django.db import IntegrityError

from core_app.models.credit import CreditSettings, CreditTransaction, CreditWallet


@pytest.mark.django_db
def test_credit_settings_is_singleton():
    a = CreditSettings.load()
    b = CreditSettings.load()
    assert a.pk == b.pk == 1
    assert a.difficulty == CreditSettings.Difficulty.MEDIUM
    assert a.training_day_threshold == 0.70
    assert a.nutrition_min_meals == 3
    assert a.water_goal_glasses == 8
    assert a.meal_review_days == 3
    assert a.reschedule_window_hours == 24
    assert a.require_workout_captures is False


@pytest.mark.django_db
def test_wallet_defaults(existing_user):
    wallet = CreditWallet.objects.create(customer=existing_user)
    assert wallet.balance == 0
    assert wallet.current_streak == 0
    assert wallet.longest_streak == 0
    assert wallet.last_active_date is None


@pytest.mark.django_db
def test_transaction_reference_is_unique_per_customer_action(existing_user):
    CreditTransaction.objects.create(
        customer=existing_user,
        action=CreditTransaction.Action.CHECKIN,
        amount=5,
        description='Completaste tu check-in',
        reference_type='mood_entry',
        reference_id='1',
    )
    with pytest.raises(IntegrityError):
        CreditTransaction.objects.create(
            customer=existing_user,
            action=CreditTransaction.Action.CHECKIN,
            amount=5,
            description='dup',
            reference_type='mood_entry',
            reference_id='1',
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/models/test_credit_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core_app.models.credit'`

- [ ] **Step 3: Write the models**

```python
# backend/core_app/models/credit.py
from django.conf import settings
from django.db import models

from core_app.models.base import SingletonModel, TimestampedModel


class CreditSettings(SingletonModel, TimestampedModel):
    """Global (singleton) configuration for the credit economy.

    ``action_values`` and ``streak_bonuses`` are seeded from the selected
    difficulty preset by ``credit_engine.get_settings()`` when empty, and can
    be individually overridden by the trainer (Part 6 UI).
    """

    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Fácil'
        MEDIUM = 'medium', 'Medio'
        HARD = 'hard', 'Difícil'

    difficulty = models.CharField(
        max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM,
    )
    action_values = models.JSONField(default=dict, blank=True)
    streak_bonuses = models.JSONField(default=dict, blank=True)
    training_day_threshold = models.FloatField(default=0.70)
    nutrition_min_meals = models.PositiveSmallIntegerField(default=3)
    water_goal_glasses = models.PositiveSmallIntegerField(default=8)
    meal_review_days = models.PositiveSmallIntegerField(default=3)
    reschedule_window_hours = models.PositiveSmallIntegerField(default=24)
    require_workout_captures = models.BooleanField(default=False)

    def __str__(self):
        return f'CreditSettings ({self.difficulty})'


class CreditWallet(TimestampedModel):
    """Denormalized per-customer credit state; reconstructible from the ledger."""

    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_wallet',
    )
    balance = models.IntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f'{self.customer} — {self.balance} credits (streak {self.current_streak})'


class CreditTransaction(TimestampedModel):
    """Append-only credit ledger. Only CONFIRMED rows touch the wallet balance."""

    class Action(models.TextChoices):
        PHYSICAL_TEST_PASSED = 'physical_test_passed', 'Physical test passed'
        SESSION_ATTENDED = 'session_attended', 'Session attended'
        WORKOUT_DAY = 'workout_day', 'Workout day'
        MEAL_PHOTO = 'meal_photo', 'Meal with photo'
        CHECKIN = 'checkin', 'Daily check-in'
        WATER_GOAL = 'water_goal', 'Hydration goal'
        STREAK_BONUS = 'streak_bonus', 'Streak bonus'
        NO_SHOW_PENALTY = 'no_show_penalty', 'No-show penalty'
        NO_SHOW_REVERSAL = 'no_show_reversal', 'No-show reversal'
        LATE_RESCHEDULE_PENALTY = 'late_reschedule_penalty', 'Late reschedule penalty'
        ADJUSTMENT = 'adjustment', 'Manual adjustment'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        REJECTED = 'rejected', 'Rejected'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_transactions',
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    amount = models.IntegerField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.CONFIRMED, db_index=True,
    )
    description = models.CharField(max_length=255)
    reference_type = models.CharField(max_length=32, blank=True, default='')
    reference_id = models.CharField(max_length=64, null=True, blank=True)
    review_deadline = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=['customer', 'action', 'reference_type', 'reference_id'],
                name='uq_credit_tx_reference',
            ),
        ]

    def __str__(self):
        return f'{self.customer} {self.action} {self.amount:+d} ({self.status})'
```

Append to `backend/core_app/models/__init__.py` (imports block and `__all__`):

```python
from .credit import CreditSettings, CreditWallet, CreditTransaction
```

```python
    'CreditSettings',
    'CreditWallet',
    'CreditTransaction',
```

- [ ] **Step 4: Make the migration**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations core_app`
Expected: new migration `0057_creditsettings_creditwallet_credittransaction*.py` (accept generated name)

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest core_app/tests/models/test_credit_models.py -v`
Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/models/credit.py backend/core_app/models/__init__.py backend/core_app/migrations/ backend/core_app/tests/models/test_credit_models.py
git commit -m "feat(credits): add CreditSettings, CreditWallet and CreditTransaction models"
```

---

### Task 2: `PhysicalTest`, `ExerciseCapture`, `Booking` attendance fields

**Files:**
- Create: `backend/core_app/models/physical_test.py`
- Modify: `backend/core_app/models/monthly_program.py` (append `ExerciseCapture` at end)
- Modify: `backend/core_app/models/booking.py` (add 2 fields + `AttendanceStatus` choices)
- Modify: `backend/core_app/models/__init__.py`
- Test: `backend/core_app/tests/models/test_credit_support_models.py`

**Interfaces:**
- Produces: `PhysicalTest` (`customer`, `trainer`, `performed_at` date, `result` in `Result.PASSED|FAILED`, `notes`); `ExerciseCapture` (`exercise_log` FK related_name `captures`, `image`); `Booking.AttendanceStatus.UNSET|ATTENDED|NO_SHOW`, fields `attendance_status` (default `unset`), `attendance_confirmed_at` (nullable).

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/models/test_credit_support_models.py
from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, User
from core_app.models.physical_test import PhysicalTest


@pytest.mark.django_db
def test_physical_test_result_choices(existing_user):
    test = PhysicalTest.objects.create(
        customer=existing_user,
        performed_at=timezone.localdate(),
        result=PhysicalTest.Result.PASSED,
    )
    assert test.result == 'passed'
    assert test.trainer is None  # nullable


@pytest.mark.django_db
def test_booking_attendance_defaults_to_unset(existing_user):
    from core_app.models import Package
    package = Package.objects.create(name='P', price=100, sessions_per_month=4, validity_days=30)
    now = timezone.now()
    booking = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now, ends_at=now + timedelta(hours=1),
    )
    assert booking.attendance_status == Booking.AttendanceStatus.UNSET
    assert booking.attendance_confirmed_at is None
```

Note for the implementer: check `Package` required fields in `backend/core_app/models/package.py` before running — if `Package.objects.create` needs different fields, mirror how `backend/core_app/tests/views/test_booking_views.py` builds its package fixture instead.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/models/test_credit_support_models.py -v`
Expected: FAIL with `No module named 'core_app.models.physical_test'`

- [ ] **Step 3: Write the models**

```python
# backend/core_app/models/physical_test.py
from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class PhysicalTest(TimestampedModel):
    """Biweekly trainer-administered physical test.

    A passed test is the human-verified source of training credits
    (see credits engine spec). Cadence is operational, not enforced.
    """

    class Result(models.TextChoices):
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='physical_tests',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='physical_tests',
    )
    performed_at = models.DateField(db_index=True)
    result = models.CharField(max_length=10, choices=Result.choices)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('-performed_at',)

    def __str__(self):
        return f'{self.customer} — {self.result} ({self.performed_at})'
```

Append to `backend/core_app/models/monthly_program.py`:

```python
class ExerciseCapture(TimestampedModel):
    """Random camera capture taken while an exercise is active.

    Evidence for workout-day credits. The client-facing copy presents the
    capture flow as video validation; the system stores sparse photos.
    """

    exercise_log = models.ForeignKey(
        ExerciseLog, on_delete=models.CASCADE, related_name='captures',
    )
    image = models.ImageField(upload_to='workout_captures/%Y/%m/')

    class Meta:
        ordering = ('created_at',)

    def __str__(self):
        return f'Capture #{self.pk} for log {self.exercise_log_id}'
```

Add to `backend/core_app/models/booking.py` inside `Booking` (below the `Status` choices class, fields after `canceled_reason`):

```python
    class AttendanceStatus(models.TextChoices):
        UNSET = 'unset', 'Unset'
        ATTENDED = 'attended', 'Attended'
        NO_SHOW = 'no_show', 'No Show'
```

```python
    attendance_status = models.CharField(
        max_length=10,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.UNSET,
        db_index=True,
    )
    attendance_confirmed_at = models.DateTimeField(null=True, blank=True)
```

Update `backend/core_app/models/__init__.py`: change the monthly_program import line to include `ExerciseCapture` and add the physical test import; extend `__all__` with `'ExerciseCapture', 'PhysicalTest'`:

```python
from .monthly_program import MonthlyProgram, ProgramDay, ProgramExercise, DailyLog, ExerciseLog, ExerciseCapture
from .physical_test import PhysicalTest
```

- [ ] **Step 4: Make migration, run test**

Run: `python manage.py makemigrations core_app && pytest core_app/tests/models/test_credit_support_models.py -v`
Expected: migration `0058_*` created; 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/models/ backend/core_app/migrations/ backend/core_app/tests/models/test_credit_support_models.py
git commit -m "feat(credits): add PhysicalTest, ExerciseCapture and Booking attendance fields"
```

---

### Task 3: Engine core — presets, settings seeding, idempotent `award()`

**Files:**
- Create: `backend/core_app/services/credit_engine.py`
- Test: `backend/core_app/tests/services/test_credit_engine.py`

**Interfaces:**
- Consumes: models from Tasks 1-2.
- Produces (used by every later task):
  - `DIFFICULTY_PRESETS: dict` — `{'easy'|'medium'|'hard': {'actions': {slug: int}, 'streak_bonuses': {str(days): int}}}`
  - `get_settings() -> CreditSettings` — loads singleton, seeds empty JSON fields from preset.
  - `action_value(settings_obj, action: str) -> int`
  - `get_wallet(customer) -> CreditWallet` (get_or_create)
  - `award(customer, action, reference_type, reference_id, description, amount=None, status='confirmed', review_deadline=None) -> CreditTransaction | None` — returns None if duplicate reference or zero amount; applies confirmed amounts to wallet balance atomically.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_engine.py
import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_get_settings_seeds_medium_preset():
    s = credit_engine.get_settings()
    assert s.action_values['session_attended'] == 50
    assert s.action_values['physical_test_passed'] == 100
    assert s.action_values['no_show_penalty'] == -40
    assert s.streak_bonuses['7'] == 50


@pytest.mark.django_db
def test_award_confirmed_updates_wallet(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.CHECKIN,
        'mood_entry', 10, 'Completaste tu check-in del lunes',
    )
    assert tx.amount == 5
    wallet = credit_engine.get_wallet(existing_user)
    assert wallet.balance == 5


@pytest.mark.django_db
def test_award_is_idempotent_per_reference(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 10, 'x')
    dup = credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 10, 'x')
    assert dup is None
    assert credit_engine.get_wallet(existing_user).balance == 5
    assert CreditTransaction.objects.count() == 1


@pytest.mark.django_db
def test_pending_award_does_not_touch_balance(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO,
        'meal_entry', 3, 'Registraste tu almuerzo',
        status=CreditTransaction.Status.PENDING,
    )
    assert tx.status == 'pending'
    assert credit_engine.get_wallet(existing_user).balance == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/services/test_credit_engine.py -v`
Expected: FAIL with `cannot import name 'credit_engine'`

- [ ] **Step 3: Write the engine core**

```python
# backend/core_app/services/credit_engine.py
"""Credit economy engine.

Award/penalty orchestration over the append-only CreditTransaction ledger.
Pure rule helpers stay ORM-free; orchestrators do the DB work. Callers on
user-request paths must treat failures as non-fatal (handlers swallow + log).
"""
from __future__ import annotations

import logging

from django.db import IntegrityError, transaction
from django.db.models import F

from core_app.models.credit import CreditSettings, CreditTransaction, CreditWallet

logger = logging.getLogger(__name__)


DIFFICULTY_PRESETS = {
    'easy': {
        'actions': {
            'physical_test_passed': 150,
            'session_attended': 75,
            'workout_day': 25,
            'meal_photo': 8,
            'checkin': 8,
            'water_goal': 15,
            'no_show_penalty': -20,
            'late_reschedule_penalty': -10,
        },
        'streak_bonuses': {'3': 30, '7': 75, '14': 150, '21': 225, '28': 375},
    },
    'medium': {
        'actions': {
            'physical_test_passed': 100,
            'session_attended': 50,
            'workout_day': 15,
            'meal_photo': 5,
            'checkin': 5,
            'water_goal': 10,
            'no_show_penalty': -40,
            'late_reschedule_penalty': -20,
        },
        'streak_bonuses': {'3': 20, '7': 50, '14': 100, '21': 150, '28': 250},
    },
    'hard': {
        'actions': {
            'physical_test_passed': 75,
            'session_attended': 40,
            'workout_day': 10,
            'meal_photo': 4,
            'checkin': 4,
            'water_goal': 8,
            'no_show_penalty': -60,
            'late_reschedule_penalty': -30,
        },
        'streak_bonuses': {'3': 15, '7': 40, '14': 75, '21': 110, '28': 190},
    },
}


def get_settings() -> CreditSettings:
    """Load the singleton, seeding empty JSON fields from the difficulty preset."""
    obj = CreditSettings.load()
    preset = DIFFICULTY_PRESETS[obj.difficulty]
    changed = False
    if not obj.action_values:
        obj.action_values = dict(preset['actions'])
        changed = True
    if not obj.streak_bonuses:
        obj.streak_bonuses = dict(preset['streak_bonuses'])
        changed = True
    if changed:
        obj.save(update_fields=['action_values', 'streak_bonuses', 'updated_at'])
    return obj


def action_value(settings_obj: CreditSettings, action: str) -> int:
    preset = DIFFICULTY_PRESETS[settings_obj.difficulty]['actions']
    return int(settings_obj.action_values.get(action, preset.get(action, 0)))


def get_wallet(customer) -> CreditWallet:
    wallet, _ = CreditWallet.objects.get_or_create(customer=customer)
    return wallet


def _apply_to_balance(tx: CreditTransaction) -> None:
    get_wallet(tx.customer)
    CreditWallet.objects.filter(customer=tx.customer).update(
        balance=F('balance') + tx.amount,
    )


def award(
    customer,
    action: str,
    reference_type: str,
    reference_id,
    description: str,
    *,
    amount: int | None = None,
    status: str = CreditTransaction.Status.CONFIRMED,
    review_deadline=None,
) -> CreditTransaction | None:
    """Create one ledger entry (idempotent per reference) and apply it if confirmed.

    Returns the created transaction, or None when the amount resolves to 0 or a
    transaction with the same (customer, action, reference) already exists.
    """
    if amount is None:
        amount = action_value(get_settings(), action)
    if amount == 0:
        return None

    try:
        with transaction.atomic():
            tx, created = CreditTransaction.objects.get_or_create(
                customer=customer,
                action=action,
                reference_type=reference_type,
                reference_id=str(reference_id) if reference_id is not None else None,
                defaults={
                    'amount': amount,
                    'status': status,
                    'description': description,
                    'review_deadline': review_deadline,
                },
            )
            if not created:
                return None
            if tx.status == CreditTransaction.Status.CONFIRMED:
                _apply_to_balance(tx)
            return tx
    except IntegrityError:
        # Lost a concurrent race for the same reference — already awarded.
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest core_app/tests/services/test_credit_engine.py -v`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/credit_engine.py backend/core_app/tests/services/test_credit_engine.py
git commit -m "feat(credits): engine core with difficulty presets and idempotent award"
```

---

### Task 4: Engine — review transitions, attendance recording, late-reschedule rule

**Files:**
- Modify: `backend/core_app/services/credit_engine.py` (append)
- Test: `backend/core_app/tests/services/test_credit_engine_rules.py`

**Interfaces:**
- Consumes: Task 3 (`award`, `get_settings`, `_apply_to_balance`).
- Produces:
  - `confirm_transaction(tx) -> bool` — pending→confirmed, applies balance.
  - `reject_transaction(tx, reviewer, note='') -> bool` — pending→rejected, sets `reviewed_by/at`, appends note to description.
  - `record_attendance(booking, attended: bool) -> None` — sets `attendance_status` + `attendance_confirmed_at`, awards `session_attended` or `no_show_penalty`; on attended, reverses a prior confirmed penalty via `no_show_reversal`.
  - `on_reschedule(old_booking, new_booking, acting_user) -> None` — customer-initiated reschedule closer than `reschedule_window_hours` → `late_reschedule_penalty` (never raises).

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_engine_rules.py
from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, Package, User
from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.fixture
def package(db):
    return Package.objects.create(name='P', price=100, sessions_per_month=4, validity_days=30)
    # If Package requires other fields, mirror the fixture in tests/views/test_booking_views.py.


@pytest.fixture
def booking(existing_user, package):
    now = timezone.now()
    return Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now - timedelta(hours=2), ends_at=now - timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_confirm_pending_transaction_applies_balance(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1,
        'Registraste tu almuerzo', status=CreditTransaction.Status.PENDING,
    )
    assert credit_engine.confirm_transaction(tx) is True
    tx.refresh_from_db()
    assert tx.status == 'confirmed'
    assert credit_engine.get_wallet(existing_user).balance == 5
    # Confirming twice must not double-apply
    assert credit_engine.confirm_transaction(tx) is False
    assert credit_engine.get_wallet(existing_user).balance == 5


@pytest.mark.django_db
def test_reject_pending_transaction(existing_user, admin_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 2,
        'Registraste tu cena', status=CreditTransaction.Status.PENDING,
    )
    assert credit_engine.reject_transaction(tx, admin_user, 'Foto no válida') is True
    tx.refresh_from_db()
    assert tx.status == 'rejected'
    assert tx.reviewed_by == admin_user
    assert 'Foto no válida' in tx.description
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_record_attendance_attended_awards_credits(booking, existing_user):
    credit_engine.record_attendance(booking, attended=True)
    booking.refresh_from_db()
    assert booking.attendance_status == Booking.AttendanceStatus.ATTENDED
    assert booking.attendance_confirmed_at is not None
    assert credit_engine.get_wallet(existing_user).balance == 50


@pytest.mark.django_db
def test_late_attendance_confirmation_reverses_penalty(booking, existing_user):
    credit_engine.record_attendance(booking, attended=False)
    assert credit_engine.get_wallet(existing_user).balance == -40
    credit_engine.record_attendance(booking, attended=True)
    # -40 (penalty) +40 (reversal) +50 (attended)
    assert credit_engine.get_wallet(existing_user).balance == 50


@pytest.mark.django_db
def test_late_reschedule_penalizes_customer(existing_user, package):
    now = timezone.now()
    old = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now + timedelta(hours=5), ends_at=now + timedelta(hours=6),
        status=Booking.Status.CANCELED,
    )
    new = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now + timedelta(days=3), ends_at=now + timedelta(days=3, hours=1),
    )
    credit_engine.on_reschedule(old, new, acting_user=existing_user)
    assert credit_engine.get_wallet(existing_user).balance == -20
    # Trainer/admin-initiated reschedule must NOT penalize
    tx_count = CreditTransaction.objects.count()
    admin = User.objects.create_user(
        email='a2@example.com', password='x', role=User.Role.ADMIN,
    )
    credit_engine.on_reschedule(old, new, acting_user=admin)
    assert CreditTransaction.objects.count() == tx_count
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/services/test_credit_engine_rules.py -v`
Expected: FAIL with `AttributeError: ... has no attribute 'confirm_transaction'`

- [ ] **Step 3: Append to `credit_engine.py`**

```python
from datetime import timedelta

from django.utils import timezone


def confirm_transaction(tx: CreditTransaction) -> bool:
    """Pending → confirmed; applies the amount to the wallet exactly once."""
    with transaction.atomic():
        updated = CreditTransaction.objects.filter(
            pk=tx.pk, status=CreditTransaction.Status.PENDING,
        ).update(status=CreditTransaction.Status.CONFIRMED, reviewed_at=timezone.now())
        if not updated:
            return False
        tx.refresh_from_db()
        _apply_to_balance(tx)
    return True


def reject_transaction(tx: CreditTransaction, reviewer, note: str = '') -> bool:
    with transaction.atomic():
        updated = CreditTransaction.objects.filter(
            pk=tx.pk, status=CreditTransaction.Status.PENDING,
        ).update(status=CreditTransaction.Status.REJECTED)
        if not updated:
            return False
    tx.refresh_from_db()
    tx.reviewed_by = reviewer
    tx.reviewed_at = timezone.now()
    if note:
        tx.description = f'{tx.description} — Rechazada: {note}'[:255]
    tx.save(update_fields=['reviewed_by', 'reviewed_at', 'description', 'updated_at'])
    return True


def record_attendance(booking, attended: bool) -> None:
    """Set booking attendance and emit the matching ledger entries."""
    from core_app.models import Booking

    booking.attendance_status = (
        Booking.AttendanceStatus.ATTENDED if attended else Booking.AttendanceStatus.NO_SHOW
    )
    booking.attendance_confirmed_at = timezone.now()
    booking.save(update_fields=['attendance_status', 'attendance_confirmed_at', 'updated_at'])

    day = timezone.localtime(booking.starts_at).date().isoformat()
    if attended:
        prior_penalty = CreditTransaction.objects.filter(
            customer=booking.customer,
            action=CreditTransaction.Action.NO_SHOW_PENALTY,
            reference_type='booking',
            reference_id=str(booking.pk),
            status=CreditTransaction.Status.CONFIRMED,
        ).first()
        if prior_penalty:
            award(
                booking.customer, CreditTransaction.Action.NO_SHOW_REVERSAL,
                'booking', booking.pk,
                f'Tu entrenador confirmó tu asistencia del {day} — penalización revertida',
                amount=-prior_penalty.amount,
            )
        award(
            booking.customer, CreditTransaction.Action.SESSION_ATTENDED,
            'booking', booking.pk,
            f'Asististe a tu sesión del {day}',
        )
    else:
        award(
            booking.customer, CreditTransaction.Action.NO_SHOW_PENALTY,
            'booking', booking.pk,
            f'No asististe a tu sesión del {day}',
        )


def on_reschedule(old_booking, new_booking, acting_user) -> None:
    """Penalize customer-initiated reschedules inside the anticipation window.

    Called from BookingViewSet.reschedule; must never raise into the request.
    """
    try:
        if acting_user is None or acting_user.pk != old_booking.customer_id:
            return
        settings_obj = get_settings()
        window = timedelta(hours=settings_obj.reschedule_window_hours)
        if old_booking.starts_at - timezone.now() >= window:
            return
        day = timezone.localtime(old_booking.starts_at).date().isoformat()
        award(
            old_booking.customer, CreditTransaction.Action.LATE_RESCHEDULE_PENALTY,
            'booking', old_booking.pk,
            f'Reprogramaste tu sesión del {day} con poca anticipación',
        )
    except Exception:
        logger.exception('credits: on_reschedule failed for booking %s', old_booking.pk)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest core_app/tests/services/test_credit_engine_rules.py -v`
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/credit_engine.py backend/core_app/tests/services/test_credit_engine_rules.py
git commit -m "feat(credits): review transitions, attendance recording and late-reschedule rule"
```

---

### Task 5: Signal receivers + Huey event task (check-in, water, meals, physical test)

**Files:**
- Modify: `backend/core_app/signals.py` (append receivers)
- Modify: `backend/core_app/tasks.py` (append `process_credit_event` db_task)
- Modify: `backend/core_app/services/credit_engine.py` (append `handle_event`)
- Test: `backend/core_app/tests/services/test_credit_events.py`

**Interfaces:**
- Consumes: `award`, `get_settings` (Tasks 3-4).
- Produces: `credit_engine.handle_event(kind: str, object_id: int) -> None` with kinds `'checkin' | 'water_glass' | 'meal_photo' | 'physical_test'`; Huey `process_credit_event(kind, object_id)`; receivers `on_mood_entry_credit`, `on_water_glass_credit`, `on_meal_entry_credit`, `on_physical_test_credit`.

Note on testing: the receivers enqueue via `transaction.on_commit`, which does NOT fire under pytest-django's default transaction wrapper. The tests below therefore exercise `credit_engine.handle_event` directly (the receivers are 3-line pass-throughs following the proven risk-score pattern); end-to-end signal delivery is verified in staging.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_events.py
import pytest
from django.utils import timezone

from core_app.models import MealEntry, MoodEntry, NutritionDailyLog, WaterGlassLog
from core_app.models.credit import CreditTransaction
from core_app.models.physical_test import PhysicalTest
from core_app.services import credit_engine


@pytest.mark.django_db
def test_checkin_event_awards_once(existing_user):
    entry = MoodEntry.objects.create(user=existing_user, score=8)
    credit_engine.handle_event('checkin', entry.pk)
    credit_engine.handle_event('checkin', entry.pk)  # idempotent
    assert credit_engine.get_wallet(existing_user).balance == 5


@pytest.mark.django_db
def test_water_goal_awards_when_goal_reached(existing_user):
    log = NutritionDailyLog.objects.create(customer=existing_user, date=timezone.localdate())
    settings_obj = credit_engine.get_settings()
    settings_obj.water_goal_glasses = 2
    settings_obj.save(update_fields=['water_goal_glasses'])

    g1 = WaterGlassLog.objects.create(daily_log=log, photo='nutrition/water/x.jpg')
    credit_engine.handle_event('water_glass', g1.pk)
    assert credit_engine.get_wallet(existing_user).balance == 0  # below goal

    g2 = WaterGlassLog.objects.create(daily_log=log, photo='nutrition/water/y.jpg')
    credit_engine.handle_event('water_glass', g2.pk)
    assert credit_engine.get_wallet(existing_user).balance == 10


@pytest.mark.django_db
def test_meal_with_photo_creates_pending_transaction(existing_user):
    log = NutritionDailyLog.objects.create(customer=existing_user, date=timezone.localdate())
    meal = MealEntry.objects.create(
        daily_log=log, meal_block=MealEntry.MealBlock.LUNCH,
        status=MealEntry.Status.COMPLETED, photo='nutrition/x.jpg',
    )
    credit_engine.handle_event('meal_photo', meal.pk)
    tx = CreditTransaction.objects.get(reference_type='meal_entry', reference_id=str(meal.pk))
    assert tx.status == CreditTransaction.Status.PENDING
    assert tx.review_deadline is not None
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_passed_physical_test_awards(existing_user):
    test = PhysicalTest.objects.create(
        customer=existing_user, performed_at=timezone.localdate(),
        result=PhysicalTest.Result.PASSED,
    )
    credit_engine.handle_event('physical_test', test.pk)
    assert credit_engine.get_wallet(existing_user).balance == 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/services/test_credit_events.py -v`
Expected: FAIL with `AttributeError: ... no attribute 'handle_event'`

- [ ] **Step 3: Append `handle_event` to `credit_engine.py`**

```python
def handle_event(kind: str, object_id: int) -> None:
    """Resolve a Phase 1 event into ledger entries. Idempotent; never raises."""
    try:
        if kind == 'checkin':
            from core_app.models import MoodEntry
            entry = MoodEntry.objects.select_related('user').get(pk=object_id)
            award(
                entry.user, CreditTransaction.Action.CHECKIN,
                'mood_entry', entry.pk,
                f'Completaste tu check-in del {entry.date.isoformat()}',
            )
        elif kind == 'water_glass':
            from core_app.models import WaterGlassLog
            glass = WaterGlassLog.objects.select_related('daily_log__customer').get(pk=object_id)
            daily_log = glass.daily_log
            settings_obj = get_settings()
            count = daily_log.water_glasses.count()
            if count >= settings_obj.water_goal_glasses:
                award(
                    daily_log.customer, CreditTransaction.Action.WATER_GOAL,
                    'nutrition_daily_log', daily_log.pk,
                    f'Cumpliste tu meta de hidratación del {daily_log.date.isoformat()}',
                )
        elif kind == 'meal_photo':
            from core_app.models import MealEntry
            meal = MealEntry.objects.select_related('daily_log__customer').get(pk=object_id)
            if meal.status != MealEntry.Status.COMPLETED or not meal.photo:
                return
            settings_obj = get_settings()
            deadline = timezone.now() + timedelta(days=settings_obj.meal_review_days)
            award(
                meal.daily_log.customer, CreditTransaction.Action.MEAL_PHOTO,
                'meal_entry', meal.pk,
                f'Registraste tu {meal.get_meal_block_display().lower()} del {meal.daily_log.date.isoformat()}',
                status=CreditTransaction.Status.PENDING,
                review_deadline=deadline,
            )
        elif kind == 'physical_test':
            from core_app.models.physical_test import PhysicalTest
            test = PhysicalTest.objects.select_related('customer').get(pk=object_id)
            if test.result != PhysicalTest.Result.PASSED:
                return
            award(
                test.customer, CreditTransaction.Action.PHYSICAL_TEST_PASSED,
                'physical_test', test.pk,
                f'Aprobaste tu test físico del {test.performed_at.isoformat()}',
            )
    except Exception:
        logger.exception('credits: handle_event(%s, %s) failed', kind, object_id)
```

- [ ] **Step 4: Append the Huey task to `backend/core_app/tasks.py`**

```python
@db_task()
def process_credit_event(kind, object_id):
    """Resolve one Phase 1 event into credit ledger entries, off the request path.

    Enqueued via transaction.on_commit by the credit signal receivers.
    """
    from core_app.services.credit_engine import handle_event
    handle_event(kind, object_id)
```

- [ ] **Step 5: Append receivers to `backend/core_app/signals.py`**

```python
# ── Credit engine event hooks (Phase 2) ─────────────────────────────────────
#
# Same pattern as the risk-score recompute: enqueue AFTER the commit so the
# worker sees the saved row, and swallow enqueue errors so credits can never
# break the user's save. Rules live in services/credit_engine.handle_event.

def _enqueue_credit_event(kind: str, object_id: int) -> None:
    def _enqueue():
        try:
            from core_app.tasks import process_credit_event
            process_credit_event(kind, object_id)
        except Exception as exc:
            logger.exception('credits: failed to enqueue %s for %s: %s', kind, object_id, exc)

    transaction.on_commit(_enqueue)


@receiver(post_save, sender='core_app.MoodEntry')
def on_mood_entry_credit(sender, instance, created, **kwargs):
    if created:
        _enqueue_credit_event('checkin', instance.pk)


@receiver(post_save, sender='core_app.WaterGlassLog')
def on_water_glass_credit(sender, instance, created, **kwargs):
    if created:
        _enqueue_credit_event('water_glass', instance.pk)


@receiver(post_save, sender='core_app.MealEntry')
def on_meal_entry_credit(sender, instance, **kwargs):
    if instance.status == 'completed' and instance.photo:
        _enqueue_credit_event('meal_photo', instance.pk)


@receiver(post_save, sender='core_app.PhysicalTest')
def on_physical_test_credit(sender, instance, **kwargs):
    if instance.result == 'passed':
        _enqueue_credit_event('physical_test', instance.pk)
```

- [ ] **Step 6: Run tests, commit**

Run: `pytest core_app/tests/services/test_credit_events.py -v`
Expected: 4 PASS

```bash
git add backend/core_app/signals.py backend/core_app/tasks.py backend/core_app/services/credit_engine.py backend/core_app/tests/services/test_credit_events.py
git commit -m "feat(credits): wire Phase 1 signals to credit events via on_commit + Huey"
```

---

### Task 6: Day-close service + periodic task (streak, bonuses, no-shows, pending expiry)

**Files:**
- Create: `backend/core_app/services/credit_day_close.py`
- Modify: `backend/core_app/tasks.py` (append periodic task)
- Test: `backend/core_app/tests/services/test_credit_day_close.py`

**Interfaces:**
- Consumes: `credit_engine` (award, get_settings, get_wallet, confirm_transaction, record_attendance), `adherence_calculator.compute_training_adherence`, models `DailyLog`, `ExerciseLog`, `ProgramDay`, `NutritionDailyLog`, `MealEntry`, `Booking`, `ExerciseCapture`.
- Produces: `process_credits_day_close(today=None) -> dict` (summary counts) and Huey `@db_periodic_task(crontab(minute=57, hour=23)) close_credits_day()` delegating to it. Runs on `timezone.localdate()` — same UTC day semantics as `close_daily_logs`.

Behavior (from spec):
1. For each customer having a `DailyLog` for today: training adherence = `compute_training_adherence(exercise_logs, day_type, planned_count=len(exercise_logs))` where `day_type` comes from `ProgramDay.objects.filter(program=log.program, date=today).first()` (missing → `'rest'`); meals completed = count of today's `MealEntry(status='completed')` (no nutrition log → 0). Active = training ≥ `training_day_threshold` AND meals ≥ `nutrition_min_meals`.
2. Active → streak = streak+1 if `last_active_date == today - 1 day` else 1; update `longest_streak`, `last_active_date`; if `str(current_streak)` in `streak_bonuses` → `award(STREAK_BONUS, 'streak', f'{streak}:{start_date}')` where `start_date = today - (streak-1) days`, description `f'¡Racha de {streak} días! Bono de constancia'`. If `require_workout_captures` and training fulfilled and `ExerciseCapture.objects.filter(exercise_log__daily_log=log).exists()` → pending `WORKOUT_DAY` award (ref `daily_log`, deadline `meal_review_days`). Inactive → `current_streak = 0` (save).
3. Wallets whose customer has NO DailyLog today and `current_streak > 0` → reset to 0.
4. `Booking.objects.filter(starts_at__date=today, status='confirmed', attendance_status='unset')` → `credit_engine.record_attendance(booking, attended=False)`.
5. `CreditTransaction.objects.filter(status='pending', review_deadline__lte=now)` → `confirm_transaction` each.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_day_close.py
from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import (
    Booking, DailyLog, ExerciseLog, MealEntry, MonthlyProgram, NutritionDailyLog,
    Package, ProgramDay, ProgramExercise, Exercise,
)
from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine
from core_app.services.credit_day_close import process_credits_day_close


def _training_day(customer, today, completed=True):
    program = MonthlyProgram.objects.create(
        customer=customer, fitness_level=3, goal='fuerza',
        start_date=today - timedelta(days=5), end_date=today + timedelta(days=22),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    day = ProgramDay.objects.create(
        program=program, day_number=6, date=today, day_type=ProgramDay.DayType.TRAINING,
    )
    exercise = Exercise.objects.create(name='Sentadilla', youtube_url='https://youtu.be/x')
    pe = ProgramExercise.objects.create(program_day=day, exercise=exercise)
    log = DailyLog.objects.create(customer=customer, program=program, date=today, is_closed=True)
    ExerciseLog.objects.create(
        daily_log=log, program_exercise=pe,
        status=ExerciseLog.Status.COMPLETED if completed else ExerciseLog.Status.NOT_DONE,
    )
    return log


def _nutrition_day(customer, today, completed_meals=3):
    nlog = NutritionDailyLog.objects.create(customer=customer, date=today, is_closed=True)
    blocks = [b for b, _ in MealEntry.MealBlock.choices]
    for i, block in enumerate(blocks):
        MealEntry.objects.create(
            daily_log=nlog, meal_block=block,
            status=MealEntry.Status.COMPLETED if i < completed_meals else MealEntry.Status.NOT_DONE,
        )
    return nlog


@pytest.mark.django_db
def test_active_day_increments_streak_and_milestone_bonus(existing_user):
    today = timezone.localdate()
    wallet = credit_engine.get_wallet(existing_user)
    wallet.current_streak = 2
    wallet.last_active_date = today - timedelta(days=1)
    wallet.save()

    _training_day(existing_user, today, completed=True)
    _nutrition_day(existing_user, today, completed_meals=3)
    process_credits_day_close(today=today)

    wallet.refresh_from_db()
    assert wallet.current_streak == 3
    bonus = CreditTransaction.objects.get(action=CreditTransaction.Action.STREAK_BONUS)
    assert bonus.amount == 20  # medium preset, 3-day milestone


@pytest.mark.django_db
def test_inactive_day_resets_streak(existing_user):
    today = timezone.localdate()
    wallet = credit_engine.get_wallet(existing_user)
    wallet.current_streak = 5
    wallet.last_active_date = today - timedelta(days=1)
    wallet.save()

    _training_day(existing_user, today, completed=False)
    _nutrition_day(existing_user, today, completed_meals=1)
    process_credits_day_close(today=today)

    wallet.refresh_from_db()
    assert wallet.current_streak == 0


@pytest.mark.django_db
def test_unconfirmed_booking_marked_no_show_with_penalty(existing_user):
    package = Package.objects.create(name='P', price=100, sessions_per_month=4, validity_days=30)
    start = timezone.now() - timedelta(hours=3)
    booking = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=start, ends_at=start + timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )
    # Evaluate the day the booking belongs to (avoids flakiness near UTC midnight)
    process_credits_day_close(today=start.date())
    booking.refresh_from_db()
    assert booking.attendance_status == Booking.AttendanceStatus.NO_SHOW
    assert credit_engine.get_wallet(existing_user).balance == -40


@pytest.mark.django_db
def test_expired_pending_transactions_autoconfirm(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 9,
        'Registraste tu cena', status=CreditTransaction.Status.PENDING,
        review_deadline=timezone.now() - timedelta(hours=1),
    )
    process_credits_day_close(today=timezone.localdate())
    tx.refresh_from_db()
    assert tx.status == CreditTransaction.Status.CONFIRMED
    assert credit_engine.get_wallet(existing_user).balance == 5
```

Note: if `MonthlyProgram`/`Exercise` require extra fields, mirror the factory helpers used in `core_app/tests/services/test_progress_service.py`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/services/test_credit_day_close.py -v`
Expected: FAIL with `No module named 'core_app.services.credit_day_close'`

- [ ] **Step 3: Write the service**

```python
# backend/core_app/services/credit_day_close.py
"""End-of-day credit evaluation: streaks, bonuses, no-shows, pending expiry.

Runs right after close_daily_logs (23:55 UTC) so DailyLog/NutritionDailyLog
rows for the day are complete. Same UTC day semantics as the rest of the
daily-log system.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from core_app.models import Booking, DailyLog, MealEntry, ProgramDay
from core_app.models.credit import CreditTransaction, CreditWallet
from core_app.models.monthly_program import ExerciseCapture
from core_app.services import credit_engine
from core_app.services.adherence_calculator import compute_training_adherence

logger = logging.getLogger(__name__)


def _evaluate_customer_day(log: DailyLog, today, settings_obj) -> None:
    customer = log.customer
    exercise_logs = list(log.exercise_logs.all())
    program_day = ProgramDay.objects.filter(program=log.program, date=today).first()
    day_type = program_day.day_type if program_day else 'rest'
    training = compute_training_adherence(
        exercise_logs, day_type, planned_count=len(exercise_logs),
    )
    meals_completed = MealEntry.objects.filter(
        daily_log__customer=customer,
        daily_log__date=today,
        status=MealEntry.Status.COMPLETED,
    ).count()

    training_ok = training >= settings_obj.training_day_threshold
    active = training_ok and meals_completed >= settings_obj.nutrition_min_meals

    wallet = credit_engine.get_wallet(customer)
    if active:
        if wallet.last_active_date == today - timedelta(days=1):
            wallet.current_streak += 1
        else:
            wallet.current_streak = 1
        wallet.longest_streak = max(wallet.longest_streak, wallet.current_streak)
        wallet.last_active_date = today
        wallet.save(update_fields=[
            'current_streak', 'longest_streak', 'last_active_date', 'updated_at',
        ])

        bonus = settings_obj.streak_bonuses.get(str(wallet.current_streak))
        if bonus:
            start = today - timedelta(days=wallet.current_streak - 1)
            credit_engine.award(
                customer, CreditTransaction.Action.STREAK_BONUS,
                'streak', f'{wallet.current_streak}:{start.isoformat()}',
                f'¡Racha de {wallet.current_streak} días! Bono de constancia',
                amount=int(bonus),
            )
    else:
        if wallet.current_streak:
            wallet.current_streak = 0
            wallet.save(update_fields=['current_streak', 'updated_at'])

    if (
        settings_obj.require_workout_captures
        and training_ok
        and day_type == 'training'
        and ExerciseCapture.objects.filter(exercise_log__daily_log=log).exists()
    ):
        deadline = timezone.now() + timedelta(days=settings_obj.meal_review_days)
        credit_engine.award(
            customer, CreditTransaction.Action.WORKOUT_DAY,
            'daily_log', log.pk,
            f'Completaste tu entrenamiento del {today.isoformat()}',
            status=CreditTransaction.Status.PENDING,
            review_deadline=deadline,
        )


def process_credits_day_close(today=None) -> dict:
    today = today or timezone.localdate()
    settings_obj = credit_engine.get_settings()

    evaluated = errors = 0
    logs = DailyLog.objects.filter(date=today).select_related('customer', 'program')
    seen_customer_ids = set()
    for log in logs:
        seen_customer_ids.add(log.customer_id)
        try:
            _evaluate_customer_day(log, today, settings_obj)
            evaluated += 1
        except Exception:
            logger.exception('credits day close: failed for customer %s', log.customer_id)
            errors += 1

    # Customers with an active streak but no log today lose the streak.
    stale = CreditWallet.objects.filter(current_streak__gt=0).exclude(
        customer_id__in=seen_customer_ids,
    )
    streaks_reset = stale.update(current_streak=0)

    no_shows = 0
    unconfirmed = Booking.objects.filter(
        starts_at__date=today,
        status=Booking.Status.CONFIRMED,
        attendance_status=Booking.AttendanceStatus.UNSET,
    ).select_related('customer')
    for booking in unconfirmed:
        try:
            credit_engine.record_attendance(booking, attended=False)
            no_shows += 1
        except Exception:
            logger.exception('credits day close: no-show failed for booking %s', booking.pk)
            errors += 1

    confirmed = 0
    expired = CreditTransaction.objects.filter(
        status=CreditTransaction.Status.PENDING,
        review_deadline__lte=timezone.now(),
    )
    for tx in expired:
        if credit_engine.confirm_transaction(tx):
            confirmed += 1

    summary = {
        'evaluated': evaluated,
        'streaks_reset': streaks_reset,
        'no_shows': no_shows,
        'pending_confirmed': confirmed,
        'errors': errors,
    }
    logger.info('process_credits_day_close: %s', summary)
    return summary
```

- [ ] **Step 4: Append the periodic task to `backend/core_app/tasks.py`**

```python
@db_periodic_task(crontab(minute=57, hour=23))
def close_credits_day():
    """At 23:57 daily (after close_daily_logs): evaluate streaks, no-shows and
    expired pending credit transactions."""
    from core_app.services.credit_day_close import process_credits_day_close
    return process_credits_day_close()
```

- [ ] **Step 5: Run tests, commit**

Run: `pytest core_app/tests/services/test_credit_day_close.py -v`
Expected: 4 PASS

```bash
git add backend/core_app/services/credit_day_close.py backend/core_app/tasks.py backend/core_app/tests/services/test_credit_day_close.py
git commit -m "feat(credits): day-close task with streaks, milestone bonuses and no-show penalties"
```

---

### Task 7: `confirm-attendance` action on `BookingViewSet` + reschedule hook

**Files:**
- Modify: `backend/core_app/views/booking_views.py`
- Test: `backend/core_app/tests/views/test_booking_attendance.py`

**Interfaces:**
- Consumes: `credit_engine.record_attendance`, `credit_engine.on_reschedule` (Task 4).
- Produces: `POST /api/bookings/{id}/confirm-attendance/` body `{"attended": true|false}` — trainer-owner or admin; booking must not be canceled and must have started. Reschedule action now emits the late penalty.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_booking_attendance.py
from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def past_booking(existing_user, trainer_user):
    package = Package.objects.create(name='P', price=100, sessions_per_month=4, validity_days=30)
    now = timezone.now()
    return Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=now - timedelta(hours=2), ends_at=now - timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_trainer_confirms_attendance(api_client, trainer_user, past_booking, existing_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 200
    past_booking.refresh_from_db()
    assert past_booking.attendance_status == Booking.AttendanceStatus.ATTENDED
    assert credit_engine.get_wallet(existing_user).balance == 50


@pytest.mark.django_db
def test_customer_cannot_confirm_attendance(api_client, existing_user, past_booking):
    api_client.force_authenticate(existing_user)
    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_cannot_confirm_future_booking(api_client, trainer_user, existing_user):
    package = Package.objects.create(name='P2', price=100, sessions_per_month=4, validity_days=30)
    now = timezone.now()
    future = Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=now + timedelta(days=1), ends_at=now + timedelta(days=1, hours=1),
        status=Booking.Status.CONFIRMED,
    )
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(
        f'/api/bookings/{future.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 400
```

Note: if `TrainerProfile` auto-creates via signal or requires fields, mirror the trainer fixture in `core_app/tests/views/test_booking_views_trainer.py`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/views/test_booking_attendance.py -v`
Expected: FAIL — 404 on the unrouted action

- [ ] **Step 3: Add the action to `BookingViewSet`** (after `session_prep`, reusing its owner check)

```python
    @action(detail=True, methods=['post'], url_path='confirm-attendance', permission_classes=[IsTrainerRole])
    def confirm_attendance(self, request, pk=None):
        """Trainer marks whether the customer attended a session that already started.

        Body: ``{"attended": true|false}``. Emits credit awards/penalties via the
        credit engine (late confirmation reverses a prior no-show penalty).
        """
        try:
            booking = Booking.objects.select_related('trainer', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Sesión no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not is_admin_user(request.user):
            if not trainer_profile or (booking.trainer_id and booking.trainer_id != trainer_profile.pk):
                return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status == Booking.Status.CANCELED:
            return Response(
                {'detail': 'No se puede confirmar asistencia de una sesión cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.starts_at > timezone.now():
            return Response(
                {'detail': 'La sesión aún no ha iniciado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attended = request.data.get('attended')
        if not isinstance(attended, bool):
            return Response(
                {'detail': 'El campo attended (true/false) es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from core_app.services import credit_engine
        credit_engine.record_attendance(booking, attended=attended)
        serializer = self.get_serializer(booking)
        return Response(serializer.data)
```

Also add the reschedule hook — in the `reschedule` action, immediately after `send_booking_reschedule(booking, new_booking)`:

```python
        from core_app.services import credit_engine
        credit_engine.on_reschedule(booking, new_booking, acting_user=request.user)
```

- [ ] **Step 4: Run tests, then the existing booking regression slice**

Run: `pytest core_app/tests/views/test_booking_attendance.py core_app/tests/views/test_booking_views.py -v`
Expected: new tests PASS; existing booking tests still PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/booking_views.py backend/core_app/tests/views/test_booking_attendance.py
git commit -m "feat(credits): trainer confirm-attendance action + late-reschedule penalty hook"
```

---

### Task 8: Customer API — wallet + transaction history

**Files:**
- Create: `backend/core_app/serializers/credit_serializers.py`
- Create: `backend/core_app/views/credit_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_credit_views.py`

**Interfaces:**
- Consumes: `credit_engine.get_wallet`, `get_settings`, models.
- Produces:
  - `GET /api/credits/wallet/` → `{balance, pending_balance, current_streak, longest_streak, last_active_date, next_milestone: {days, bonus, remaining} | null}`
  - `GET /api/credits/transactions/?limit=&offset=` → `{count, results: [{id, action, amount, status, description, created_at}]}`

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_credit_views.py
import pytest
from django.utils import timezone

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_wallet_endpoint_returns_state_and_next_milestone(api_client, existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 1, 'Check-in')
    credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1, 'Almuerzo',
        status=CreditTransaction.Status.PENDING,
        review_deadline=timezone.now(),
    )
    wallet = credit_engine.get_wallet(existing_user)
    wallet.current_streak = 5
    wallet.save(update_fields=['current_streak'])

    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/wallet/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['balance'] == 5
    assert data['pending_balance'] == 5
    assert data['current_streak'] == 5
    assert data['next_milestone'] == {'days': 7, 'bonus': 50, 'remaining': 2}


@pytest.mark.django_db
def test_transactions_endpoint_paginates_newest_first(api_client, existing_user):
    for i in range(3):
        credit_engine.award(
            existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', i, f'Check-in {i}',
        )
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/transactions/?limit=2')
    assert resp.status_code == 200
    data = resp.json()
    assert data['count'] == 3
    assert len(data['results']) == 2
    assert data['results'][0]['description'] == 'Check-in 2'


@pytest.mark.django_db
def test_wallet_requires_auth(api_client):
    assert api_client.get('/api/credits/wallet/').status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/views/test_credit_views.py -v`
Expected: FAIL — 404 (routes missing)

- [ ] **Step 3: Write serializers, views, routes**

```python
# backend/core_app/serializers/credit_serializers.py
from rest_framework import serializers

from core_app.models.credit import CreditSettings, CreditTransaction


class CreditTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditTransaction
        fields = (
            'id', 'action', 'amount', 'status', 'description',
            'reference_type', 'reference_id', 'review_deadline', 'created_at',
        )


class CreditSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditSettings
        fields = (
            'difficulty', 'action_values', 'streak_bonuses',
            'training_day_threshold', 'nutrition_min_meals', 'water_goal_glasses',
            'meal_review_days', 'reschedule_window_hours', 'require_workout_captures',
        )
```

```python
# backend/core_app/views/credit_views.py
"""Credit economy API: customer wallet/history + trainer review/settings."""
from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.credit import CreditTransaction
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.serializers.credit_serializers import (
    CreditSettingsSerializer,
    CreditTransactionSerializer,
)
from core_app.services import credit_engine


class CreditWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = credit_engine.get_wallet(request.user)
        settings_obj = credit_engine.get_settings()
        pending = (
            CreditTransaction.objects.filter(
                customer=request.user,
                status=CreditTransaction.Status.PENDING,
            ).aggregate(total=Sum('amount'))['total'] or 0
        )
        next_milestone = None
        milestones = sorted(int(d) for d in settings_obj.streak_bonuses.keys())
        for days in milestones:
            if days > wallet.current_streak:
                next_milestone = {
                    'days': days,
                    'bonus': int(settings_obj.streak_bonuses[str(days)]),
                    'remaining': days - wallet.current_streak,
                }
                break
        return Response({
            'balance': wallet.balance,
            'pending_balance': pending,
            'current_streak': wallet.current_streak,
            'longest_streak': wallet.longest_streak,
            'last_active_date': wallet.last_active_date,
            'next_milestone': next_milestone,
        })


class CreditTransactionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = CreditTransaction.objects.filter(customer=request.user)
        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
            offset = int(request.query_params.get('offset', 0))
        except ValueError:
            return Response({'detail': 'limit/offset inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        page = qs[offset:offset + limit]
        return Response({
            'count': qs.count(),
            'results': CreditTransactionSerializer(page, many=True).data,
        })
```

Add to `backend/core_app/urls/api_urls.py` (imports + paths):

```python
from core_app.views.credit_views import (
    CreditTransactionListView,
    CreditWalletView,
)
```

```python
    # Credits (Phase 2)
    path('credits/wallet/', CreditWalletView.as_view(), name='credits-wallet'),
    path('credits/transactions/', CreditTransactionListView.as_view(), name='credits-transactions'),
```

- [ ] **Step 4: Run tests, commit**

Run: `pytest core_app/tests/views/test_credit_views.py -v`
Expected: 3 PASS

```bash
git add backend/core_app/serializers/credit_serializers.py backend/core_app/views/credit_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_credit_views.py
git commit -m "feat(credits): customer wallet and transaction history endpoints"
```

---

### Task 9: Trainer API — pending reviews, review action, settings

**Files:**
- Modify: `backend/core_app/views/credit_views.py` (append 3 views)
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_credit_trainer_views.py`

**Interfaces:**
- Consumes: `credit_engine.confirm_transaction/reject_transaction/get_settings`; `User.assigned_trainer` (customers are assigned to a trainer profile — filter `customer__assigned_trainer=trainer_profile`).
- Produces:
  - `GET /api/trainer/credits/pending-reviews/` → pending transactions of the trainer's clients (admin: all), each with `customer_email`, `customer_name` and `photo_url` when the reference is a `meal_entry`.
  - `POST /api/trainer/credits/transactions/<int:tx_id>/review/` `{"decision": "approve"|"reject", "note": "..."}`.
  - `GET/PUT /api/credits/settings/` (trainer or admin) — `PUT` with `difficulty` change and empty `action_values` reseeds from preset.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_credit_trainer_views.py
import pytest
from django.utils import timezone

from core_app.models import TrainerProfile, User
from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def assigned_customer(existing_user, trainer_user):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user
    # If assigned_trainer lives elsewhere, check core_app/views/trainer_client_views.py:39.


@pytest.mark.django_db
def test_pending_reviews_lists_only_own_clients(api_client, trainer_user, assigned_customer):
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1,
        'Registraste tu almuerzo', status=CreditTransaction.Status.PENDING,
        review_deadline=timezone.now(),
    )
    other = User.objects.create_user(email='o@example.com', password='x', role=User.Role.CUSTOMER)
    credit_engine.award(
        other, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 2,
        'Cena', status=CreditTransaction.Status.PENDING, review_deadline=timezone.now(),
    )
    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')
    assert resp.status_code == 200
    results = resp.json()['results']
    assert len(results) == 1
    assert results[0]['customer_email'] == assigned_customer.email


@pytest.mark.django_db
def test_review_approve_and_reject(api_client, trainer_user, assigned_customer):
    tx1 = credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 3,
        'Almuerzo', status=CreditTransaction.Status.PENDING, review_deadline=timezone.now(),
    )
    tx2 = credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 4,
        'Cena', status=CreditTransaction.Status.PENDING, review_deadline=timezone.now(),
    )
    api_client.force_authenticate(trainer_user)
    assert api_client.post(
        f'/api/trainer/credits/transactions/{tx1.pk}/review/',
        {'decision': 'approve'}, format='json',
    ).status_code == 200
    assert api_client.post(
        f'/api/trainer/credits/transactions/{tx2.pk}/review/',
        {'decision': 'reject', 'note': 'Foto borrosa'}, format='json',
    ).status_code == 200
    assert credit_engine.get_wallet(assigned_customer).balance == 5


@pytest.mark.django_db
def test_settings_put_reseeds_on_difficulty_change(api_client, trainer_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.put(
        '/api/credits/settings/',
        {'difficulty': 'hard', 'action_values': {}, 'streak_bonuses': {}},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.json()['action_values']['session_attended'] == 40
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/views/test_credit_trainer_views.py -v`
Expected: FAIL — 404 (routes missing)

- [ ] **Step 3: Append views**

```python
# append to backend/core_app/views/credit_views.py
from core_app.models import MealEntry
from core_app.models.credit import CreditSettings
from core_app.services.credit_engine import DIFFICULTY_PRESETS


def _scope_to_trainer_clients(qs, request):
    if is_admin_user(request.user):
        return qs
    trainer_profile = getattr(request.user, 'trainer_profile', None)
    return qs.filter(customer__assigned_trainer=trainer_profile)


class TrainerPendingReviewsView(APIView):
    permission_classes = [IsTrainerRole]

    def get(self, request):
        qs = _scope_to_trainer_clients(
            CreditTransaction.objects.filter(
                status=CreditTransaction.Status.PENDING,
            ).select_related('customer'),
            request,
        )
        results = []
        meal_ids = [
            int(t.reference_id) for t in qs
            if t.reference_type == 'meal_entry' and t.reference_id
        ]
        photos = {
            str(m.pk): (m.photo.url if m.photo else None)
            for m in MealEntry.objects.filter(pk__in=meal_ids)
        }
        for tx in qs:
            row = CreditTransactionSerializer(tx).data
            row['customer_email'] = tx.customer.email
            row['customer_name'] = f'{tx.customer.first_name} {tx.customer.last_name}'.strip()
            row['photo_url'] = photos.get(tx.reference_id)
            results.append(row)
        return Response({'count': len(results), 'results': results})


class TrainerReviewTransactionView(APIView):
    permission_classes = [IsTrainerRole]

    def post(self, request, tx_id):
        qs = _scope_to_trainer_clients(
            CreditTransaction.objects.filter(pk=tx_id), request,
        )
        tx = qs.first()
        if tx is None:
            return Response({'detail': 'Transacción no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        decision = request.data.get('decision')
        if decision == 'approve':
            ok = credit_engine.confirm_transaction(tx)
        elif decision == 'reject':
            ok = credit_engine.reject_transaction(tx, request.user, request.data.get('note', ''))
        else:
            return Response(
                {'detail': 'decision debe ser approve o reject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ok:
            return Response(
                {'detail': 'La transacción ya fue revisada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tx.refresh_from_db()
        return Response(CreditTransactionSerializer(tx).data)


class CreditSettingsView(APIView):
    permission_classes = [IsTrainerRole]

    def get(self, request):
        return Response(CreditSettingsSerializer(credit_engine.get_settings()).data)

    def put(self, request):
        settings_obj = credit_engine.get_settings()
        serializer = CreditSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        # Difficulty change with cleared maps reseeds from the preset
        if not obj.action_values or not obj.streak_bonuses:
            preset = DIFFICULTY_PRESETS[obj.difficulty]
            if not obj.action_values:
                obj.action_values = dict(preset['actions'])
            if not obj.streak_bonuses:
                obj.streak_bonuses = dict(preset['streak_bonuses'])
            obj.save(update_fields=['action_values', 'streak_bonuses', 'updated_at'])
        return Response(CreditSettingsSerializer(obj).data)
```

Routes in `api_urls.py` (extend the credits import + paths):

```python
from core_app.views.credit_views import (
    CreditSettingsView,
    CreditTransactionListView,
    CreditWalletView,
    TrainerPendingReviewsView,
    TrainerReviewTransactionView,
)
```

```python
    path('credits/settings/', CreditSettingsView.as_view(), name='credits-settings'),
    path('trainer/credits/pending-reviews/', TrainerPendingReviewsView.as_view(), name='trainer-credits-pending-reviews'),
    path('trainer/credits/transactions/<int:tx_id>/review/', TrainerReviewTransactionView.as_view(), name='trainer-credits-review'),
```

- [ ] **Step 4: Run tests, commit**

Run: `pytest core_app/tests/views/test_credit_trainer_views.py -v`
Expected: 3 PASS

```bash
git add backend/core_app/views/credit_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_credit_trainer_views.py
git commit -m "feat(credits): trainer pending-review, review action and settings endpoints"
```

---

### Task 10: `PhysicalTest` ViewSet + `ExerciseCapture` upload endpoint

**Files:**
- Create: `backend/core_app/views/physical_test_views.py`
- Modify: `backend/core_app/serializers/credit_serializers.py` (append `PhysicalTestSerializer`)
- Modify: `backend/core_app/views/monthly_program_views.py` (append `ExerciseCaptureUploadView`)
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_physical_test_views.py`

**Interfaces:**
- Produces:
  - Router `trainer/physical-tests` → `PhysicalTestViewSet` (`IsTrainerRole`; trainers see/create tests for their assigned clients, admin sees all; `perform_create` sets `trainer=request.user.trainer_profile`). Creating a `passed` test triggers the award via the Task 5 signal.
  - `POST /api/my-program/logs/<int:log_id>/exercises/<int:ex_log_id>/captures/` multipart `{image}` — owner-only, rejects closed logs, caps at 5 captures per exercise log.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_physical_test_views.py
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from core_app.models import TrainerProfile, User


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def assigned_customer(existing_user, trainer_user):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user


@pytest.mark.django_db
def test_trainer_records_physical_test(api_client, trainer_user, assigned_customer):
    api_client.force_authenticate(trainer_user)
    resp = api_client.post('/api/trainer/physical-tests/', {
        'customer': assigned_customer.pk,
        'performed_at': timezone.localdate().isoformat(),
        'result': 'passed',
        'notes': 'Buen progreso',
    }, format='json')
    assert resp.status_code == 201
    data = resp.json()
    assert data['trainer'] == trainer_user.trainer_profile.pk
    # The credit award fires via the post_save signal → on_commit → Huey chain,
    # which pytest's transaction wrapper suppresses; the award rule itself is
    # covered by test_credit_events.py::test_passed_physical_test_awards.


@pytest.mark.django_db
def test_customer_cannot_create_physical_test(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/trainer/physical-tests/', {
        'customer': existing_user.pk,
        'performed_at': timezone.localdate().isoformat(),
        'result': 'passed',
    }, format='json')
    assert resp.status_code == 403


def _png_upload(name='c.png'):
    # 1x1 transparent PNG
    png = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xff'
        b'\xff?\x03\x00\x08\xfc\x02\xfe\xa7\x9a\xa0\xa0\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    return SimpleUploadedFile(name, png, content_type='image/png')


@pytest.mark.django_db
def test_capture_upload_rejects_closed_log(api_client, existing_user):
    from datetime import timedelta
    from core_app.models import (
        DailyLog, Exercise, ExerciseLog, MonthlyProgram, ProgramDay, ProgramExercise,
    )
    today = timezone.localdate()
    program = MonthlyProgram.objects.create(
        customer=existing_user, fitness_level=3, goal='fuerza',
        start_date=today - timedelta(days=1), end_date=today + timedelta(days=26),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    day = ProgramDay.objects.create(program=program, day_number=2, date=today, day_type='training')
    ex = Exercise.objects.create(name='Plancha', youtube_url='https://youtu.be/y')
    pe = ProgramExercise.objects.create(program_day=day, exercise=ex)
    log = DailyLog.objects.create(customer=existing_user, program=program, date=today, is_closed=True)
    ex_log = ExerciseLog.objects.create(daily_log=log, program_exercise=pe)

    api_client.force_authenticate(existing_user)
    resp = api_client.post(
        f'/api/my-program/logs/{log.pk}/exercises/{ex_log.pk}/captures/',
        {'image': _png_upload()}, format='multipart',
    )
    assert resp.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/views/test_physical_test_views.py -v`
Expected: FAIL — 404 (routes missing)

- [ ] **Step 3: Implement**

Append to `credit_serializers.py`:

```python
from core_app.models.physical_test import PhysicalTest


class PhysicalTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhysicalTest
        fields = ('id', 'customer', 'trainer', 'performed_at', 'result', 'notes', 'created_at')
        read_only_fields = ('trainer',)
```

```python
# backend/core_app/views/physical_test_views.py
"""Trainer-administered biweekly physical tests (credit source)."""
from rest_framework import viewsets

from core_app.models.physical_test import PhysicalTest
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.serializers.credit_serializers import PhysicalTestSerializer


class PhysicalTestViewSet(viewsets.ModelViewSet):
    serializer_class = PhysicalTestSerializer
    permission_classes = [IsTrainerRole]

    def get_queryset(self):
        qs = PhysicalTest.objects.select_related('customer', 'trainer')
        if is_admin_user(self.request.user):
            return qs
        trainer_profile = getattr(self.request.user, 'trainer_profile', None)
        return qs.filter(customer__assigned_trainer=trainer_profile)

    def perform_create(self, serializer):
        serializer.save(trainer=getattr(self.request.user, 'trainer_profile', None))
```

Append to `monthly_program_views.py`:

```python
class ExerciseCaptureUploadView(APIView):
    """Deferred-upload endpoint for workout evidence captures.

    The client-facing flow presents this as video validation; the app uploads
    a few random photos per exercise while the exercise is active.
    """
    permission_classes = [IsAuthenticated]

    MAX_CAPTURES_PER_EXERCISE = 5

    def post(self, request, log_id, ex_log_id):
        from core_app.models.monthly_program import DailyLog, ExerciseCapture, ExerciseLog

        try:
            ex_log = ExerciseLog.objects.select_related('daily_log').get(
                pk=ex_log_id, daily_log_id=log_id, daily_log__customer=request.user,
            )
        except ExerciseLog.DoesNotExist:
            return Response({'detail': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if ex_log.daily_log.is_closed:
            return Response(
                {'detail': 'El día ya está cerrado; no se pueden subir capturas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        image = request.FILES.get('image')
        if image is None:
            return Response({'detail': 'El campo image es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if ex_log.captures.count() >= self.MAX_CAPTURES_PER_EXERCISE:
            return Response(
                {'detail': 'Límite de capturas alcanzado para este ejercicio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        capture = ExerciseCapture.objects.create(exercise_log=ex_log, image=image)
        return Response({'id': capture.pk}, status=status.HTTP_201_CREATED)
```

Check the imports at the top of `monthly_program_views.py` — `APIView`, `Response`, `status`, `IsAuthenticated` are already imported there (used by the existing views); add any that are missing.

Routes in `api_urls.py`:

```python
from core_app.views.physical_test_views import PhysicalTestViewSet
from core_app.views.monthly_program_views import ExerciseCaptureUploadView  # add to existing import block
```

```python
router.register('trainer/physical-tests', PhysicalTestViewSet, basename='physical-test')
```

```python
    path('my-program/logs/<int:log_id>/exercises/<int:ex_log_id>/captures/', ExerciseCaptureUploadView.as_view(), name='my-program-exercise-captures'),
```

- [ ] **Step 4: Run tests, commit**

Run: `pytest core_app/tests/views/test_physical_test_views.py -v`
Expected: 3 PASS

```bash
git add backend/core_app/views/physical_test_views.py backend/core_app/views/monthly_program_views.py backend/core_app/serializers/credit_serializers.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_physical_test_views.py
git commit -m "feat(credits): physical test CRUD and workout capture upload endpoints"
```

---

### Task 11: `reconcile_credit_wallets` management command

**Files:**
- Create: `backend/core_app/management/commands/reconcile_credit_wallets.py`
- Test: `backend/core_app/tests/commands/test_reconcile_credit_wallets.py`

**Interfaces:**
- Produces: `python manage.py reconcile_credit_wallets [--fix]` — reports wallets whose `balance` differs from the sum of confirmed ledger amounts; `--fix` repairs them.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/commands/test_reconcile_credit_wallets.py
import pytest
from django.core.management import call_command

from core_app.models.credit import CreditTransaction, CreditWallet
from core_app.services import credit_engine


@pytest.mark.django_db
def test_reconcile_detects_and_fixes_drift(existing_user, capsys):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 1, 'x')
    CreditWallet.objects.filter(customer=existing_user).update(balance=999)

    call_command('reconcile_credit_wallets')
    assert 'drift' in capsys.readouterr().out

    call_command('reconcile_credit_wallets', '--fix')
    wallet = CreditWallet.objects.get(customer=existing_user)
    assert wallet.balance == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/commands/test_reconcile_credit_wallets.py -v`
Expected: FAIL with `Unknown command: 'reconcile_credit_wallets'`

- [ ] **Step 3: Write the command**

```python
# backend/core_app/management/commands/reconcile_credit_wallets.py
"""Recompute wallet balances from the confirmed ledger and report/repair drift."""
from django.core.management.base import BaseCommand
from django.db.models import Sum

from core_app.models.credit import CreditTransaction, CreditWallet


class Command(BaseCommand):
    help = 'Report (and optionally fix) CreditWallet balances that drifted from the ledger.'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Repair drifted balances.')

    def handle(self, *args, **options):
        drifted = 0
        for wallet in CreditWallet.objects.select_related('customer'):
            expected = (
                CreditTransaction.objects.filter(
                    customer=wallet.customer,
                    status=CreditTransaction.Status.CONFIRMED,
                ).aggregate(total=Sum('amount'))['total'] or 0
            )
            if wallet.balance != expected:
                drifted += 1
                self.stdout.write(
                    f'drift: {wallet.customer} balance={wallet.balance} expected={expected}'
                )
                if options['fix']:
                    wallet.balance = expected
                    wallet.save(update_fields=['balance', 'updated_at'])
        self.stdout.write(f'checked={CreditWallet.objects.count()} drifted={drifted} fixed={drifted if options["fix"] else 0}')
```

- [ ] **Step 4: Run test, commit**

Run: `pytest core_app/tests/commands/test_reconcile_credit_wallets.py -v`
Expected: 1 PASS

```bash
git add backend/core_app/management/commands/reconcile_credit_wallets.py backend/core_app/tests/commands/test_reconcile_credit_wallets.py
git commit -m "feat(credits): reconcile_credit_wallets management command"
```

---

### Task 12: Wrap-up — Django check, push, PR

- [ ] **Step 1: Sanity checks**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`

Run: `python manage.py makemigrations core_app --check --dry-run`
Expected: `No changes detected` (all schema changes already migrated)

- [ ] **Step 2: Push and report**

```bash
git push -u origin feat/01072026-phase2-credits-engine-core
```

CI runs the full test suite. Report the PR URL (`https://github.com/carlos18bp/kore_project/pull/new/feat/01072026-phase2-credits-engine-core` or the existing PR) — base branch **july-release**.

Out of scope reminders for the PR description: trainer mini-UI (attendance button + physical test form) comes in a follow-up plan; client camera capture flow ships with Parts 2/3 (`require_workout_captures` stays `false` until then).
