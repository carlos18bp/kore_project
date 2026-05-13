"""Tests for the computed AvailabilityView (GET /api/availability/)."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Booking, Package, TrainerProfile, User

FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)
# Friday Jan 16 05:00 Bogota = 10:00 UTC — first free slot after FIXED_NOW + 16h advance
FIRST_AVAILABLE = '2026-01-16T10:00:00+00:00'


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='avail_trainer@example.com', password='p', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer(trainer_user):
    return TrainerProfile.objects.create(user=trainer_user, specialty='General')


@pytest.fixture
def customer(db, trainer):
    u = User.objects.create_user(
        email='avail_cust@example.com', password='p', role=User.Role.CUSTOMER,
    )
    u.assigned_trainer = trainer
    u.save(update_fields=['assigned_trainer'])
    return u


@pytest.fixture
def package(db):
    return Package.objects.create(title='Pkg', is_active=True)


@pytest.mark.django_db
def test_unauthenticated_returns_401(api_client):
    response = api_client.get(reverse('availability'))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_customer_no_assigned_trainer_returns_empty_dict(api_client, db):
    u = User.objects.create_user(
        email='no_trainer_cust@example.com', password='p', role=User.Role.CUSTOMER,
    )
    api_client.force_authenticate(user=u)
    response = api_client.get(reverse('availability'))

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {}


@pytest.mark.django_db
def test_customer_returns_assigned_trainer_availability(api_client, customer):
    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'))

    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.data, dict)
    # Friday Jan 16 is within the default 7-day window and should have free slots
    assert '2026-01-16' in response.data
    assert FIRST_AVAILABLE in response.data['2026-01-16']


@pytest.mark.django_db
def test_trainer_param_overrides_assigned_trainer(api_client, customer, db):
    other_user = User.objects.create_user(
        email='other_trainer@example.com', password='p', role=User.Role.TRAINER,
    )
    other_trainer = TrainerProfile.objects.create(user=other_user, specialty='Yoga')

    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {'trainer': other_trainer.pk})

    assert response.status_code == status.HTTP_200_OK
    # other_trainer also has no bookings, so same availability shape
    assert '2026-01-16' in response.data


@pytest.mark.django_db
def test_non_customer_without_trainer_param_returns_400(api_client, trainer_user):
    api_client.force_authenticate(user=trainer_user)
    response = api_client.get(reverse('availability'))

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'trainer' in response.data['detail']


@pytest.mark.django_db
def test_unknown_trainer_returns_404(api_client, customer):
    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {'trainer': 999999})

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_date_range_params_filter_results(api_client, customer):
    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {
        'date_from': '2026-01-16',
        'date_to': '2026-01-16',
    })

    assert response.status_code == status.HTTP_200_OK
    assert '2026-01-16' in response.data
    # Only Jan 16 should be present (single-day request)
    assert all(k == '2026-01-16' for k in response.data)


@pytest.mark.django_db
def test_invalid_date_from_returns_400(api_client, customer):
    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {'date_from': 'not-a-date'})

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'date_from' in response.data['detail']


@pytest.mark.django_db
def test_invalid_date_to_returns_400(api_client, customer):
    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {
        'date_from': '2026-01-16',
        'date_to': 'bad',
    })

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'date_to' in response.data['detail']


@pytest.mark.django_db
def test_date_to_before_date_from_returns_400(api_client, customer):
    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {
        'date_from': '2026-01-20',
        'date_to': '2026-01-16',
    })

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_existing_booking_blocks_start_time(api_client, customer, trainer, package, db):
    """Booking at Jan 16 10:30 UTC blocks the 10:00 slot via 45-min buffer."""
    other_customer = User.objects.create_user(
        email='other_cust@example.com', password='p', role=User.Role.CUSTOMER,
    )
    Booking.objects.create(
        customer=other_customer, package=package, trainer=trainer,
        status=Booking.Status.CONFIRMED,
        starts_at=datetime(2026, 1, 16, 10, 30, tzinfo=dt_timezone.utc),
        ends_at=datetime(2026, 1, 16, 11, 30, tzinfo=dt_timezone.utc),
    )

    api_client.force_authenticate(user=customer)
    response = api_client.get(reverse('availability'), {
        'date_from': '2026-01-16',
        'date_to': '2026-01-16',
    })

    assert response.status_code == status.HTTP_200_OK
    jan16_slots = response.data.get('2026-01-16', [])
    assert FIRST_AVAILABLE not in jan16_slots
