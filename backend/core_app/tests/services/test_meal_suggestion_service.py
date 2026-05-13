"""Tests for meal_suggestion_service.get_daily_suggestions selection logic."""
from datetime import date
from decimal import Decimal

import pytest

from core_app.models import MealSuggestion, MonthlyProgram, NutritionHabit, User
from core_app.services.meal_suggestion_service import MEAL_BLOCKS, get_daily_suggestions

FIXED_DATE = date(2026, 4, 15)


def _customer(email='cust-meal@test.com'):
    return User.objects.create_user(
        email=email, password='pass', first_name='C', last_name='M', role=User.Role.CUSTOMER,
    )


def _suggestion(*, meal_block=MealSuggestion.MealBlock.BREAKFAST, title='Avena con frutas',
                goal_tags=None, fitness_min=1, fitness_max=5, nova_max=2, is_active=True):
    return MealSuggestion.objects.create(
        title=title,
        meal_block=meal_block,
        calories_estimate=300,
        goal_tags=goal_tags if goal_tags is not None else ['general_health'],
        fitness_level_min=fitness_min,
        fitness_level_max=fitness_max,
        nova_max=nova_max,
        is_active=is_active,
    )


@pytest.mark.django_db
class TestGetDailySuggestions:
    def test_picks_one_suggestion_per_meal_block(self):
        customer = _customer()
        for block in MEAL_BLOCKS:
            _suggestion(meal_block=block, title=f'Plato {block}')

        result = get_daily_suggestions(customer, FIXED_DATE)

        assert set(result.keys()) == set(MEAL_BLOCKS)
        for block in MEAL_BLOCKS:
            assert isinstance(result[block], MealSuggestion)
            assert result[block].meal_block == block

    def test_selection_is_deterministic_for_same_customer_and_date(self):
        customer = _customer()
        _suggestion(title='A')
        _suggestion(title='B')

        first = get_daily_suggestions(customer, FIXED_DATE)
        second = get_daily_suggestions(customer, FIXED_DATE)

        assert first[MealSuggestion.MealBlock.BREAKFAST].id == second[MealSuggestion.MealBlock.BREAKFAST].id

    def test_selection_rotates_across_dates(self):
        customer = _customer()
        for i in range(6):
            _suggestion(title=f'Desayuno {i}')

        picks = {
            get_daily_suggestions(customer, date(2026, 4, d))[MealSuggestion.MealBlock.BREAKFAST].id
            for d in range(10, 17)
        }

        assert len(picks) > 1

    def test_excludes_suggestion_above_customer_fitness_level(self):
        customer = _customer()
        MonthlyProgram.objects.create(
            customer=customer, fitness_level=1, goal='general_health',
            start_date=date(2026, 4, 1), end_date=date(2026, 4, 28),
            status=MonthlyProgram.Status.PUBLISHED,
        )
        _suggestion(fitness_min=4, fitness_max=5)

        result = get_daily_suggestions(customer, FIXED_DATE)

        assert result[MealSuggestion.MealBlock.BREAKFAST] is None

    def test_restricts_to_nova_2_when_nutrition_habit_score_is_low(self):
        customer = _customer()
        habit = NutritionHabit.objects.create(
            customer=customer, meals_per_day=2, water_liters=Decimal('0.5'),
            fruit_weekly=0, vegetable_weekly=0, protein_frequency=1,
            ultraprocessed_weekly=20, sugary_drinks_weekly=20, eats_breakfast=False,
        )
        NutritionHabit.objects.filter(pk=habit.pk).update(habit_score=Decimal('30'))
        _suggestion(title='Procesado', nova_max=3)
        _suggestion(title='Natural', nova_max=2)

        result = get_daily_suggestions(customer, FIXED_DATE)

        assert result[MealSuggestion.MealBlock.BREAKFAST].nova_max <= 2

    def test_falls_back_to_any_active_suggestion_when_goal_filter_matches_nothing(self):
        customer = _customer()
        _suggestion(goal_tags=['fat_loss'])

        result = get_daily_suggestions(customer, FIXED_DATE)

        breakfast = result[MealSuggestion.MealBlock.BREAKFAST]
        assert breakfast is not None
        assert breakfast.goal_tags == ['fat_loss']

    def test_returns_none_for_block_without_any_suggestion(self):
        customer = _customer()
        _suggestion(meal_block=MealSuggestion.MealBlock.BREAKFAST)

        result = get_daily_suggestions(customer, FIXED_DATE)

        assert result[MealSuggestion.MealBlock.BREAKFAST] is not None
        assert result[MealSuggestion.MealBlock.DINNER] is None

    def test_uses_published_program_fitness_level_for_filtering(self):
        customer = _customer()
        MonthlyProgram.objects.create(
            customer=customer, fitness_level=4, goal='general_health',
            start_date=date(2026, 4, 1), end_date=date(2026, 4, 28),
            status=MonthlyProgram.Status.PUBLISHED,
        )
        _suggestion(fitness_min=4, fitness_max=5)

        result = get_daily_suggestions(customer, FIXED_DATE)

        assert result[MealSuggestion.MealBlock.BREAKFAST] is not None
