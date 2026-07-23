from datetime import timedelta

import pytest

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
def past_booking(existing_user, trainer_user, frozen_now):
    package = Package.objects.create(title='P')
    return Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=frozen_now - timedelta(hours=2), ends_at=frozen_now - timedelta(hours=1),
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
def test_cannot_confirm_future_booking(api_client, trainer_user, existing_user, frozen_now):
    package = Package.objects.create(title='P2')
    future = Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=frozen_now + timedelta(days=1), ends_at=frozen_now + timedelta(days=1, hours=1),
        status=Booking.Status.CONFIRMED,
    )
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(
        f'/api/bookings/{future.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_confirm_attendance_unknown_booking_returns_404(api_client, trainer_user):
    """Confirming attendance on a nonexistent booking id yields 404."""
    api_client.force_authenticate(trainer_user)

    resp = api_client.post(
        '/api/bookings/999999/confirm-attendance/',
        {'attended': True}, format='json',
    )

    assert resp.status_code == 404


@pytest.mark.django_db
def test_foreign_trainer_cannot_confirm_attendance(api_client, past_booking):
    """A trainer not assigned to the booking is rejected with 403."""
    foreign = User.objects.create_user(
        email='foreign-attendance@example.com', password='x', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=foreign)
    api_client.force_authenticate(foreign)

    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_cannot_confirm_attendance_on_canceled_booking(api_client, trainer_user, past_booking):
    """A canceled session cannot receive an attendance confirmation."""
    past_booking.status = Booking.Status.CANCELED
    past_booking.save(update_fields=['status'])
    api_client.force_authenticate(trainer_user)

    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': True}, format='json',
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_confirm_attendance_requires_boolean_attended(api_client, trainer_user, past_booking):
    """A non-boolean attended payload is rejected with 400."""
    api_client.force_authenticate(trainer_user)

    resp = api_client.post(
        f'/api/bookings/{past_booking.pk}/confirm-attendance/',
        {'attended': 'yes'}, format='json',
    )

    assert resp.status_code == 400
