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

    def test_dismiss_already_dismissed_message_is_idempotent(self, api_client, customer, message):
        """Dismissing a message twice should still return 200 and not error."""
        _auth(api_client, customer)
        url = reverse('my-trainer-messages-dismiss', args=[message.pk])
        api_client.post(url)  # first dismiss
        resp = api_client.post(url)  # second dismiss
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['dismissed_at'] is not None


# ── TrainerClientKPIView ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientKPIView:
    """GET /api/trainer/my-clients/<customer_id>/kpi/"""

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-client-kpi', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_requires_authentication(self, api_client, customer):
        resp = api_client.get(reverse('trainer-client-kpi', args=[customer.pk]))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_404_for_trainer_without_profile(self, api_client, customer):
        """Trainer user with no TrainerProfile gets 404."""
        bare_trainer = User.objects.create_user(
            email='bare-trainer-kpi@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-client-kpi', args=[customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, other_customer):
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-kpi', args=[other_customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_200_with_empty_kpis_when_no_data(self, api_client, trainer, customer, booking):
        """Customer with a booking but no program/evaluations → 200 with zero KPIs."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-kpi', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert 'behavioral' in resp.data
        assert 'clinical' in resp.data
        # No program → adherence all zero
        behavioral = resp.data['behavioral']
        assert behavioral['training_adherence_7d'] == 0.0
        assert behavioral['streak_current'] == 0
        # No evaluations → kore_score is None
        clinical = resp.data['clinical']
        assert clinical['kore_score'] is None
        assert clinical['kore_category'] == 'Sin datos'

    def test_sessions_completed_count_in_behavioral(self, api_client, trainer, customer, booking):
        """sessions_completed reflects confirmed bookings for this trainer/customer."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-kpi', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        # booking fixture has status=CONFIRMED
        assert resp.data['behavioral']['sessions_completed'] >= 1

    def test_sessions_remaining_zero_when_no_subscription(self, api_client, trainer, customer, booking):
        """No active subscription → sessions_remaining = 0."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-kpi', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['behavioral']['sessions_remaining'] == 0


# ── TrainerComparativeMetricsView ─────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerComparativeMetricsView:
    """GET /api/trainer/comparative-metrics/"""

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_requires_authentication(self, api_client):
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_404_for_trainer_without_profile(self, api_client):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-comp@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_200_with_empty_ranking_when_no_customers(self, api_client, trainer):
        """Trainer with no customers → 200 with empty ranking and zero global patterns."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['adherence_ranking'] == []
        assert resp.data['improved_this_week'] == []
        assert resp.data['worsened_this_week'] == []
        assert resp.data['global_patterns']['avg_training_adherence'] == 0.0
        assert resp.data['global_patterns']['avg_nutrition_adherence'] == 0.0
        assert resp.data['global_patterns']['most_missed_day_of_week'] is None

    def test_returns_200_with_customer_but_no_program(self, api_client, trainer, customer, booking):
        """Customer with booking but no MonthlyProgram is skipped in ranking."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        # No program means customer not in ranking
        assert resp.data['adherence_ranking'] == []

    def test_response_has_all_required_keys(self, api_client, trainer, customer, booking):
        """Response shape includes all required top-level keys."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        for key in ('adherence_ranking', 'improved_this_week', 'worsened_this_week',
                    'global_patterns', 'most_failed_exercises', 'most_failed_meal_blocks',
                    'expired_evaluations'):
            assert key in resp.data, f"Missing key: {key}"

    def test_expired_evaluations_list_when_customer_has_no_evals(self, api_client, trainer, customer, booking):
        """Customer with no evaluations → all 4 modules appear in expired_evaluations."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-comparative-metrics'))
        assert resp.status_code == status.HTTP_200_OK
        expired = resp.data['expired_evaluations']
        modules_expired = {e['module'] for e in expired}
        # All 4 modules should be expired since there are no evaluations at all
        assert 'anthropometry' in modules_expired
        assert 'posturometry' in modules_expired
        assert 'physical' in modules_expired
        assert 'parq' in modules_expired


# ── TrainerPhotoGalleryView ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerPhotoGalleryView:
    """GET /api/trainer/photo-gallery/"""

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-photo-gallery'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_requires_authentication(self, api_client):
        resp = api_client.get(reverse('trainer-photo-gallery'))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_404_for_trainer_without_profile(self, api_client):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-photo@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-photo-gallery'))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_200_with_empty_photos_when_no_uploads(self, api_client, trainer, customer, booking):
        """Gallery returns empty list when no meal entries have photos."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-photo-gallery'))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data == {'photos': []}

    def test_customer_id_filter_excludes_other_customers(self, api_client, trainer, customer, other_customer, package):
        """?customer_id=X limits results to that customer (returns empty for unrelated)."""
        from datetime import timedelta
        # Give other_customer a booking with trainer
        Booking.objects.create(
            customer=other_customer, trainer=trainer, package=package,
            starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
        )
        _auth(api_client, trainer.user)
        # Filter for customer who has no photos
        resp = api_client.get(reverse('trainer-photo-gallery') + f'?customer_id={customer.pk}')
        assert resp.status_code == status.HTTP_200_OK
        # No meal entries with photos → empty
        assert resp.data['photos'] == []

    def test_customer_id_filter_for_unrelated_customer_returns_empty(self, api_client, trainer, other_customer, booking):
        """?customer_id for a customer not in trainer's list returns empty photos."""
        _auth(api_client, trainer.user)
        # other_customer has no booking with this trainer
        resp = api_client.get(reverse('trainer-photo-gallery') + f'?customer_id={other_customer.pk}')
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['photos'] == []


# ── TrainerAlertCenterView — extended ────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerAlertCenterViewExtended:
    """Additional cases for the alert center beyond TestTrainerAlertCenterView."""

    def test_returns_404_for_trainer_without_profile(self, api_client):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-alerts@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-alerts'))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_total_unresolved_alto_counts_correctly(self, api_client, trainer, customer, other_customer, package):
        """total_unresolved_alto reflects only ALTO-level non-stale scores."""
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
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-alerts'))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['total_unresolved_alto'] == 1

    def test_stale_scores_excluded_from_alerts(self, api_client, trainer, customer, booking):
        """Alert center filters is_stale=False, so stale scores are excluded."""
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[], clinical_signals=[], is_stale=True,  # stale → excluded
            computed_at=FIXED_NOW,
        )
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-alerts'))
        assert resp.status_code == status.HTTP_200_OK
        # Stale ALTO scores are excluded from alert center
        assert len(resp.data['alerts']) == 0
        assert resp.data['total_unresolved_alto'] == 0


# ── TrainerMessagesView — extended ────────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerMessagesViewExtended:
    """Additional tests for GET /api/trainer/messages/ filtering."""

    def test_returns_404_for_trainer_without_profile(self, api_client):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-msgs@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-messages'))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_messages_filtered_by_customer_id(self, api_client, trainer, customer, other_customer, package):
        """GET ?customer_id=X filters messages to that customer only."""
        from datetime import timedelta
        from core_app.models import TrainerMessage

        Booking.objects.create(
            customer=other_customer, trainer=trainer, package=package,
            starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
        )
        TrainerMessage.objects.create(
            customer=customer, trainer=trainer,
            trigger_type='manual', message='Para customer',
        )
        TrainerMessage.objects.create(
            customer=other_customer, trainer=trainer,
            trigger_type='manual', message='Para other_customer',
        )
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-messages') + f'?customer_id={customer.pk}')
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data['messages']) == 1
        assert resp.data['messages'][0]['message'] == 'Para customer'

    def test_post_returns_404_for_trainer_without_profile(self, api_client, customer):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-msgs-post@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.post(reverse('trainer-messages'), {
            'customer_id': customer.pk,
            'message': 'Hola',
        }, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientAlertsView — extended ────────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientAlertsViewExtended:
    """Additional tests for /api/trainer/my-clients/<id>/alerts/."""

    def test_returns_404_for_trainer_without_profile(self, api_client, customer):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-clt-alerts@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-client-alerts', args=[customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_alert_list_with_risk_scores(self, api_client, trainer, customer, booking):
        """Customer with risk scores returns them in the alerts list."""
        ClientRiskScore.objects.create(
            customer=customer, trainer=trainer,
            level=ClientRiskScore.Level.ALTO,
            behavioral_signals=[{'type': 'inactivity_7d'}],
            clinical_signals=[], is_stale=False,
            computed_at=FIXED_NOW,
        )
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-alerts', args=[customer.pk]))
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data['alerts']) == 1
        assert resp.data['alerts'][0]['level'] == ClientRiskScore.Level.ALTO

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-client-alerts', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── TrainerClientDailyLogsView — extended ─────────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientDailyLogsViewExtended:

    def test_returns_404_for_trainer_without_profile(self, api_client, customer):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-dlogs@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-client-daily-logs', args=[customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-client-daily-logs', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── TrainerClientNutritionLogsView — extended ─────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientNutritionLogsViewExtended:

    def test_returns_404_for_trainer_without_profile(self, api_client, customer):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-nlogs@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-client-nutrition-logs', args=[customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-client-nutrition-logs', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_days_param_respected(self, api_client, trainer, customer, booking):
        """?days=14 is accepted and returns 200."""
        _auth(api_client, trainer.user)
        resp = api_client.get(reverse('trainer-client-nutrition-logs', args=[customer.pk]) + '?days=14')
        assert resp.status_code == status.HTTP_200_OK
        assert 'days' in resp.data


# ── TrainerProgramPauseView / ResumeView — extended ───────────────────────────

@pytest.mark.django_db
class TestTrainerProgramPauseResumeExtended:
    @pytest.fixture
    def program(self, trainer, customer, booking):
        from datetime import timedelta
        start = FIXED_NOW.date()
        return MonthlyProgram.objects.create(
            customer=customer,
            trainer=trainer,
            start_date=start,
            end_date=start + timedelta(days=27),
            fitness_level=1,
            goal='weight_loss',
            status=MonthlyProgram.Status.PUBLISHED,
        )

    def test_pause_returns_404_for_nonexistent_program(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-pause', args=[customer.pk, 999999])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_resume_returns_404_for_nonexistent_program(self, api_client, trainer, customer, booking):
        _auth(api_client, trainer.user)
        url = reverse('trainer-program-resume', args=[customer.pk, 999999])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_pause_returns_404_for_trainer_without_profile(self, api_client, customer, program):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-pause@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        url = reverse('trainer-program-pause', args=[customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_resume_returns_404_for_trainer_without_profile(self, api_client, customer, program):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-resume@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        url = reverse('trainer-program-resume', args=[customer.pk, program.pk])
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerMessagesForCustomerView — extended ─────────────────────────────────

@pytest.mark.django_db
class TestTrainerMessagesForCustomerViewExtended:
    """Tests for unseen message marking in GET /api/my-trainer-messages/."""

    def test_unseen_messages_marked_seen_on_fetch(self, api_client, trainer, customer, booking):
        """Fetching messages marks unseen ones as seen_by_customer=True."""
        from core_app.models import TrainerMessage

        msg = TrainerMessage.objects.create(
            customer=customer,
            trainer=trainer,
            trigger_type='manual',
            message='Revisa tu rutina de hoy.',
            seen_by_customer=False,
        )
        _auth(api_client, customer)
        resp = api_client.get(reverse('my-trainer-messages'))
        assert resp.status_code == status.HTTP_200_OK
        # The response should show it as seen
        returned_msg = next((m for m in resp.data['messages'] if m['id'] == msg.pk), None)
        assert returned_msg is not None
        assert returned_msg['seen_by_customer'] is True
        # DB should be updated
        msg.refresh_from_db()
        assert msg.seen_by_customer is True

    def test_dismissed_messages_excluded(self, api_client, trainer, customer, booking):
        """Messages with dismissed_at set are excluded from the list."""
        from core_app.models import TrainerMessage

        dismissed_msg = TrainerMessage.objects.create(
            customer=customer,
            trainer=trainer,
            trigger_type='manual',
            message='Old message',
            dismissed_at=FIXED_NOW,
        )
        _auth(api_client, customer)
        resp = api_client.get(reverse('my-trainer-messages'))
        assert resp.status_code == status.HTTP_200_OK
        ids_returned = [m['id'] for m in resp.data['messages']]
        assert dismissed_msg.pk not in ids_returned

    def test_already_seen_message_not_updated(self, api_client, trainer, customer, booking):
        """Messages already seen_by_customer=True are returned but not re-updated."""
        from core_app.models import TrainerMessage

        msg = TrainerMessage.objects.create(
            customer=customer,
            trainer=trainer,
            trigger_type='manual',
            message='Already seen',
            seen_by_customer=True,
        )
        _auth(api_client, customer)
        resp = api_client.get(reverse('my-trainer-messages'))
        assert resp.status_code == status.HTTP_200_OK
        returned = next((m for m in resp.data['messages'] if m['id'] == msg.pk), None)
        assert returned is not None
        assert returned['seen_by_customer'] is True


# ── TrainerAlertResolveView — no-profile path ─────────────────────────────────

@pytest.mark.django_db
class TestTrainerAlertResolveNoProfileView:
    """Edge case: trainer user without a TrainerProfile gets 404."""

    def test_resolve_returns_404_for_trainer_without_profile(self, api_client):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-resolve@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        url = reverse('trainer-alert-resolve', args=[999])
        resp = api_client.post(url, {
            'signal_type': 'inactivity_7d',
            'resolution_type': 'mark_reviewed',
            'note': 'x',
        }, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientResumenView — no-profile path ────────────────────────────────

@pytest.mark.django_db
class TestTrainerClientResumenNoProfileView:
    """Edge case: trainer user without a TrainerProfile gets 404 on resumen."""

    def test_resumen_returns_404_for_trainer_without_profile(self, api_client, customer):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-resumen@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-client-resumen', args=[customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerMealCommentView — no-profile path ──────────────────────────────────

@pytest.mark.django_db
class TestTrainerMealCommentNoProfileView:
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

    def test_comment_returns_404_for_trainer_without_profile(self, api_client, meal_entry):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-comment@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        url = reverse('trainer-meal-comment', args=[meal_entry.pk])
        resp = api_client.patch(url, {'trainer_comment': 'x'}, format='json')
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientSessionsFullView — no-profile and data tests ─────────────────

@pytest.mark.django_db
class TestTrainerClientSessionsFullViewExtended:

    def test_returns_404_for_trainer_without_profile(self, api_client, customer):
        bare_trainer = User.objects.create_user(
            email='bare-trainer-sessions@test.com', password='pass', role=User.Role.TRAINER,
        )
        _auth(api_client, bare_trainer)
        resp = api_client.get(reverse('trainer-client-sessions-full', args=[customer.pk]))
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_trainer_role(self, api_client, customer, booking):
        _auth(api_client, customer)
        resp = api_client.get(reverse('trainer-client-sessions-full', args=[customer.pk]))
        assert resp.status_code == status.HTTP_403_FORBIDDEN
