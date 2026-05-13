"""Tests for nutrition_plan_generator.generate_weekly_plan."""
from datetime import date, timedelta

import pytest

from core_app.models import (
    MealSuggestion,
    TrainerProfile,
    User,
    WeeklyNutritionPlan,
    WeeklyPlanMeal,
)
from core_app.services.nutrition_plan_generator import MEAL_BLOCKS, generate_weekly_plan

MONDAY = date(2026, 4, 6)


def _customer(email='cust-plan@test.com'):
    return User.objects.create_user(
        email=email, password='pass', first_name='C', last_name='P', role=User.Role.CUSTOMER,
    )


def _trainer():
    user = User.objects.create_user(
        email='trainer-plan@test.com', password='pass', first_name='T', last_name='P', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, specialty='General')


def _seed_suggestions():
    for block in MEAL_BLOCKS:
        MealSuggestion.objects.create(
            title=f'Plato {block}', meal_block=block, calories_estimate=300,
            goal_tags=['general_health'], fitness_level_min=1, fitness_level_max=5, nova_max=2,
        )


@pytest.mark.django_db
class TestGenerateWeeklyPlan:
    def test_creates_draft_plan_with_28_days_and_five_meals_each(self):
        customer, trainer = _customer(), _trainer()
        _seed_suggestions()

        plan = generate_weekly_plan(customer, trainer, week_start=MONDAY)

        assert plan.status == WeeklyNutritionPlan.Status.DRAFT
        assert plan.customer == customer
        assert plan.trainer == trainer
        assert plan.days.count() == 28
        first_day = plan.days.order_by('day_number').first()
        assert list(first_day.meals.order_by('order').values_list('meal_block', flat=True)) == list(MEAL_BLOCKS)
        assert WeeklyPlanMeal.objects.filter(plan_day__plan=plan).count() == 28 * 5

    def test_week_end_is_27_days_after_week_start(self):
        customer, trainer = _customer(), _trainer()

        plan = generate_weekly_plan(customer, trainer, week_start=date(2026, 5, 4))

        assert plan.week_end == date(2026, 5, 4) + timedelta(days=27)

    def test_derives_week_start_to_a_monday_when_not_given(self):
        customer, trainer = _customer(), _trainer()

        plan = generate_weekly_plan(customer, trainer)

        assert plan.week_start.weekday() == 0
        assert plan.week_start <= date.today()

    def test_uses_fitness_level_override_from_customer_profile(self):
        customer, trainer = _customer(), _trainer()
        cp = customer.customer_profile
        cp.fitness_level_override = 4
        cp.save(update_fields=['fitness_level_override'])

        plan = generate_weekly_plan(customer, trainer, week_start=MONDAY)

        assert plan.fitness_level == 4

    def test_uses_customer_primary_goal_when_set(self):
        customer, trainer = _customer(), _trainer()
        cp = customer.customer_profile
        cp.primary_goal = 'muscle_gain'
        cp.save(update_fields=['primary_goal'])

        plan = generate_weekly_plan(customer, trainer, week_start=MONDAY)

        assert plan.goal == 'muscle_gain'

    def test_goal_defaults_to_general_health_without_profile(self):
        customer, trainer = _customer(), _trainer()

        plan = generate_weekly_plan(customer, trainer, week_start=MONDAY)

        assert plan.goal == 'general_health'
