"""Tests for availability slot API views."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import AvailabilitySlot, Booking, Package, TrainerProfile, User
from core_app.tests.helpers import get_results

FIXED_NOW = timezone.make_aware(datetime(2100, 2, 3, 10, 0, 0), timezone.get_current_timezone())


def _fixed_now() -> datetime:
    return FIXED_NOW


@pytest.mark.django_db
def test_availability_slot_list_filters_for_anonymous(api_client):
    """List only publicly available slots for anonymous users."""
    now = _fixed_now()
    AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1), is_active=True, is_blocked=False)
    AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3), is_active=True, is_blocked=True)

    url = reverse('availability-slot-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_availability_slot_list_returns_all_for_admin(api_client, admin_user):
    """Allow admins to list both blocked and unblocked slots."""
    now = _fixed_now()
    AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1), is_active=True, is_blocked=False)
    AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3), is_active=True, is_blocked=True)

    api_client.force_authenticate(user=admin_user)

    url = reverse('availability-slot-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 2


@pytest.mark.django_db
def test_availability_slot_create_requires_admin(api_client):
    """Reject slot creation requests from non-admin users."""
    now = _fixed_now()

    url = reverse('availability-slot-list')
    response = api_client.post(
        url,
        {'starts_at': now.isoformat(), 'ends_at': (now + timedelta(hours=1)).isoformat()},
        format='json',
    )

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_availability_slot_list_with_malformed_date_param(api_client):
    """Malformed date param is silently ignored (lines 59-63)."""
    now = _fixed_now()
    AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
        is_active=True,
        is_blocked=False,
    )

    url = reverse('availability-slot-list')
    response = api_client.get(url, {'date': 'not-a-date'})

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_availability_slot_list_filters_by_valid_date(api_client, admin_user):
    """Valid date param filters slots by date (line 60-61)."""
    now = _fixed_now()
    target_date = (now + timedelta(days=1)).date()
    # Use midday UTC to avoid crossing local-day boundaries in America/Bogota.
    target_start = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        12,
        0,
        tzinfo=dt_timezone.utc,
    )
    AvailabilitySlot.objects.create(
        starts_at=target_start,
        ends_at=target_start + timedelta(hours=1),
        is_active=True, is_blocked=False,
    )
    AvailabilitySlot.objects.create(
        starts_at=target_start + timedelta(days=2),
        ends_at=target_start + timedelta(days=2, hours=1),
        is_active=True, is_blocked=False,
    )

    api_client.force_authenticate(user=admin_user)
    url = reverse('availability-slot-list')
    response = api_client.get(url, {'date': target_date.strftime('%Y-%m-%d')})

    assert response.status_code == status.HTTP_200_OK
    results = get_results(response.data)
    assert len(results) == 1


@pytest.mark.django_db
def test_availability_slot_list_filters_by_bogota_local_day(api_client, admin_user):
    """Date filter uses America/Bogota local day boundaries instead of UTC date."""
    # 2026-01-17 00:30 UTC == 2026-01-16 19:30 America/Bogota
    slot_prev_local_day = AvailabilitySlot.objects.create(
        starts_at=datetime(2026, 1, 17, 0, 30, tzinfo=dt_timezone.utc),
        ends_at=datetime(2026, 1, 17, 1, 30, tzinfo=dt_timezone.utc),
        is_active=True,
        is_blocked=False,
    )
    # 2026-01-17 05:30 UTC == 2026-01-17 00:30 America/Bogota
    slot_same_local_day = AvailabilitySlot.objects.create(
        starts_at=datetime(2026, 1, 17, 5, 30, tzinfo=dt_timezone.utc),
        ends_at=datetime(2026, 1, 17, 6, 30, tzinfo=dt_timezone.utc),
        is_active=True,
        is_blocked=False,
    )

    api_client.force_authenticate(user=admin_user)
    url = reverse('availability-slot-list')

    response_prev_day = api_client.get(url, {'date': '2026-01-16'})
    assert response_prev_day.status_code == status.HTTP_200_OK
    prev_day_ids = {item['id'] for item in get_results(response_prev_day.data)}
    assert slot_prev_local_day.id in prev_day_ids
    assert slot_same_local_day.id not in prev_day_ids

    response_same_day = api_client.get(url, {'date': '2026-01-17'})
    assert response_same_day.status_code == status.HTTP_200_OK
    same_day_ids = {item['id'] for item in get_results(response_same_day.data)}
    assert slot_prev_local_day.id not in same_day_ids
    assert slot_same_local_day.id in same_day_ids


@pytest.mark.django_db
def test_availability_slot_list_filters_by_trainer(api_client):
    """Trainer query param filters slots by trainer_id (line 68)."""
    trainer_user = User.objects.create_user(
        email='trainer_avail@example.com', password='p',
        first_name='T', last_name='One', role=User.Role.TRAINER,
    )
    trainer = TrainerProfile.objects.create(
        user=trainer_user, specialty='Yoga', location='Studio',
    )
    now = _fixed_now()
    AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
        is_active=True,
        is_blocked=False,
        trainer=trainer,
    )
    AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=3),
        ends_at=now + timedelta(hours=4),
        is_active=True,
        is_blocked=False,
        trainer=None,
    )

    url = reverse('availability-slot-list')
    response = api_client.get(url, {'trainer': trainer.pk})

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_availability_excludes_slots_inside_trainer_travel_buffer(api_client):
    """Hide slots that violate 45-minute buffer around active trainer bookings."""
    trainer_user = User.objects.create_user(
        email='trainer_buffer@example.com', password='p', role=User.Role.TRAINER,
    )
    trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Strength', location='Studio')

    customer_a = User.objects.create_user(email='buffer_customer_a@example.com', password='p')
    package = Package.objects.create(title='Buffer Pack', sessions_count=4, validity_days=30)

    now = _fixed_now()
    booked_slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=2),
        ends_at=now + timedelta(hours=3),
        trainer=trainer,
        is_active=True,
        is_blocked=True,
    )
    Booking.objects.create(
        customer=customer_a,
        package=package,
        slot=booked_slot,
        trainer=trainer,
        status=Booking.Status.CONFIRMED,
    )

    within_buffer_slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=3, minutes=30),
        ends_at=now + timedelta(hours=4, minutes=30),
        trainer=trainer,
        is_active=True,
        is_blocked=False,
    )
    boundary_slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=3, minutes=45),
        ends_at=now + timedelta(hours=4, minutes=45),
        trainer=trainer,
        is_active=True,
        is_blocked=False,
    )

    url = reverse('availability-slot-list')
    response = api_client.get(url, {'trainer': trainer.pk})

    assert response.status_code == status.HTTP_200_OK
    slot_ids = {item['id'] for item in get_results(response.data)}
    assert within_buffer_slot.id not in slot_ids
    assert boundary_slot.id in slot_ids
