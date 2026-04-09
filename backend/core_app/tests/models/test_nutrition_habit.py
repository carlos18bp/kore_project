"""Tests for NutritionHabit model save logic."""

from decimal import Decimal

import pytest

from core_app.models import User
from core_app.models.nutrition_habit import NutritionHabit


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='nutri-customer@test.com', password='p',
        first_name='Customer', last_name='Nutri', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestNutritionHabitSave:
    """Validates save() auto-computes habit_score from raw habit fields."""

    def test_save_computes_habit_score(self, customer):
        """Save auto-computes habit_score from the 8 dietary inputs."""
        ev = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=4,
            water_liters=Decimal('2.5'),
            fruit_weekly=14,
            vegetable_weekly=14,
            protein_frequency=4,
            ultraprocessed_weekly=2,
            sugary_drinks_weekly=1,
            eats_breakfast=True,
        )
        assert ev.habit_score is not None
        assert 0 <= ev.habit_score <= 10

    def test_save_populates_habit_category(self, customer):
        """Save auto-populates habit_category from the computed score."""
        ev = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=4,
            water_liters=Decimal('2.5'),
            fruit_weekly=14,
            vegetable_weekly=14,
            protein_frequency=4,
            ultraprocessed_weekly=2,
            sugary_drinks_weekly=1,
            eats_breakfast=True,
        )
        assert ev.habit_category != ''
        assert ev.habit_color != ''

    def test_excellent_habits_score_higher_than_poor(self, customer):
        """Excellent dietary inputs produce a higher habit_score than poor inputs."""
        excellent = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=5, water_liters=Decimal('3.0'),
            fruit_weekly=21, vegetable_weekly=21, protein_frequency=5,
            ultraprocessed_weekly=0, sugary_drinks_weekly=0, eats_breakfast=True,
        )
        other = User.objects.create_user(
            email='nutri-other@test.com', password='p', role=User.Role.CUSTOMER,
        )
        poor = NutritionHabit.objects.create(
            customer=other,
            meals_per_day=2, water_liters=Decimal('0.5'),
            fruit_weekly=1, vegetable_weekly=2, protein_frequency=1,
            ultraprocessed_weekly=14, sugary_drinks_weekly=10, eats_breakfast=False,
        )
        assert excellent.habit_score > poor.habit_score

    def test_save_default_notes_is_empty(self, customer):
        """Notes defaults to an empty string when not provided."""
        ev = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=7, vegetable_weekly=7, protein_frequency=3,
            ultraprocessed_weekly=5, sugary_drinks_weekly=3, eats_breakfast=True,
        )
        assert ev.notes == ''


@pytest.mark.django_db
class TestNutritionHabitMeta:
    """Validates ordering, str representation, and FK behavior."""

    def test_str_representation(self, customer):
        """String representation includes pk, customer email, and date."""
        ev = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=7, vegetable_weekly=7, protein_frequency=3,
            ultraprocessed_weekly=5, sugary_drinks_weekly=3, eats_breakfast=True,
        )
        rendered = str(ev)
        assert f'#{ev.pk}' in rendered
        assert customer.email in rendered

    def test_ordering_by_created_at_descending(self, customer):
        """Default queryset orders entries by created_at descending."""
        first = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=3,
            ultraprocessed_weekly=5, sugary_drinks_weekly=3, eats_breakfast=True,
        )
        # Use a different customer to avoid any cooldown ambiguity
        other = User.objects.create_user(
            email='nutri-second@test.com', password='p', role=User.Role.CUSTOMER,
        )
        second = NutritionHabit.objects.create(
            customer=other,
            meals_per_day=4, water_liters=Decimal('2.5'),
            fruit_weekly=10, vegetable_weekly=10, protein_frequency=4,
            ultraprocessed_weekly=3, sugary_drinks_weekly=1, eats_breakfast=True,
        )
        ids = list(NutritionHabit.objects.values_list('pk', flat=True))
        assert ids == [second.pk, first.pk]

    def test_cascade_delete_with_customer(self, customer):
        """Habit entries are deleted when their owning customer is deleted."""
        NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=7, vegetable_weekly=7, protein_frequency=3,
            ultraprocessed_weekly=5, sugary_drinks_weekly=3, eats_breakfast=True,
        )
        customer.delete()
        assert NutritionHabit.objects.count() == 0
