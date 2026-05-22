"""Tests del modelo ProgramWeekNote."""
from datetime import date

import pytest
from django.db import IntegrityError

from core_app.models import MonthlyProgram, ProgramWeekNote, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='pwn-customer@test.com', password='pass',
        first_name='C', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def program(customer):
    return MonthlyProgram.objects.create(
        customer=customer, fitness_level=2, goal='muscle_gain',
        start_date=date(2026, 5, 1), end_date=date(2026, 5, 28),
    )


def test_create_program_week_note(program):
    note = ProgramWeekNote.objects.create(program=program, week_number=1, notes='Semana 1')
    assert note.pk is not None
    assert note.program_id == program.pk
    assert note.notes == 'Semana 1'


def test_program_week_note_unique_per_week(program):
    ProgramWeekNote.objects.create(program=program, week_number=1, notes='a')
    with pytest.raises(IntegrityError):
        ProgramWeekNote.objects.create(program=program, week_number=1, notes='b')


def test_program_week_notes_related_name(program):
    ProgramWeekNote.objects.create(program=program, week_number=2, notes='x')
    ProgramWeekNote.objects.create(program=program, week_number=1, notes='y')
    weeks = list(program.week_notes.values_list('week_number', flat=True))
    assert weeks == [1, 2]  # ordering = ['week_number']
