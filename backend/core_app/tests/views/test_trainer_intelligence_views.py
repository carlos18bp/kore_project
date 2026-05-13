"""Integration tests for TrainerIntelligenceCenter views.

Covers: risk dashboard ordering, alert resolution, photo comment,
program pause/resume, and basic permission checks.
"""

from datetime import datetime
from datetime import timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import (
    Booking,
    ClientRiskScore,
    Package,
    TrainerAlertResolution,
    TrainerProfile,
    User,
)
from core_app.models.monthly_program import MonthlyProgram
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
        email='trainer-intel@test.com', password='pass',
        first_name='Ana', last_name='Garcia', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym A')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer-intel@test.com', password='pass',
        first_name='Carlos', last_name='Lopez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def other_customer(db):
    return User.objects.create_user(
        email='other-intel@test.com', password='pass',
        first_name='Pedro', last_name='Ramirez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Test', sessions_count=8, validity_days=30, price='200000.00',
    )


@pytest.fixture
def booking(trainer, customer, package):
    slot_time = FIXED_NOW
    from core_app.models import AvailabilitySlot
    slot = AvailabilitySlot.objects.create(
        starts_at=slot_time,
        ends_at=slot_time.replace(hour=9),
        is_active=True,
        is_blocked=True,
    )
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        slot=slot, status=Booking.Status.CONFIRMED,
    )


# ── TrainerRiskDashboardView ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerRiskDashboardView:
    def test_returns_200_for_trainer(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        assert 'risk_summary' in resp.data
        assert 'clients_by_risk' in resp.data

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_requires_authentication(self, api_client):
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_ordered_alto_before_bajo(self, api_client, trainer, customer, other_customer, package):
        _auth(api_client, trainer.user)
        from core_app.models import AvailabilitySlot
        for i, cust in enumerate([customer, other_customer]):
            from datetime import timedelta
            t = FIXED_NOW + timedelta(hours=i * 2)
            slot = AvailabilitySlot.objects.create(
                starts_at=t, ends_at=t + timedelta(hours=1),
                is_active=True, is_blocked=True,
            )
            Booking.objects.create(
                customer=cust, trainer=trainer, package=package,
                slot=slot, status=Booking.Status.CONFIRMED,
            )

        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.BAJO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        ClientRiskScore.objects.create(
            customer=other_customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )

        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        clients = resp.data['clients_by_risk']
        levels = [c['level'] for c in clients]
        assert levels.index('alto') < levels.index('bajo')

    def test_stale_scores_excluded(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[], clinical_signals=[], is_stale=True,
            computed_at=FIXED_NOW,
        )
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['risk_summary']['alto'] == 0

    def test_summary_counts_correct(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.MEDIO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.data['risk_summary']['medio'] == 1
        assert resp.data['risk_summary']['alto'] == 0


# ── TrainerAlertResolveView ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerAlertResolveView:
    @pytest.fixture
    def risk_score(self, trainer, customer, booking):
        return ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[{'type': 'inactivity_7d', 'severity': 'medio'}],
            clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )

    def test_creates_resolution_with_note(self, api_client, trainer, risk_score):
        _auth(api_client, trainer.user)
        url = reverse('trainer-alert-resolve', args=[risk_score.pk])
        resp = api_client.post(url, {
            'signal_type': 'inactivity_7d',
            'resolution_type': 'mark_reviewed',
            'note': 'Cliente notificado.',
            'is_public': False,
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['resolution_type'] == 'mark_reviewed'
        assert TrainerAlertResolution.objects.filter(risk_score=risk_score).count() == 1

    def test_requires_note(self, api_client, trainer, risk_score):
        _auth(api_client, trainer.user)
        url = reverse('trainer-alert-resolve', args=[risk_score.pk])
        resp = api_client.post(url, {
            'signal_type': 'inactivity_7d',
            'resolution_type': 'mark_reviewed',
            'note': '',
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_invalid_resolution_type(self, api_client, trainer, risk_score):
        _auth(api_client, trainer.user)
        url = reverse('trainer-alert-resolve', args=[risk_score.pk])
        resp = api_client.post(url, {
            'signal_type': 'inactivity_7d',
            'resolution_type': 'invalid_type',
            'note': 'Test',
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_404_for_other_trainer_score(self, api_client, customer, package, risk_score):
        other_trainer_user = User.objects.create_user(
            email='other-trainer@test.com', password='pass', role=User.Role.TRAINER,
        )
        other_trainer = TrainerProfile.objects.create(user=other_trainer_user, location='Gym B')
        _auth(api_client, other_trainer_user)
        url = reverse('trainer-alert-resolve', args=[risk_score.pk])
        resp = api_client.post(url, {
            'resolution_type': 'mark_reviewed', 'note': 'Test',
        }, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_trainer_auth(self, api_client, customer, risk_score):
        _auth(api_client, customer)
        url = reverse('trainer-alert-resolve', args=[risk_score.pk])
        resp = api_client.post(url, {'resolution_type': 'mark_reviewed', 'note': 'x'}, format='json')
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── TrainerMealCommentView ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerMealCommentView:
    @pytest.fixture
    def meal_entry(self, customer):
        log = NutritionDailyLog.objects.create(
            customer=customer, date=FIXED_NOW.date(), is_closed=False,
        )
        return MealEntry.objects.create(
            daily_log=log,
            meal_block='desayuno',
            status='logged',
        )

    def test_saves_comment_and_flag(self, api_client, trainer, customer, booking, meal_entry):
        _auth(api_client, trainer.user)
        url = reverse('trainer-meal-comment', args=[meal_entry.pk])
        resp = api_client.patch(url, {
            'trainer_comment': 'Buena porción de proteína.',
            'flagged_for_session': True,
        }, format='json')
        assert resp.status_code == status.HTTP_200_OK
        meal_entry.refresh_from_db()
        assert meal_entry.trainer_comment == 'Buena porción de proteína.'
        assert meal_entry.flagged_for_session is True

    def test_saves_flag_without_comment(self, api_client, trainer, customer, booking, meal_entry):
        _auth(api_client, trainer.user)
        url = reverse('trainer-meal-comment', args=[meal_entry.pk])
        resp = api_client.patch(url, {'flagged_for_session': True}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        meal_entry.refresh_from_db()
        assert meal_entry.flagged_for_session is True

    def test_returns_404_for_unrelated_client(self, api_client, trainer, other_customer, meal_entry):
        # meal_entry belongs to customer who has no booking with trainer
        _auth(api_client, trainer.user)
        url = reverse('trainer-meal-comment', args=[meal_entry.pk])
        resp = api_client.patch(url, {'trainer_comment': 'x'}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_trainer_role(self, api_client, customer, booking, meal_entry):
        _auth(api_client, customer)
        url = reverse('trainer-meal-comment', args=[meal_entry.pk])
        resp = api_client.patch(url, {'trainer_comment': 'x'}, format='json')
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── TrainerProgramPauseView / TrainerProgramResumeView ────────────────────────

@pytest.mark.django_db
class TestTrainerProgramPauseResume:
    @pytest.fixture
    def program(self, trainer, customer, booking):
        start = FIXED_NOW.date()
        from datetime import timedelta
        return MonthlyProgram.objects.create(
            customer=customer,
            trainer=trainer,
            start_date=start,
            end_date=start + timedelta(days=27),
            fitness_level=1,
            goal='weight_loss',
            status=MonthlyProgram.Status.PUBLISHED,
        )

    def test_pause_sets_is_paused_true(self, api_client, trainer, customer, program):
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-pause', args=[customer.pk, program.pk])
        resp = api_client.post(url, {'pause_reason': 'Viaje del cliente.'}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['status'] == 'paused'
        program.refresh_from_db()
        assert program.is_paused is True
        assert program.pause_reason == 'Viaje del cliente.'

    def test_pause_already_paused_returns_400(self, api_client, trainer, customer, program):
        program.is_paused = True
        program.save(update_fields=['is_paused'])
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-pause', args=[customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_resume_sets_is_paused_false(self, api_client, trainer, customer, program):
        program.is_paused = True
        program.save(update_fields=['is_paused'])
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-resume', args=[customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['status'] == 'resumed'
        program.refresh_from_db()
        assert program.is_paused is False

    def test_resume_not_paused_returns_400(self, api_client, trainer, customer, program):
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-resume', args=[customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_pause_returns_404_for_unrelated_client(self, api_client, trainer, other_customer, program):
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-pause', args=[other_customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_pause_requires_trainer_role(self, api_client, customer, program):
        _auth(api_client, customer)
        url = reverse('trainer-program-pause', args=[customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_403_FORBIDDEN
