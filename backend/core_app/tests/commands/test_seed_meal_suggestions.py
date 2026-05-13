"""Tests for the seed_meal_suggestions management command."""
from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import MealSuggestion


@pytest.mark.django_db
class TestSeedMealSuggestions:
    def test_seeds_meal_suggestions(self):
        out = StringIO()

        call_command('seed_meal_suggestions', stdout=out)

        assert MealSuggestion.objects.count() > 0
        assert MealSuggestion.objects.filter(meal_block='desayuno').exists()

    def test_rerun_does_not_duplicate_by_title_and_block(self):
        out = StringIO()
        call_command('seed_meal_suggestions', stdout=out)
        first_count = MealSuggestion.objects.count()

        call_command('seed_meal_suggestions', stdout=out)

        assert MealSuggestion.objects.count() == first_count

    def test_output_reports_created_count(self):
        out = StringIO()

        call_command('seed_meal_suggestions', stdout=out)

        message = out.getvalue()
        assert 'created' in message
        assert str(MealSuggestion.objects.count()) in message
