"""Tests for the create_fake_programs management command."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramWeekNote,
    TrainerProfile,
    User,
)
from core_app.models.exercise import Exercise

GENERAL_HEALTH_PATTERNS = ['Sentadilla', 'Doblar', 'Empuje', 'Jalar', 'Núcleo', 'Una pierna']
VALID_EXERCISE_STATUSES = set(ExerciseLog.Status.values)


def _stock_exercise_catalog():
    """Seed a general-health exercise pool plus corrective options."""
    for pattern in GENERAL_HEALTH_PATTERNS:
        for i in range(3):
            Exercise.objects.create(
                name=f'{pattern}-{i}', pattern=pattern, fitness_level_min=1,
                goal_tags=['general_health'], is_active=True, is_corrective=False,
                youtube_url='https://example.com/video',
            )
    for i in range(3):
        Exercise.objects.create(
            name=f'Estabilidad-{i}', pattern='Estabilidad', fitness_level_min=1,
            goal_tags=['general_health'], is_active=True, is_corrective=True,
            youtube_url='https://example.com/video',
        )


@pytest.fixture
def two_customers_with_catalog(db):
    """Two customers, one trainer, and a stocked exercise catalog."""
    User.objects.create_user(
        email='prog-c1@test.com', password='p',
        first_name='C1', last_name='Prog', role=User.Role.CUSTOMER,
    )
    User.objects.create_user(
        email='prog-c2@test.com', password='p',
        first_name='C2', last_name='Prog', role=User.Role.CUSTOMER,
    )
    trainer_user = User.objects.create_user(
        email='prog-trainer@test.com', password='p',
        first_name='T', last_name='Prog', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=trainer_user, location='Gym Prog')
    _stock_exercise_catalog()


@pytest.mark.django_db
class TestCreateFakePrograms:
    """Validates fake monthly-program creation outcomes and command options."""

    def test_creates_one_published_program_per_customer(self, two_customers_with_catalog):
        """Default run creates exactly one published program for each customer."""
        call_command('create_fake_programs', seed=7, stdout=StringIO())

        assert MonthlyProgram.objects.count() == 2
        assert list(MonthlyProgram.objects.values_list('status', flat=True)) == [
            MonthlyProgram.Status.PUBLISHED,
            MonthlyProgram.Status.PUBLISHED,
        ]

    def test_program_spans_twenty_eight_days(self, two_customers_with_catalog):
        """Each generated program has 28 program days."""
        call_command('create_fake_programs', seed=7, stdout=StringIO())

        program = MonthlyProgram.objects.first()
        assert program.days.count() == 28

    def test_creates_four_week_notes_per_program(self, two_customers_with_catalog):
        """Each program gets one coaching note for each of its four weeks."""
        call_command('create_fake_programs', seed=7, stdout=StringIO())

        program = MonthlyProgram.objects.first()
        week_numbers = sorted(program.week_notes.values_list('week_number', flat=True))
        assert week_numbers == [1, 2, 3, 4]
        assert ProgramWeekNote.objects.count() == 8

    def test_daily_logs_cover_only_past_days(self, two_customers_with_catalog):
        """Generated daily logs are created for elapsed program days only."""
        call_command('create_fake_programs', seed=7, stdout=StringIO())

        today = timezone.localdate()
        assert DailyLog.objects.exists()
        assert not DailyLog.objects.filter(date__gt=today).exists()

    def test_exercise_logs_have_valid_completion_status(self, two_customers_with_catalog):
        """Every generated exercise log carries a valid completion status."""
        call_command('create_fake_programs', seed=7, stdout=StringIO())

        statuses = set(ExerciseLog.objects.values_list('status', flat=True))
        assert ExerciseLog.objects.exists()
        assert statuses <= VALID_EXERCISE_STATUSES

    def test_rerun_does_not_duplicate_programs(self, two_customers_with_catalog):
        """A second run skips customers that already own a program."""
        call_command('create_fake_programs', seed=7, stdout=StringIO())
        call_command('create_fake_programs', seed=7, stdout=StringIO())

        assert MonthlyProgram.objects.count() == 2

    def test_warns_when_exercise_catalog_is_empty(self, db):
        """Command warns and creates nothing when no exercises exist."""
        User.objects.create_user(
            email='prog-nocat@test.com', password='p', role=User.Role.CUSTOMER,
        )
        out = StringIO()
        call_command('create_fake_programs', stdout=out)

        assert MonthlyProgram.objects.count() == 0
        assert 'No active exercises found' in out.getvalue()
