import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import AvailabilitySlot


def _results(data):
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


@pytest.mark.django_db
def test_availability_slot_list_filters_for_anonymous(api_client):
    now = timezone.now()
    AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1), is_active=True, is_blocked=False)
    AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3), is_active=True, is_blocked=True)

    url = reverse('availability-slot-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(_results(response.data)) == 1


@pytest.mark.django_db
def test_availability_slot_list_returns_all_for_admin(api_client, admin_user):
    now = timezone.now()
    AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1), is_active=True, is_blocked=False)
    AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3), is_active=True, is_blocked=True)

    api_client.force_authenticate(user=admin_user)

    url = reverse('availability-slot-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(_results(response.data)) == 2


@pytest.mark.django_db
def test_availability_slot_create_requires_admin(api_client):
    now = timezone.now()

    url = reverse('availability-slot-list')
    response = api_client.post(
        url,
        {'starts_at': now.isoformat(), 'ends_at': (now + timedelta(hours=1)).isoformat()},
        format='json',
    )

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
