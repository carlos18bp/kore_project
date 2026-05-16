"""Tests for the close_daily_logs Huey task (lines 356-467 in tasks.py)."""

from datetime import date, timedelta
from datetime import datetime
from datetime import timezone as dt_tz
from unittest.mock import patch

import pytest

from core_app.models import TrainerProfile, User
from core_app.models.exercise import Exercise
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
    ProgramExercise,
)
from core_app.tasks import close_daily_logs

TODAY = date(2026, 5, 10)
FIXED_NOW = datetime(2026, 5, 10, 23, 55, tzinfo=dt_tz.utc)


@pytest.fixture(autouse=True)
def freeze_time(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.localdate', lambda: TODAY)
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='cdl-customer@test.com', password='p',
        first_name='CDL', last_name='Customer', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer_user(db):
    u = User.objects.create_user(
        email='cdl-trainer@test.com', password='p',
        first_name='CDL', last_name='Trainer', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, specialty='General')


@pytest.fixture
def published_program(customer, trainer_user):
    return MonthlyProgram.objects.create(
        customer=customer,
        trainer=trainer_user,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=5),
        end_date=TODAY + timedelta(days=22),
        status=MonthlyProgram.Status.PUBLISHED,
    )


@pytest.fixture
def exercise_with_url(db):
    return Exercise.objects.create(
        name='Squat CDL', pattern='Sentadilla', fitness_level_min=1,
        goal_tags=['general_health'], is_active=True,
        youtube_url='https://yt.com/squat-cdl',
    )


@pytest.fixture
def exercise_no_url(db):
    return Exercise.objects.create(
        name='Plank CDL', pattern='Core', fitness_level_min=1,
        goal_tags=['general_health'], is_active=True,
        youtube_url='',
    )


@pytest.mark.django_db
def test_closes_open_daily_log_for_today(customer, published_program):
    """Open DailyLog from today is closed by the task."""
    log = DailyLog.objects.create(
        customer=customer,
        program=published_program,
        date=TODAY,
        is_closed=False,
    )

    result = close_daily_logs.call_local()

    log.refresh_from_db()
    assert log.is_closed is True
    assert log.closed_at == FIXED_NOW
    assert result['exercise_closed'] == 1


@pytest.mark.django_db
def test_creates_absent_log_for_customer_with_no_log_today(
    customer, published_program, exercise_with_url, exercise_no_url
):
    """Customer with active program but no DailyLog gets one created and closed."""
    program_day = ProgramDay.objects.create(
        program=published_program,
        day_number=6,
        date=TODAY,
        day_type=ProgramDay.DayType.TRAINING,
    )
    ProgramExercise.objects.create(
        program_day=program_day,
        exercise=exercise_with_url,
        sets=3, reps=10, order=0,
    )
    ProgramExercise.objects.create(
        program_day=program_day,
        exercise=exercise_no_url,
        sets=3, reps=10, order=1,
    )

    result = close_daily_logs.call_local()

    assert result['exercise_created_absent'] == 1
    new_log = DailyLog.objects.get(customer=customer, date=TODAY)
    assert new_log.is_closed is True

    # Only the exercise WITH a youtube_url gets an ExerciseLog
    exercise_logs = ExerciseLog.objects.filter(daily_log=new_log)
    assert exercise_logs.count() == 1
    assert exercise_logs.first().program_exercise.exercise.youtube_url != ''


@pytest.mark.django_db
def test_skips_program_day_for_paused_program(customer, db):
    """Program days under paused programs are not auto-closed."""
    program = MonthlyProgram.objects.create(
        customer=customer,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=5),
        end_date=TODAY + timedelta(days=22),
        status=MonthlyProgram.Status.PUBLISHED,
        is_paused=True,
    )
    ProgramDay.objects.create(
        program=program,
        day_number=6,
        date=TODAY,
        day_type=ProgramDay.DayType.TRAINING,
    )

    result = close_daily_logs.call_local()

    assert result['exercise_created_absent'] == 0
    assert DailyLog.objects.filter(customer=customer, date=TODAY).count() == 0


@pytest.mark.django_db
def test_noop_when_no_open_logs_and_no_program_days():
    """Returns zero counts when there is nothing to close."""
    result = close_daily_logs.call_local()

    assert result['exercise_closed'] == 0
    assert result['exercise_created_absent'] == 0


@pytest.mark.django_db
def test_exercise_log_not_created_for_exercise_without_youtube_url(
    customer, published_program, exercise_no_url
):
    """Exercises with empty youtube_url are excluded from auto-created ExerciseLogs."""
    program_day = ProgramDay.objects.create(
        program=published_program,
        day_number=6,
        date=TODAY,
        day_type=ProgramDay.DayType.TRAINING,
    )
    ProgramExercise.objects.create(
        program_day=program_day,
        exercise=exercise_no_url,
        sets=3, reps=10, order=0,
    )

    close_daily_logs.call_local()

    new_log = DailyLog.objects.get(customer=customer, date=TODAY)
    assert ExerciseLog.objects.filter(daily_log=new_log).count() == 0
