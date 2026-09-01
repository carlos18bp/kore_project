from datetime import timedelta

import pytest

from core_app.models import Booking, Package, TrainerProfile, User


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def client_booking(existing_user, trainer_user, frozen_now):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    package = Package.objects.create(title='P')
    return Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=frozen_now - timedelta(hours=2), ends_at=frozen_now - timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_client_sessions_payload_includes_attendance(api_client, trainer_user, client_booking, existing_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.get(f'/api/trainer/my-clients/{existing_user.pk}/sessions/')
    assert resp.status_code == 200
    row = resp.json()[0]
    assert row['attendance_status'] == 'unset'
    assert row['attendance_confirmed_at'] is None


@pytest.mark.django_db
def test_agenda_payload_includes_attendance(api_client, trainer_user, client_booking, frozen_now):
    api_client.force_authenticate(trainer_user)
    day = frozen_now.date().isoformat()
    resp = api_client.get(f'/api/trainer/agenda/?from={day}&to={day}')
    assert resp.status_code == 200
    session = resp.json()['sessions'][0]
    assert session['attendance_status'] == 'unset'
    assert session['attendance_confirmed_at'] is None
