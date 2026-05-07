"""Tests for the customer-side trainer-message dismiss endpoint.

Covers ownership, idempotence, and that dismissed messages stop showing in
GET /api/my-trainer-messages/.
"""

from datetime import datetime
from datetime import timezone as dt_tz

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import TrainerProfile, User
from core_app.models.trainer_message import TrainerMessage

FIXED_NOW = datetime(2026, 5, 5, 8, 0, 0, tzinfo=dt_tz.utc)


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
    user = User.objects.create_user(
        email='trainer-dismiss@test.com', password='pass',
        first_name='Ana', last_name='Garcia', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym A')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer-dismiss@test.com', password='pass',
        first_name='Carlos', last_name='Lopez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def other_customer(db):
    return User.objects.create_user(
        email='other-dismiss@test.com', password='pass',
        first_name='Pedro', last_name='Ramirez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def message(trainer, customer):
    return TrainerMessage.objects.create(
        trainer=trainer,
        customer=customer,
        message='Buen trabajo en la sesión de hoy',
        trigger_type=TrainerMessage.TriggerType.POST_SESSION,
    )


@pytest.mark.django_db
class TestTrainerMessageDismiss:

    def test_owner_can_dismiss_message(self, api_client, customer, message):
        _auth(api_client, customer)
        url = f'/api/my-trainer-messages/{message.pk}/dismiss/'
        resp = api_client.post(url)
        assert resp.status_code == status.HTTP_200_OK
        message.refresh_from_db()
        assert message.dismissed_at is not None

    def test_other_customer_cannot_dismiss(self, api_client, other_customer, message):
        _auth(api_client, other_customer)
        url = f'/api/my-trainer-messages/{message.pk}/dismiss/'
        resp = api_client.post(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        message.refresh_from_db()
        assert message.dismissed_at is None

    def test_trainer_cannot_dismiss(self, api_client, trainer, message):
        _auth(api_client, trainer.user)
        url = f'/api/my-trainer-messages/{message.pk}/dismiss/'
        resp = api_client.post(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_idempotent_dismiss_keeps_first_timestamp(self, api_client, customer, message):
        _auth(api_client, customer)
        url = f'/api/my-trainer-messages/{message.pk}/dismiss/'
        first = api_client.post(url)
        message.refresh_from_db()
        first_ts = message.dismissed_at
        second = api_client.post(url)
        assert second.status_code == status.HTTP_200_OK
        message.refresh_from_db()
        assert message.dismissed_at == first_ts

    def test_dismissed_message_excluded_from_my_messages(self, api_client, customer, message):
        _auth(api_client, customer)
        # Confirm message visible before dismiss
        list_url = '/api/my-trainer-messages/'
        before = api_client.get(list_url)
        assert before.status_code == status.HTTP_200_OK
        assert any(m['id'] == message.pk for m in before.data['messages'])

        api_client.post(f'/api/my-trainer-messages/{message.pk}/dismiss/')

        after = api_client.get(list_url)
        assert after.status_code == status.HTTP_200_OK
        assert all(m['id'] != message.pk for m in after.data['messages'])

    def test_dismiss_unknown_message_returns_404(self, api_client, customer):
        _auth(api_client, customer)
        resp = api_client.post('/api/my-trainer-messages/99999/dismiss/')
        assert resp.status_code == status.HTTP_404_NOT_FOUND
