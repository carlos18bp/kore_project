"""The reschedule/cancel window is whatever CreditSettings says — not a constant."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Booking, Package, Subscription, TrainerProfile, User
from core_app.models.credit import CreditSettings


@pytest.fixture
def window_48(db):
    settings_obj = CreditSettings.load()
    settings_obj.reschedule_window_hours = 48
    settings_obj.save(update_fields=['reschedule_window_hours'])
    return settings_obj


@pytest.fixture
def package(db):
    return Package.objects.create(title='Plan', sessions_count=4, price=100000)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='window-customer@kore.com', password='p',
        first_name='Ana', last_name='Cliente', role=User.Role.CUSTOMER,
    )


def _booking(customer, package, hours_out, trainer=None):
    start = timezone.now() + timedelta(hours=hours_out)
    Subscription.objects.create(
        customer=customer, package=package, sessions_total=4,
        starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30),
        status=Subscription.Status.ACTIVE,
    )
    return Booking.objects.create(
        customer=customer, package=package, trainer=trainer,
        starts_at=start, ends_at=start + timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_cancel_inside_the_configured_window_is_rejected(api_client, customer, package, window_48):
    # 30h out: allowed under the old hardcoded 24h, rejected under the configured 48h.
    booking = _booking(customer, package, hours_out=30)
    api_client.force_authenticate(user=customer)

    response = api_client.post(reverse('booking-cancel', args=[booking.pk]))

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert '48' in response.data['detail']


@pytest.mark.django_db
def test_cancel_outside_the_configured_window_is_allowed(api_client, customer, package, window_48):
    booking = _booking(customer, package, hours_out=60)
    api_client.force_authenticate(user=customer)

    response = api_client.post(reverse('booking-cancel', args=[booking.pk]))

    assert response.status_code == status.HTTP_200_OK
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CANCELED


@pytest.mark.django_db
def test_reschedule_inside_the_configured_window_is_rejected(api_client, customer, package, window_48):
    booking = _booking(customer, package, hours_out=30)
    api_client.force_authenticate(user=customer)
    new_start = (timezone.now() + timedelta(days=7)).isoformat()

    response = api_client.post(
        reverse('booking-reschedule', args=[booking.pk]),
        {'new_starts_at': new_start}, format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert '48' in response.data['detail']


@pytest.mark.django_db
def test_the_trainer_still_bypasses_the_window(api_client, customer, package, window_48, db):
    trainer_user = User.objects.create_user(
        email='window-trainer@kore.com', password='p',
        first_name='Tina', last_name='Trainer', role=User.Role.TRAINER,
    )
    profile = TrainerProfile.objects.create(user=trainer_user)
    booking = _booking(customer, package, hours_out=2, trainer=profile)
    api_client.force_authenticate(user=trainer_user)

    response = api_client.post(reverse('booking-cancel', args=[booking.pk]))

    assert response.status_code == status.HTTP_200_OK
