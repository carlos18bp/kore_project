"""Tests for create_fake_diagnostics management command."""

from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import (
    AnthropometryEvaluation,
    NutritionHabit,
    ParqAssessment,
    PhysicalEvaluation,
    PosturometryEvaluation,
    TrainerProfile,
    User,
)


@pytest.fixture
def two_customers_with_trainer(db):
    """Create two customers and one trainer for diagnostics generation."""
    User.objects.create_user(
        email='diag-c1@test.com', password='p',
        first_name='C1', last_name='Diag', role=User.Role.CUSTOMER,
    )
    User.objects.create_user(
        email='diag-c2@test.com', password='p',
        first_name='C2', last_name='Diag', role=User.Role.CUSTOMER,
    )
    trainer_user = User.objects.create_user(
        email='diag-trainer@test.com', password='p',
        first_name='T', last_name='Diag', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=trainer_user, location='Gym Diag')


@pytest.mark.django_db
class TestCreateFakeDiagnostics:
    """Validates fake diagnostics creation outcomes and command options."""

    def test_creates_one_evaluation_per_module_per_customer(self, two_customers_with_trainer):
        """Default run creates exactly one evaluation per module for each customer."""
        out = StringIO()
        call_command('create_fake_diagnostics', stdout=out)

        assert AnthropometryEvaluation.objects.count() == 2
        assert PosturometryEvaluation.objects.count() == 2
        assert PhysicalEvaluation.objects.count() == 2
        assert NutritionHabit.objects.count() == 2
        assert ParqAssessment.objects.count() == 2

    def test_auto_computes_anthropometry_indices(self, two_customers_with_trainer):
        """Generated anthropometry rows have BMI and category auto-computed by save()."""
        call_command('create_fake_diagnostics', stdout=StringIO())

        for ev in AnthropometryEvaluation.objects.all():
            assert ev.bmi is not None
            assert ev.bmi_category != ''

    def test_auto_computes_nutrition_score(self, two_customers_with_trainer):
        """Generated nutrition rows have habit_score auto-computed by save()."""
        call_command('create_fake_diagnostics', stdout=StringIO())

        for ev in NutritionHabit.objects.all():
            assert ev.habit_score is not None
            assert ev.habit_category != ''

    def test_auto_computes_parq_classification(self, two_customers_with_trainer):
        """Generated PAR-Q rows have risk_classification auto-computed by save()."""
        call_command('create_fake_diagnostics', stdout=StringIO())

        for ev in ParqAssessment.objects.all():
            assert ev.risk_classification != ''
            assert ev.risk_label != ''

    def test_skip_modules_flags_respected(self, two_customers_with_trainer):
        """Skip flags suppress creation of the corresponding module."""
        call_command(
            'create_fake_diagnostics',
            skip_anthro=True,
            skip_posturo=True,
            skip_physical=True,
            stdout=StringIO(),
        )

        assert AnthropometryEvaluation.objects.count() == 0
        assert PosturometryEvaluation.objects.count() == 0
        assert PhysicalEvaluation.objects.count() == 0
        assert NutritionHabit.objects.count() == 2
        assert ParqAssessment.objects.count() == 2

    def test_per_customer_multiplier_applies_to_diagnostic_modules(self, two_customers_with_trainer):
        """Higher per_customer count multiplies anthropometry/physical evaluations."""
        call_command('create_fake_diagnostics', per_customer=3, stdout=StringIO())

        # 2 customers × 3 evaluations
        assert AnthropometryEvaluation.objects.count() == 6
        assert PhysicalEvaluation.objects.count() == 6
        # PARQ remains 1 per customer (90-day cooldown)
        assert ParqAssessment.objects.count() == 2

    def test_no_customers_warning(self, db):
        """Command warns and exits cleanly when no customers exist."""
        out = StringIO()
        call_command('create_fake_diagnostics', stdout=out)

        assert AnthropometryEvaluation.objects.count() == 0
        assert 'No customers found' in out.getvalue()

    def test_assigns_trainer_when_available(self, two_customers_with_trainer):
        """Generated evaluations are linked to the first available trainer."""
        call_command('create_fake_diagnostics', stdout=StringIO())

        trainer = TrainerProfile.objects.first()
        for ev in AnthropometryEvaluation.objects.all():
            assert ev.trainer == trainer
