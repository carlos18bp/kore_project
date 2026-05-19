"""Tests for the seed_meal_suggestions management command."""
import csv
import os
import tempfile
from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import MealSuggestion
from core_app.models.food import Food


CSV_HEADER = [
    'title', 'meal_block', 'description', 'calories_estimate',
    'goal_tags', 'fitness_level_min', 'fitness_level_max', 'nova_max', 'foods',
]

SAMPLE_ROWS = [
    {
        'title': 'Arepa con huevo y aguacate',
        'meal_block': 'desayuno',
        'description': 'Arepa de maiz con huevo y aguacate',
        'calories_estimate': '380',
        'goal_tags': 'general_health|muscle_gain',
        'fitness_level_min': '1',
        'fitness_level_max': '5',
        'nova_max': '2',
        'foods': 'Huevo, de gallina, entero, crudo|Aguacate, crudo',
    },
    {
        'title': 'Avena con leche y banano',
        'meal_block': 'desayuno',
        'description': 'Avena en leche con banano',
        'calories_estimate': '350',
        'goal_tags': 'general_health|fat_loss',
        'fitness_level_min': '1',
        'fitness_level_max': '5',
        'nova_max': '2',
        'foods': 'Avena, hojuelas, cruda|Leche, de vaca, integral|Banano, Manzana, cruda',
    },
    {
        'title': 'Mango y maracuya frescos',
        'meal_block': 'media_manana',
        'description': 'Porcion de mango con maracuya',
        'calories_estimate': '120',
        'goal_tags': 'general_health|fat_loss',
        'fitness_level_min': '1',
        'fitness_level_max': '5',
        'nova_max': '1',
        'foods': 'Mango, Tommy Atkins, cruda',
    },
]


def _write_csv(path, rows):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADER)
        writer.writeheader()
        writer.writerows(rows)


def _create_foods():
    food_data = [
        ('Huevo, de gallina, entero, crudo', Food.Category.PROTEIN),
        ('Aguacate, crudo', Food.Category.HEALTHY_FAT),
        ('Avena, hojuelas, cruda', Food.Category.CARB),
        ('Leche, de vaca, integral', Food.Category.DAIRY),
        ('Banano, Manzana, cruda', Food.Category.FRUIT),
        ('Mango, Tommy Atkins, cruda', Food.Category.FRUIT),
    ]
    for name, category in food_data:
        Food.objects.get_or_create(name=name, defaults={'category': category})


@pytest.mark.django_db
class TestSeedMealSuggestions:
    def test_seeds_suggestions_from_csv(self, tmp_path):
        _create_foods()
        csv_path = str(tmp_path / 'test_meals.csv')
        _write_csv(csv_path, SAMPLE_ROWS)
        out = StringIO()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out)

        assert MealSuggestion.objects.count() == 3
        assert MealSuggestion.objects.filter(meal_block='desayuno').count() == 2
        assert MealSuggestion.objects.filter(meal_block='media_manana').count() == 1
        assert 'created' in out.getvalue()

    def test_m2m_foods_linked(self, tmp_path):
        _create_foods()
        csv_path = str(tmp_path / 'test_meals.csv')
        _write_csv(csv_path, SAMPLE_ROWS)
        out = StringIO()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out)

        arepa = MealSuggestion.objects.get(title='Arepa con huevo y aguacate', meal_block='desayuno')
        assert arepa.foods.count() == 2

        avena = MealSuggestion.objects.get(title='Avena con leche y banano', meal_block='desayuno')
        assert avena.foods.count() == 3

    def test_idempotent_rerun_does_not_duplicate(self, tmp_path):
        _create_foods()
        csv_path = str(tmp_path / 'test_meals.csv')
        _write_csv(csv_path, SAMPLE_ROWS)
        out = StringIO()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out)
        first_count = MealSuggestion.objects.count()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out)

        assert MealSuggestion.objects.count() == first_count
        second_output = out.getvalue()
        assert '0 created' in second_output

    def test_missing_food_reported_as_warning(self, tmp_path):
        _create_foods()
        rows_with_missing = [
            {
                'title': 'Plato con ingrediente raro',
                'meal_block': 'cena',
                'description': 'Test',
                'calories_estimate': '300',
                'goal_tags': 'general_health',
                'fitness_level_min': '1',
                'fitness_level_max': '5',
                'nova_max': '2',
                'foods': 'Aguacate, crudo|Ingrediente Inexistente XYZ',
            },
        ]
        csv_path = str(tmp_path / 'test_missing.csv')
        _write_csv(csv_path, rows_with_missing)
        out = StringIO()
        err = StringIO()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out, stderr=err)

        suggestion = MealSuggestion.objects.get(title='Plato con ingrediente raro')
        assert suggestion.foods.count() == 1
        assert 'Ingrediente Inexistente XYZ' in err.getvalue()

    def test_goal_tags_stored_correctly(self, tmp_path):
        _create_foods()
        csv_path = str(tmp_path / 'test_meals.csv')
        _write_csv(csv_path, SAMPLE_ROWS)
        out = StringIO()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out)

        arepa = MealSuggestion.objects.get(title='Arepa con huevo y aguacate', meal_block='desayuno')
        assert set(arepa.goal_tags) == {'general_health', 'muscle_gain'}

    def test_output_reports_total_rows(self, tmp_path):
        _create_foods()
        csv_path = str(tmp_path / 'test_meals.csv')
        _write_csv(csv_path, SAMPLE_ROWS)
        out = StringIO()

        call_command('seed_meal_suggestions', '--csv', csv_path, stdout=out)

        message = out.getvalue()
        assert 'total_rows=3' in message
