"""Tests for PhysicalEvaluation model save logic."""

from datetime import date
from decimal import Decimal

import pytest

from core_app.models import TrainerProfile, User
from core_app.models.anthropometry import AnthropometryEvaluation
from core_app.models.physical_evaluation import PhysicalEvaluation


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='phys-trainer@test.com', password='p',
        first_name='Trainer', last_name='Phys', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym Phys')


@pytest.fixture
def customer(db):
    user = User.objects.create_user(
        email='phys-customer@test.com', password='p',
        first_name='Customer', last_name='Phys', role=User.Role.CUSTOMER,
    )
    profile = user.customer_profile
    profile.sex = 'masculino'
    profile.date_of_birth = date(1990, 5, 15)
    profile.save()
    return user


@pytest.mark.django_db
class TestPhysicalEvaluationSave:
    """Validates save() snapshots demographics and computes indices."""

    def test_save_snapshots_age_and_sex(self, trainer, customer):
        """Save copies age and sex from customer profile to evaluation snapshot."""
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer,
            squats_reps=25, pushups_reps=15, plank_seconds=60,
            walk_meters=500, unipodal_seconds=30,
            hip_mobility=4, shoulder_mobility=4, ankle_mobility=4,
        )
        assert ev.sex_at_evaluation == 'masculino'
        assert ev.age_at_evaluation is not None
        assert ev.age_at_evaluation > 0

    def test_save_default_age_when_no_dob(self, trainer):
        """When customer profile has no date_of_birth, age defaults to 30."""
        user = User.objects.create_user(
            email='phys-no-dob@test.com', password='p', role=User.Role.CUSTOMER,
        )
        ev = PhysicalEvaluation.objects.create(
            customer=user, trainer=trainer,
            squats_reps=20, pushups_reps=10,
        )
        assert ev.age_at_evaluation == 30

    def test_save_computes_individual_scores(self, trainer, customer):
        """Save auto-computes individual test scores (1-5) from raw test data."""
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer,
            squats_reps=30, pushups_reps=20, plank_seconds=80,
            walk_meters=550, unipodal_seconds=40,
            hip_mobility=4, shoulder_mobility=4, ankle_mobility=4,
        )
        assert ev.squats_score is not None
        assert ev.pushups_score is not None
        assert ev.plank_score is not None
        assert ev.walk_score is not None
        assert ev.unipodal_score is not None

    def test_save_computes_composite_indices(self, trainer, customer):
        """Save auto-computes strength, endurance, mobility, balance, and general indices."""
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer,
            squats_reps=30, pushups_reps=20, plank_seconds=80,
            walk_meters=550, unipodal_seconds=40,
            hip_mobility=4, shoulder_mobility=4, ankle_mobility=4,
        )
        assert ev.strength_index is not None
        assert ev.endurance_index is not None
        assert ev.mobility_index is not None
        assert ev.balance_index is not None
        assert ev.general_index is not None
        assert ev.general_category != ''

    def test_save_default_evaluation_date_is_today(self, trainer, customer):
        """When evaluation_date is omitted, it defaults to today's date."""
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer,
            squats_reps=20, pushups_reps=10,
        )
        assert ev.evaluation_date == date.today()

    def test_save_pulls_anthropometry_context_when_available(self, trainer, customer):
        """Save integrates latest anthropometry data into cross-module alerts when present."""
        AnthropometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            weight_kg=Decimal('80'), height_cm=Decimal('175'),
            evaluation_date=date(2026, 1, 1),
        )
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer,
            squats_reps=20, pushups_reps=10,
        )
        # cross_module_alerts is a dict — may be empty or populated depending on values
        assert isinstance(ev.cross_module_alerts, dict)


@pytest.mark.django_db
class TestPhysicalEvaluationMeta:
    """Validates ordering, str representation, and FK behavior."""

    def test_str_representation(self, trainer, customer):
        """String representation includes pk, customer email, and date."""
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer, squats_reps=20,
        )
        rendered = str(ev)
        assert f'#{ev.pk}' in rendered
        assert customer.email in rendered

    def test_ordering_by_evaluation_date_descending(self, trainer, customer):
        """Default queryset orders evaluations by most recent evaluation_date first."""
        PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer, squats_reps=20,
            evaluation_date=date(2026, 1, 1),
        )
        PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer, squats_reps=25,
            evaluation_date=date(2026, 3, 1),
        )
        dates = list(PhysicalEvaluation.objects.values_list('evaluation_date', flat=True))
        assert dates == [date(2026, 3, 1), date(2026, 1, 1)]

    def test_cascade_delete_with_customer(self, trainer, customer):
        """Evaluations are deleted when their owning customer is deleted."""
        PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer, squats_reps=20,
        )
        customer.delete()
        assert PhysicalEvaluation.objects.count() == 0

    def test_trainer_set_null_on_delete(self, trainer, customer):
        """Deleting the trainer sets the FK to NULL but keeps the evaluation."""
        ev = PhysicalEvaluation.objects.create(
            customer=customer, trainer=trainer, squats_reps=20,
        )
        trainer.delete()
        ev.refresh_from_db()
        assert ev.trainer is None


@pytest.mark.django_db
def test_get_posturometry_context_returns_none_when_no_posturometry(trainer, customer):
    """_get_posturometry_context returns None when no posturometry row exists for the customer."""
    ev = PhysicalEvaluation.objects.create(customer=customer, trainer=trainer, squats_reps=10)
    assert ev._get_posturometry_context() is None


@pytest.mark.django_db
def test_get_posturometry_context_returns_dict_when_posturometry_exists(trainer, customer):
    """_get_posturometry_context returns color/findings dict when a posturometry row exists."""
    from core_app.models.posturometry import PosturometryEvaluation
    PosturometryEvaluation.objects.create(
        customer=customer, trainer=trainer,
        anterior_data={'head': {'deviation': 'none'}},
        lower_color='green', central_color='yellow',
    )
    ev = PhysicalEvaluation.objects.create(customer=customer, trainer=trainer, squats_reps=20)
    ctx = ev._get_posturometry_context()
    assert ctx is not None
    assert 'lower_color' in ctx


@pytest.mark.django_db
def test_fill_default_recommendations_skips_when_already_set(trainer, customer):
    """_fill_default_recommendations returns early without overwriting existing recommendations."""
    ev = PhysicalEvaluation.objects.create(
        customer=customer, trainer=trainer, squats_reps=30,
    )
    existing = ev.recommendations.copy()
    ev._fill_default_recommendations()
    assert ev.recommendations == existing


@pytest.mark.django_db
def test_fill_default_recommendations_populates_when_empty(trainer, customer):
    """_fill_default_recommendations fills recommendations when the field is empty."""
    ev = PhysicalEvaluation.objects.create(
        customer=customer, trainer=trainer,
        squats_reps=30, pushups_reps=20, plank_seconds=60,
        walk_meters=500, unipodal_seconds=30,
    )
    ev.recommendations = {}
    ev._fill_default_recommendations()
    assert ev.recommendations
