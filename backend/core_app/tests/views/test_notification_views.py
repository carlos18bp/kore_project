"""Tests for notification API views."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Notification,
    Package,
    User,
)
from core_app.tests.helpers import get_results


@pytest.fixture
def booking(db):
    """Create a booking fixture used to validate notification view behavior."""
    customer = User.objects.create_user(email='nv_cust@example.com', password='p')
    pkg = Package.objects.create(title='Pkg')
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.mark.django_db
def test_notification_list_requires_admin(api_client, existing_user):
    """Deny notification listing for authenticated non-admin users."""
    api_client.force_authenticate(user=existing_user)
    url = reverse('notification-list')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_notification_list_anonymous_denied(api_client):
    """Reject anonymous access to notification listing endpoint."""
    url = reverse('notification-list')
    response = api_client.get(url)
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_notification_list_allowed_for_admin(api_client, admin_user, booking):
    """Allow admins to list persisted notifications."""
    Notification.objects.create(
        booking=booking,
        notification_type=Notification.Type.BOOKING_CONFIRMED,
        status=Notification.Status.SENT,
    )
    api_client.force_authenticate(user=admin_user)
    url = reverse('notification-list')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_notification_create_requires_admin(api_client, existing_user, booking):
    """Deny notification creation for authenticated non-admin users."""
    api_client.force_authenticate(user=existing_user)
    url = reverse('notification-list')
    response = api_client.post(url, {
        'booking': booking.id,
        'notification_type': 'booking_confirmed',
    }, format='json')
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_notification_create_allowed_for_admin(api_client, admin_user, booking):
    """Allow admins to create notifications through list endpoint."""
    api_client.force_authenticate(user=admin_user)
    url = reverse('notification-list')
    response = api_client.post(url, {
        'booking': booking.id,
        'notification_type': 'booking_confirmed',
        'sent_to': 'admin@example.com',
    }, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert Notification.objects.count() == 1
