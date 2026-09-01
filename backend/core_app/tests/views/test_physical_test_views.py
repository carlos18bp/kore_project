import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from core_app.models import TrainerProfile, User
from core_app.models.physical_test import PhysicalTest


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def staff_trainer_user(db):
    user = User.objects.create_user(
        email='staff-trainer@example.com', password='x',
        first_name='S', last_name='T', role=User.Role.TRAINER, is_staff=True,
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


@pytest.mark.django_db
def test_trainer_list_scoped_to_assigned_customers(api_client, trainer_user, assigned_customer):
    """GET returns only tests belonging to the trainer's assigned customers."""
    unassigned = User.objects.create_user(
        email='loose-customer@example.com', password='x', role=User.Role.CUSTOMER,
    )
    visible = PhysicalTest.objects.create(
        customer=assigned_customer, trainer=trainer_user.trainer_profile,
        performed_at=timezone.localdate(), result=PhysicalTest.Result.PASSED,
    )
    PhysicalTest.objects.create(
        customer=unassigned,
        performed_at=timezone.localdate(), result=PhysicalTest.Result.FAILED,
    )
    api_client.force_authenticate(trainer_user)

    resp = api_client.get('/api/trainer/physical-tests/')

    assert resp.status_code == 200
    assert [t['id'] for t in resp.json()['results']] == [visible.pk]


@pytest.mark.django_db
def test_staff_trainer_list_filters_by_customer_param(api_client, staff_trainer_user, existing_user):
    """A staff trainer sees the unscoped queryset narrowed by ?customer=."""
    other = User.objects.create_user(
        email='second-customer@example.com', password='x', role=User.Role.CUSTOMER,
    )
    PhysicalTest.objects.create(
        customer=existing_user,
        performed_at=timezone.localdate(), result=PhysicalTest.Result.PASSED,
    )
    PhysicalTest.objects.create(
        customer=other,
        performed_at=timezone.localdate(), result=PhysicalTest.Result.PASSED,
    )
    api_client.force_authenticate(staff_trainer_user)

    resp = api_client.get(f'/api/trainer/physical-tests/?customer={existing_user.pk}')

    assert resp.status_code == 200
    assert [t['customer'] for t in resp.json()['results']] == [existing_user.pk]


@pytest.mark.django_db
def test_staff_trainer_records_test_for_unassigned_customer(api_client, staff_trainer_user, existing_user):
    """A staff (admin-privileged) trainer may record a test without assignment."""
    api_client.force_authenticate(staff_trainer_user)

    resp = api_client.post('/api/trainer/physical-tests/', {
        'customer': existing_user.pk,
        'performed_at': timezone.localdate().isoformat(),
        'result': 'passed',
    }, format='json')

    assert resp.status_code == 201
    assert resp.json()['trainer'] == staff_trainer_user.trainer_profile.pk


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
