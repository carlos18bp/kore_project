"""Tests for the create_fake_tracking management command."""

from datetime import timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import (
    CustomerProfile,
    MoodEntry,
    Package,
    Subscription,
    SubscriptionRenewal,
    TermsAcceptance,
    TrainerProfile,
    TrainerUnavailability,
    User,
    WeightEntry,
    WompiEvent,
)


@pytest.fixture
def customers_trainer_and_subscription(db):
    """Two customers, one trainer, and one subscription for tracking generation."""
    c1 = User.objects.create_user(
        email='trk-c1@test.com', password='p',
        first_name='C1', last_name='Track', role=User.Role.CUSTOMER,
    )
    User.objects.create_user(
        email='trk-c2@test.com', password='p',
        first_name='C2', last_name='Track', role=User.Role.CUSTOMER,
    )
    trainer_user = User.objects.create_user(
        email='trk-trainer@test.com', password='p',
        first_name='T', last_name='Track', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=trainer_user, location='Gym Track')
    package = Package.objects.create(title='Básico', sessions_count=8)
    now = timezone.now()
    Subscription.objects.create(
        customer=c1,
        package=package,
        sessions_total=8,
        sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=now - timedelta(days=5),
        expires_at=now + timedelta(days=25),
    )


@pytest.mark.django_db
class TestCreateFakeTracking:
    """Validates fake tracking creation outcomes and command options."""

    def test_creates_mood_entries_for_requested_days(self, customers_trainer_and_subscription):
        """Five mood days produce five entries for each of the two customers."""
        call_command('create_fake_tracking', mood_days=5, seed=2, stdout=StringIO())

        assert MoodEntry.objects.count() == 10

    def test_creates_weight_entries_for_requested_weeks(self, customers_trainer_and_subscription):
        """Four weight weeks produce four entries for each of the two customers."""
        call_command('create_fake_tracking', weight_weeks=4, seed=2, stdout=StringIO())

        assert WeightEntry.objects.count() == 8

    def test_enriches_customer_profile_to_completed(self, customers_trainer_and_subscription):
        """Profile enrichment fills demographics so the profile reads as completed."""
        call_command('create_fake_tracking', seed=2, stdout=StringIO())

        profile = CustomerProfile.objects.get(user__email='trk-c1@test.com')
        assert profile.primary_goal != ''
        assert profile.profile_completed is True

    def test_creates_future_trainer_unavailability(self, customers_trainer_and_subscription):
        """Two blocked days are created for the trainer, all in the future."""
        call_command('create_fake_tracking', unavailability=2, seed=2, stdout=StringIO())

        today = timezone.localdate()
        assert TrainerUnavailability.objects.count() == 2
        assert not TrainerUnavailability.objects.filter(date__lte=today).exists()

    def test_creates_initial_renewal_per_subscription(self, customers_trainer_and_subscription):
        """Each subscription gets one initial billing-period renewal record."""
        call_command('create_fake_tracking', seed=2, stdout=StringIO())

        renewals = SubscriptionRenewal.objects.all()
        assert renewals.count() == 1
        assert renewals.first().kind == SubscriptionRenewal.Kind.INITIAL

    def test_creates_terms_acceptance_per_user(self, customers_trainer_and_subscription):
        """One terms acceptance is recorded for each customer and trainer."""
        call_command('create_fake_tracking', seed=2, stdout=StringIO())

        assert TermsAcceptance.objects.count() == 3

    def test_creates_requested_number_of_wompi_events(self, customers_trainer_and_subscription):
        """The command creates exactly the requested number of webhook events."""
        call_command('create_fake_tracking', wompi_events=4, seed=2, stdout=StringIO())

        assert WompiEvent.objects.filter(transaction_id__startswith='wompi-fake-').count() == 4

    def test_rerun_does_not_duplicate_mood_entries(self, customers_trainer_and_subscription):
        """A second run reuses existing mood entries instead of duplicating them."""
        call_command('create_fake_tracking', mood_days=5, seed=2, stdout=StringIO())
        call_command('create_fake_tracking', mood_days=5, seed=2, stdout=StringIO())

        assert MoodEntry.objects.count() == 10
