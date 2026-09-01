import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from core_app.models import (
    DailyLog, Exercise, ExerciseLog, MonthlyProgram, ProgramDay,
    ProgramExercise, TrainerProfile, User,
)
from core_app.models.credit import CreditTransaction
from core_app.models.monthly_program import ExerciseCapture
from core_app.services import credit_engine


def _tiny_image(name='cap.jpg'):
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), (90, 90, 90)).save(buf, 'JPEG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/jpeg')


def _training_log_with_capture(customer, today):
    program = MonthlyProgram.objects.create(
        customer=customer, fitness_level=3, goal='fuerza',
        start_date=today, end_date=today, status=MonthlyProgram.Status.PUBLISHED,
    )
    day = ProgramDay.objects.create(
        program=program, day_number=1, date=today, day_type=ProgramDay.DayType.TRAINING,
    )
    exercise = Exercise.objects.create(name='Sentadilla', youtube_url='https://youtu.be/x')
    pe = ProgramExercise.objects.create(program_day=day, exercise=exercise)
    log = DailyLog.objects.create(customer=customer, program=program, date=today, is_closed=True)
    el = ExerciseLog.objects.create(
        daily_log=log, program_exercise=pe, status=ExerciseLog.Status.COMPLETED,
    )
    ExerciseCapture.objects.create(exercise_log=el, image=_tiny_image())
    return log


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
def test_pending_reviews_lists_only_own_clients(api_client, trainer_user, assigned_customer, frozen_now):
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1,
        'Registraste tu almuerzo', status=CreditTransaction.Status.PENDING,
        review_deadline=frozen_now,
    )
    other = User.objects.create_user(email='o@example.com', password='x', role=User.Role.CUSTOMER)
    credit_engine.award(
        other, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 2,
        'Cena', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )
    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')
    assert resp.status_code == 200
    results = resp.json()['results']
    assert len(results) == 1
    assert results[0]['customer_email'] == assigned_customer.email


@pytest.mark.django_db
def test_review_approve_and_reject(api_client, trainer_user, assigned_customer, frozen_now):
    tx1 = credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 3,
        'Almuerzo', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )
    tx2 = credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 4,
        'Cena', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )
    api_client.force_authenticate(trainer_user)
    assert api_client.post(
        f'/api/trainer/credits/transactions/{tx1.pk}/review/',
        {'decision': 'approve'}, format='json',
    ).status_code == 200
    assert api_client.post(
        f'/api/trainer/credits/transactions/{tx2.pk}/review/',
        {'decision': 'reject', 'note': 'Foto borrosa'}, format='json',
    ).status_code == 200
    assert credit_engine.get_wallet(assigned_customer).balance == 5


@pytest.mark.django_db
def test_pending_reviews_attaches_workout_capture_photos(api_client, trainer_user, assigned_customer, frozen_now):
    log = _training_log_with_capture(assigned_customer, frozen_now.date())
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.WORKOUT_DAY, 'daily_log', log.pk,
        'Entrenamiento', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )

    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')

    assert resp.status_code == 200
    row = next(r for r in resp.json()['results'] if r['reference_type'] == 'daily_log')
    assert len(row['photos']) == 1
    assert row['photos'][0].endswith('.jpg')
    assert row['photo_url'] == row['photos'][0]


@pytest.mark.django_db
def test_pending_reviews_meal_photo_uses_photos_list(api_client, trainer_user, assigned_customer, frozen_now):
    from core_app.models import MealEntry, NutritionDailyLog
    dlog = NutritionDailyLog.objects.create(customer=assigned_customer, date=frozen_now.date())
    meal = MealEntry.objects.create(
        daily_log=dlog, meal_block='almuerzo', status=MealEntry.Status.COMPLETED,
        photo=_tiny_image('meal.jpg'),
    )
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', meal.pk,
        'Almuerzo', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )

    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')

    row = next(r for r in resp.json()['results'] if r['reference_type'] == 'meal_entry')
    assert row['photos'] == [row['photo_url']]
    assert row['photo_url'].endswith('.jpg')


@pytest.mark.django_db
def test_settings_put_reseeds_on_difficulty_change(api_client, trainer_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.put(
        '/api/credits/settings/',
        {'difficulty': 'hard', 'action_values': {}, 'streak_bonuses': {}},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.json()['action_values']['session_attended'] == 40
