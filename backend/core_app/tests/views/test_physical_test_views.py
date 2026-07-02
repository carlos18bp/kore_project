import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from core_app.models import TrainerProfile, User


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def assigned_customer(existing_user, trainer_user):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user


@pytest.mark.django_db
def test_trainer_records_physical_test(api_client, trainer_user, assigned_customer):
    api_client.force_authenticate(trainer_user)
    resp = api_client.post('/api/trainer/physical-tests/', {
        'customer': assigned_customer.pk,
        'performed_at': timezone.localdate().isoformat(),
        'result': 'passed',
        'notes': 'Buen progreso',
    }, format='json')
    assert resp.status_code == 201
    data = resp.json()
    assert data['trainer'] == trainer_user.trainer_profile.pk
    # The credit award fires via the post_save signal → on_commit → Huey chain,
    # which pytest's transaction wrapper suppresses; the award rule itself is
    # covered by test_credit_events.py::test_passed_physical_test_awards.


@pytest.mark.django_db
def test_trainer_cannot_record_test_for_unassigned_customer(api_client, trainer_user, existing_user):
    # existing_user has NO assigned_trainer here — scope check must fail closed
    api_client.force_authenticate(trainer_user)
    resp = api_client.post('/api/trainer/physical-tests/', {
        'customer': existing_user.pk,
        'performed_at': timezone.localdate().isoformat(),
        'result': 'passed',
    }, format='json')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_customer_cannot_create_physical_test(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/trainer/physical-tests/', {
        'customer': existing_user.pk,
        'performed_at': timezone.localdate().isoformat(),
        'result': 'passed',
    }, format='json')
    assert resp.status_code == 403


def _png_upload(name='c.png'):
    # 1x1 transparent PNG
    png = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xff'
        b'\xff?\x03\x00\x08\xfc\x02\xfe\xa7\x9a\xa0\xa0\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    return SimpleUploadedFile(name, png, content_type='image/png')


@pytest.mark.django_db
def test_capture_upload_rejects_closed_log(api_client, existing_user):
    from datetime import timedelta
    from core_app.models import (
        DailyLog, Exercise, ExerciseLog, MonthlyProgram, ProgramDay, ProgramExercise,
    )
    today = timezone.localdate()
    program = MonthlyProgram.objects.create(
        customer=existing_user, fitness_level=3, goal='fuerza',
        start_date=today - timedelta(days=1), end_date=today + timedelta(days=26),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    day = ProgramDay.objects.create(program=program, day_number=2, date=today, day_type='training')
    ex = Exercise.objects.create(name='Plancha', youtube_url='https://youtu.be/y')
    pe = ProgramExercise.objects.create(program_day=day, exercise=ex)
    log = DailyLog.objects.create(customer=existing_user, program=program, date=today, is_closed=True)
    ex_log = ExerciseLog.objects.create(daily_log=log, program_exercise=pe)

    api_client.force_authenticate(existing_user)
    resp = api_client.post(
        f'/api/my-program/logs/{log.pk}/exercises/{ex_log.pk}/captures/',
        {'image': _png_upload()}, format='multipart',
    )
    assert resp.status_code == 400
