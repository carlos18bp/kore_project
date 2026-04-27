"""Tests for PosturometryEvaluation model save logic."""

from datetime import date

import pytest

from core_app.models import TrainerProfile, User
from core_app.models.posturometry import PosturometryEvaluation


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='posturo-trainer@test.com', password='p',
        first_name='Trainer', last_name='Posturo', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym Posturo')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='posturo-customer@test.com', password='p',
        first_name='Customer', last_name='Posturo', role=User.Role.CUSTOMER,
    )


def _normal_view():
    return {
        'cabeza': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'cuello': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'hombros': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'columna': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'cadera': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'rodillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'pies': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
    }


def _abnormal_view():
    return {
        'cabeza': {'is_normal': False, 'severity': 2, 'sub_fields': {}},
        'cuello': {'is_normal': False, 'severity': 2, 'sub_fields': {}},
        'hombros': {'is_normal': False, 'severity': 1, 'sub_fields': {}},
        'columna': {'is_normal': False, 'severity': 2, 'sub_fields': {}},
        'cadera': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'rodillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'pies': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
    }


@pytest.mark.django_db
class TestPosturometryEvaluationSave:
    """Validates save() auto-computes regional and global indices."""

    def test_save_computes_global_index(self, trainer, customer):
        """Save auto-computes global_index from observations across views."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
            lateral_right_data=_normal_view(),
            lateral_left_data=_normal_view(),
            posterior_data=_normal_view(),
        )
        assert ev.global_index is not None
        assert ev.global_category != ''
        assert ev.global_color != ''

    def test_save_computes_regional_indices(self, trainer, customer):
        """Save auto-computes upper, central, and lower regional indices."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
            lateral_right_data=_normal_view(),
            lateral_left_data=_normal_view(),
            posterior_data=_normal_view(),
        )
        assert ev.upper_index is not None
        assert ev.central_index is not None
        assert ev.lower_index is not None

    def test_save_populates_segment_scores(self, trainer, customer):
        """Save populates segment_scores JSON with consolidated per-segment data."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
            lateral_right_data=_normal_view(),
            lateral_left_data=_normal_view(),
            posterior_data=_normal_view(),
        )
        assert isinstance(ev.segment_scores, dict)
        assert len(ev.segment_scores) > 0

    def test_save_default_evaluation_date_is_today(self, trainer, customer):
        """When evaluation_date is omitted, it defaults to today's date."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
        )
        assert ev.evaluation_date == date.today()

    def test_save_respects_explicit_evaluation_date(self, trainer, customer):
        """Explicit evaluation_date is preserved instead of being overwritten."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            evaluation_date=date(2026, 1, 15),
            anterior_data=_normal_view(),
        )
        assert ev.evaluation_date == date(2026, 1, 15)

    def test_save_fills_default_recommendations_when_empty(self, trainer, customer):
        """Save populates default recommendations when none provided."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
        )
        assert isinstance(ev.recommendations, dict)
        assert len(ev.recommendations) > 0

    def test_save_preserves_custom_recommendations(self, trainer, customer):
        """Save preserves trainer-provided recommendations instead of overriding."""
        custom = {'upper': {'result': 'custom', 'action': 'do this'}}
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
            recommendations=custom,
        )
        assert ev.recommendations == custom

    def test_save_with_abnormal_findings_raises_deviation_index(self, trainer, customer):
        """Abnormal observations produce a higher deviation index than perfect ones."""
        normal = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
            lateral_right_data=_normal_view(),
            lateral_left_data=_normal_view(),
            posterior_data=_normal_view(),
        )
        other_customer = User.objects.create_user(
            email='posturo-other@test.com', password='p', role=User.Role.CUSTOMER,
        )
        abnormal = PosturometryEvaluation.objects.create(
            customer=other_customer, trainer=trainer,
            anterior_data=_abnormal_view(),
            lateral_right_data=_abnormal_view(),
            lateral_left_data=_abnormal_view(),
            posterior_data=_abnormal_view(),
        )
        # Index measures deviation: 0.0 is perfect, higher is worse
        assert abnormal.global_index > normal.global_index


@pytest.mark.django_db
class TestPosturometryEvaluationMeta:
    """Validates ordering, str representation, and FK behavior."""

    def test_str_representation(self, trainer, customer):
        """String representation includes pk, customer email, and creation date."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
        )
        rendered = str(ev)
        assert f'#{ev.pk}' in rendered
        assert customer.email in rendered

    def test_ordering_by_evaluation_date_descending(self, trainer, customer):
        """Default queryset orders evaluations by most recent evaluation_date first."""
        PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            evaluation_date=date(2026, 1, 1),
            anterior_data=_normal_view(),
        )
        PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            evaluation_date=date(2026, 3, 1),
            anterior_data=_normal_view(),
        )
        dates = list(PosturometryEvaluation.objects.values_list('evaluation_date', flat=True))
        assert dates == [date(2026, 3, 1), date(2026, 1, 1)]

    def test_trainer_set_null_on_delete(self, trainer, customer):
        """Deleting the trainer sets the FK to NULL but keeps the evaluation row."""
        ev = PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
        )
        trainer.delete()
        ev.refresh_from_db()
        assert ev.trainer is None

    def test_cascade_delete_with_customer(self, trainer, customer):
        """Evaluations are deleted when their owning customer is deleted."""
        PosturometryEvaluation.objects.create(
            customer=customer, trainer=trainer,
            anterior_data=_normal_view(),
        )
        customer.delete()
        assert PosturometryEvaluation.objects.count() == 0


def test_posturometry_photo_path_with_customer_id():
    """posturometry_photo_path returns the expected upload path."""
    from types import SimpleNamespace
    from core_app.models.posturometry import posturometry_photo_path
    instance = SimpleNamespace(customer_id=42)
    path = posturometry_photo_path(instance, 'front.jpg')
    assert path == 'posturometry/42/front.jpg'


def test_posturometry_photo_path_without_customer_id():
    """posturometry_photo_path uses 'unknown' when customer_id is not set."""
    from types import SimpleNamespace
    from core_app.models.posturometry import posturometry_photo_path
    instance = SimpleNamespace(customer_id=None)
    path = posturometry_photo_path(instance, 'side.jpg')
    assert path == 'posturometry/unknown/side.jpg'
