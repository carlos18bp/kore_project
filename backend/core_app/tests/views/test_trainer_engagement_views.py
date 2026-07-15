"""Tests for the trainer engagement endpoint (Fase 2 — Parte 11b)."""

from datetime import datetime, timedelta, timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Booking, CreditWallet, Package, TrainerProfile, User

FIXED_NOW = datetime(2026, 7, 15, 14, 0, tzinfo=dt_tz.utc)
URL_NAME = 'trainer-engagement'


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    u = User.objects.create_user(
        email='tr@test.com', password='p', first_name='Ana', last_name='G', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, location='Gym')


@pytest.mark.django_db
def test_non_trainer_forbidden(api_client):
    u = User.objects.create_user(email='cust@test.com', password='p', role=User.Role.CUSTOMER)
    _auth(api_client, u)
    response = api_client.get(reverse(URL_NAME))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_trainer_gets_summary_and_roster(api_client, trainer):
    customer = User.objects.create_user(
        email='c@test.com', password='p', first_name='Bea', last_name='R', role=User.Role.CUSTOMER,
    )
    package = Package.objects.create(title='Plan', sessions_count=8)
    Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=FIXED_NOW - timedelta(days=1), ends_at=FIXED_NOW,
        status=Booking.Status.CONFIRMED,
    )
    CreditWallet.objects.create(customer=customer, current_streak=4)

    _auth(api_client, trainer.user)
    response = api_client.get(reverse(URL_NAME))

    assert response.status_code == status.HTTP_200_OK
    assert set(response.data) == {'summary', 'roster'}
    assert response.data['summary']['active_streaks'] == 1
    assert response.data['roster'][0]['customer_id'] == customer.id
