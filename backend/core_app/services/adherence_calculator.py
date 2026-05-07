"""
Pure functions for computing adherence metrics.
No Django ORM calls — inputs are plain Python objects/lists.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Sequence


# ── Per-day adherence ────────────────────────────────────────────────────────

def compute_training_adherence(
    exercise_logs: list,
    day_type: str,
    planned_count: int | None = None,
) -> float:
    """
    Returns 0.0–1.0.

    - day_type == 'rest'           → 1.0 (no requirement)
    - planned_count == 0           → 1.0 (nothing scheduled, day is met)
    - planned_count > 0            → min(1.0, completed_logs / planned_count)
    - planned_count is None        → falls back to len(exercise_logs); empty
                                     logs return 0.0 (nothing logged = nothing
                                     completed). Pass planned_count whenever
                                     the program day's planned exercises are
                                     known so future / unstarted days don't
                                     get falsely credited.
    """
    if day_type == 'rest':
        return 1.0

    if planned_count is None:
        if not exercise_logs:
            return 0.0
        total = len(exercise_logs)
    else:
        if planned_count == 0:
            return 1.0
        total = planned_count

    completed = sum(1 for e in exercise_logs if _status(e) == 'completed')
    return round(min(1.0, completed / total), 4)


def compute_nutrition_adherence(meal_entries: list) -> float:
    """Returns 0.0–1.0 based on completed meals out of 5."""
    if not meal_entries:
        return 0.0
    completed = sum(1 for m in meal_entries if getattr(m, 'status', m.get('status') if isinstance(m, dict) else None) == 'completed')
    return round(completed / 5, 4)


def compute_combined_adherence(training: float, nutrition: float) -> float:
    return round(0.6 * training + 0.4 * nutrition, 4)


# ── Streak ───────────────────────────────────────────────────────────────────

@dataclass
class StreakResult:
    current: int = 0
    longest: int = 0
    start_date: str | None = None


def compute_streak(daily_combined: list[tuple[date, float]], threshold: float = 0.70) -> StreakResult:
    """
    Args:
        daily_combined: list of (date, combined_adherence) sorted ascending.
        threshold: minimum combined adherence to count a day in the streak.
    """
    if not daily_combined:
        return StreakResult()

    current = 0
    longest = 0
    streak_start: date | None = None
    current_start: date | None = None

    for d, value in daily_combined:
        if value >= threshold:
            current += 1
            if current_start is None:
                current_start = d
            if current > longest:
                longest = current
                streak_start = current_start
        else:
            current = 0
            current_start = None

    return StreakResult(
        current=current,
        longest=longest,
        start_date=streak_start.isoformat() if streak_start else None,
    )


# ── Weekly summary ───────────────────────────────────────────────────────────

@dataclass
class DayAdherence:
    date: str
    day_type: str
    training_adherence: float
    nutrition_adherence: float
    combined_adherence: float
    exercises_completed: int
    exercises_total: int
    meals_completed: int
    meals_total: int


def compute_week_adherence(days_data: list[dict]) -> list[DayAdherence]:
    """
    Args:
        days_data: list of dicts, each with keys:
            date (str), day_type (str),
            exercise_logs (list), meal_entries (list),
            planned_count (int, optional) — exercises scheduled for that day.
    """
    result = []
    for d in days_data:
        ex_logs = d.get('exercise_logs', [])
        meal_entries = d.get('meal_entries', [])
        planned_count = d.get('planned_count')

        training = compute_training_adherence(ex_logs, d['day_type'], planned_count)
        nutrition = compute_nutrition_adherence(meal_entries)
        combined = compute_combined_adherence(training, nutrition)

        ex_completed = sum(1 for e in ex_logs if _status(e) == 'completed')
        meals_completed = sum(1 for m in meal_entries if _status(m) == 'completed')

        # Total of exercises = planned_count when known, else fall back to logs.
        ex_total = planned_count if planned_count is not None else len(ex_logs)

        result.append(DayAdherence(
            date=d['date'],
            day_type=d['day_type'],
            training_adherence=training,
            nutrition_adherence=nutrition,
            combined_adherence=combined,
            exercises_completed=ex_completed,
            exercises_total=ex_total,
            meals_completed=meals_completed,
            meals_total=len(meal_entries),
        ))
    return result


# ── Projection ───────────────────────────────────────────────────────────────

@dataclass
class ProjectionResult:
    projected_final_adherence: float
    weight_projection: float | None
    trend: str  # 'improving' | 'stable' | 'declining'
    confidence: str  # 'high' | 'medium' | 'low'
    recommendation: str


_RECOMMENDATIONS = {
    'improving': '¡Vas en la dirección correcta! Mantén el ritmo y terminarás el programa con una adherencia excelente.',
    'stable': 'Tu consistencia es buena. Un pequeño empujón en los días difíciles puede llevarte al siguiente nivel.',
    'declining': 'Los últimos días han sido más difíciles. Recuerda: un día malo no arruina el programa — vuelve hoy.',
}


def project_program_outcome(
    daily_adherences: list[float],
    days_remaining: int,
    weight_entries: list[tuple[date, float]] | None = None,
) -> ProjectionResult:
    """
    Args:
        daily_adherences: list of combined adherence per past day (floats 0-1), chronological.
        days_remaining: number of days left in the program.
        weight_entries: optional list of (date, weight_kg) sorted ascending.
    """
    n = len(daily_adherences)

    if n == 0:
        return ProjectionResult(
            projected_final_adherence=0.0,
            weight_projection=None,
            trend='stable',
            confidence='low',
            recommendation=_RECOMMENDATIONS['stable'],
        )

    # Confidence
    confidence = 'high' if n >= 14 else ('medium' if n >= 7 else 'low')

    # Rolling 7-day average as projection base
    window = daily_adherences[-7:] if n >= 7 else daily_adherences
    rolling_avg = sum(window) / len(window)

    # Trend: first half vs second half
    if n >= 4:
        mid = n // 2
        first_half = sum(daily_adherences[:mid]) / mid
        second_half = sum(daily_adherences[mid:]) / (n - mid)
        diff = second_half - first_half
        trend = 'improving' if diff > 0.05 else ('declining' if diff < -0.05 else 'stable')
    else:
        trend = 'stable'

    # Project final adherence as weighted average of past + projected remaining
    total_days = n + days_remaining
    projected_final = round(
        (sum(daily_adherences) + rolling_avg * days_remaining) / total_days, 4
    ) if total_days > 0 else rolling_avg

    # Weight projection (simple linear regression)
    weight_proj = None
    if weight_entries and len(weight_entries) >= 2:
        dates_ord = [(d - weight_entries[0][0]).days for d, _ in weight_entries]
        weights = [w for _, w in weight_entries]
        n_w = len(dates_ord)
        sx = sum(dates_ord)
        sy = sum(weights)
        sxy = sum(x * y for x, y in zip(dates_ord, weights))
        sx2 = sum(x * x for x in dates_ord)
        denom = n_w * sx2 - sx * sx
        if denom != 0:
            slope = (n_w * sxy - sx * sy) / denom
            intercept = (sy - slope * sx) / n_w
            last_x = dates_ord[-1] + days_remaining
            weight_proj = round(intercept + slope * last_x, 2)

    return ProjectionResult(
        projected_final_adherence=projected_final,
        weight_projection=weight_proj,
        trend=trend,
        confidence=confidence,
        recommendation=_RECOMMENDATIONS[trend],
    )


# ── Internal helpers ─────────────────────────────────────────────────────────

def _status(obj) -> str:
    if isinstance(obj, dict):
        return obj.get('status', '')
    return getattr(obj, 'status', '')
