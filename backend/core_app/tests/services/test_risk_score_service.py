"""Tests for recompute_risk_score() in risk_score_service.py."""

from datetime import date
from unittest.mock import patch

import pytest

from core_app.models import ClientRiskScore, User
from core_app.models.monthly_program import MonthlyProgram
from core_app.models.trainer_profile import TrainerProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXED_TODAY = date(2026, 5, 15)

BEHAVIORAL_PATCH = 'core_app.services.behavioral_alert_engine.compute_behavioral_signals'
CLINICAL_PATCH = 'core_app.services.clinical_alert_engine.compute_clinical_signals'


def _make_customer(email='risk@test.com'):
    return User.objects.create_user(email=email, password='pass', role=User.Role.CUSTOMER)


def _make_trainer(email='trainer_risk@test.com'):
    user = User.objects.create_user(email=email, password='pass', role=User.Role.TRAINER)
    return TrainerProfile.objects.create(user=user, location='Gym', specialty='General')


def _make_published_program(customer, trainer=None):
    return MonthlyProgram.objects.create(
        customer=customer,
        trainer=trainer,
        fitness_level=2,
        goal='fat_loss',
        start_date=FIXED_TODAY,
        end_date=FIXED_TODAY,
        status=MonthlyProgram.Status.PUBLISHED,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRecomputeRiskScoreNoActiveProgram:
    def test_returns_false_when_no_active_program_exists(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('norisk1@test.com')
        result = recompute_risk_score(customer, today=FIXED_TODAY)
        assert result is False

    def test_returns_false_when_only_draft_program_exists(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('norisk2@test.com')
        trainer = _make_trainer('trainer_draft@test.com')
        MonthlyProgram.objects.create(
            customer=customer,
            trainer=trainer,
            fitness_level=2,
            goal='muscle_gain',
            start_date=FIXED_TODAY,
            end_date=FIXED_TODAY,
            status=MonthlyProgram.Status.DRAFT,
        )
        result = recompute_risk_score(customer, today=FIXED_TODAY)
        assert result is False


@pytest.mark.django_db
class TestRecomputeRiskScoreNoTrainer:
    def test_returns_false_when_program_has_no_trainer(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('notrainer@test.com')
        _make_published_program(customer, trainer=None)

        result = recompute_risk_score(customer, today=FIXED_TODAY)
        assert result is False


@pytest.mark.django_db
class TestRecomputeRiskScoreNormalFlow:
    def test_returns_true_on_successful_recompute(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('flowok@test.com')
        trainer = _make_trainer('trainer_flowok@test.com')
        _make_published_program(customer, trainer)

        with patch(BEHAVIORAL_PATCH, return_value=[]), patch(CLINICAL_PATCH, return_value=[]):
            result = recompute_risk_score(customer, today=FIXED_TODAY)

        assert result is True

    def test_old_risk_scores_are_marked_stale(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('stale@test.com')
        trainer = _make_trainer('trainer_stale@test.com')
        _make_published_program(customer, trainer)

        # Pre-existing fresh score
        old_score = ClientRiskScore.objects.create(
            customer=customer,
            trainer=trainer,
            level=ClientRiskScore.Level.SIN_RIESGO,
            is_stale=False,
        )

        with patch(BEHAVIORAL_PATCH, return_value=[]), patch(CLINICAL_PATCH, return_value=[]):
            recompute_risk_score(customer, today=FIXED_TODAY)

        old_score.refresh_from_db()
        assert old_score.is_stale is True

    def test_new_risk_score_is_created(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('newrisk@test.com')
        trainer = _make_trainer('trainer_newrisk@test.com')
        _make_published_program(customer, trainer)

        with patch(BEHAVIORAL_PATCH, return_value=[]), patch(CLINICAL_PATCH, return_value=[]):
            recompute_risk_score(customer, today=FIXED_TODAY)

        assert ClientRiskScore.objects.filter(customer=customer, trainer=trainer).count() == 1

    def test_new_risk_score_has_correct_trainer(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('trainermatch@test.com')
        trainer = _make_trainer('trainer_trainermatch@test.com')
        _make_published_program(customer, trainer)

        with patch(BEHAVIORAL_PATCH, return_value=[]), patch(CLINICAL_PATCH, return_value=[]):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.trainer == trainer


@pytest.mark.django_db
class TestRecomputeRiskScoreLevelDetermination:
    def test_empty_signals_produces_sin_riesgo(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('lvl_sin@test.com')
        trainer = _make_trainer('trainer_sin@test.com')
        _make_published_program(customer, trainer)

        with patch(BEHAVIORAL_PATCH, return_value=[]), patch(CLINICAL_PATCH, return_value=[]):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.level == ClientRiskScore.Level.SIN_RIESGO

    def test_alto_severity_signal_produces_alto_level(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('lvl_alto@test.com')
        trainer = _make_trainer('trainer_alto@test.com')
        _make_published_program(customer, trainer)

        behavioral = [{'type': 'inactivity_14d', 'severity': 'alto', 'since_date': None}]
        with patch(BEHAVIORAL_PATCH, return_value=behavioral), patch(CLINICAL_PATCH, return_value=[]):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.level == ClientRiskScore.Level.ALTO

    def test_only_medio_severity_produces_medio_level(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('lvl_medio@test.com')
        trainer = _make_trainer('trainer_medio@test.com')
        _make_published_program(customer, trainer)

        behavioral = [{'type': 'inactivity_7d', 'severity': 'medio', 'since_date': None}]
        with patch(BEHAVIORAL_PATCH, return_value=behavioral), patch(CLINICAL_PATCH, return_value=[]):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.level == ClientRiskScore.Level.MEDIO

    def test_only_bajo_severity_produces_bajo_level(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('lvl_bajo@test.com')
        trainer = _make_trainer('trainer_bajo@test.com')
        _make_published_program(customer, trainer)

        clinical = [{'type': 'mild_bmi', 'severity': 'bajo', 'since_date': None}]
        with patch(BEHAVIORAL_PATCH, return_value=[]), patch(CLINICAL_PATCH, return_value=clinical):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.level == ClientRiskScore.Level.BAJO

    def test_alto_takes_precedence_over_medio_and_bajo(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('lvl_prec@test.com')
        trainer = _make_trainer('trainer_prec@test.com')
        _make_published_program(customer, trainer)

        behavioral = [
            {'type': 'inactivity_14d', 'severity': 'alto'},
            {'type': 'inactivity_7d', 'severity': 'medio'},
        ]
        clinical = [{'type': 'mild_bmi', 'severity': 'bajo'}]
        with patch(BEHAVIORAL_PATCH, return_value=behavioral), patch(CLINICAL_PATCH, return_value=clinical):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.level == ClientRiskScore.Level.ALTO

    def test_behavioral_and_clinical_signals_are_both_stored(self):
        from core_app.services.risk_score_service import recompute_risk_score

        customer = _make_customer('stored@test.com')
        trainer = _make_trainer('trainer_stored@test.com')
        _make_published_program(customer, trainer)

        behavioral = [{'type': 'inactivity_7d', 'severity': 'medio'}]
        clinical = [{'type': 'mild_bmi', 'severity': 'bajo'}]
        with patch(BEHAVIORAL_PATCH, return_value=behavioral), patch(CLINICAL_PATCH, return_value=clinical):
            recompute_risk_score(customer, today=FIXED_TODAY)

        score = ClientRiskScore.objects.filter(customer=customer).first()
        assert score.behavioral_signals == behavioral
        assert score.clinical_signals == clinical
