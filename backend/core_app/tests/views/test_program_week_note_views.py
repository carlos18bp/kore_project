"""Tests de UpdateProgramWeekNoteView (PATCH .../week-notes/<week>/)."""
from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import MonthlyProgram, ProgramWeekNote, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    return User.objects.create_user(
        email='pwnv-trainer@test.com', password='pass',
        first_name='T', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='pwnv-customer@test.com', password='pass',
        first_name='C', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def program(customer):
    return MonthlyProgram.objects.create(
        customer=customer, fitness_level=2, goal='muscle_gain',
        start_date=date(2026, 5, 1), end_date=date(2026, 5, 28),
    )


def test_patch_creates_week_note(api_client, trainer, program):
    api_client.force_authenticate(trainer)
    url = f'/api/monthly-programs/{program.pk}/week-notes/1/'
    resp = api_client.patch(url, {'notes': 'Foco fuerza'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['week_number'] == 1
    assert resp.data['notes'] == 'Foco fuerza'
    assert ProgramWeekNote.objects.filter(program=program, week_number=1).exists()


def test_patch_updates_existing_week_note(api_client, trainer, program):
    ProgramWeekNote.objects.create(program=program, week_number=2, notes='viejo')
    api_client.force_authenticate(trainer)
    url = f'/api/monthly-programs/{program.pk}/week-notes/2/'
    resp = api_client.patch(url, {'notes': 'nuevo'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['notes'] == 'nuevo'
    assert ProgramWeekNote.objects.filter(program=program, week_number=2).count() == 1


def test_patch_rejects_week_out_of_range(api_client, trainer, program):
    api_client.force_authenticate(trainer)
    resp = api_client.patch(
        f'/api/monthly-programs/{program.pk}/week-notes/5/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_patch_forbidden_for_customer(api_client, customer, program):
    api_client.force_authenticate(customer)
    resp = api_client.patch(
        f'/api/monthly-programs/{program.pk}/week-notes/1/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN


def test_customer_program_list_embeds_week_notes(api_client, trainer, program, customer):
    ProgramWeekNote.objects.create(program=program, week_number=1, notes='Semana uno')
    api_client.force_authenticate(trainer)
    resp = api_client.get(f'/api/monthly-programs/customer/{customer.pk}/')
    assert resp.status_code == status.HTTP_200_OK
    prog = resp.data[0]
    assert 'week_notes' in prog
    assert prog['week_notes'] == [
        {'week_number': 1, 'notes': 'Semana uno', 'updated_at': prog['week_notes'][0]['updated_at']}
    ]
    assert 'current_week_note' in prog
