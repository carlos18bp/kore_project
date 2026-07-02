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
