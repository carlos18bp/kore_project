"""Credit economy engine.

Award/penalty orchestration over the append-only CreditTransaction ledger.
Pure rule helpers stay ORM-free; orchestrators do the DB work. Callers on
user-request paths must treat failures as non-fatal (handlers swallow + log).
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

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


def spend(customer, amount, reference_type, reference_id, description) -> CreditTransaction | None:
    """Debit confirmed credits for a redemption. Atomic; never goes below 0.

    Returns None on non-positive amount, insufficient funds, or duplicate reference.
    """
    if amount <= 0:
        return None
    ref_id = str(reference_id) if reference_id is not None else None
    with transaction.atomic():
        wallet = CreditWallet.objects.select_for_update().get_or_create(customer=customer)[0]
        if wallet.balance < amount:
            return None
        tx, created = CreditTransaction.objects.get_or_create(
            customer=customer,
            action=CreditTransaction.Action.REDEMPTION,
            reference_type=reference_type,
            reference_id=ref_id,
            defaults={'amount': -amount, 'status': CreditTransaction.Status.CONFIRMED, 'description': description},
        )
        if not created:
            return None
        CreditWallet.objects.filter(customer=customer).update(balance=F('balance') - amount)
    return tx
