"""Tests for trainer unavailability (block-a-day) endpoint and its effect on availability."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import TrainerProfile, TrainerUnavailability, User


# Thursday 2026-01-15 12:00 UTC = 07:00 Bogota
FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)
TODAY_BOGOTA = '2026-01-15'
NEXT_DAY_BOGOTA = '2026-01-16'  # Friday


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='unavail_trainer@example.com', password='p',
        first_name='Tr', last_name='Block', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    return TrainerProfile.objects.create(user=trainer_user, specialty='General')


@pytest.fixture
def assigned_customer(trainer_profile):
    return User.objects.create_user(
        email='unavail_customer@example.com', password='p',
        role=User.Role.CUSTOMER, assigned_trainer=trainer_profile,
    )


# ────────────────────────────────────────────────────────────────────────
# Endpoint behaviour
# ────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUnavailabilityEndpoint:

    def test_post_blocks_a_date(self, api_client, trainer_user, trainer_profile):
        api_client.force_authenticate(user=trainer_user)
        url = reverse('trainer-unavailability')

        response = api_client.post(url, {'date': NEXT_DAY_BOGOTA, 'reason': 'Vacaciones'}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['date'] == NEXT_DAY_BOGOTA
        assert response.data['reason'] == 'Vacaciones'
        assert TrainerUnavailability.objects.filter(trainer=trainer_profile, date=NEXT_DAY_BOGOTA).exists()

    def test_post_is_idempotent(self, api_client, trainer_user, trainer_profile):
        TrainerUnavailability.objects.create(trainer=trainer_profile, date=NEXT_DAY_BOGOTA, reason='Old')
        api_client.force_authenticate(user=trainer_user)
        url = reverse('trainer-unavailability')

        response = api_client.post(url, {'date': NEXT_DAY_BOGOTA, 'reason': 'New'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert TrainerUnavailability.objects.filter(trainer=trainer_profile, date=NEXT_DAY_BOGOTA).count() == 1
        TrainerUnavailability.objects.get(trainer=trainer_profile, date=NEXT_DAY_BOGOTA).reason == 'New'

    def test_post_rejects_past_dates(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        url = reverse('trainer-unavailability')

        response = api_client.post(url, {'date': '2026-01-10'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'pasadas' in response.data['detail']

    def test_get_lists_blocked_dates_in_range(self, api_client, trainer_user, trainer_profile):
        TrainerUnavailability.objects.create(trainer=trainer_profile, date='2026-01-16')
        TrainerUnavailability.objects.create(trainer=trainer_profile, date='2026-01-20')
        # Outside default range:
        TrainerUnavailability.objects.create(trainer=trainer_profile, date='2026-04-01')

        api_client.force_authenticate(user=trainer_user)
        url = reverse('trainer-unavailability')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['dates'] == ['2026-01-16', '2026-01-20']

    def test_delete_unblocks_a_date(self, api_client, trainer_user, trainer_profile):
        TrainerUnavailability.objects.create(trainer=trainer_profile, date=NEXT_DAY_BOGOTA)
        api_client.force_authenticate(user=trainer_user)
        url = reverse('trainer-unavailability')

        response = api_client.delete(f'{url}?date={NEXT_DAY_BOGOTA}')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TrainerUnavailability.objects.filter(trainer=trainer_profile, date=NEXT_DAY_BOGOTA).exists()

    def test_delete_unknown_date_returns_404(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        url = reverse('trainer-unavailability')

        response = api_client.delete(f'{url}?date={NEXT_DAY_BOGOTA}')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_customer_cannot_access(self, api_client, assigned_customer):
        api_client.force_authenticate(user=assigned_customer)
        url = reverse('trainer-unavailability')

        response = api_client.get(url)

        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED)


# ────────────────────────────────────────────────────────────────────────
# Availability filtering — blocked dates disappear from /api/availability/
# ────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUnavailabilityAffectsAvailability:

    def test_blocked_date_is_absent_from_availability(
        self, api_client, trainer_user, trainer_profile, assigned_customer,
    ):
        # Friday Jan 16 is a normal biz day; block it.
        TrainerUnavailability.objects.create(trainer=trainer_profile, date='2026-01-16')

        api_client.force_authenticate(user=trainer_user)
        url = reverse('availability')

        response = api_client.get(f'{url}?date_from=2026-01-16&date_to=2026-01-16')

        assert response.status_code == status.HTTP_200_OK
        assert '2026-01-16' not in response.data

    def test_non_blocked_date_still_has_slots(
        self, api_client, trainer_user, trainer_profile,
    ):
        # Saturday Jan 17 is biz hours; not blocked.
        api_client.force_authenticate(user=trainer_user)
        url = reverse('availability')

        response = api_client.get(f'{url}?date_from=2026-01-17&date_to=2026-01-17')

        assert response.status_code == status.HTTP_200_OK
        assert '2026-01-17' in response.data
        assert len(response.data['2026-01-17']) > 0

    def test_customer_cannot_book_on_blocked_date(
        self, api_client, trainer_profile, assigned_customer,
    ):
        from core_app.models import Package
        package = Package.objects.create(title='P', is_active=True)

        # Block Saturday Jan 17 — a slot the customer could otherwise pick.
        TrainerUnavailability.objects.create(trainer=trainer_profile, date='2026-01-17')

        api_client.force_authenticate(user=assigned_customer)
        url = reverse('booking-list')

        response = api_client.post(
            url,
            {'package_id': package.id, 'starts_at': '2026-01-17T14:00:00Z'},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'starts_at' in response.data
