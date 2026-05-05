"""
Orchestrates DB queries and calls adherence_calculator for weekly summaries and projections.
"""
from datetime import date, timedelta

from core_app.models import NutritionDailyLog
from core_app.models.monthly_program import DailyLog, MonthlyProgram, ProgramDay
from core_app.models.weight_entry import WeightEntry
from core_app.services.adherence_calculator import (
    compute_streak,
    compute_week_adherence,
    project_program_outcome,
)


def _get_active_program(user) -> MonthlyProgram | None:
    return (
        MonthlyProgram.objects
        .filter(customer=user, status=MonthlyProgram.Status.PUBLISHED)
        .order_by('-start_date')
        .first()
    )


def get_weekly_summary(user, week_number: int | None = None) -> dict:
    """
    Returns adherence data for one week of the active program.

    week_number: 1-based (1 = days 1-7, 2 = days 8-14, etc.)
                 defaults to the current week.
    """
    program = _get_active_program(user)
    if program is None:
        return None

    today = date.today()
    start = program.start_date

    if week_number is None:
        elapsed = (today - start).days
        week_number = max(1, min(4, elapsed // 7 + 1))

    week_start = start + timedelta(days=(week_number - 1) * 7)
    week_end = week_start + timedelta(days=6)

    # Fetch ProgramDays for this week
    program_days = (
        ProgramDay.objects
        .filter(program=program, date__range=(week_start, week_end))
        .prefetch_related('exercises')
        .order_by('date')
    )

    # Fetch DailyLogs and NutritionDailyLogs for this week
    daily_logs = {
        log.date: log
        for log in DailyLog.objects
        .filter(customer=user, date__range=(week_start, week_end))
        .prefetch_related('exercise_logs')
    }
    nutrition_logs = {
        log.date: log
        for log in NutritionDailyLog.objects
        .filter(customer=user, date__range=(week_start, week_end))
        .prefetch_related('meal_entries')
    }

    days_data = []
    for pd in program_days:
        dl = daily_logs.get(pd.date)
        nl = nutrition_logs.get(pd.date)
        days_data.append({
            'date': pd.date.isoformat(),
            'day_type': pd.day_type,
            'exercise_logs': list(dl.exercise_logs.all()) if dl else [],
            'meal_entries': list(nl.meal_entries.all()) if nl else [],
        })

    day_adherences = compute_week_adherence(days_data)

    # Streak over the whole program so far
    all_daily_logs = (
        DailyLog.objects
        .filter(customer=user, date__range=(start, today))
        .prefetch_related('exercise_logs')
    )
    all_nutrition_logs = {
        log.date: log
        for log in NutritionDailyLog.objects
        .filter(customer=user, date__range=(start, today))
        .prefetch_related('meal_entries')
    }
    all_program_days = (
        ProgramDay.objects
        .filter(program=program, date__range=(start, today))
        .prefetch_related('exercises')
        .order_by('date')
    )
    all_daily_map = {log.date: log for log in all_daily_logs}

    streak_data = []
    from core_app.services.adherence_calculator import compute_training_adherence, compute_nutrition_adherence, compute_combined_adherence
    for pd in all_program_days:
        dl = all_daily_map.get(pd.date)
        nl = all_nutrition_logs.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        training = compute_training_adherence(ex_logs, pd.day_type)
        nutrition = compute_nutrition_adherence(meal_entries)
        combined = compute_combined_adherence(training, nutrition)
        streak_data.append((pd.date, combined))

    streak = compute_streak(streak_data)
    week_avg = round(
        sum(d.combined_adherence for d in day_adherences) / len(day_adherences), 4
    ) if day_adherences else 0.0

    return {
        'week_number': week_number,
        'days': [
            {
                'date': d.date,
                'day_type': d.day_type,
                'training_adherence': d.training_adherence,
                'nutrition_adherence': d.nutrition_adherence,
                'combined_adherence': d.combined_adherence,
                'exercises_completed': d.exercises_completed,
                'exercises_total': d.exercises_total,
                'meals_completed': d.meals_completed,
                'meals_total': d.meals_total,
            }
            for d in day_adherences
        ],
        'week_average': week_avg,
        'streak': {
            'current': streak.current,
            'longest': streak.longest,
            'start_date': streak.start_date,
        },
    }


def get_projection(user) -> dict | None:
    program = _get_active_program(user)
    if program is None:
        return None

    today = date.today()
    start = program.start_date
    end = program.end_date
    days_remaining = max(0, (end - today).days)

    all_program_days = (
        ProgramDay.objects
        .filter(program=program, date__range=(start, today))
        .prefetch_related('exercises')
        .order_by('date')
    )
    daily_logs_map = {
        log.date: log
        for log in DailyLog.objects
        .filter(customer=user, date__range=(start, today))
        .prefetch_related('exercise_logs')
    }
    nutrition_logs_map = {
        log.date: log
        for log in NutritionDailyLog.objects
        .filter(customer=user, date__range=(start, today))
        .prefetch_related('meal_entries')
    }

    from core_app.services.adherence_calculator import compute_training_adherence, compute_nutrition_adherence, compute_combined_adherence
    daily_adherences = []
    for pd in all_program_days:
        dl = daily_logs_map.get(pd.date)
        nl = nutrition_logs_map.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        training = compute_training_adherence(ex_logs, pd.day_type)
        nutrition = compute_nutrition_adherence(meal_entries)
        daily_adherences.append(compute_combined_adherence(training, nutrition))

    weight_entries_qs = (
        WeightEntry.objects
        .filter(user=user, date__range=(start, today))
        .order_by('date')
        .values_list('date', 'weight_kg')
    )
    weight_entries = [(d, float(w)) for d, w in weight_entries_qs]

    result = project_program_outcome(daily_adherences, days_remaining, weight_entries or None)

    return {
        'projected_final_adherence': result.projected_final_adherence,
        'weight_projection': result.weight_projection,
        'trend': result.trend,
        'confidence': result.confidence,
        'recommendation': result.recommendation,
        'days_elapsed': len(daily_adherences),
        'days_remaining': days_remaining,
    }
