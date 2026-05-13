"""Tests for the create_test_users management command."""
from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import (
    AnthropometryEvaluation,
    ParqAssessment,
    PhysicalEvaluation,
    PosturometryEvaluation,
    TrainerProfile,
    User,
)
from core_app.models.customer_profile import CustomerProfile
from core_app.models.exercise import Exercise
from core_app.models.monthly_program import DailyLog, ExerciseLog, MonthlyProgram

TRAINER_EMAIL = 'trainer@kore.com'
CUSTOMER_EMAIL = 'test@kore.com'

# The command's test customer has primary_goal=fat_loss; stock that goal's patterns
# so generate_monthly_program can populate training days (and thus daily logs).
FAT_LOSS_PATTERNS = ['Sentadilla', 'Empuje', 'Jalar', 'Núcleo', 'Doblar', 'Una pierna', 'Locomoción']


def _stock_exercise_catalog():
    for pattern in FAT_LOSS_PATTERNS:
        for i in range(2):
            Exercise.objects.create(
                name=f'{pattern}-{i}', pattern=pattern, fitness_level_min=1,
                goal_tags=['fat_loss'], is_active=True, youtube_url='https://example.com/v',
            )
    Exercise.objects.create(
        name='Corrective core', pattern='Núcleo', fitness_level_min=1,
        goal_tags=['fat_loss'], is_active=True, is_corrective=True,
        youtube_url='https://example.com/v',
    )


@pytest.mark.django_db
class TestCreateTestUsers:
    def test_creates_trainer_with_profile(self):
        out = StringIO()

        call_command('create_test_users', stdout=out)

        trainer = User.objects.get(email=TRAINER_EMAIL)
        assert trainer.role == User.Role.TRAINER
        assert TrainerProfile.objects.filter(user=trainer).exists()

    def test_creates_customer_with_completed_profile(self):
        out = StringIO()

        call_command('create_test_users', stdout=out)

        customer = User.objects.get(email=CUSTOMER_EMAIL)
        assert customer.role == User.Role.CUSTOMER
        assert CustomerProfile.objects.get(user=customer).profile_completed is True

    def test_creates_published_program_with_daily_logs(self):
        _stock_exercise_catalog()
        out = StringIO()

        call_command('create_test_users', stdout=out)

        customer = User.objects.get(email=CUSTOMER_EMAIL)
        program = MonthlyProgram.objects.get(customer=customer)
        assert program.status == MonthlyProgram.Status.PUBLISHED
        assert DailyLog.objects.filter(program=program).exists()
        assert ExerciseLog.objects.filter(daily_log__program=program).exists()

    def test_creates_all_evaluation_types(self):
        out = StringIO()

        call_command('create_test_users', stdout=out)

        customer = User.objects.get(email=CUSTOMER_EMAIL)
        assert AnthropometryEvaluation.objects.filter(customer=customer).exists()
        assert PosturometryEvaluation.objects.filter(customer=customer).exists()
        assert PhysicalEvaluation.objects.filter(customer=customer).exists()
        assert ParqAssessment.objects.filter(customer=customer).exists()

    def test_can_be_rerun_without_protected_error(self):
        call_command('create_test_users', stdout=StringIO())
        call_command('create_test_users', stdout=StringIO())

        assert User.objects.filter(email=TRAINER_EMAIL, role=User.Role.TRAINER).count() == 1
        assert User.objects.filter(email=CUSTOMER_EMAIL, role=User.Role.CUSTOMER).count() == 1
