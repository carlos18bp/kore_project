import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import AvailabilitySlot, TrainerProfile, User
from core_app.tests.helpers import get_results


@pytest.mark.django_db
def test_availability_slot_list_filters_for_anonymous(api_client):
    now = timezone.now()
    AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1), is_active=True, is_blocked=False)
    AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3), is_active=True, is_blocked=True)

    url = reverse('availability-slot-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_availability_slot_list_returns_all_for_admin(api_client, admin_user):
    now = timezone.now()
    AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1), is_active=True, is_blocked=False)
    AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3), is_active=True, is_blocked=True)

    api_client.force_authenticate(user=admin_user)

    url = reverse('availability-slot-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 2


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


@pytest.mark.django_db
def test_availability_slot_list_with_malformed_date_param(api_client):
    """Malformed date param is silently ignored (lines 59-63)."""
    now = timezone.now()
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
    now = timezone.now()
    target_date = (now + timedelta(days=1)).date()
    target_start = timezone.make_aware(
        timezone.datetime.combine(target_date, timezone.datetime.min.time()),
        timezone.get_current_timezone(),
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
def test_availability_slot_list_filters_by_trainer(api_client):
    """Trainer query param filters slots by trainer_id (line 68)."""
    trainer_user = User.objects.create_user(
        email='trainer_avail@example.com', password='p',
        first_name='T', last_name='One', role=User.Role.TRAINER,
    )
    trainer = TrainerProfile.objects.create(
        user=trainer_user, specialty='Yoga', location='Studio',
    )
    now = timezone.now()
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
