"""
Behavioral alert detection for the Trainer Intelligence Center.

Pure functions detect individual risk signals from pre-fetched data.
compute_behavioral_signals() is the ORM orchestrator that assembles everything.
"""
from __future__ import annotations

from datetime import date, timedelta

PAIN_KEYWORDS = ('dolor', 'molestia', 'lesión', 'lesion', 'duele', 'duelen', 'lastimé', 'lastime')


# ── Pure signal detectors ────────────────────────────────────────────────────

def detect_inactivity(last_completed_date: date | None, today: date) -> dict | None:
    """Returns a signal if the customer has not completed any exercise in 7+ days."""
    if last_completed_date is None:
        return {
            'type': 'inactivity_14d',
            'label': 'Sin actividad registrada',
            'severity': 'medio',
            'detail': 'El cliente no tiene ejercicios completados.',
            'since_date': None,
        }
    days_since = (today - last_completed_date).days
    if days_since >= 14:
        return {
            'type': 'inactivity_14d',
            'label': f'Sin actividad hace {days_since} días',
            'severity': 'alto',
            'detail': f'Último ejercicio completado: {last_completed_date.isoformat()}',
            'since_date': last_completed_date.isoformat(),
        }
    if days_since >= 7:
        return {
            'type': 'inactivity_7d',
            'label': f'Sin actividad hace {days_since} días',
            'severity': 'medio',
            'detail': f'Último ejercicio completado: {last_completed_date.isoformat()}',
            'since_date': last_completed_date.isoformat(),
        }
    return None


def detect_low_adherence_sustained(
    daily_combined: list[tuple[date, float]],
    window: int = 14,
) -> dict | None:
    """Returns a signal if combined adherence averaged below 0.40 over the last N days."""
    if not daily_combined:
        return None
    recent = [v for _, v in daily_combined[-window:]]
    if not recent:
        return None
    avg = sum(recent) / len(recent)
    if avg < 0.25:
        return {
            'type': 'low_adherence_sustained',
            'label': f'Adherencia muy baja: {round(avg * 100)}% en {len(recent)}d',
            'severity': 'alto',
            'detail': f'Promedio combinado últimos {len(recent)} días: {round(avg * 100, 1)}%',
            'since_date': daily_combined[-window][0].isoformat() if len(daily_combined) >= window else daily_combined[0][0].isoformat(),
        }
    if avg < 0.40:
        return {
            'type': 'low_adherence_sustained',
            'label': f'Adherencia baja: {round(avg * 100)}% en {len(recent)}d',
            'severity': 'medio',
            'detail': f'Promedio combinado últimos {len(recent)} días: {round(avg * 100, 1)}%',
            'since_date': daily_combined[-window][0].isoformat() if len(daily_combined) >= window else daily_combined[0][0].isoformat(),
        }
    return None


def detect_recurring_pain(mood_notes: list[tuple[date, str]]) -> dict | None:
    """Returns a signal if pain keywords appear in 2+ of the last 7 mood entries."""
    recent = mood_notes[-7:] if len(mood_notes) > 7 else mood_notes
    pain_dates = [
        d.isoformat()
        for d, note in recent
        if any(kw in note.lower() for kw in PAIN_KEYWORDS)
    ]
    if len(pain_dates) >= 2:
        return {
            'type': 'recurring_pain',
            'label': f'Dolor mencionado {len(pain_dates)} veces en 7 entradas',
            'severity': 'medio',
            'detail': f'Menciones de dolor en: {", ".join(pain_dates)}',
            'since_date': pain_dates[0],
        }
    return None


def detect_consecutive_absences(
    daily_logs_by_date: dict,
    program_days_sorted: list,
    threshold: int = 3,
) -> dict | None:
    """
    Returns a signal if the last `threshold` program days all have no completed exercises.

    program_days_sorted: list of ProgramDay objects ordered by date ascending.
    daily_logs_by_date: {date: DailyLog} mapping.
    """
    if len(program_days_sorted) < threshold:
        return None

    last_days = program_days_sorted[-threshold:]
    absent_count = 0
    for pd in last_days:
        dl = daily_logs_by_date.get(pd.date)
        if pd.day_type == 'rest':
            continue
        if dl is None:
            absent_count += 1
            continue
        ex_logs = list(dl.exercise_logs.all()) if hasattr(dl, 'exercise_logs') else []
        completed = sum(1 for e in ex_logs if e.status == 'completed')
        if completed == 0:
            absent_count += 1

    if absent_count >= threshold:
        since = last_days[0].date
        return {
            'type': 'consecutive_absences',
            'label': f'{absent_count} días consecutivos sin entrenamiento',
            'severity': 'alto' if absent_count >= 5 else 'medio',
            'detail': f'Sin entrenamientos completados desde {since.isoformat()}',
            'since_date': since.isoformat(),
        }
    return None


def detect_unachieved_milestone(
    program_start: date,
    today: date,
    daily_adherences: list[float],
) -> dict | None:
    """
    At day 14+ (week 2), signals if current avg adherence < 0.50 and projected < 0.60.
    Uses simple rolling average as projection base.
    """
    elapsed = (today - program_start).days
    if elapsed < 14 or not daily_adherences:
        return None

    avg = sum(daily_adherences) / len(daily_adherences)
    if avg < 0.50:
        return {
            'type': 'unachieved_milestone',
            'label': f'Adherencia acumulada baja: {round(avg * 100)}%',
            'severity': 'medio',
            'detail': f'A {elapsed} días del programa, la adherencia acumulada es {round(avg * 100, 1)}%',
            'since_date': program_start.isoformat(),
        }
    return None


# ── ORM orchestrator ─────────────────────────────────────────────────────────

def compute_behavioral_signals(customer, trainer, today: date) -> list[dict]:
    """
    Queries DB for a single customer and returns a list of behavioral signal dicts.
    Signals that are None are excluded from the result.
    """
    from core_app.models.monthly_program import DailyLog, MonthlyProgram, ProgramDay
    from core_app.models import MoodEntry, NutritionDailyLog
    from core_app.services.adherence_calculator import (
        compute_combined_adherence,
        compute_nutrition_adherence,
        compute_training_adherence,
    )

    signals: list[dict] = []

    # Active program
    program = (
        MonthlyProgram.objects
        .filter(customer=customer, status=MonthlyProgram.Status.PUBLISHED)
        .order_by('-start_date')
        .first()
    )
    if program is None:
        return signals

    window_start = program.start_date
    window_end = today

    # Fetch last 14 days of DailyLog with exercise_logs
    daily_logs_qs = (
        DailyLog.objects
        .filter(customer=customer, date__range=(window_start, window_end))
        .prefetch_related('exercise_logs')
        .order_by('date')
    )
    daily_logs_by_date = {log.date: log for log in daily_logs_qs}

    # Last completed exercise date for inactivity detection
    last_completed: date | None = None
    for log in sorted(daily_logs_by_date.values(), key=lambda l: l.date, reverse=True):
        ex_logs = list(log.exercise_logs.all())
        if any(e.status == 'completed' for e in ex_logs):
            last_completed = log.date
            break

    signal = detect_inactivity(last_completed, today)
    if signal:
        signals.append(signal)

    # Build daily combined adherence list (last 14 days)
    program_days_qs = (
        ProgramDay.objects
        .filter(program=program, date__range=(window_start, window_end))
        .prefetch_related('exercises')
        .order_by('date')
    )
    nutrition_logs = {
        log.date: log
        for log in NutritionDailyLog.objects
        .filter(customer=customer, date__range=(window_start, window_end))
        .prefetch_related('meal_entries')
    }

    daily_combined: list[tuple[date, float]] = []
    daily_adherences: list[float] = []
    program_days_list = list(program_days_qs)

    for pd in program_days_list:
        dl = daily_logs_by_date.get(pd.date)
        nl = nutrition_logs.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        training = compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
        nutrition = compute_nutrition_adherence(meal_entries)
        combined = compute_combined_adherence(training, nutrition)
        daily_combined.append((pd.date, combined))
        daily_adherences.append(combined)

    signal = detect_low_adherence_sustained(daily_combined)
    if signal:
        signals.append(signal)

    # Consecutive absences (last 5 program days)
    recent_program_days = program_days_list[-5:] if len(program_days_list) >= 5 else program_days_list
    signal = detect_consecutive_absences(daily_logs_by_date, recent_program_days, threshold=3)
    if signal:
        signals.append(signal)

    # Unachieved milestone
    signal = detect_unachieved_milestone(program.start_date, today, daily_adherences)
    if signal:
        signals.append(signal)

    # Recurring pain from mood notes (last 14 entries)
    mood_notes = list(
        MoodEntry.objects
        .filter(user=customer, date__range=(today - timedelta(days=14), today))
        .order_by('date')
        .values_list('date', 'notes')
    )
    signal = detect_recurring_pain(mood_notes)
    if signal:
        signals.append(signal)

    return signals
