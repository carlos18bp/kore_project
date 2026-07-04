"""Tests for the create_fake_trainer_intelligence management command."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import (
    ClientRiskScore,
    TrainerAlertResolution,
    TrainerMessage,
    TrainerProfile,
    User,
)
from core_app.models.monthly_program import MonthlyProgram


@pytest.fixture
def customer_with_published_program(db):
    """One customer, one trainer, and a published program (needed for risk scoring)."""
    customer = User.objects.create_user(
        email='ti-c1@test.com', password='p',
        first_name='C1', last_name='Intel', role=User.Role.CUSTOMER,
    )
    trainer_user = User.objects.create_user(
        email='ti-trainer@test.com', password='p',
        first_name='T', last_name='Intel', role=User.Role.TRAINER,
    )
    trainer = TrainerProfile.objects.create(user=trainer_user, location='Gym Intel')
    today = timezone.localdate()
    MonthlyProgram.objects.create(
        customer=customer,
        trainer=trainer,
        fitness_level=2,
        goal='general_health',
        start_date=today,
        end_date=today,
        status=MonthlyProgram.Status.PUBLISHED,
    )
    return customer, trainer


@pytest.mark.django_db
class TestCreateFakeTrainerIntelligence:
    """Validates fake trainer-intelligence creation outcomes and command options."""

    def test_creates_one_risk_score_for_customer_with_program(self, customer_with_published_program):
        """A single fresh risk score is computed for the customer."""
        customer, _ = customer_with_published_program
        call_command('create_fake_trainer_intelligence', seed=3, stdout=StringIO())

        scores = ClientRiskScore.objects.filter(customer=customer, is_stale=False)
        assert scores.count() == 1
        assert scores.first().level in set(ClientRiskScore.Level.values)

    def test_creates_one_resolution_per_detected_signal(self, customer_with_published_program):
        """Each behavioral/clinical signal in the score gets a resolution row."""
        customer, _ = customer_with_published_program
        call_command('create_fake_trainer_intelligence', seed=3, stdout=StringIO())

        score = ClientRiskScore.objects.get(customer=customer, is_stale=False)
        expected = len(score.behavioral_signals) + len(score.clinical_signals)
        assert expected > 0
        assert TrainerAlertResolution.objects.filter(risk_score=score).count() == expected

    def test_creates_requested_number_of_messages(self, customer_with_published_program):
        """The command creates exactly the requested number of trainer messages."""
        customer, _ = customer_with_published_program
        call_command(
            'create_fake_trainer_intelligence',
            messages_per_customer=2, seed=3, stdout=StringIO(),
        )

        assert TrainerMessage.objects.filter(customer=customer).count() == 2

    def test_rerun_does_not_recompute_fresh_score(self, customer_with_published_program):
        """A second run leaves the existing fresh score untouched."""
        customer, _ = customer_with_published_program
        call_command('create_fake_trainer_intelligence', seed=3, stdout=StringIO())
        call_command('create_fake_trainer_intelligence', seed=3, stdout=StringIO())

        assert ClientRiskScore.objects.filter(customer=customer).count() == 1

    def test_no_customers_warning(self, db):
        """Command warns and exits cleanly when no customers exist."""
        out = StringIO()
        call_command('create_fake_trainer_intelligence', stdout=out)

        assert ClientRiskScore.objects.count() == 0
        assert 'No customers found' in out.getvalue()
