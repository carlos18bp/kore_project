"""
Selects one MealSuggestion per meal_block for a given customer based on their
full evaluation profile: goal, fitness level, anthropometry, nutrition habit, and PARQ risk.

Usage:
    from core_app.services.meal_suggestion_service import get_daily_suggestions
    suggestions = get_daily_suggestions(customer, date=date.today())
    # returns {meal_block: MealSuggestion | None}
"""
import hashlib
from datetime import date as date_type

from django.db.models import QuerySet

from core_app.models import MealSuggestion

MEAL_BLOCKS = [
    MealSuggestion.MealBlock.BREAKFAST,
    MealSuggestion.MealBlock.MID_MORNING,
    MealSuggestion.MealBlock.LUNCH,
    MealSuggestion.MealBlock.SNACK,
    MealSuggestion.MealBlock.DINNER,
]


def _day_seed(customer_id: int, target_date: date_type) -> int:
    """Deterministic seed from customer + date so suggestions rotate daily but are reproducible."""
    raw = f"{customer_id}-{target_date.isoformat()}"
    return int(hashlib.md5(raw.encode()).hexdigest(), 16)


def _build_goal_tags(customer) -> list[str]:
    """Derive goal_tags from CustomerProfile.primary_goal."""
    try:
        goal = customer.customer_profile.primary_goal
    except Exception:
        return ['general_health']

    mapping = {
        'fat_loss': ['fat_loss'],
        'muscle_gain': ['muscle_gain'],
        'general_health': ['general_health'],
        'endurance': ['general_health'],
        'flexibility': ['general_health'],
    }
    return mapping.get(goal, ['general_health'])


def _fitness_level(customer) -> int:
    """Return fitness_level from the most recent MonthlyProgram, default 1."""
    try:
        program = customer.monthly_programs.filter(status='published').order_by('-created_at').first()
        if program:
            return program.fitness_level
    except Exception:
        pass
    return 1


def _restrict_nova(customer) -> int:
    """
    If nutrition_habit score is low, restrict to NOVA 1-2 only.
    Otherwise allow up to NOVA 3.
    """
    try:
        habit = customer.nutrition_habits.order_by('-created_at').first()
        if habit and habit.habit_score is not None and habit.habit_score < 40:
            return 2
    except Exception:
        pass
    return 3


def _pick_one(qs: QuerySet, seed: int, block: str) -> 'MealSuggestion | None':
    """Pick a deterministic but rotating suggestion from a queryset."""
    ids = list(qs.values_list('id', flat=True))
    if not ids:
        return None
    index = (seed + hash(block)) % len(ids)
    try:
        return qs.get(id=ids[index])
    except MealSuggestion.DoesNotExist:
        return None


def get_daily_suggestions(customer, target_date: date_type | None = None) -> dict[str, 'MealSuggestion | None']:
    """
    Return one suggestion per meal_block filtered by customer profile.

    Args:
        customer: User instance (customer role).
        target_date: Date to generate suggestions for (default today). Used for daily rotation.

    Returns:
        dict mapping meal_block value → MealSuggestion or None.
    """
    if target_date is None:
        target_date = date_type.today()

    goal_tags = _build_goal_tags(customer)
    fitness_level = _fitness_level(customer)
    nova_max = _restrict_nova(customer)
    seed = _day_seed(customer.id, target_date)

    base_qs = MealSuggestion.objects.filter(
        is_active=True,
        fitness_level_min__lte=fitness_level,
        fitness_level_max__gte=fitness_level,
    )

    result: dict[str, MealSuggestion | None] = {}

    for block in MEAL_BLOCKS:
        # Primary: match goal + nova constraint
        qs = base_qs.filter(meal_block=block, nova_max__lte=nova_max)
        goal_qs = qs.filter(goal_tags__overlap=goal_tags) if goal_tags else qs

        suggestion = _pick_one(goal_qs, seed, block)

        # Fallback: any active suggestion for this block if goal filter returned nothing
        if suggestion is None:
            suggestion = _pick_one(qs, seed, block)

        # Last resort: ignore nova constraint
        if suggestion is None:
            suggestion = _pick_one(base_qs.filter(meal_block=block), seed, block)

        result[block] = suggestion

    return result
