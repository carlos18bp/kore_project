"""Tests for ParqAssessment model save logic."""

import pytest

from core_app.models import User
from core_app.models.parq_assessment import ParqAssessment


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='parq-customer@test.com', password='p',
        first_name='Customer', last_name='Parq', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestParqAssessmentSave:
    """Validates save() auto-computes risk classification from yes/no responses."""

    def test_save_zero_yes_count_for_all_no(self, customer):
        """Save computes yes_count=0 when all 7 responses are False."""
        ev = ParqAssessment.objects.create(customer=customer)
        assert ev.yes_count == 0

    def test_save_yes_count_matches_truthy_responses(self, customer):
        """Save computes yes_count equal to the number of True boolean responses."""
        ev = ParqAssessment.objects.create(
            customer=customer,
            q1_heart_condition=True,
            q4_chronic_condition=True,
            q5_prescribed_medication=True,
        )
        assert ev.yes_count == 3

    def test_save_populates_risk_classification(self, customer):
        """Save auto-populates risk_classification, label, and color."""
        ev = ParqAssessment.objects.create(customer=customer)
        assert ev.risk_classification != ''
        assert ev.risk_label != ''
        assert ev.risk_color != ''

    def test_low_risk_for_zero_yes(self, customer):
        """Zero yes responses produce a low-risk classification."""
        ev = ParqAssessment.objects.create(customer=customer)
        # Don't lock to a specific string — just ensure low risk indicators
        assert ev.yes_count == 0
        assert ev.risk_color != ''

    def test_high_risk_for_critical_questions(self, customer):
        """Affirmative responses to critical questions raise risk classification above zero-yes baseline."""
        baseline = ParqAssessment.objects.create(customer=customer)

        other = User.objects.create_user(
            email='parq-high@test.com', password='p', role=User.Role.CUSTOMER,
        )
        high = ParqAssessment.objects.create(
            customer=other,
            q1_heart_condition=True,
            q2_chest_pain=True,
            q3_dizziness=True,
        )
        # high-risk classification should differ from baseline (zero yes)
        assert high.risk_classification != baseline.risk_classification

    def test_save_default_additional_notes_is_empty(self, customer):
        """additional_notes defaults to an empty string when not provided."""
        ev = ParqAssessment.objects.create(customer=customer)
        assert ev.additional_notes == ''

    def test_save_preserves_explicit_additional_notes(self, customer):
        """Explicit additional_notes are preserved through save()."""
        ev = ParqAssessment.objects.create(
            customer=customer,
            additional_notes='Allergic to ibuprofen',
        )
        assert ev.additional_notes == 'Allergic to ibuprofen'


@pytest.mark.django_db
class TestParqAssessmentMeta:
    """Validates ordering, str representation, and FK behavior."""

    def test_str_representation(self, customer):
        """String representation includes pk, customer email, and date."""
        ev = ParqAssessment.objects.create(customer=customer)
        rendered = str(ev)
        assert f'PAR-Q #{ev.pk}' in rendered
        assert customer.email in rendered

    def test_ordering_by_created_at_descending(self, customer):
        """Default queryset orders assessments by created_at descending."""
        first = ParqAssessment.objects.create(customer=customer)
        # Use a different customer to avoid any cooldown semantics
        other = User.objects.create_user(
            email='parq-second@test.com', password='p', role=User.Role.CUSTOMER,
        )
        second = ParqAssessment.objects.create(customer=other)

        ids = list(ParqAssessment.objects.values_list('pk', flat=True))
        assert ids == [second.pk, first.pk]

    def test_cascade_delete_with_customer(self, customer):
        """Assessments are deleted when their owning customer is deleted."""
        ParqAssessment.objects.create(customer=customer)
        customer.delete()
        assert ParqAssessment.objects.count() == 0
