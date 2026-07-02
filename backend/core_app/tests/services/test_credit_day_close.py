from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import (
    Booking, DailyLog, Exercise, ExerciseLog, MealEntry, MonthlyProgram,
    NutritionDailyLog, Package, ProgramDay, ProgramExercise,
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
    package = Package.objects.create(title='P')
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
