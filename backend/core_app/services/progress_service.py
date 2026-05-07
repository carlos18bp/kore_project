"""
Orchestrates DB queries and calls adherence_calculator for weekly summaries and projections.
"""
from datetime import date, timedelta

from core_app.models import (
    AnthropometryEvaluation,
    MoodEntry,
    NutritionDailyLog,
    PhysicalEvaluation,
)
from core_app.models.monthly_program import DailyLog, MonthlyProgram, ProgramDay
from core_app.models.weight_entry import WeightEntry
from core_app.services.adherence_calculator import (
    compute_combined_adherence,
    compute_nutrition_adherence,
    compute_streak,
    compute_training_adherence,
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
            'planned_count': len(pd.exercises.all()),
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
    for pd in all_program_days:
        dl = all_daily_map.get(pd.date)
        nl = all_nutrition_logs.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        training = compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
        nutrition = compute_nutrition_adherence(meal_entries)
        combined = compute_combined_adherence(training, nutrition)
        streak_data.append((pd.date, combined))

    streak = compute_streak(streak_data)

    today_iso = today.isoformat()
    elapsed_days = [d for d in day_adherences if d.date <= today_iso]
    week_avg = round(
        sum(d.combined_adherence for d in elapsed_days) / len(elapsed_days), 4
    ) if elapsed_days else 0.0

    return {
        'week_number': week_number,
        'days': [
            {
                'date': d.date,
                'day_type': d.day_type,
                'is_future': d.date > today_iso,
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

    daily_adherences = []
    for pd in all_program_days:
        dl = daily_logs_map.get(pd.date)
        nl = nutrition_logs_map.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        training = compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
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


def get_monthly_summary(user, program_id: int | None = None) -> dict | None:
    """
    Returns a comparative summary for a completed or active program.
    Compares evaluations just before the program vs most recent within/after the program.
    """
    if program_id:
        program = MonthlyProgram.objects.filter(pk=program_id, customer=user).first()
    else:
        program = (
            MonthlyProgram.objects
            .filter(customer=user, status__in=[MonthlyProgram.Status.PUBLISHED, MonthlyProgram.Status.COMPLETED])
            .order_by('-start_date')
            .first()
        )
    if not program:
        return None

    start = program.start_date
    end = program.end_date
    today = date.today()

    # --- Adherence over the whole program ---
    all_program_days = (
        ProgramDay.objects
        .filter(program=program, date__lte=min(end, today))
        .prefetch_related('exercises')
        .order_by('date')
    )
    daily_logs_map = {
        log.date: log
        for log in DailyLog.objects
        .filter(customer=user, date__range=(start, min(end, today)))
        .prefetch_related('exercise_logs')
    }
    nutrition_logs_map = {
        log.date: log
        for log in NutritionDailyLog.objects
        .filter(customer=user, date__range=(start, min(end, today)))
        .prefetch_related('meal_entries')
    }
    training_total, nutrition_total, days_count = 0.0, 0.0, 0
    for pd in all_program_days:
        dl = daily_logs_map.get(pd.date)
        nl = nutrition_logs_map.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        training_total += compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
        nutrition_total += compute_nutrition_adherence(meal_entries)
        days_count += 1

    overall_training = round(training_total / days_count, 4) if days_count else 0.0
    overall_nutrition = round(nutrition_total / days_count, 4) if days_count else 0.0
    overall_combined = compute_combined_adherence(overall_training, overall_nutrition)

    # --- Anthropometry comparison: last eval before start vs last eval on or after start ---
    def _anthro_snapshot(qs_filter):
        eval_ = AnthropometryEvaluation.objects.filter(customer=user, **qs_filter).order_by('-evaluation_date').first()
        if not eval_:
            return None
        return {
            'bmi': float(eval_.bmi) if eval_.bmi else None,
            'body_fat_pct': float(eval_.body_fat_pct) if eval_.body_fat_pct else None,
        }

    anthro_before = _anthro_snapshot({'evaluation_date__lt': start})
    anthro_after = _anthro_snapshot({'evaluation_date__gte': start})

    # --- Physical evaluation comparison ---
    def _physical_snapshot(qs_filter):
        eval_ = PhysicalEvaluation.objects.filter(customer=user, **qs_filter).order_by('-evaluation_date').first()
        return float(eval_.general_index) if eval_ and eval_.general_index else None

    physical_before = _physical_snapshot({'evaluation_date__lt': start})
    physical_after = _physical_snapshot({'evaluation_date__gte': start})

    # --- Weight trend ---
    weights = list(
        WeightEntry.objects
        .filter(user=user, date__range=(start, end))
        .order_by('date')
        .values_list('weight_kg', flat=True)
    )
    weight_start = float(weights[0]) if weights else None
    weight_end = float(weights[-1]) if len(weights) > 1 else None
    weight_delta = round(weight_end - weight_start, 2) if weight_start and weight_end else None

    # --- Mood: first week vs last week ---
    first_week_end = start + timedelta(days=6)
    last_week_start = end - timedelta(days=6)

    def _mood_avg(date_from, date_to):
        entries = list(
            MoodEntry.objects
            .filter(user=user, date__range=(date_from, date_to))
            .values_list('score', flat=True)
        )
        return round(sum(entries) / len(entries), 1) if entries else None

    mood_first = _mood_avg(start, first_week_end)
    mood_last = _mood_avg(last_week_start, end)

    # --- Best streak ---
    streak_data = []
    for pd in all_program_days:
        dl = daily_logs_map.get(pd.date)
        nl = nutrition_logs_map.get(pd.date)
        ex_logs = list(dl.exercise_logs.all()) if dl else []
        meal_entries = list(nl.meal_entries.all()) if nl else []
        t = compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
        n = compute_nutrition_adherence(meal_entries)
        streak_data.append((pd.date, compute_combined_adherence(t, n)))
    streak = compute_streak(streak_data)

    return {
        'program_id': program.pk,
        'start_date': start.isoformat(),
        'end_date': end.isoformat(),
        'overall_adherence': overall_combined,
        'training_adherence': overall_training,
        'nutrition_adherence': overall_nutrition,
        'comparisons': {
            'bmi': {
                'before': anthro_before['bmi'] if anthro_before else None,
                'after': anthro_after['bmi'] if anthro_after else None,
                'delta': round(anthro_after['bmi'] - anthro_before['bmi'], 2) if anthro_before and anthro_after and anthro_before['bmi'] and anthro_after['bmi'] else None,
            },
            'body_fat_pct': {
                'before': anthro_before['body_fat_pct'] if anthro_before else None,
                'after': anthro_after['body_fat_pct'] if anthro_after else None,
                'delta': round(anthro_after['body_fat_pct'] - anthro_before['body_fat_pct'], 2) if anthro_before and anthro_after and anthro_before['body_fat_pct'] and anthro_after['body_fat_pct'] else None,
            },
            'physical_index': {
                'before': physical_before,
                'after': physical_after,
                'delta': round(physical_after - physical_before, 2) if physical_before is not None and physical_after is not None else None,
            },
        },
        'mood': {'first_week': mood_first, 'last_week': mood_last},
        'weight': {'start': weight_start, 'end': weight_end, 'delta': weight_delta},
        'streak_best': streak.longest,
    }
