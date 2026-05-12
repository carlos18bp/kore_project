"""Tests for the link_meal_foods management command."""
from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import MealSuggestion
from core_app.models.food import Food

# Title + foods taken verbatim from link_meal_foods.MEAL_FOOD_MAP.
SUGGESTION_TITLE = 'Banano con maní'
FOOD_NAMES = ['Banano, Manzana, cruda', 'Maní, tostado, salado']


def _setup_suggestion_and_foods():
    suggestion = MealSuggestion.objects.create(
        title=SUGGESTION_TITLE, meal_block='media_manana', calories_estimate=200,
    )
    for name in FOOD_NAMES:
        Food.objects.create(name=name, category=Food.Category.SNACK)
    return suggestion


@pytest.mark.django_db
class TestLinkMealFoods:
    def test_links_existing_foods_to_suggestion(self):
        suggestion = _setup_suggestion_and_foods()
        out = StringIO()

        call_command('link_meal_foods', stdout=out)

        assert set(suggestion.foods.values_list('name', flat=True)) == set(FOOD_NAMES)

    def test_dry_run_does_not_persist_links(self):
        suggestion = _setup_suggestion_and_foods()
        out = StringIO()

        call_command('link_meal_foods', '--dry-run', stdout=out)

        assert suggestion.foods.count() == 0
