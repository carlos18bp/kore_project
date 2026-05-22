"""Tests del modelo NutritionWeekNote."""
from datetime import date

import pytest
from django.db import IntegrityError, transaction

from core_app.models import NutritionWeekNote, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='nwn-customer@test.com', password='pass',
        first_name='C', last_name='Two', role=User.Role.CUSTOMER,
    )


def test_create_nutrition_week_note(customer):
    note = NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=1, notes='Semana 1',
    )
    assert note.pk is not None
    assert note.cycle_number == 1


def test_nutrition_week_note_unique_per_cycle_week(customer):
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=1, notes='a',
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        NutritionWeekNote.objects.create(
            customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
            week_number=1, notes='b',
        )
    assert NutritionWeekNote.objects.filter(
        customer=customer, cycle_number=1, week_number=1,
    ).count() == 1


def test_nutrition_week_note_ordering(customer):
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=2, notes='x',
    )
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=2, cycle_start=date(2026, 5, 29),
        week_number=1, notes='y',
    )
    rows = list(NutritionWeekNote.objects.values_list('cycle_number', 'week_number'))
    assert rows == [(2, 1), (1, 2)]  # ordering = ['-cycle_number', 'week_number']
