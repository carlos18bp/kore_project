"""Tests for progress_service weekly/projection/monthly summary orchestration."""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from core_app.models import (
    AnthropometryEvaluation,
    NutritionDailyLog,
    PhysicalEvaluation,
    User,
)
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
    ProgramExercise,
)
from core_app.models.nutrition_daily_log import MealEntry
from core_app.models.weight_entry import WeightEntry
from core_app.services import progress_service

PROGRAM_START = date(2026, 4, 6)  # a Monday


def _customer(email='progress-cust@test.com'):
    return User.objects.create_user(
        email=email, password='pass', first_name='P', last_name='C', role=User.Role.CUSTOMER,
    )


def _exercise(name='Push-up'):
    from core_app.models.exercise import Exercise

    return Exercise.objects.create(
        name=name, pattern='Empuje', fitness_level_min=1,
        goal_tags=['general_health'], is_active=True, youtube_url='https://x/y',
    )


def _published_program(customer, start=PROGRAM_START, training_days=7):
    """Create a PUBLISHED 28-day program; first `training_days` days are training."""
    program = MonthlyProgram.objects.create(
        customer=customer, fitness_level=1, goal='general_health',
        start_date=start, end_date=start + timedelta(days=27),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    ex = _exercise()
    for day_num in range(1, 29):
        is_training = day_num <= training_days
        pd = ProgramDay.objects.create(
            program=program, day_number=day_num,
            date=start + timedelta(days=day_num - 1),
            day_type=ProgramDay.DayType.TRAINING if is_training else ProgramDay.DayType.REST,
        )
        if is_training:
            ProgramExercise.objects.create(program_day=pd, exercise=ex, sets=3, reps=10, order=0)
    return program


def _log_full_compliance_day(customer, program, program_day):
    """Log all planned exercises completed + 5 meals completed for one day."""
    dl = DailyLog.objects.create(customer=customer, program=program, date=program_day.date)
    for pe in program_day.exercises.all():
        ExerciseLog.objects.create(daily_log=dl, program_exercise=pe, status=ExerciseLog.Status.COMPLETED)
    nl = NutritionDailyLog.objects.create(customer=customer, date=program_day.date)
    for block in MealEntry.MealBlock.values:
        MealEntry.objects.create(daily_log=nl, meal_block=block, status=MealEntry.Status.COMPLETED)


def _freeze_today(monkeypatch, today_value):
    class _FrozenDate(date):
        @classmethod
        def today(cls):
            return today_value

    monkeypatch.setattr(progress_service, 'date', _FrozenDate)


@pytest.mark.django_db
class TestGetWeeklySummary:
    def test_returns_none_when_no_published_program(self):
        customer = _customer()

        assert progress_service.get_weekly_summary(customer) is None

    def test_defaults_week_number_to_current_elapsed_week(self, monkeypatch):
        customer = _customer()
        _published_program(customer)
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=10))  # 2nd week

        result = progress_service.get_weekly_summary(customer)

        assert result['week_number'] == 2

    def test_week_average_ignores_future_days(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        first_day = program.days.get(day_number=1)
        _log_full_compliance_day(customer, program, first_day)
        _freeze_today(monkeypatch, PROGRAM_START)  # only day 1 has elapsed

        result = progress_service.get_weekly_summary(customer, week_number=1)

        assert result['week_average'] == 1.0

    def test_day_without_logs_has_zero_combined_adherence(self, monkeypatch):
        customer = _customer()
        _published_program(customer)
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=6))

        result = progress_service.get_weekly_summary(customer, week_number=1)
        day_one = result['days'][0]

        assert day_one['combined_adherence'] == 0.0

    def test_full_compliance_day_has_full_combined_adherence(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        first_day = program.days.get(day_number=1)
        _log_full_compliance_day(customer, program, first_day)
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=6))

        result = progress_service.get_weekly_summary(customer, week_number=1)
        day_one = result['days'][0]

        assert day_one['combined_adherence'] == 1.0

    def test_streak_reflects_consecutive_compliant_days(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        for day_num in (1, 2, 3):
            _log_full_compliance_day(customer, program, program.days.get(day_number=day_num))
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=2))

        result = progress_service.get_weekly_summary(customer, week_number=1)

        assert result['streak']['current'] == 3
        assert result['streak']['start_date'] == PROGRAM_START.isoformat()


@pytest.mark.django_db
class TestGetProjection:
    def test_returns_none_without_published_program(self):
        customer = _customer()

        assert progress_service.get_projection(customer) is None

    def test_reports_days_elapsed_and_remaining(self, monkeypatch):
        customer = _customer()
        _published_program(customer)
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=9))  # 10 program days passed

        result = progress_service.get_projection(customer)

        assert result['days_elapsed'] == 10
        assert result['days_remaining'] == 18
        assert result['trend'] in {'improving', 'stable', 'declining'}
        assert result['confidence'] in {'high', 'medium', 'low'}

    def test_weight_projection_present_when_weight_entries_exist(self, monkeypatch):
        customer = _customer()
        _published_program(customer)
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('80.0'), date=PROGRAM_START)
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('78.0'), date=PROGRAM_START + timedelta(days=7))
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=9))

        result = progress_service.get_projection(customer)

        assert result['weight_projection'] is not None

    def test_weight_projection_none_without_weight_entries(self, monkeypatch):
        customer = _customer()
        _published_program(customer)
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=9))

        result = progress_service.get_projection(customer)

        assert result['weight_projection'] is None


@pytest.mark.django_db
class TestGetMonthlySummary:
    def test_returns_none_when_no_program(self):
        customer = _customer()

        assert progress_service.get_monthly_summary(customer) is None

    def test_uses_explicit_program_id(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=40))  # whole program elapsed

        result = progress_service.get_monthly_summary(customer, program_id=program.pk)

        assert result['program_id'] == program.pk
        assert result['start_date'] == PROGRAM_START.isoformat()

    def test_bmi_comparison_uses_before_and_after_evaluations(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        before = AnthropometryEvaluation.objects.create(
            customer=customer, weight_kg=Decimal('80.0'), height_cm=Decimal('170.0'),
            evaluation_date=PROGRAM_START - timedelta(days=5),
        )
        AnthropometryEvaluation.objects.filter(pk=before.pk).update(bmi=Decimal('27.00'))
        after = AnthropometryEvaluation.objects.create(
            customer=customer, weight_kg=Decimal('76.0'), height_cm=Decimal('170.0'),
            evaluation_date=PROGRAM_START + timedelta(days=20),
        )
        AnthropometryEvaluation.objects.filter(pk=after.pk).update(bmi=Decimal('25.00'))
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=40))

        result = progress_service.get_monthly_summary(customer, program_id=program.pk)

        assert result['comparisons']['bmi']['delta'] == -2.0

    def test_physical_index_comparison_uses_before_and_after_evaluations(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        before = PhysicalEvaluation.objects.create(
            customer=customer, evaluation_date=PROGRAM_START - timedelta(days=5),
        )
        PhysicalEvaluation.objects.filter(pk=before.pk).update(general_index=Decimal('2.00'))
        after = PhysicalEvaluation.objects.create(
            customer=customer, evaluation_date=PROGRAM_START + timedelta(days=20),
        )
        PhysicalEvaluation.objects.filter(pk=after.pk).update(general_index=Decimal('3.00'))
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=40))

        result = progress_service.get_monthly_summary(customer, program_id=program.pk)

        assert result['comparisons']['physical_index']['delta'] == 1.0

    def test_weight_delta_uses_first_and_last_entry(self, monkeypatch):
        customer = _customer()
        program = _published_program(customer)
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('82.0'), date=PROGRAM_START)
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('79.5'), date=PROGRAM_START + timedelta(days=20))
        _freeze_today(monkeypatch, PROGRAM_START + timedelta(days=40))

        result = progress_service.get_monthly_summary(customer, program_id=program.pk)

        assert result['weight']['delta'] == -2.5
