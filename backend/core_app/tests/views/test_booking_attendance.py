from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def past_booking(existing_user, trainer_user):
    package = Package.objects.create(title='P')
    now = timezone.now()
    return Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=now - timedelta(hours=2), ends_at=now - timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_trainer_confirms_attendance(api_client, trainer_user, past_booking, existing_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 200
    past_booking.refresh_from_db()
    assert past_booking.attendance_status == Booking.AttendanceStatus.ATTENDED
    assert credit_engine.get_wallet(existing_user).balance == 50


@pytest.mark.django_db
def test_customer_cannot_confirm_attendance(api_client, existing_user, past_booking):
    api_client.force_authenticate(existing_user)
    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_cannot_confirm_future_booking(api_client, trainer_user, existing_user):
    package = Package.objects.create(title='P2')
    now = timezone.now()
    future = Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=now + timedelta(days=1), ends_at=now + timedelta(days=1, hours=1),
        status=Booking.Status.CONFIRMED,
    )
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(
        f'/api/bookings/{future.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 400
