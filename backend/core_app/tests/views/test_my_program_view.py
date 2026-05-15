"""Contract tests: MyProgramView / TodayProgramView return 200 + null when
the authenticated customer has no published MonthlyProgram (previously 404).

This avoids logging spurious 'Not Found' warnings for the normal empty-state
of a fresh customer, and lets the frontend distinguish 'no program' from a
real transport error.
"""
from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import User
from core_app.models.exercise import Exercise
from core_app.models.monthly_program import MonthlyProgram, ProgramDay, ProgramExercise


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='mp-customer@test.com', password='p',
        first_name='Pat', last_name='Mp', role=User.Role.CUSTOMER,
    )


def _published_program(customer, *, start, training_today=True):
    program = MonthlyProgram.objects.create(
        customer=customer, fitness_level=1, goal='general_health',
        start_date=start, end_date=start + timedelta(days=27),
        status=MonthlyProgram.Status.PUBLISHED,
    )
    ex = Exercise.objects.create(
        name='Pushup', pattern='Empuje', fitness_level_min=1,
        goal_tags=['general_health'], is_active=True, youtube_url='https://x/y',
    )
    pd = ProgramDay.objects.create(
        program=program, day_number=1, date=start,
        day_type=ProgramDay.DayType.TRAINING if training_today else ProgramDay.DayType.REST,
    )
    if training_today:
        ProgramExercise.objects.create(program_day=pd, exercise=ex, sets=3, reps=10, order=0)
    return program


@pytest.mark.django_db
class TestMyProgramView:
    def test_returns_200_with_null_when_no_program(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is None

    def test_returns_200_with_program_payload_when_program_exists(self, api_client, customer):
        _published_program(customer, start=date.today())
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is not None
        assert response.data['status'] == 'published'

    def test_unauthenticated_still_401(self, api_client):
        # 401 (not 200) on missing auth — the empty-state contract only kicks in
        # *after* auth succeeds.
        response = api_client.get(reverse('my-program'))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTodayProgramView:
    def test_returns_200_with_null_when_no_program(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-today'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is None

    def test_returns_200_with_null_when_program_exists_but_no_day_for_today(
        self, api_client, customer
    ):
        # Program that ended yesterday — no ProgramDay matches today.
        _published_program(customer, start=date.today() - timedelta(days=60))
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-today'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is None

    def test_returns_payload_when_today_is_a_program_day(self, api_client, customer):
        _published_program(customer, start=date.today())
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-today'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is not None
        assert 'program_day' in response.data
        assert 'daily_log' in response.data
