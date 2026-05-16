"""Tests for complete_finished_programs and compute_daily_alerts tasks."""

from datetime import date, timedelta
from unittest.mock import patch

import pytest

from core_app.models import TrainerProfile, User
from core_app.models.monthly_program import MonthlyProgram
from core_app.tasks import complete_finished_programs, compute_daily_alerts

TODAY = date(2026, 5, 10)


@pytest.fixture(autouse=True)
def freeze_localdate(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.localdate', lambda: TODAY)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='cfa-customer@test.com', password='p',
        first_name='CFA', last_name='Customer', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer_user(db):
    u = User.objects.create_user(
        email='cfa-trainer@test.com', password='p',
        first_name='CFA', last_name='Trainer', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, specialty='General')


# ---------------------------------------------------------------------------
# complete_finished_programs
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_complete_finished_programs_marks_past_published_as_completed(customer):
    """Published program with end_date in the past is transitioned to COMPLETED."""
    program = MonthlyProgram.objects.create(
        customer=customer,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=28),
        end_date=TODAY - timedelta(days=1),
        status=MonthlyProgram.Status.PUBLISHED,
    )

    result = complete_finished_programs.call_local()

    program.refresh_from_db()
    assert program.status == MonthlyProgram.Status.COMPLETED
    assert result['completed'] == 1


@pytest.mark.django_db
def test_complete_finished_programs_ignores_future_programs(customer):
    """Published program with end_date in the future is not changed."""
    program = MonthlyProgram.objects.create(
        customer=customer,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY,
        end_date=TODAY + timedelta(days=27),
        status=MonthlyProgram.Status.PUBLISHED,
    )

    result = complete_finished_programs.call_local()

    program.refresh_from_db()
    assert program.status == MonthlyProgram.Status.PUBLISHED
    assert result['completed'] == 0


@pytest.mark.django_db
def test_complete_finished_programs_ignores_draft_programs(customer):
    """Draft program with past end_date is not transitioned (only PUBLISHED ones are)."""
    program = MonthlyProgram.objects.create(
        customer=customer,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=28),
        end_date=TODAY - timedelta(days=1),
        status=MonthlyProgram.Status.DRAFT,
    )

    result = complete_finished_programs.call_local()

    program.refresh_from_db()
    assert program.status == MonthlyProgram.Status.DRAFT
    assert result['completed'] == 0


@pytest.mark.django_db
def test_complete_finished_programs_noop_when_no_programs():
    """Returns zero when there are no programs to complete."""
    result = complete_finished_programs.call_local()
    assert result == {'completed': 0}


# ---------------------------------------------------------------------------
# compute_daily_alerts
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@patch('core_app.services.risk_score_service.recompute_risk_score')
def test_compute_daily_alerts_calls_recompute_for_active_program_with_trainer(
    mock_recompute, customer, trainer_user
):
    """recompute_risk_score is called for each published program that has a trainer."""
    MonthlyProgram.objects.create(
        customer=customer,
        trainer=trainer_user,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=5),
        end_date=TODAY + timedelta(days=22),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    mock_recompute.return_value = True

    result = compute_daily_alerts.call_local()

    assert result['processed'] == 1
    assert result['errors'] == 0
    mock_recompute.assert_called_once_with(customer, today=TODAY)


@pytest.mark.django_db
def test_compute_daily_alerts_skips_program_without_trainer(customer):
    """Programs with trainer=None are skipped entirely."""
    MonthlyProgram.objects.create(
        customer=customer,
        trainer=None,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=5),
        end_date=TODAY + timedelta(days=22),
        status=MonthlyProgram.Status.PUBLISHED,
    )

    result = compute_daily_alerts.call_local()

    assert result['processed'] == 0
    assert result['errors'] == 0


@pytest.mark.django_db
@patch('core_app.services.risk_score_service.recompute_risk_score')
def test_compute_daily_alerts_handles_exception_without_crashing(
    mock_recompute, customer, trainer_user
):
    """Exception from recompute_risk_score is caught; task continues and increments errors."""
    MonthlyProgram.objects.create(
        customer=customer,
        trainer=trainer_user,
        fitness_level=1,
        goal='general_health',
        start_date=TODAY - timedelta(days=5),
        end_date=TODAY + timedelta(days=22),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    mock_recompute.side_effect = RuntimeError('scoring boom')

    result = compute_daily_alerts.call_local()

    assert result['processed'] == 0
    assert result['errors'] == 1


@pytest.mark.django_db
def test_compute_daily_alerts_noop_when_no_programs():
    """Returns zeros when there are no published programs."""
    result = compute_daily_alerts.call_local()

    assert result == {'processed': 0, 'errors': 0}
