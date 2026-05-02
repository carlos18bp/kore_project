"""Automatic 28-day workout program generator for the KÓRE Monthly Tracking system.

Reads the customer's latest evaluation data and builds a MonthlyProgram with
status=DRAFT.  The trainer then reviews and publishes it.

Fitness level mapping (mirrors PhysicalEvaluation.general_index scale):
    1 → Fundacional
    2 → Básico
    3 → Intermedio
    4 → Avanzado
    5 → Elite
"""

import random
from datetime import date, timedelta
from math import floor

from django.db import transaction

from core_app.models.exercise import Exercise
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
    ProgramExercise,
)


# ---------------------------------------------------------------------------
# Configuration tables
# ---------------------------------------------------------------------------

TRAINING_DAYS_BY_LEVEL = {1: 3, 2: 3, 3: 4, 4: 5, 5: 5}

# Ordered list of movement patterns to fill per training day, by goal.
# Pattern values must match the Spanish canonical names stored in Exercise.pattern.
PATTERN_SEQUENCE_BY_GOAL = {
    'fat_loss':           ['Sentadilla', 'Empuje', 'Jalar', 'Núcleo', 'Doblar', 'Una pierna', 'Locomoción'],
    'muscle_gain':        ['Empuje', 'Jalar', 'Doblar', 'Sentadilla', 'Núcleo', 'Una pierna'],
    'rehab':              ['Estabilidad', 'Núcleo', 'Una pierna', 'Empuje', 'Jalar'],
    'general_health':     ['Sentadilla', 'Doblar', 'Empuje', 'Jalar', 'Núcleo', 'Una pierna'],
    'sports_performance': ['Doblar', 'Sentadilla', 'Empuje', 'Jalar', 'Complejo', 'Una pierna', 'Pliométrico'],
}

ACTIVE_REST_PATTERNS = ['Núcleo', 'Una pierna']

EXERCISES_PER_TRAINING_DAY_BY_LEVEL = {1: 5, 2: 5, 3: 6, 4: 7, 5: 8}
ACTIVE_REST_EXERCISE_COUNT = 3

# Progressive overload: (sets_multiplier, reps_multiplier) by week number
WEEKLY_PROGRESSION = {
    1: (1.0, 1.0),
    2: (1.0, 1.1),
    3: (1.1, 1.0),
    4: (0.8, 0.9),
}

# Base sets/reps per level (Stability/Corrective always 2 sets)
BASE_SETS_BY_LEVEL = {1: 2, 2: 3, 3: 3, 4: 4, 5: 4}
BASE_REPS_BY_LEVEL = {1: 10, 2: 12, 3: 12, 4: 10, 5: 10}

# Weekday training schedule per level (0=Monday … 6=Sunday)
TRAINING_WEEKDAYS_BY_LEVEL = {
    1: {0, 2, 4},       # Mon Wed Fri
    2: {0, 2, 4},       # Mon Wed Fri
    3: {0, 1, 3, 4},    # Mon Tue Thu Fri
    4: {0, 1, 2, 3, 4}, # Mon-Fri
    5: {0, 1, 2, 3, 4}, # Mon-Fri
}

# 3-day fallback schedule (used when start_date is mid-week)
_3_DAY_ROTATION = [True, False, True, False, True, False, False]
_4_DAY_ROTATION = [True, True, False, True, True, False, False]
_5_DAY_ROTATION = [True, True, True, True, True, False, False]

TRAINING_ROTATION_BY_LEVEL = {
    1: _3_DAY_ROTATION,
    2: _3_DAY_ROTATION,
    3: _4_DAY_ROTATION,
    4: _5_DAY_ROTATION,
    5: _5_DAY_ROTATION,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@transaction.atomic
def generate_monthly_program(customer_id: int, start_date: date | None = None) -> MonthlyProgram:
    """Generate a draft 28-day program for the given customer.

    Args:
        customer_id: PK of the customer User.
        start_date:  First day of the program; defaults to today.

    Returns:
        A MonthlyProgram instance with status=DRAFT and all ProgramDays
        and ProgramExercises populated.
    """
    from core_app.models import User

    if start_date is None:
        start_date = date.today()

    customer = User.objects.select_related('customer_profile').get(pk=customer_id)

    fitness_level = _get_fitness_level(customer)
    goal = _get_goal(customer)
    parq_risk = _get_parq_risk(customer)
    corrective_patterns = _get_corrective_patterns(customer)

    # Resolve the trainer (first active TrainerProfile, if any)
    from core_app.models import TrainerProfile
    trainer = TrainerProfile.objects.first()

    program = MonthlyProgram.objects.create(
        customer=customer,
        trainer=trainer,
        fitness_level=fitness_level,
        goal=goal,
        start_date=start_date,
        end_date=start_date + timedelta(days=27),
        status=MonthlyProgram.Status.DRAFT,
    )

    rotation = TRAINING_ROTATION_BY_LEVEL[fitness_level]
    exercise_count = EXERCISES_PER_TRAINING_DAY_BY_LEVEL[fitness_level]

    # Track used exercises per week to avoid repetition
    used_by_week: dict[int, set[int]] = {w: set() for w in range(1, 5)}

    for day_num in range(1, 29):
        current_date = start_date + timedelta(days=day_num - 1)
        week_num = ((day_num - 1) // 7) + 1
        rotation_index = (day_num - 1) % 7
        is_training = rotation[rotation_index]

        if is_training:
            day_type = ProgramDay.DayType.TRAINING
        elif rotation_index in (5, 6):  # Sat/Sun
            day_type = ProgramDay.DayType.REST
        else:
            day_type = ProgramDay.DayType.ACTIVE_REST

        program_day = ProgramDay.objects.create(
            program=program,
            day_number=day_num,
            date=current_date,
            day_type=day_type,
        )

        if day_type == ProgramDay.DayType.TRAINING:
            _fill_training_day(
                program_day,
                fitness_level,
                goal,
                parq_risk,
                corrective_patterns,
                week_num,
                used_by_week[week_num],
                exercise_count,
            )
        elif day_type == ProgramDay.DayType.ACTIVE_REST:
            _fill_active_rest_day(program_day, fitness_level, used_by_week[week_num])

    return program


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_fitness_level(customer) -> int:
    eval_ = (
        customer.physical_evaluations
        .filter(general_index__isnull=False)
        .order_by('-created_at')
        .first()
    )
    if eval_ is None or eval_.general_index is None:
        return 1
    return max(1, min(5, floor(float(eval_.general_index) + 0.5)))


def _get_goal(customer) -> str:
    try:
        goal = customer.customer_profile.primary_goal
        return goal if goal else 'general_health'
    except Exception:
        return 'general_health'


def _get_parq_risk(customer) -> str:
    assessment = customer.parq_assessments.order_by('-created_at').first()
    if assessment is None:
        return 'apto_con_precaucion'
    return assessment.risk_classification or 'apto'


def _get_corrective_patterns(customer) -> list[str]:
    """Return body regions with posturometry findings that need corrective work."""
    eval_ = customer.posturometry_evaluations.order_by('-created_at').first()
    if eval_ is None:
        return []
    findings = eval_.findings or {}
    affected = []
    if findings.get('anterior') or findings.get('lateral_right') or findings.get('lateral_left'):
        affected.append('upper')
    if findings.get('posterior'):
        affected.append('lower')
    return affected


def _build_exercise_pool(
    fitness_level: int,
    goal: str,
    parq_risk: str,
    corrective_patterns: list[str],
) -> dict[str, list]:
    """Return a dict of pattern → list of eligible Exercise objects."""
    base_qs = Exercise.objects.filter(
        is_active=True,
        fitness_level_min__lte=fitness_level,
    )

    # PAR-Q restriction: only corrective exercises for high-risk customers
    # Use icontains on the JSON string representation for cross-database compatibility
    # (SQLite dev does not support JSONField __contains lookup; MySQL 8 prod does,
    # but the quoted-string search is reliable on both)
    if parq_risk == 'requiere_valoracion':
        base_qs = base_qs.filter(is_corrective=True)
    else:
        base_qs = base_qs.filter(goal_tags__icontains=f'"{goal}"')

    pool: dict[str, list] = {}
    for pattern in set(PATTERN_SEQUENCE_BY_GOAL.get(goal, []) + ACTIVE_REST_PATTERNS):
        pool[pattern] = list(base_qs.filter(pattern=pattern))

    # Add corrective exercises for affected body regions (by posturometry)
    if corrective_patterns and parq_risk != 'requiere_valoracion':
        corrective_qs = base_qs.filter(is_corrective=True)
        pool['Estabilidad'] = list(corrective_qs)

    return pool


def _fill_training_day(
    program_day: ProgramDay,
    fitness_level: int,
    goal: str,
    parq_risk: str,
    corrective_patterns: list[str],
    week_num: int,
    used_ids: set,
    exercise_count: int,
):
    pool = _build_exercise_pool(fitness_level, goal, parq_risk, corrective_patterns)
    pattern_sequence = list(PATTERN_SEQUENCE_BY_GOAL.get(goal, ['Push', 'Pull', 'Squat', 'Bend', 'Core']))

    # Add corrective slot if posturometry shows issues
    if corrective_patterns and 'Estabilidad' in pool and parq_risk != 'requiere_valoracion':
        pattern_sequence.append('Estabilidad')

    sets_mult, reps_mult = WEEKLY_PROGRESSION[week_num]
    base_sets = BASE_SETS_BY_LEVEL[fitness_level]
    base_reps = BASE_REPS_BY_LEVEL[fitness_level]

    selected = []
    pattern_iter = iter(pattern_sequence * 3)  # cycle up to 3x to fill the quota

    for pattern in pattern_iter:
        if len(selected) >= exercise_count:
            break
        candidates = [e for e in pool.get(pattern, []) if e.id not in used_ids]
        if not candidates:
            continue
        exercise = random.choice(candidates)
        selected.append((pattern, exercise))
        used_ids.add(exercise.id)

    for order, (pattern, exercise) in enumerate(selected):
        is_corrective = exercise.is_corrective
        sets = max(1, round((2 if is_corrective else base_sets) * sets_mult))
        reps = max(1, round(base_reps * reps_mult)) if not is_corrective else None
        duration = 30 if is_corrective else None

        ProgramExercise.objects.create(
            program_day=program_day,
            exercise=exercise,
            sets=sets,
            reps=reps,
            duration_seconds=duration,
            rest_seconds=45 if is_corrective else 60,
            order=order,
        )


def _fill_active_rest_day(program_day: ProgramDay, fitness_level: int, used_ids: set):
    pool_qs = Exercise.objects.filter(
        is_active=True,
        fitness_level_min__lte=fitness_level,
        is_corrective=True,
    )
    candidates = [e for e in pool_qs if e.id not in used_ids]
    if not candidates:
        candidates = list(pool_qs[:ACTIVE_REST_EXERCISE_COUNT])

    selected = random.sample(candidates, min(ACTIVE_REST_EXERCISE_COUNT, len(candidates)))
    for order, exercise in enumerate(selected):
        ProgramExercise.objects.create(
            program_day=program_day,
            exercise=exercise,
            sets=2,
            duration_seconds=30,
            rest_seconds=30,
            order=order,
        )
        used_ids.add(exercise.id)
