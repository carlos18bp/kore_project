"""Tests for the most_failed_exercises and most_failed_meal_blocks aggregates
in TrainerComparativeMetricsView.
"""

from datetime import datetime, timedelta
from datetime import timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Exercise,
    Package,
    TrainerProfile,
    User,
)
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
    ProgramExercise,
)
from core_app.models.nutrition_daily_log import MealEntry, NutritionDailyLog

FIXED_NOW = datetime(2026, 5, 5, 8, 0, 0, tzinfo=dt_tz.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='trainer-cm-failed@test.com', password='pass',
        first_name='Ana', last_name='Garcia', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym A')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer-cm-failed@test.com', password='pass',
        first_name='Carlos', last_name='Lopez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Test', sessions_count=8, validity_days=30, price='200000.00',
    )


@pytest.fixture
def linked_booking(trainer, customer, package):
    slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1),
        is_active=True, is_blocked=True,
    )
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        slot=slot, status=Booking.Status.CONFIRMED,
    )


@pytest.fixture
def program(customer):
    today = FIXED_NOW.date()
    return MonthlyProgram.objects.create(
        customer=customer,
        fitness_level=2,
        goal='general_health',
        start_date=today - timedelta(days=10),
        end_date=today + timedelta(days=20),
        status=MonthlyProgram.Status.PUBLISHED,
    )


@pytest.fixture
def exercises(db):
    sentadilla = Exercise.objects.create(name='Sentadilla', pattern='squat')
    plancha = Exercise.objects.create(name='Plancha', pattern='core')
    flexion = Exercise.objects.create(name='Flexión', pattern='push')
    return sentadilla, plancha, flexion


def _make_skipped_logs(program, customer, exercise, n_skipped):
    """Create n_skipped daily logs (one per day) where the given exercise is skipped."""
    today = FIXED_NOW.date()
    for i in range(n_skipped):
        d = today - timedelta(days=i)
        pd, _ = ProgramDay.objects.get_or_create(
            program=program,
            day_number=10 - i,
            defaults={'date': d, 'day_type': ProgramDay.DayType.TRAINING},
        )
        pe, _ = ProgramExercise.objects.get_or_create(
            program_day=pd,
            exercise=exercise,
            defaults={'sets': 3, 'reps': 10, 'rest_seconds': 60, 'order': 0},
        )
        dl, _ = DailyLog.objects.get_or_create(
            customer=customer,
            program=program,
            date=d,
        )
        ExerciseLog.objects.create(
            daily_log=dl,
            program_exercise=pe,
            status=ExerciseLog.Status.SKIPPED,
        )


@pytest.mark.django_db
class TestMostFailedAggregates:

    def test_response_includes_new_keys(self, api_client, trainer, customer, linked_booking, program):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        assert 'most_failed_exercises' in resp.data
        assert 'most_failed_meal_blocks' in resp.data
        assert resp.data['most_failed_exercises'] == []
        assert resp.data['most_failed_meal_blocks'] == []

    def test_exercises_aggregated_and_ordered_by_count(
        self, api_client, trainer, customer, linked_booking, program, exercises
    ):
        sentadilla, plancha, flexion = exercises
        _make_skipped_logs(program, customer, sentadilla, n_skipped=3)
        _make_skipped_logs(program, customer, plancha, n_skipped=1)
        _make_skipped_logs(program, customer, flexion, n_skipped=2)

        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        names = [e['name'] for e in resp.data['most_failed_exercises']]
        counts = [e['count'] for e in resp.data['most_failed_exercises']]
        assert names == ['Sentadilla', 'Flexión', 'Plancha']
        assert counts == [3, 2, 1]

    def test_meal_blocks_aggregated(
        self, api_client, trainer, customer, linked_booking, program
    ):
        today = FIXED_NOW.date()
        for i, block in enumerate([
            MealEntry.MealBlock.BREAKFAST,
            MealEntry.MealBlock.BREAKFAST,
            MealEntry.MealBlock.LUNCH,
        ]):
            d = today - timedelta(days=i)
            log = NutritionDailyLog.objects.create(
                customer=customer,
                date=d,
            )
            MealEntry.objects.create(
                daily_log=log,
                meal_block=block,
                status=MealEntry.Status.SKIPPED,
            )

        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        meals = resp.data['most_failed_meal_blocks']
        breakfast = next((m for m in meals if m['block'] == MealEntry.MealBlock.BREAKFAST), None)
        lunch = next((m for m in meals if m['block'] == MealEntry.MealBlock.LUNCH), None)
        assert breakfast is not None and breakfast['count'] == 2
        assert lunch is not None and lunch['count'] == 1

    def test_other_trainer_customers_excluded(
        self, api_client, trainer, customer, linked_booking, program, exercises
    ):
        sentadilla, _, _ = exercises
        _make_skipped_logs(program, customer, sentadilla, n_skipped=2)

        # Another trainer + customer with skipped logs — must not leak into our trainer's response
        other_trainer_user = User.objects.create_user(
            email='other-trainer-cm@test.com', password='pass', role=User.Role.TRAINER,
        )
        other_trainer = TrainerProfile.objects.create(user=other_trainer_user, location='Gym B')
        other_customer = User.objects.create_user(
            email='other-cust-cm@test.com', password='pass', role=User.Role.CUSTOMER,
        )
        other_program = MonthlyProgram.objects.create(
            customer=other_customer,
            fitness_level=2,
            goal='general_health',
            start_date=FIXED_NOW.date() - timedelta(days=10),
            end_date=FIXED_NOW.date() + timedelta(days=20),
            status=MonthlyProgram.Status.PUBLISHED,
        )
        _make_skipped_logs(other_program, other_customer, sentadilla, n_skipped=5)

        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        ex = resp.data['most_failed_exercises']
        assert len(ex) == 1
        assert ex[0]['name'] == 'Sentadilla'
        assert ex[0]['count'] == 2  # not 7
