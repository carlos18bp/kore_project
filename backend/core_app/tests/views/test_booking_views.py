"""Tests for booking API views."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.tests.helpers import get_results

FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)
# Saturday Jan 17 09:00 Bogota = 14:00 UTC — 50h ahead, valid schedule slot
BOOKING_STARTS_AT = '2026-01-17T14:00:00Z'


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze timezone.now for deterministic booking view test expectations."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.mark.django_db
def test_booking_create_requires_login(api_client):
    """Reject booking creation requests from anonymous users."""
    package = Package.objects.create(title='P1', is_active=True)

    url = reverse('booking-list')
    response = api_client.post(url, {'package_id': package.id, 'starts_at': BOOKING_STARTS_AT}, format='json')

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_booking_create_and_prevents_double_booking(api_client, existing_user):
    """Create a booking then reject a second booking at the same time for the same trainer."""
    trainer_user = User.objects.create_user(
        email='bk_view_trainer@example.com', password='p', role=User.Role.TRAINER,
    )
    trainer = TrainerProfile.objects.create(user=trainer_user, specialty='General')
    existing_user.assigned_trainer = trainer
    existing_user.save(update_fields=['assigned_trainer'])

    api_client.force_authenticate(user=existing_user)

    package = Package.objects.create(title='P1', is_active=True)

    url = reverse('booking-list')
    response = api_client.post(url, {'package_id': package.id, 'starts_at': BOOKING_STARTS_AT}, format='json')

    assert response.status_code == status.HTTP_201_CREATED
    assert Booking.objects.count() == 1

    response2 = api_client.post(url, {'package_id': package.id, 'starts_at': BOOKING_STARTS_AT}, format='json')
    assert response2.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_booking_list_returns_only_own_bookings_for_customer(api_client, existing_user, admin_user):
    """List endpoint returns only bookings owned by the authenticated customer."""
    package = Package.objects.create(title='P1', is_active=True)
    now = FIXED_NOW

    Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    Booking.objects.create(
        customer=admin_user, package=package,
        starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4),
    )

    api_client.force_authenticate(user=existing_user)
    url = reverse('booking-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_booking_list_returns_all_for_admin(api_client, existing_user, admin_user):
    """List endpoint returns bookings for all customers when requester is admin."""
    package = Package.objects.create(title='P1', is_active=True)
    now = FIXED_NOW

    Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    Booking.objects.create(
        customer=admin_user, package=package,
        starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4),
    )

    api_client.force_authenticate(user=admin_user)
    url = reverse('booking-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 2
