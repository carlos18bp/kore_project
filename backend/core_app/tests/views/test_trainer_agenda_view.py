"""Tests for TrainerAgendaView — sesiones del trainer por rango de fechas."""

from datetime import datetime, timedelta
from datetime import timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Booking, Package, TrainerProfile, User

FIXED_NOW = datetime(2026, 3, 1, 10, 0, tzinfo=dt_tz.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='trainer-ag@test.com', password='pass',
        first_name='Ana', last_name='Garcia', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym A')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer-ag@test.com', password='pass',
        first_name='Carlos', last_name='Lopez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Básico', sessions_count=8, validity_days=30, price='200000.00',
    )


def _booking(trainer, customer, package, day_offset, hour=9, status_=Booking.Status.CONFIRMED):
    start = FIXED_NOW + timedelta(days=day_offset, hours=hour - 10)
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=start, ends_at=start + timedelta(hours=1), status=status_,
    )


@pytest.mark.django_db
def test_returns_sessions_within_range(api_client, trainer, customer, package):
    _booking(trainer, customer, package, day_offset=1)   # 2026-03-02
    _booking(trainer, customer, package, day_offset=3)   # 2026-03-04
    _booking(trainer, customer, package, day_offset=40)  # fuera de rango
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-03-01', 'to': '2026-03-07'},
    )
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data['sessions']) == 2


@pytest.mark.django_db
def test_returns_all_sessions_no_limit(api_client, trainer, customer, package):
    for i in range(8):
        _booking(trainer, customer, package, day_offset=0, hour=8 + i)
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-03-01', 'to': '2026-03-01'},
    )
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data['sessions']) == 8  # sin tope de 5


@pytest.mark.django_db
def test_forbidden_for_non_trainer(api_client, customer):
    api_client.force_authenticate(user=customer)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-03-01', 'to': '2026-03-07'},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_bad_request_on_missing_params(api_client, trainer):
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(reverse('trainer-agenda'))
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_bad_request_on_range_too_large(api_client, trainer):
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-01-01', 'to': '2026-12-31'},
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
