"""Golden-value unit tests for the pure adherence calculator functions.

The module under test has no Django ORM dependency — inputs are plain dicts,
so these tests need no database. Exercise/meal entries are represented as
``{'status': ...}`` dicts, matching how the service reads ``_status``.
"""

from datetime import date

from core_app.services.adherence_calculator import (
    DayAdherence,
    StreakResult,
    compute_combined_adherence,
    compute_nutrition_adherence,
    compute_streak,
    compute_training_adherence,
    compute_week_adherence,
    project_program_outcome,
)


def _log(status):
    return {'status': status}


# ── compute_training_adherence ───────────────────────────────────────────────

def test_training_adherence_rest_day_returns_full():
    # Arrange
    logs = [_log('skipped')]

    # Act
    result = compute_training_adherence(logs, 'rest', planned_count=3)

    # Assert
    assert result == 1.0


def test_training_adherence_zero_planned_returns_full():
    # Act
    result = compute_training_adherence([], 'training', planned_count=0)

    # Assert
    assert result == 1.0


def test_training_adherence_partial_planned_returns_ratio():
    # Arrange
    logs = [_log('completed'), _log('completed'), _log('skipped')]

    # Act
    result = compute_training_adherence(logs, 'training', planned_count=4)

    # Assert
    assert result == 0.5


def test_training_adherence_none_planned_empty_logs_returns_zero():
    # Act
    result = compute_training_adherence([], 'training', planned_count=None)

    # Assert
    assert result == 0.0


def test_training_adherence_none_planned_uses_log_count_as_total():
    # Arrange — 2 of 3 logged exercises completed.
    logs = [_log('completed'), _log('completed'), _log('skipped')]

    # Act
    result = compute_training_adherence(logs, 'training', planned_count=None)

    # Assert
    assert result == 0.6667


def test_training_adherence_caps_at_one_when_completed_exceeds_planned():
    # Arrange — 3 completed against only 2 planned.
    logs = [_log('completed'), _log('completed'), _log('completed')]

    # Act
    result = compute_training_adherence(logs, 'training', planned_count=2)

    # Assert
    assert result == 1.0


# ── compute_nutrition_adherence ──────────────────────────────────────────────

def test_nutrition_adherence_empty_entries_returns_zero():
    # Act
    result = compute_nutrition_adherence([])

    # Assert
    assert result == 0.0


def test_nutrition_adherence_counts_completed_over_five():
    # Arrange — 3 completed meals out of the fixed denominator of 5.
    meals = [_log('completed'), _log('completed'), _log('completed'), _log('skipped')]

    # Act
    result = compute_nutrition_adherence(meals)

    # Assert
    assert result == 0.6


# ── compute_combined_adherence ───────────────────────────────────────────────

def test_combined_adherence_applies_sixty_forty_weighting():
    # Act — training weighted 0.6, nutrition weighted 0.4.
    result = compute_combined_adherence(training=1.0, nutrition=0.0)

    # Assert
    assert result == 0.6


# ── compute_streak ───────────────────────────────────────────────────────────

def test_streak_empty_input_returns_zero_result():
    # Act
    result = compute_streak([])

    # Assert
    assert result == StreakResult(current=0, longest=0, start_date=None)


def test_streak_counts_consecutive_days_above_threshold():
    # Arrange
    days = [(date(2026, 1, 1), 0.8), (date(2026, 1, 2), 0.9)]

    # Act
    result = compute_streak(days, threshold=0.70)

    # Assert
    assert result == StreakResult(current=2, longest=2, start_date='2026-01-01')


def test_streak_resets_current_after_day_below_threshold():
    # Arrange — two good days, one bad day, then one good day.
    days = [
        (date(2026, 1, 1), 0.8),
        (date(2026, 1, 2), 0.8),
        (date(2026, 1, 3), 0.5),
        (date(2026, 1, 4), 0.9),
    ]

    # Act
    result = compute_streak(days, threshold=0.70)

    # Assert — current reflects only the last run; longest keeps the best run.
    assert result == StreakResult(current=1, longest=2, start_date='2026-01-01')


# ── compute_week_adherence ───────────────────────────────────────────────────

def test_week_adherence_computes_combined_metric_for_day():
    # Arrange — 1 of 4 planned exercises done, 3 of 5 meals done.
    days_data = [{
        'date': '2026-01-01',
        'day_type': 'training',
        'exercise_logs': [_log('completed'), _log('skipped')],
        'meal_entries': [_log('completed'), _log('completed'), _log('completed')],
        'planned_count': 4,
    }]

    # Act
    result = compute_week_adherence(days_data)

    # Assert — training 0.25, nutrition 0.6, combined 0.6*0.25 + 0.4*0.6 = 0.39.
    assert result[0] == DayAdherence(
        date='2026-01-01',
        day_type='training',
        training_adherence=0.25,
        nutrition_adherence=0.6,
        combined_adherence=0.39,
        exercises_completed=1,
        exercises_total=4,
        meals_completed=3,
        meals_total=3,
    )


def test_week_adherence_uses_log_count_as_total_when_planned_absent():
    # Arrange — no planned_count, so exercises_total falls back to log count.
    days_data = [{
        'date': '2026-01-02',
        'day_type': 'training',
        'exercise_logs': [_log('completed'), _log('completed')],
        'meal_entries': [],
    }]

    # Act
    result = compute_week_adherence(days_data)

    # Assert
    assert result[0].exercises_total == 2


# ── project_program_outcome ──────────────────────────────────────────────────

def test_projection_empty_history_returns_low_confidence_stable():
    # Act
    result = project_program_outcome([], days_remaining=10)

    # Assert
    assert result.projected_final_adherence == 0.0
    assert result.confidence == 'low'
    assert result.trend == 'stable'


def test_projection_full_history_reports_high_confidence():
    # Arrange — 14 days of complete adherence.
    daily = [1.0] * 14

    # Act
    result = project_program_outcome(daily, days_remaining=0)

    # Assert
    assert result.confidence == 'high'
    assert result.projected_final_adherence == 1.0


def test_projection_detects_improving_trend():
    # Arrange — first half low, second half high.
    daily = [0.0, 0.0, 1.0, 1.0]

    # Act
    result = project_program_outcome(daily, days_remaining=0)

    # Assert
    assert result.trend == 'improving'


def test_projection_detects_declining_trend():
    # Arrange — first half high, second half low.
    daily = [1.0, 1.0, 0.0, 0.0]

    # Act
    result = project_program_outcome(daily, days_remaining=0)

    # Assert
    assert result.trend == 'declining'


def test_projection_estimates_weight_via_linear_regression():
    # Arrange — 2 kg lost over 10 days (slope -0.2 kg/day), project 10 days out.
    weights = [(date(2026, 1, 1), 80.0), (date(2026, 1, 11), 78.0)]

    # Act
    result = project_program_outcome([0.8, 0.8], days_remaining=10, weight_entries=weights)

    # Assert — intercept 80, slope -0.2, last_x = 20 → 80 - 4 = 76.0.
    assert result.weight_projection == 76.0


def test_projection_weight_none_with_single_entry():
    # Arrange — regression needs at least two points.
    weights = [(date(2026, 1, 1), 80.0)]

    # Act
    result = project_program_outcome([0.8, 0.8], days_remaining=5, weight_entries=weights)

    # Assert
    assert result.weight_projection is None
