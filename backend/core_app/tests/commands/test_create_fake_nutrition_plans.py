"""Tests for the create_fake_nutrition_plans management command."""

from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import (
    MealSuggestion,
    NutritionWeekNote,
    TrainerProfile,
    User,
    WeeklyNutritionPlan,
    WeeklyPlanMeal,
)


@pytest.fixture
def two_customers_with_trainer_and_suggestions(db):
    """Two customers, one trainer, and a meal-suggestion catalog."""
    User.objects.create_user(
        email='np-c1@test.com', password='p',
        first_name='C1', last_name='Plan', role=User.Role.CUSTOMER,
    )
    User.objects.create_user(
        email='np-c2@test.com', password='p',
        first_name='C2', last_name='Plan', role=User.Role.CUSTOMER,
    )
    trainer_user = User.objects.create_user(
        email='np-trainer@test.com', password='p',
        first_name='T', last_name='Plan', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=trainer_user, location='Gym Plan')
    for block in MealSuggestion.MealBlock.values:
        MealSuggestion.objects.create(
            title=f'Plato {block}', meal_block=block, calories_estimate=350,
            goal_tags=['general_health'], fitness_level_min=1, fitness_level_max=5, nova_max=2,
        )


@pytest.mark.django_db
class TestCreateFakeNutritionPlans:
    """Validates fake weekly nutrition-plan creation outcomes and command options."""

    def test_creates_one_published_plan_per_customer(self, two_customers_with_trainer_and_suggestions):
        """Default run creates exactly one published plan for each customer."""
        call_command('create_fake_nutrition_plans', stdout=StringIO())

        assert WeeklyNutritionPlan.objects.count() == 2
        assert list(WeeklyNutritionPlan.objects.values_list('status', flat=True)) == [
            WeeklyNutritionPlan.Status.PUBLISHED,
            WeeklyNutritionPlan.Status.PUBLISHED,
        ]

    def test_plan_spans_twenty_eight_days(self, two_customers_with_trainer_and_suggestions):
        """Each generated plan has 28 plan days."""
        call_command('create_fake_nutrition_plans', stdout=StringIO())

        plan = WeeklyNutritionPlan.objects.first()
        assert plan.days.count() == 28

    def test_plan_has_five_meals_per_day(self, two_customers_with_trainer_and_suggestions):
        """Each plan carries five meal slots for every one of its 28 days."""
        call_command('create_fake_nutrition_plans', stdout=StringIO())

        plan = WeeklyNutritionPlan.objects.first()
        assert WeeklyPlanMeal.objects.filter(plan_day__plan=plan).count() == 28 * 5

    def test_creates_four_week_notes_per_customer(self, two_customers_with_trainer_and_suggestions):
        """Each customer gets one nutrition note for each of the four cycle weeks."""
        call_command('create_fake_nutrition_plans', stdout=StringIO())

        assert NutritionWeekNote.objects.count() == 8
        customer = User.objects.get(email='np-c1@test.com')
        week_numbers = sorted(
            NutritionWeekNote.objects.filter(customer=customer).values_list('week_number', flat=True)
        )
        assert week_numbers == [1, 2, 3, 4]

    def test_rerun_does_not_duplicate_plans(self, two_customers_with_trainer_and_suggestions):
        """A second run skips customers that already own a plan."""
        call_command('create_fake_nutrition_plans', stdout=StringIO())
        call_command('create_fake_nutrition_plans', stdout=StringIO())

        assert WeeklyNutritionPlan.objects.count() == 2

    def test_warns_when_meal_suggestion_catalog_is_empty(self, db):
        """Command warns and creates nothing when no meal suggestions exist."""
        User.objects.create_user(email='np-nocat@test.com', password='p', role=User.Role.CUSTOMER)
        trainer_user = User.objects.create_user(
            email='np-trainer2@test.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=trainer_user, location='Gym')
        out = StringIO()
        call_command('create_fake_nutrition_plans', stdout=out)

        assert WeeklyNutritionPlan.objects.count() == 0
        assert 'No active meal suggestions found' in out.getvalue()
