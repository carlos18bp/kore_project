"""Tests for TrainerProfileViewSet (read-only, public list)."""

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import TrainerProfile, User
from core_app.tests.helpers import get_results


@pytest.fixture
def trainer_user(db):
    """Create a trainer user fixture for trainer profile view tests."""
    return User.objects.create_user(
        email='tp_trainer@example.com', password='p',
        first_name='Maria', last_name='Lopez', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    """Create a trainer profile fixture exposed by trainer endpoints."""
    return TrainerProfile.objects.create(
        user=trainer_user, specialty='Yoga', bio='Expert', location='Room B',
        session_duration_minutes=45,
    )


@pytest.mark.django_db
class TestTrainerProfileViews:
    """Validate read-only trainer profile endpoint behavior."""

    def test_list_returns_trainers(self, api_client, trainer_profile, existing_user):
        """Return trainer list entries for authenticated users."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('trainer-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        assert len(results) >= 1
        names = [r['first_name'] for r in results]
        assert 'Maria' in names

    def test_retrieve_single_trainer(self, api_client, trainer_profile, existing_user):
        """Return trainer detail payload for an existing trainer profile."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('trainer-detail', args=[trainer_profile.pk])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['first_name'] == 'Maria'
        assert response.data['specialty'] == 'Yoga'
        assert response.data['session_duration_minutes'] == 45

    def test_create_not_allowed(self, api_client, existing_user):
        """Reject trainer profile creation through read-only endpoint."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('trainer-list')
        response = api_client.post(url, {'specialty': 'Boxing'}, format='json')

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_list_requires_authentication(self, api_client):
        """Require authentication before exposing trainer list endpoint."""
        url = reverse('trainer-list')
        response = api_client.get(url)

        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_empty_list(self, api_client, existing_user):
        """Return an empty list payload when no trainer profiles exist."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('trainer-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        assert len(results) == 0
