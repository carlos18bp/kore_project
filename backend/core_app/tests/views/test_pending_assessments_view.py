"""Tests for PendingAssessmentsView.

Covers nutrition/parq due flags, latest evaluation timestamps,
profile_incomplete, subscription_expiring, and kore_index.
"""

from datetime import date, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Package, Subscription, TrainerProfile, User
from core_app.models.anthropometry import AnthropometryEvaluation
from core_app.models.nutrition_habit import NutritionHabit
from core_app.models.parq_assessment import ParqAssessment


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def customer(db):
    """Create a customer with complete profile."""
    user = User.objects.create_user(
        email='pend-customer@test.com', password='pass',
        first_name='Maria', last_name='Test', role=User.Role.CUSTOMER,
    )
    profile = user.customer_profile
    profile.sex = 'femenino'
    profile.date_of_birth = date(1990, 1, 1)
    profile.city = 'Bogotá'
    profile.primary_goal = 'general_health'
    profile.save()
    return user


@pytest.fixture
def incomplete_customer(db):
    """Create a customer with incomplete profile."""
    return User.objects.create_user(
        email='pend-incomplete@test.com', password='pass',
        first_name='', last_name='', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='pend-trainer@test.com', password='pass',
        first_name='Trainer', last_name='Test', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym')


URL = 'client-pending-assessments'


@pytest.mark.django_db
class TestPendingAssessmentsView:
    def test_requires_authentication(self, api_client):
        """Reject unauthenticated requests."""
        response = api_client.get(reverse(URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_all_flags_for_new_customer(self, api_client, customer):
        """New customer with no evaluations should have due flags True."""
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['nutrition_due'] is True
        assert response.data['parq_due'] is True
        assert response.data['latest_anthropometry_at'] is None
        assert response.data['latest_posturometry_at'] is None
        assert response.data['latest_physical_eval_at'] is None
        assert response.data['profile_incomplete'] is False

    def test_nutrition_due_false_after_recent_submission(self, api_client, customer):
        """nutrition_due should be False when recent nutrition assessment exists."""
        NutritionHabit.objects.create(
            customer=customer, meals_per_day=3, water_liters=2.0,
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=3,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['nutrition_due'] is False

    def test_parq_due_false_after_recent_submission(self, api_client, customer):
        """parq_due should be False when recent PAR-Q assessment exists."""
        ParqAssessment.objects.create(
            customer=customer,
            q1_heart_condition=False, q2_chest_pain=False,
            q3_dizziness=False, q4_chronic_condition=False,
            q5_prescribed_medication=False, q6_bone_joint_problem=False,
            q7_medical_supervision=False,
        )
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['parq_due'] is False

    def test_profile_incomplete_when_missing_fields(self, api_client, incomplete_customer):
        """profile_incomplete should be True when profile fields are empty."""
        api_client.force_authenticate(user=incomplete_customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['profile_incomplete'] is True

    def test_latest_anthropometry_at_populated(self, api_client, customer, trainer):
        """latest_anthropometry_at should reflect the most recent evaluation."""
        AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=60, height_cm=165,
        )
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['latest_anthropometry_at'] is not None

    def test_subscription_expiring_when_near_expiry(self, api_client, customer):
        """subscription_expiring should be True when subscription expires within 7 days."""
        package = Package.objects.create(
            title='Expiring', sessions_count=4, validity_days=30, price='100000.00',
        )
        Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=4, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(days=25),
            expires_at=timezone.now() + timedelta(days=5),
        )
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['subscription_expiring'] is True

    def test_subscription_not_expiring_when_far(self, api_client, customer):
        """subscription_expiring should be False when expiry is far away."""
        package = Package.objects.create(
            title='Fresh', sessions_count=4, validity_days=30, price='100000.00',
        )
        Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=4, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(days=5),
            expires_at=timezone.now() + timedelta(days=25),
        )
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['subscription_expiring'] is False

    def test_kore_index_included(self, api_client, customer):
        """Response should include kore_index field."""
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(URL))

        assert response.status_code == status.HTTP_200_OK
        assert 'kore_index' in response.data
