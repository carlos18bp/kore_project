"""Tests de las vistas de NutritionWeekNote."""
from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import NutritionWeekNote, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    return User.objects.create_user(
        email='nwnv-trainer@test.com', password='pass',
        first_name='T', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='nwnv-customer@test.com', password='pass',
        first_name='C', last_name='One', role=User.Role.CUSTOMER,
    )


def test_patch_creates_cycle_1_week_1(api_client, trainer, customer):
    api_client.force_authenticate(trainer)
    url = f'/api/nutrition-week-notes/customer/{customer.pk}/1/1/'
    resp = api_client.patch(url, {'notes': 'Hidratación', 'cycle_start': '2026-05-01'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['cycle_number'] == 1
    assert resp.data['week_number'] == 1
    assert resp.data['cycle_start'] == '2026-05-01'


def test_list_returns_all_notes(api_client, trainer, customer):
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=1, notes='a')
    api_client.force_authenticate(trainer)
    resp = api_client.get(f'/api/nutrition-week-notes/customer/{customer.pk}/')
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data) == 1
    assert resp.data[0]['notes'] == 'a'


def test_patch_rejects_cycle_skip(api_client, trainer, customer):
    api_client.force_authenticate(trainer)
    # No existe ciclo todavía → max = 0 → solo se permite ciclo 1
    resp = api_client.patch(
        f'/api/nutrition-week-notes/customer/{customer.pk}/3/1/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_patch_rejects_week_out_of_range(api_client, trainer, customer):
    api_client.force_authenticate(trainer)
    resp = api_client.patch(
        f'/api/nutrition-week-notes/customer/{customer.pk}/1/9/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_patch_forbidden_for_customer(api_client, customer):
    api_client.force_authenticate(customer)
    resp = api_client.patch(
        f'/api/nutrition-week-notes/customer/{customer.pk}/1/1/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN
