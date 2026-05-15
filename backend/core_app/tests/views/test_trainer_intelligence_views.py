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
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=slot_time,
        ends_at=slot_time.replace(hour=9),
        status=Booking.Status.CONFIRMED,
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
        for i, cust in enumerate([customer, other_customer]):
            from datetime import timedelta
            t = FIXED_NOW + timedelta(hours=i * 2)
            Booking.objects.create(
                customer=cust, trainer=trainer, package=package,
                starts_at=t, ends_at=t + timedelta(hours=1),
                status=Booking.Status.CONFIRMED,
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


# ── Helper function unit tests ────────────────────────────────────────────────

@pytest.mark.django_db
class TestHelperFunctions:
    """Direct unit tests for module-level helpers in trainer_intelligence_views."""

    def test_get_trainer_profile_returns_none_when_no_profile(self, customer):
        """User with CUSTOMER role has no trainer_profile → returns None."""
        from core_app.views.trainer_intelligence_views import _get_trainer_profile

        class FakeRequest:
            user = customer

        result = _get_trainer_profile(FakeRequest())
        assert result is None

    def test_get_trainer_profile_returns_profile_when_exists(self, trainer):
        """User with TrainerProfile attached → returns the profile."""
        from core_app.views.trainer_intelligence_views import _get_trainer_profile

        class FakeRequest:
            user = trainer.user

        result = _get_trainer_profile(FakeRequest())
        assert result == trainer

    def test_get_trainer_customer_returns_none_when_no_booking(self, trainer, customer):
        """Customer has no booking with this trainer → returns None."""
        from core_app.views.trainer_intelligence_views import _get_trainer_customer

        # No Booking created, so no association
        result = _get_trainer_customer(trainer, customer.pk)
        assert result is None

    def test_get_trainer_customer_returns_none_when_user_is_trainer_role(self, trainer, package):
        """If the looked-up user has TRAINER role, User.DoesNotExist branch → None."""
        from core_app.views.trainer_intelligence_views import _get_trainer_customer

        # Create a booking where 'customer' is actually a TRAINER user
        trainer_as_customer = User.objects.create_user(
            email='trainer-as-cust@test.com', password='pass',
            role=User.Role.TRAINER,
        )
        Booking.objects.create(
            customer=trainer_as_customer, trainer=trainer, package=package,
            starts_at=FIXED_NOW, ends_at=FIXED_NOW.replace(hour=9),
            status=Booking.Status.CONFIRMED,
        )
        # _get_trainer_customer filters role=CUSTOMER, so this returns None
        result = _get_trainer_customer(trainer, trainer_as_customer.pk)
        assert result is None

    def test_get_trainer_customer_returns_user_when_valid(self, trainer, customer, package):
        """Customer with a booking for this trainer → returns the customer User."""
        from core_app.views.trainer_intelligence_views import _get_trainer_customer

        Booking.objects.create(
            customer=customer, trainer=trainer, package=package,
            starts_at=FIXED_NOW, ends_at=FIXED_NOW.replace(hour=9),
            status=Booking.Status.CONFIRMED,
        )
        result = _get_trainer_customer(trainer, customer.pk)
        assert result == customer


# ── TrainerRiskDashboardView — extended ───────────────────────────────────────

@pytest.mark.django_db
class TestTrainerRiskDashboardExtended:
    """Additional scenarios beyond the basic tests already in TestTrainerRiskDashboardView."""

    def test_trainer_with_no_customers_returns_empty_list(self, api_client, trainer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['clients_by_risk'] == []
        assert resp.data['risk_summary']['alto'] == 0

    def test_only_non_stale_score_appears_when_both_exist(self, api_client, trainer, customer, package):
        """Customer with a stale and a non-stale score: only the non-stale one appears."""
        _auth(api_client, trainer.user)
        from datetime import timedelta
        Booking.objects.create(
            customer=customer, trainer=trainer, package=package,
            starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
        )
        # Create stale score
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[], clinical_signals=[], is_stale=True,
            computed_at=FIXED_NOW,
        )
        # Create non-stale score with lower risk
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.BAJO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        clients = resp.data['clients_by_risk']
        assert len(clients) == 1
        assert clients[0]['level'] == ClientRiskScore.Level.BAJO

    def test_full_ordering_alto_medio_bajo_sin_riesgo(self, api_client, trainer, package):
        """All four risk levels present — order must be alto→medio→bajo→sin_riesgo."""
        _auth(api_client, trainer.user)
        from datetime import timedelta
        levels_to_create = [
            ('sin_riesgo-cu@test.com', ClientRiskScore.Level.SIN_RIESGO),
            ('bajo-cu@test.com', ClientRiskScore.Level.BAJO),
            ('medio-cu@test.com', ClientRiskScore.Level.MEDIO),
            ('alto-cu@test.com', ClientRiskScore.Level.ALTO),
        ]
        for i, (email, level) in enumerate(levels_to_create):
            cu = User.objects.create_user(email=email, password='p', role=User.Role.CUSTOMER)
            t = FIXED_NOW + timedelta(hours=i)
            Booking.objects.create(
                customer=cu, trainer=trainer, package=package,
                starts_at=t, ends_at=t + timedelta(hours=1),
                status=Booking.Status.CONFIRMED,
            )
            ClientRiskScore.objects.create(
                customer=cu, trainer=trainer, level=level,
                behavioral_signals=[], clinical_signals=[], is_stale=False,
                computed_at=t,
            )
        resp = api_client.get(reverse('trainer-risk-dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        levels_returned = [c['level'] for c in resp.data['clients_by_risk']]
        assert levels_returned == [
            ClientRiskScore.Level.ALTO,
            ClientRiskScore.Level.MEDIO,
            ClientRiskScore.Level.BAJO,
            ClientRiskScore.Level.SIN_RIESGO,
        ]


# ── TrainerAlertCenterView ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerAlertCenterView:

    @pytest.fixture
    def risk_score(self, trainer, customer, booking):
        return ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[{'type': 'inactivity_7d'}],
            clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )

    def test_returns_200_for_trainer(self, api_client, trainer, risk_score):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-alerts'))
        assert resp.status_code == status.HTTP_200_OK
        assert 'alerts' in resp.data

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-alerts'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_sin_riesgo_excluded_from_alerts(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.SIN_RIESGO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        resp = api_client.get(reverse('trainer-alerts'))
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data['alerts']) == 0

    def test_level_filter_param(self, api_client, trainer, customer, other_customer, package):
        _auth(api_client, trainer.user)
        from datetime import timedelta
        Booking.objects.create(
            customer=other_customer, trainer=trainer, package=package,
            starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
        )
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        ClientRiskScore.objects.create(
            customer=other_customer, trainer=trainer,
            level=ClientRiskScore.Level.MEDIO,
            behavioral_signals=[], clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        resp = api_client.get(reverse('trainer-alerts') + '?level=alto')
        assert resp.status_code == status.HTTP_200_OK
        assert all(a['level'] == ClientRiskScore.Level.ALTO for a in resp.data['alerts'])


# ── TrainerMessagesView ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerMessagesView:
    """Tests for GET/POST /api/trainer/messages/"""

    def test_get_messages_returns_200(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-messages'))
        assert resp.status_code == status.HTTP_200_OK
        assert 'messages' in resp.data

    def test_post_creates_message(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.post(reverse('trainer-messages'), {
            'customer_id': customer.pk,
            'message': 'Hola, ¿cómo te sientes hoy?',
        }, format='json')
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['message'] == 'Hola, ¿cómo te sientes hoy?'

    def test_post_missing_fields_returns_400(self, api_client, trainer):
        _auth(api_client, trainer.user)
        resp = api_client.post(reverse('trainer-messages'), {
            'customer_id': '',
            'message': '',
        }, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_post_unrelated_customer_returns_404(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.post(reverse('trainer-messages'), {
            'customer_id': other_customer.pk,
            'message': 'Hola',
        }, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientResumenView ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientResumenView:

    @pytest.mark.xfail(
        reason="TrainerClientResumenView references Booking.slot which does not exist — production bug",
        strict=True,
    )
    def test_returns_200_for_valid_customer(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-resumen', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert 'risk' in resp.data
        assert 'subscription' in resp.data

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-resumen', args=[other_customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-client-resumen', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── TrainerClientAlertsView ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientAlertsView:

    def test_returns_200_for_valid_customer(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-alerts', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert 'alerts' in resp.data

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-alerts', args=[other_customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientDailyLogsView ────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientDailyLogsView:

    def test_returns_200_with_empty_days_when_no_program(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-daily-logs', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == {'days': [], 'program': None}

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-daily-logs', args=[other_customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientNutritionLogsView ────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientNutritionLogsView:

    def test_returns_200_with_empty_days_when_no_logs(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-nutrition-logs', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == {'days': []}

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-nutrition-logs', args=[other_customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientSessionsFullView ─────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientSessionsFullView:

    @pytest.mark.xfail(
        reason="TrainerClientSessionsFullView uses select_related('slot') which does not exist on Booking — production bug",
        strict=True,
    )
    def test_returns_200_with_sessions_for_valid_customer(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-sessions-full', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert 'sessions' in resp.data
        assert 'stats' in resp.data
        assert resp.data['stats']['total'] == 1

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-sessions-full', args=[other_customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerMessagesForCustomerView ────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerMessagesForCustomerView:

    def test_customer_can_get_messages(self, api_client, customer):
        _auth(api_client, customer)
        resp = api_client.get(reverse('my-trainer-messages'))
        assert resp.status_code == status.HTTP_200_OK
        assert 'messages' in resp.data

    def test_trainer_cannot_access_customer_messages_endpoint(self, api_client, trainer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('my-trainer-messages'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── TrainerMessageDismissView ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerMessageDismissView:

    @pytest.fixture
    def message(self, trainer, customer, booking):
        from core_app.models import TrainerMessage
        return TrainerMessage.objects.create(
            customer=customer,
            trainer=trainer,
            trigger_type='manual',
            message='Test message for dismissal',
        )

    def test_customer_can_dismiss_own_message(self, api_client, customer, message):
        _auth(api_client, customer)
        resp = api_client.post(reverse('my-trainer-messages-dismiss', args=[message.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['dismissed_at'] is not None

    def test_non_customer_cannot_dismiss(self, api_client, trainer, message):
        _auth(api_client, trainer.user)
        resp = api_client.post(reverse('my-trainer-messages-dismiss', args=[message.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_nonexistent_message_returns_404(self, api_client, customer):
        _auth(api_client, customer)
        resp = api_client.post(reverse('my-trainer-messages-dismiss', args=[999999]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND
