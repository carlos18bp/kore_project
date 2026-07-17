"""Tests for the Fase 1/Fase 2 day-close and on-demand Huey tasks.

Covers close_daily_logs, complete_finished_programs, compute_daily_alerts,
close_credits_day, process_credit_event and recompute_risk_score_task —
previously the only task-level coverage stopped at the reminder tasks.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from core_app.models import TrainerProfile, User
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
)
from core_app.models.nutrition_daily_log import MealEntry, NutritionDailyLog
from core_app.tasks import (
    close_credits_day,
    close_daily_logs,
    complete_finished_programs,
    compute_daily_alerts,
    process_credit_event,
    recompute_risk_score_task,
)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='dayclose-cust@kore.com', password='p',
        first_name='Dana', last_name='Close', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='dayclose-trainer@kore.com', password='p',
        first_name='Toni', last_name='Close', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user)


@pytest.fixture
def published_program(customer, trainer):
    today = timezone.localdate()
    return MonthlyProgram.objects.create(
        customer=customer, trainer=trainer, fitness_level=2,
        goal='general_health', start_date=today - timedelta(days=5),
        end_date=today + timedelta(days=25),
        status=MonthlyProgram.Status.PUBLISHED,
    )


@pytest.mark.django_db
class TestCloseDailyLogs:
    """close_daily_logs (23:55) — closes open logs and backfills absent customers."""

    @patch('core_app.services.meal_suggestion_service.get_daily_suggestions', return_value={})
    def test_closes_open_exercise_log(self, mock_suggestions, customer, published_program):
        """An open DailyLog for today ends the day closed with a timestamp."""
        log = DailyLog.objects.create(
            customer=customer, program=published_program,
            date=timezone.localdate(), is_closed=False,
        )

        result = close_daily_logs.call_local()

        log.refresh_from_db()
        assert log.is_closed is True
        assert log.closed_at is not None
        assert result['exercise_closed'] == 1

    @patch('core_app.services.meal_suggestion_service.get_daily_suggestions', return_value={})
    def test_backfills_closed_log_for_absent_customer(
        self, mock_suggestions, customer, published_program,
    ):
        """A published program day without any DailyLog gets a closed backfill log."""
        ProgramDay.objects.create(
            program=published_program, day_number=1,
            date=timezone.localdate(), day_type=ProgramDay.DayType.TRAINING,
        )

        result = close_daily_logs.call_local()

        backfilled = DailyLog.objects.get(customer=customer, date=timezone.localdate())
        assert backfilled.is_closed is True
        assert result['exercise_created_absent'] == 1
        assert ExerciseLog.objects.filter(daily_log=backfilled).count() == 0

    @patch('core_app.services.meal_suggestion_service.get_daily_suggestions', return_value={})
    def test_closes_open_nutrition_log(self, mock_suggestions, customer, published_program):
        """An open NutritionDailyLog for today is closed by the task."""
        nlog = NutritionDailyLog.objects.create(
            customer=customer, date=timezone.localdate(), is_closed=False,
        )

        result = close_daily_logs.call_local()

        nlog.refresh_from_db()
        assert nlog.is_closed is True
        assert result['nutrition_closed'] == 1

    @patch('core_app.services.meal_suggestion_service.get_daily_suggestions', return_value={})
    def test_backfills_nutrition_log_with_meal_entries(
        self, mock_suggestions, customer, published_program,
    ):
        """Active-program customers without a nutrition log get a closed one with NOT_DONE meals."""
        result = close_daily_logs.call_local()

        nlog = NutritionDailyLog.objects.get(customer=customer, date=timezone.localdate())
        assert nlog.is_closed is True
        assert result['nutrition_created_absent'] == 1
        entries = MealEntry.objects.filter(daily_log=nlog)
        assert entries.count() == len(MealEntry.MealBlock.choices)
        assert set(entries.values_list('status', flat=True)) == {MealEntry.Status.NOT_DONE}

    @patch('core_app.services.meal_suggestion_service.get_daily_suggestions', return_value={})
    def test_paused_program_is_not_backfilled(self, mock_suggestions, customer, published_program):
        """Paused programs are excluded from the absent-customer backfill."""
        published_program.is_paused = True
        published_program.save(update_fields=['is_paused'])
        ProgramDay.objects.create(
            program=published_program, day_number=1,
            date=timezone.localdate(), day_type=ProgramDay.DayType.TRAINING,
        )

        result = close_daily_logs.call_local()

        assert result['exercise_created_absent'] == 0
        assert DailyLog.objects.filter(customer=customer).count() == 0


@pytest.mark.django_db
class TestCompleteFinishedPrograms:
    """complete_finished_programs (00:00) — transitions ended published programs."""

    def test_marks_past_end_date_program_completed(self, customer, trainer):
        """A published program whose end_date already passed becomes completed."""
        today = timezone.localdate()
        program = MonthlyProgram.objects.create(
            customer=customer, trainer=trainer, fitness_level=2,
            goal='general_health', start_date=today - timedelta(days=40),
            end_date=today - timedelta(days=1),
            status=MonthlyProgram.Status.PUBLISHED,
        )

        result = complete_finished_programs.call_local()

        program.refresh_from_db()
        assert program.status == MonthlyProgram.Status.COMPLETED
        assert result['completed'] == 1

    def test_keeps_programs_ending_today_published(self, published_program):
        """A program still inside its window is left untouched."""
        result = complete_finished_programs.call_local()

        published_program.refresh_from_db()
        assert published_program.status == MonthlyProgram.Status.PUBLISHED
        assert result['completed'] == 0


@pytest.mark.django_db
class TestComputeDailyAlerts:
    """compute_daily_alerts (06:00) — recomputes risk scores per active program."""

    def test_recomputes_score_for_active_program(self, customer, published_program):
        """Each published program with a trainer triggers one risk recomputation."""
        with patch('core_app.services.risk_score_service.recompute_risk_score') as mock_recompute:
            result = compute_daily_alerts.call_local()

        mock_recompute.assert_called_once_with(customer, today=timezone.localdate())
        assert result == {'processed': 1, 'errors': 0}

    def test_skips_programs_without_trainer(self, customer, published_program):
        """Programs with no trainer are skipped without counting as errors."""
        published_program.trainer = None
        published_program.save(update_fields=['trainer'])

        with patch('core_app.services.risk_score_service.recompute_risk_score') as mock_recompute:
            result = compute_daily_alerts.call_local()

        mock_recompute.assert_not_called()
        assert result == {'processed': 0, 'errors': 0}

    def test_counts_errors_and_continues(self, customer, published_program):
        """A failing recomputation is logged as an error, not raised."""
        with patch(
            'core_app.services.risk_score_service.recompute_risk_score',
            side_effect=RuntimeError('boom'),
        ) as mock_recompute:
            result = compute_daily_alerts.call_local()

        mock_recompute.assert_called_once()
        assert result == {'processed': 0, 'errors': 1}


@pytest.mark.django_db
class TestOnDemandAndCreditTasks:
    """Thin wrappers delegating to already-tested services."""

    def test_close_credits_day_delegates_to_service(self):
        """close_credits_day returns the credit day-close service result."""
        with patch(
            'core_app.services.credit_day_close.process_credits_day_close',
            return_value={'penalties': 2},
        ) as mock_close:
            result = close_credits_day.call_local()

        mock_close.assert_called_once_with()
        assert result == {'penalties': 2}

    def test_process_credit_event_delegates_to_engine(self):
        """process_credit_event forwards kind and object id to the engine."""
        with patch('core_app.services.credit_engine.handle_event') as mock_handle:
            process_credit_event.call_local('daily_log_closed', 42)

        mock_handle.assert_called_once_with('daily_log_closed', 42)

    def test_recompute_risk_score_task_returns_service_result(self, customer):
        """The reactive task resolves the customer and returns the service verdict."""
        with patch(
            'core_app.services.risk_score_service.recompute_risk_score',
            return_value=True,
        ) as mock_recompute:
            result = recompute_risk_score_task.call_local(customer.pk)

        mock_recompute.assert_called_once_with(customer)
        assert result is True

    def test_recompute_risk_score_task_false_for_unknown_customer(self, db):
        """A missing customer id short-circuits to False without recomputing."""
        with patch('core_app.services.risk_score_service.recompute_risk_score') as mock_recompute:
            result = recompute_risk_score_task.call_local(999999)

        mock_recompute.assert_not_called()
        assert result is False
