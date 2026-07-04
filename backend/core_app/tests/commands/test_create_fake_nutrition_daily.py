"""Tests for the create_fake_nutrition_daily management command."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import (
    MealEntry,
    MealSuggestion,
    NutritionDailyLog,
    User,
    WaterGlassLog,
)


@pytest.fixture
def two_customers_with_suggestions(db):
    """Two customers and a small meal-suggestion catalog."""
    User.objects.create_user(
        email='nd-c1@test.com', password='p',
        first_name='C1', last_name='Nutri', role=User.Role.CUSTOMER,
    )
    User.objects.create_user(
        email='nd-c2@test.com', password='p',
        first_name='C2', last_name='Nutri', role=User.Role.CUSTOMER,
    )
    for block in MealSuggestion.MealBlock.values:
        MealSuggestion.objects.create(
            title=f'Plato {block}', meal_block=block, calories_estimate=350,
            goal_tags=['general_health'], fitness_level_min=1, fitness_level_max=5, nova_max=2,
        )


@pytest.mark.django_db
class TestCreateFakeNutritionDaily:
    """Validates fake daily-nutrition creation outcomes and command options."""

    def test_creates_one_daily_log_per_requested_day(self, two_customers_with_suggestions):
        """Three requested days produce three daily logs for each customer."""
        call_command('create_fake_nutrition_daily', days=3, seed=1, stdout=StringIO())

        assert NutritionDailyLog.objects.count() == 6

    def test_creates_five_meal_entries_per_daily_log(self, two_customers_with_suggestions):
        """Each daily log gets one meal entry for each of the five meal blocks."""
        call_command('create_fake_nutrition_daily', days=2, seed=1, stdout=StringIO())

        daily_log = NutritionDailyLog.objects.first()
        assert daily_log.meal_entries.count() == 5
        assert MealEntry.objects.count() == 2 * 2 * 5

    def test_links_meal_entries_to_matching_block_suggestion(self, two_customers_with_suggestions):
        """A meal entry references a suggestion whose meal_block matches the entry."""
        call_command('create_fake_nutrition_daily', days=1, seed=1, stdout=StringIO())

        entry = MealEntry.objects.exclude(suggestion=None).first()
        assert entry is not None
        assert entry.suggestion.meal_block == entry.meal_block

    def test_creates_water_glasses_for_each_day(self, two_customers_with_suggestions):
        """Every daily log gets at least the minimum number of water glasses."""
        call_command('create_fake_nutrition_daily', days=1, seed=1, stdout=StringIO())

        daily_log = NutritionDailyLog.objects.first()
        assert daily_log.water_glasses.count() >= 3
        assert WaterGlassLog.objects.exists()

    def test_marks_past_days_as_closed(self, two_customers_with_suggestions):
        """Daily logs before today are marked closed; today's log stays open."""
        call_command('create_fake_nutrition_daily', days=2, seed=1, stdout=StringIO())

        today = timezone.localdate()
        assert not NutritionDailyLog.objects.filter(date__lt=today, is_closed=False).exists()
        assert NutritionDailyLog.objects.filter(date=today, is_closed=False).exists()

    def test_rerun_does_not_duplicate_daily_logs(self, two_customers_with_suggestions):
        """A second run reuses existing logs instead of duplicating them."""
        call_command('create_fake_nutrition_daily', days=3, seed=1, stdout=StringIO())
        call_command('create_fake_nutrition_daily', days=3, seed=1, stdout=StringIO())

        assert NutritionDailyLog.objects.count() == 6
        assert MealEntry.objects.count() == 6 * 5
