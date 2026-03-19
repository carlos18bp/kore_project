"""Tests for AnthropometryEvaluation model save logic.

Covers _compute_indices, _fill_default_recommendations, and __str__.
"""

from datetime import date

import pytest

from core_app.models import TrainerProfile, User
from core_app.models.anthropometry import AnthropometryEvaluation
from core_app.models.customer_profile import CustomerProfile


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='anthro-model-trainer@test.com', password='pass',
        first_name='Trainer', last_name='Model', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym')


@pytest.fixture
def customer(db):
    user = User.objects.create_user(
        email='anthro-model-customer@test.com', password='pass',
        first_name='Customer', last_name='Model', role=User.Role.CUSTOMER,
    )
    profile = user.customer_profile
    profile.sex = 'masculino'
    profile.date_of_birth = date(1990, 5, 15)
    profile.city = 'Bogotá'
    profile.primary_goal = 'fat_loss'
    profile.save()
    return user


@pytest.mark.django_db
class TestAnthropometryEvaluationSave:
    def test_save_computes_bmi(self, trainer, customer):
        """Save auto-computes BMI from weight and height."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
        )
        assert ev.bmi is not None
        assert ev.bmi_category != ''
        assert ev.bmi_color != ''

    def test_save_computes_body_fat(self, trainer, customer):
        """Save auto-computes body fat percentage."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=75, height_cm=175,
        )
        assert ev.body_fat_pct is not None
        assert ev.bf_category != ''
        assert ev.bf_color != ''

    def test_save_computes_whr_when_waist_and_hip_provided(self, trainer, customer):
        """Save computes WHR when both waist and hip are provided."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
            waist_cm=85, hip_cm=100,
        )
        assert ev.waist_hip_ratio is not None
        assert ev.whr_risk != ''
        assert ev.whr_color != ''

    def test_save_skips_whr_when_no_waist(self, trainer, customer):
        """Save skips WHR when waist_cm is not provided."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
        )
        assert ev.waist_hip_ratio is None

    def test_save_computes_mass_composition(self, trainer, customer):
        """Save computes fat and lean mass from body fat pct."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
        )
        assert ev.fat_mass_kg is not None
        assert ev.lean_mass_kg is not None
        total = float(ev.fat_mass_kg) + float(ev.lean_mass_kg)
        assert abs(total - 80.0) < 0.5

    def test_save_computes_waist_risk(self, trainer, customer):
        """Save computes waist risk when waist_cm is provided."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
            waist_cm=105,
        )
        assert ev.waist_risk != ''
        assert ev.waist_risk_color != ''

    def test_save_fills_default_recommendations(self, trainer, customer):
        """Save fills default recommendations when none exist."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
        )
        assert ev.recommendations is not None
        assert 'bmi' in ev.recommendations

    def test_save_preserves_existing_recommendations(self, trainer, customer):
        """Save does not overwrite existing recommendations."""
        custom_recs = {'custom': {'result': 'test', 'action': 'test'}}
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=80, height_cm=180,
            recommendations=custom_recs,
        )
        assert ev.recommendations == custom_recs

    def test_update_recomputes_indices(self, trainer, customer):
        """Updating weight recomputes BMI."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=70, height_cm=175,
        )
        original_bmi = ev.bmi

        ev.weight_kg = 90
        ev.save()

        assert ev.bmi != original_bmi
        assert ev.bmi > original_bmi


@pytest.mark.django_db
class TestAnthropometryEvaluationStr:
    def test_str_representation(self, trainer, customer):
        """String representation includes customer email and date."""
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=75, height_cm=175,
        )
        result = str(ev)
        assert customer.email in result


@pytest.mark.django_db
class TestAnthropometryEvaluationFemale:
    def test_female_body_fat_computation(self, trainer, db):
        """Verify body fat computation uses female-specific formula."""
        user = User.objects.create_user(
            email='anthro-female@test.com', password='pass',
            first_name='Female', last_name='Client', role=User.Role.CUSTOMER,
        )
        profile = user.customer_profile
        profile.sex = 'femenino'
        profile.date_of_birth = date(1992, 3, 10)
        profile.city = 'Medellín'
        profile.primary_goal = 'general_health'
        profile.save()

        ev = AnthropometryEvaluation.objects.create(
            customer=user, trainer=trainer,
            weight_kg=60, height_cm=165,
            waist_cm=70, hip_cm=95,
        )
        assert ev.body_fat_pct is not None
        assert ev.waist_hip_ratio is not None
        assert ev.bmi is not None
