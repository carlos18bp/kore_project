"""Additional tests for nutrition_plan_generator — covering the missing branches.

Missing lines targeted:
  - line 32: _get_fitness_level: no PhysicalEvaluation → returns 1
  - lines 49-54: _next_week_start: existing published plan → candidate alignment to Monday

The existing test file covers: generate_weekly_plan, fitness_level_override,
primary_goal, no-profile default goal. These tests cover _get_fitness_level
without override/evaluation and _next_week_start with an existing plan.
"""

from datetime import date, timedelta

import pytest

from core_app.models import (
    MealSuggestion,
    TrainerProfile,
    User,
    WeeklyNutritionPlan,
    WeeklyPlanDay,
    WeeklyPlanMeal,
)
from core_app.services.nutrition_plan_generator import (
    MEAL_BLOCKS,
    _get_fitness_level,
    _next_week_start,
    generate_weekly_plan,
)


def _customer(email='npge-cust@test.com'):
    return User.objects.create_user(
        email=email, password='pass',
        first_name='NPG', last_name='Extra', role=User.Role.CUSTOMER,
    )


def _trainer():
    u = User.objects.create_user(
        email='npge-trainer@test.com', password='pass',
        first_name='NPG', last_name='Trainer', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, specialty='General')


# ---------------------------------------------------------------------------
# _get_fitness_level — missing branch: no PhysicalEvaluation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_get_fitness_level_returns_1_when_no_physical_evaluation():
    """Customer with no override and no PhysicalEvaluation gets fitness level 1."""
    customer = _customer()
    # Ensure no override on profile
    cp = customer.customer_profile
    cp.fitness_level_override = None
    cp.save(update_fields=['fitness_level_override'])

    level = _get_fitness_level(customer)

    assert level == 1


@pytest.mark.django_db
def test_get_fitness_level_returns_1_when_evaluation_has_null_general_index():
    """Customer with PhysicalEvaluation but general_index=None returns fitness level 1."""
    from core_app.models.physical_evaluation import PhysicalEvaluation

    customer = _customer('npge-null-idx@test.com')
    cp = customer.customer_profile
    cp.fitness_level_override = None
    cp.save(update_fields=['fitness_level_override'])

    PhysicalEvaluation.objects.create(
        customer=customer,
        general_index=None,
    )

    level = _get_fitness_level(customer)

    assert level == 1


@pytest.mark.django_db
def test_get_fitness_level_uses_general_index_when_no_override():
    """Customer with general_index=2.7 and no override returns computed level (3)."""
    from core_app.models.physical_evaluation import PhysicalEvaluation
    from math import floor

    customer = _customer('npge-idx@test.com')
    cp = customer.customer_profile
    cp.fitness_level_override = None
    cp.save(update_fields=['fitness_level_override'])

    # Create the evaluation first, then bypass save() to set general_index directly
    ev = PhysicalEvaluation.objects.create(customer=customer)
    PhysicalEvaluation.objects.filter(pk=ev.pk).update(general_index=2.7)

    level = _get_fitness_level(customer)

    expected = max(1, min(5, floor(float(2.7) + 0.5)))  # floor(3.2) = 3
    assert level == expected


# ---------------------------------------------------------------------------
# _next_week_start — missing branch: existing published plan present
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_next_week_start_returns_monday_after_existing_plan():
    """When a published plan exists, _next_week_start returns the Monday after week_end."""
    customer = _customer('npge-next@test.com')
    trainer = _trainer()

    # Create a published plan ending on a Wednesday (2026-05-06)
    week_end = date(2026, 5, 6)  # Wednesday
    WeeklyNutritionPlan.objects.create(
        customer=customer,
        trainer=trainer,
        goal='general_health',
        fitness_level=1,
        week_start=week_end - timedelta(days=27),
        week_end=week_end,
        status=WeeklyNutritionPlan.Status.PUBLISHED,
    )

    result = _next_week_start(customer)

    # candidate = week_end + 1 = Thursday 2026-05-07
    # align to next Monday: 2026-05-11
    assert result.weekday() == 0  # Monday
    assert result == date(2026, 5, 11)


@pytest.mark.django_db
def test_next_week_start_returns_same_monday_when_week_end_plus_one_is_monday():
    """When week_end + 1 day is already a Monday, that Monday is returned directly."""
    customer = _customer('npge-next-mon@test.com')
    trainer = _trainer()

    # Create plan ending on Sunday 2026-05-10
    week_end = date(2026, 5, 10)  # Sunday (weekday=6)
    WeeklyNutritionPlan.objects.create(
        customer=customer,
        trainer=trainer,
        goal='general_health',
        fitness_level=1,
        week_start=week_end - timedelta(days=27),
        week_end=week_end,
        status=WeeklyNutritionPlan.Status.PUBLISHED,
    )

    result = _next_week_start(customer)

    # candidate = 2026-05-11 (Monday) — weekday == 0, no adjustment needed
    assert result == date(2026, 5, 11)
    assert result.weekday() == 0
