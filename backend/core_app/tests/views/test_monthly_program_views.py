"""Tests for monthly_program_views.py — targeting coverage above 70%.

Covers:
  - GenerateProgramView (POST /api/monthly-programs/generate/)
  - ProgramDetailView  (GET  /api/monthly-programs/<id>/)
  - ApproveProgramView  (PATCH /api/monthly-programs/<id>/approve/)
  - DeleteProgramView   (DELETE /api/monthly-programs/<id>/delete/)
  - EditProgramExerciseView (PATCH …/days/<day>/exercises/<ex>/)
  - CustomerProgramListView (GET /api/monthly-programs/customer/<id>/)
  - MyProgramView      (GET /api/my-program/)    — light smoke (heavy contract in test_my_program_view)
  - TodayProgramView   (GET /api/my-program/today/) — closed log pruning path
  - UpdateExerciseLogView (PATCH /api/my-program/logs/<log>/exercises/<ex_log>/)
"""
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Package, TrainerProfile, User
from core_app.models.exercise import Exercise
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
    ProgramExercise,
)


# ---------------------------------------------------------------------------
# Shared helpers / fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='mp-trainer@test.com', password='pass',
        first_name='Trainer', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    return TrainerProfile.objects.create(user=trainer_user, location='Gym')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='mp-customer@test.com', password='pass',
        first_name='Customer', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def other_user(db):
    """A plain customer not used in most tests — useful for auth checks."""
    return User.objects.create_user(
        email='mp-other@test.com', password='pass',
        first_name='Other', last_name='User', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def exercise(db):
    return Exercise.objects.create(
        name='Squat', pattern='Sentadilla', fitness_level_min=1,
        goal_tags=['general_health'], is_active=True,
        youtube_url='https://yt.com/squat',
    )


@pytest.fixture
def draft_program(customer):
    today = date.today()
    return MonthlyProgram.objects.create(
        customer=customer, fitness_level=1, goal='general_health',
        start_date=today, end_date=today + timedelta(days=27),
        status=MonthlyProgram.Status.DRAFT,
    )


@pytest.fixture
def published_program(customer):
    today = date.today()
    return MonthlyProgram.objects.create(
        customer=customer, fitness_level=1, goal='weight_loss',
        start_date=today, end_date=today + timedelta(days=27),
        status=MonthlyProgram.Status.PUBLISHED,
    )


def _make_program_day_and_exercise(program, target_date, exercise):
    """Helper: create a ProgramDay + ProgramExercise for the given date."""
    pd = ProgramDay.objects.create(
        program=program, day_number=1, date=target_date,
        day_type=ProgramDay.DayType.TRAINING,
    )
    pe = ProgramExercise.objects.create(
        program_day=pd, exercise=exercise, sets=3, reps=10, order=0,
    )
    return pd, pe


# ---------------------------------------------------------------------------
# GenerateProgramView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGenerateProgramView:

    URL = 'monthly-program-generate'

    def test_non_trainer_gets_403(self, api_client, other_user):
        api_client.force_authenticate(user=other_user)
        resp = api_client.post(reverse(self.URL), {'customer_id': 99}, format='json')
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_missing_customer_id_returns_400(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.post(reverse(self.URL), {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_nonexistent_customer_returns_404(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.post(reverse(self.URL), {'customer_id': 999999}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_invalid_start_date_returns_400(self, api_client, trainer_user, customer):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.post(reverse(self.URL), {
            'customer_id': customer.pk,
            'start_date': 'not-a-date',
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_existing_draft_without_regenerate_returns_409(self, api_client, trainer_user, customer, draft_program):
        api_client.force_authenticate(user=trainer_user)
        # No start_date → not a regeneration → conflict
        with patch('core_app.views.monthly_program_views.generate_monthly_program') as mock_gen:
            mock_gen.return_value = draft_program
            resp = api_client.post(reverse(self.URL), {'customer_id': customer.pk}, format='json')
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_regenerate_deletes_existing_draft_and_creates_new(self, api_client, trainer_user, customer, draft_program):
        api_client.force_authenticate(user=trainer_user)
        new_program = MonthlyProgram(
            pk=9999, customer=customer, fitness_level=1, goal='general_health',
            start_date=date.today(), end_date=date.today() + timedelta(days=27),
            status=MonthlyProgram.Status.DRAFT,
        )
        with patch('core_app.views.monthly_program_views.generate_monthly_program') as mock_gen:
            mock_gen.return_value = new_program
            resp = api_client.post(reverse(self.URL), {
                'customer_id': customer.pk,
                'start_date': date.today().isoformat(),
            }, format='json')
        # Existing draft should be deleted, mock returns new program
        assert resp.status_code == status.HTTP_201_CREATED
        assert MonthlyProgram.objects.filter(pk=draft_program.pk).count() == 0

    def test_successful_generation_returns_201(self, api_client, trainer_user, customer):
        api_client.force_authenticate(user=trainer_user)
        fake_program = MonthlyProgram(
            pk=42, customer=customer, fitness_level=1, goal='general_health',
            start_date=date.today(), end_date=date.today() + timedelta(days=27),
            status=MonthlyProgram.Status.DRAFT,
        )
        with patch('core_app.views.monthly_program_views.generate_monthly_program') as mock_gen:
            mock_gen.return_value = fake_program
            resp = api_client.post(reverse(self.URL), {'customer_id': customer.pk}, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert 'id' in resp.data
        assert resp.data['status'] == MonthlyProgram.Status.DRAFT

    def test_derives_start_date_from_latest_published_program(self, api_client, trainer_user, customer, published_program):
        """When no start_date supplied and there is a published program,
        the start_date is derived from published_program.end_date + 1 day."""
        api_client.force_authenticate(user=trainer_user)
        # No existing draft → no conflict
        expected_start = published_program.end_date + timedelta(days=1)
        captured = {}

        def _mock_gen(customer_id, start_date):
            captured['start_date'] = start_date
            prg = MonthlyProgram(
                pk=43, customer=customer, fitness_level=1, goal='general_health',
                start_date=start_date, end_date=start_date + timedelta(days=27),
                status=MonthlyProgram.Status.DRAFT,
            )
            return prg

        with patch('core_app.views.monthly_program_views.generate_monthly_program', side_effect=_mock_gen):
            resp = api_client.post(reverse(self.URL), {'customer_id': customer.pk}, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert captured['start_date'] == expected_start

    def test_unauthenticated_returns_401(self, api_client, customer):
        resp = api_client.post(reverse(self.URL), {'customer_id': customer.pk}, format='json')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# ProgramDetailView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProgramDetailView:

    def test_trainer_can_retrieve_draft(self, api_client, trainer_user, draft_program):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.get(reverse('monthly-program-detail', args=[draft_program.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['id'] == draft_program.pk

    def test_nonexistent_program_returns_404(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.get(reverse('monthly-program-detail', args=[999999]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_non_trainer_returns_403(self, api_client, other_user, draft_program):
        api_client.force_authenticate(user=other_user)
        resp = api_client.get(reverse('monthly-program-detail', args=[draft_program.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# ApproveProgramView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestApproveProgramView:

    def test_draft_transitions_to_published(self, api_client, trainer_user, draft_program):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(
            reverse('monthly-program-approve', args=[draft_program.pk]),
            {'trainer_notes': 'Buena semana.'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        draft_program.refresh_from_db()
        assert draft_program.status == MonthlyProgram.Status.PUBLISHED
        assert draft_program.trainer_notes == 'Buena semana.'

    def test_published_program_returns_404(self, api_client, trainer_user, published_program):
        """ApproveProgramView looks for status=DRAFT only → 404 for published."""
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(
            reverse('monthly-program-approve', args=[published_program.pk]),
            {},
            format='json',
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_nonexistent_program_returns_404(self, api_client, trainer_user):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(reverse('monthly-program-approve', args=[999999]), {}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_non_trainer_returns_403(self, api_client, other_user, draft_program):
        api_client.force_authenticate(user=other_user)
        resp = api_client.patch(
            reverse('monthly-program-approve', args=[draft_program.pk]), {}, format='json',
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# DeleteProgramView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDeleteProgramView:

    def test_trainer_can_delete_draft(self, api_client, trainer_user, draft_program):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.delete(reverse('monthly-program-delete', args=[draft_program.pk]))
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not MonthlyProgram.objects.filter(pk=draft_program.pk).exists()

    def test_cannot_delete_published_program(self, api_client, trainer_user, published_program):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.delete(reverse('monthly-program-delete', args=[published_program.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_non_trainer_returns_403(self, api_client, other_user, draft_program):
        api_client.force_authenticate(user=other_user)
        resp = api_client.delete(reverse('monthly-program-delete', args=[draft_program.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# CustomerProgramListView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCustomerProgramListView:

    def test_trainer_can_list_programs_for_customer(self, api_client, trainer_user, customer, draft_program, published_program):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.get(reverse('customer-program-list', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 2

    def test_empty_list_for_customer_with_no_programs(self, api_client, trainer_user, customer):
        api_client.force_authenticate(user=trainer_user)
        resp = api_client.get(reverse('customer-program-list', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == []

    def test_non_trainer_returns_403(self, api_client, other_user, customer):
        api_client.force_authenticate(user=other_user)
        resp = api_client.get(reverse('customer-program-list', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# EditProgramExerciseView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestEditProgramExerciseView:

    def test_trainer_can_update_exercise_params(self, api_client, trainer_user, draft_program, exercise):
        today = date.today()
        pd, pe = _make_program_day_and_exercise(draft_program, today, exercise)

        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(
            reverse('monthly-program-edit-exercise', args=[draft_program.pk, pd.pk, pe.pk]),
            {'sets': 5, 'reps': 12},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        pe.refresh_from_db()
        assert pe.sets == 5
        assert pe.reps == 12

    def test_invalid_program_exercise_returns_404(self, api_client, trainer_user, draft_program, exercise):
        today = date.today()
        pd, pe = _make_program_day_and_exercise(draft_program, today, exercise)

        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(
            reverse('monthly-program-edit-exercise', args=[draft_program.pk, pd.pk, 999999]),
            {'sets': 5},
            format='json',
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_swap_to_nonexistent_exercise_returns_404(self, api_client, trainer_user, draft_program, exercise):
        today = date.today()
        pd, pe = _make_program_day_and_exercise(draft_program, today, exercise)

        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(
            reverse('monthly-program-edit-exercise', args=[draft_program.pk, pd.pk, pe.pk]),
            {'exercise_id': 999999},
            format='json',
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_swap_to_valid_exercise(self, api_client, trainer_user, draft_program, exercise):
        new_exercise = Exercise.objects.create(
            name='Lunge', pattern='Estocada', fitness_level_min=1,
            goal_tags=['general_health'], is_active=True,
        )
        today = date.today()
        pd, pe = _make_program_day_and_exercise(draft_program, today, exercise)

        api_client.force_authenticate(user=trainer_user)
        resp = api_client.patch(
            reverse('monthly-program-edit-exercise', args=[draft_program.pk, pd.pk, pe.pk]),
            {'exercise_id': new_exercise.pk},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        pe.refresh_from_db()
        assert pe.exercise_id == new_exercise.pk

    def test_non_trainer_returns_403(self, api_client, other_user, draft_program, exercise):
        today = date.today()
        pd, pe = _make_program_day_and_exercise(draft_program, today, exercise)

        api_client.force_authenticate(user=other_user)
        resp = api_client.patch(
            reverse('monthly-program-edit-exercise', args=[draft_program.pk, pd.pk, pe.pk]),
            {'sets': 5},
            format='json',
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# UpdateExerciseLogView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUpdateExerciseLogView:

    @pytest.fixture
    def log_and_exercise_log(self, customer, published_program, exercise):
        today = date.today()
        pd, pe = _make_program_day_and_exercise(published_program, today, exercise)
        daily_log = DailyLog.objects.create(
            customer=customer, program=published_program, date=today, is_closed=False,
        )
        ex_log = ExerciseLog.objects.create(
            daily_log=daily_log, program_exercise=pe,
            status=ExerciseLog.Status.NOT_DONE,
        )
        return daily_log, ex_log

    def test_customer_can_mark_exercise_completed(self, api_client, customer, log_and_exercise_log):
        daily_log, ex_log = log_and_exercise_log
        api_client.force_authenticate(user=customer)
        resp = api_client.patch(
            reverse('my-program-update-exercise-log', args=[daily_log.pk, ex_log.pk]),
            {'status': 'completed'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        ex_log.refresh_from_db()
        assert ex_log.status == ExerciseLog.Status.COMPLETED

    def test_customer_can_mark_exercise_skipped(self, api_client, customer, log_and_exercise_log):
        daily_log, ex_log = log_and_exercise_log
        api_client.force_authenticate(user=customer)
        resp = api_client.patch(
            reverse('my-program-update-exercise-log', args=[daily_log.pk, ex_log.pk]),
            {'status': 'skipped', 'notes': 'Me lesioné'},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        ex_log.refresh_from_db()
        assert ex_log.status == ExerciseLog.Status.SKIPPED
        assert ex_log.notes == 'Me lesioné'

    def test_invalid_status_returns_400(self, api_client, customer, log_and_exercise_log):
        daily_log, ex_log = log_and_exercise_log
        api_client.force_authenticate(user=customer)
        resp = api_client.patch(
            reverse('my-program-update-exercise-log', args=[daily_log.pk, ex_log.pk]),
            {'status': 'invalid_status'},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_closed_log_returns_400(self, api_client, customer, log_and_exercise_log):
        daily_log, ex_log = log_and_exercise_log
        daily_log.is_closed = True
        daily_log.save(update_fields=['is_closed'])
        api_client.force_authenticate(user=customer)
        resp = api_client.patch(
            reverse('my-program-update-exercise-log', args=[daily_log.pk, ex_log.pk]),
            {'status': 'completed'},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_nonexistent_log_returns_404(self, api_client, customer, log_and_exercise_log):
        daily_log, ex_log = log_and_exercise_log
        api_client.force_authenticate(user=customer)
        resp = api_client.patch(
            reverse('my-program-update-exercise-log', args=[daily_log.pk, 999999]),
            {'status': 'completed'},
            format='json',
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_another_customer_cannot_update(self, api_client, other_user, log_and_exercise_log):
        daily_log, ex_log = log_and_exercise_log
        api_client.force_authenticate(user=other_user)
        resp = api_client.patch(
            reverse('my-program-update-exercise-log', args=[daily_log.pk, ex_log.pk]),
            {'status': 'completed'},
            format='json',
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
