import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import AvailabilitySlot, Booking, Package
from core_app.tests.helpers import get_results


@pytest.mark.django_db
def test_booking_create_requires_login(api_client):
    package = Package.objects.create(title='P1', is_active=True)
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2))

    url = reverse('booking-list')
    response = api_client.post(url, {'package_id': package.id, 'slot_id': slot.id}, format='json')

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_booking_create_blocks_slot_and_prevents_double_booking(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)

    package = Package.objects.create(title='P1', is_active=True)
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2))

    url = reverse('booking-list')
    response = api_client.post(url, {'package_id': package.id, 'slot_id': slot.id}, format='json')

    assert response.status_code == status.HTTP_201_CREATED
    assert Booking.objects.count() == 1

    slot.refresh_from_db()
    assert slot.is_blocked is True

    response2 = api_client.post(url, {'package_id': package.id, 'slot_id': slot.id}, format='json')
    assert response2.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_booking_list_returns_only_own_bookings_for_customer(api_client, existing_user, admin_user):
    package = Package.objects.create(title='P1', is_active=True)
    now = timezone.now()

    slot_1 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2), is_blocked=True)
    slot_2 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4), is_blocked=True)

    Booking.objects.create(customer=existing_user, package=package, slot=slot_1)
    Booking.objects.create(customer=admin_user, package=package, slot=slot_2)

    api_client.force_authenticate(user=existing_user)
    url = reverse('booking-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_booking_list_returns_all_for_admin(api_client, existing_user, admin_user):
    package = Package.objects.create(title='P1', is_active=True)
    now = timezone.now()

    slot_1 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2), is_blocked=True)
    slot_2 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4), is_blocked=True)

    Booking.objects.create(customer=existing_user, package=package, slot=slot_1)
    Booking.objects.create(customer=admin_user, package=package, slot=slot_2)

    api_client.force_authenticate(user=admin_user)
    url = reverse('booking-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 2
