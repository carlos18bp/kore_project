"""Generate a WeeklyNutritionPlan draft for a customer.

Uses the existing meal_suggestion_service rotation to populate 7 days ×
5 meal blocks.  The trainer then reviews and publishes the plan.
"""
from datetime import timedelta
from math import floor

from core_app.models import MealSuggestion, WeeklyNutritionPlan, WeeklyPlanDay, WeeklyPlanMeal
from core_app.services.meal_suggestion_service import get_daily_suggestions

MEAL_BLOCKS = [
    MealSuggestion.MealBlock.BREAKFAST,
    MealSuggestion.MealBlock.MID_MORNING,
    MealSuggestion.MealBlock.LUNCH,
    MealSuggestion.MealBlock.SNACK,
    MealSuggestion.MealBlock.DINNER,
]


def _get_fitness_level(customer) -> int:
    cp = getattr(customer, 'customer_profile', None)
    if cp and cp.fitness_level_override is not None:
        return max(1, min(5, cp.fitness_level_override))
    eval_ = (
        customer.physical_evaluations
        .filter(general_index__isnull=False)
        .order_by('-created_at')
        .first()
    )
    if eval_ and eval_.general_index is not None:
        return max(1, min(5, floor(float(eval_.general_index) + 0.5)))
    return 1


def _next_week_start(customer) -> 'date':
    """Return Monday of the week after the latest published plan, or next Monday from today."""
    from datetime import date

    latest = (
        WeeklyNutritionPlan.objects.filter(
            customer=customer,
            status=WeeklyNutritionPlan.Status.PUBLISHED,
        )
        .order_by('-week_end')
        .first()
    )
    if latest:
        candidate = latest.week_end + timedelta(days=1)
        # Align to Monday
        days_to_monday = (7 - candidate.weekday()) % 7
        if candidate.weekday() != 0:
            candidate += timedelta(days=(7 - candidate.weekday()) % 7)
        return candidate

    today = date.today()
    days_since_monday = today.weekday()
    return today - timedelta(days=days_since_monday)


def generate_weekly_plan(customer, trainer, week_start=None) -> WeeklyNutritionPlan:
    """Create a WeeklyNutritionPlan DRAFT for the given customer.

    If week_start is None it is derived from the latest published plan + 1
    week (or the current week if no published plan exists).
    """
    if week_start is None:
        week_start = _next_week_start(customer)

    week_end = week_start + timedelta(days=27)  # 4 weeks = 28 days

    cp = getattr(customer, 'customer_profile', None)
    goal = (cp.primary_goal if cp else None) or 'general_health'
    fitness_level = _get_fitness_level(customer)

    plan = WeeklyNutritionPlan.objects.create(
        customer=customer,
        trainer=trainer,
        goal=goal,
        fitness_level=fitness_level,
        week_start=week_start,
        week_end=week_end,
    )

    for day_num in range(28):
        day_date = week_start + timedelta(days=day_num)
        plan_day = WeeklyPlanDay.objects.create(
            plan=plan,
            day_number=day_num + 1,
            date=day_date,
        )
        suggestions = get_daily_suggestions(customer, day_date)
        WeeklyPlanMeal.objects.bulk_create([
            WeeklyPlanMeal(
                plan_day=plan_day,
                meal_block=block,
                suggestion=suggestions.get(block),
                order=order,
            )
            for order, block in enumerate(MEAL_BLOCKS)
        ])

    return plan
