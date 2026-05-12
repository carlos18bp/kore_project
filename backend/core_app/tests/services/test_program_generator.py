"""Tests for program_generator.generate_monthly_program (28-day draft program)."""
import random
from datetime import date, timedelta

import pytest

from core_app.models import ParqAssessment, PhysicalEvaluation, PosturometryEvaluation, User
from core_app.models.exercise import Exercise
from core_app.models.monthly_program import MonthlyProgram, ProgramDay, ProgramExercise
from core_app.services.program_generator import (
    EXERCISES_PER_TRAINING_DAY_BY_LEVEL,
    generate_monthly_program,
)

PROGRAM_START = date(2026, 4, 6)  # a Monday

GENERAL_HEALTH_PATTERNS = ['Sentadilla', 'Doblar', 'Empuje', 'Jalar', 'Núcleo', 'Una pierna']


def _customer(email='prog-gen-cust@test.com'):
    return User.objects.create_user(
        email=email, password='pass', first_name='P', last_name='G', role=User.Role.CUSTOMER,
    )


def _make_exercise(name, pattern, *, level=1, corrective=False):
    return Exercise.objects.create(
        name=name, pattern=pattern, fitness_level_min=level,
        goal_tags=['general_health'], is_active=True, is_corrective=corrective,
        youtube_url='https://example.com/video',
    )


def _stock_full_pool(level=1, per_pattern=3):
    for pattern in GENERAL_HEALTH_PATTERNS:
        for i in range(per_pattern):
            _make_exercise(f'{pattern}-{i}', pattern, level=level)


@pytest.mark.django_db
class TestGenerateMonthlyProgram:
    def test_creates_draft_program_with_28_days(self):
        random.seed(0)
        customer = _customer()
        _stock_full_pool()

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        assert program.status == MonthlyProgram.Status.DRAFT
        assert program.days.count() == 28
        assert program.end_date == PROGRAM_START + timedelta(days=27)

    def test_derives_level_from_latest_physical_evaluation_index(self):
        random.seed(0)
        customer = _customer()
        evaluation = PhysicalEvaluation.objects.create(customer=customer)
        PhysicalEvaluation.objects.filter(pk=evaluation.pk).update(general_index='3.00')

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        assert program.fitness_level == 3

    def test_defaults_to_level_one_without_override_or_evaluation(self):
        random.seed(0)
        customer = _customer()

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        assert program.fitness_level == 1

    def test_training_day_gets_exercises_up_to_level_quota(self):
        random.seed(0)
        customer = _customer()
        _stock_full_pool(level=1, per_pattern=5)

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        first_training_day = program.days.filter(day_type=ProgramDay.DayType.TRAINING).order_by('day_number').first()
        assert first_training_day.exercises.count() == EXERCISES_PER_TRAINING_DAY_BY_LEVEL[1]

    def test_parq_requires_valuation_restricts_to_corrective_exercises(self):
        random.seed(0)
        customer = _customer()
        assessment = ParqAssessment.objects.create(customer=customer)
        ParqAssessment.objects.filter(pk=assessment.pk).update(risk_classification='requiere_valoracion')
        _make_exercise('Empuje corrective', 'Empuje', corrective=True)
        _make_exercise('Empuje normal', 'Empuje', corrective=False)

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        training_exercises = ProgramExercise.objects.filter(
            program_day__program=program, program_day__day_type=ProgramDay.DayType.TRAINING,
        )
        assert training_exercises.exists()
        assert all(pe.exercise.is_corrective for pe in training_exercises)

    def test_posturometry_findings_add_corrective_slot_to_training_day(self):
        random.seed(0)
        customer = _customer()
        posturometry = PosturometryEvaluation.objects.create(customer=customer)
        PosturometryEvaluation.objects.filter(pk=posturometry.pk).update(findings={'anterior': ['cabeza adelantada']})
        _make_exercise('Solo Empuje', 'Empuje', corrective=False)
        _make_exercise('Estabilidad correctiva', 'Empuje', corrective=True)

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        corrective_in_training = ProgramExercise.objects.filter(
            program_day__program=program,
            program_day__day_type=ProgramDay.DayType.TRAINING,
            exercise__is_corrective=True,
        )
        assert corrective_in_training.exists()

    def test_week_four_deload_has_fewer_sets_than_week_one(self):
        random.seed(0)
        customer = _customer()
        # general_index 2.00 -> floor(2.5) -> level 2 (base_sets=3, so the
        # week-4 0.8x deload visibly drops a set; at level 1 base_sets=2 rounds back to 2).
        evaluation = PhysicalEvaluation.objects.create(customer=customer)
        PhysicalEvaluation.objects.filter(pk=evaluation.pk).update(general_index='2.00')
        _stock_full_pool(level=1, per_pattern=5)

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        # Day 1 and day 22 are both Mondays (training days for level 2).
        week_one_sets = list(
            ProgramExercise.objects.filter(program_day__program=program, program_day__day_number=1)
            .values_list('sets', flat=True)
        )
        week_four_sets = list(
            ProgramExercise.objects.filter(program_day__program=program, program_day__day_number=22)
            .values_list('sets', flat=True)
        )
        assert week_one_sets and week_four_sets
        assert max(week_four_sets) < min(week_one_sets)

    def test_empty_exercise_pool_yields_28_days_with_no_program_exercises(self):
        random.seed(0)
        customer = _customer()

        program = generate_monthly_program(customer.pk, start_date=PROGRAM_START)

        assert program.days.count() == 28
        assert ProgramExercise.objects.filter(program_day__program=program).count() == 0
