"""Model tests for CustomerProfile, MoodEntry, and WeightEntry."""

import pytest
from django.db import IntegrityError
from django.utils import timezone

from core_app.models import CustomerProfile, MoodEntry, User, WeightEntry


@pytest.mark.django_db
class TestCustomerProfileAutoCreate:
    """Signal auto-creates CustomerProfile for customer users."""

    def test_profile_created_on_customer_user_creation(self):
        """A CustomerProfile is auto-created when a customer user is saved."""
        user = User.objects.create_user(email='c@example.com', password='p')
        assert hasattr(user, 'customer_profile')
        assert CustomerProfile.objects.filter(user=user).exists()

    def test_profile_not_created_for_admin(self):
        """No CustomerProfile is created for admin users."""
        user = User.objects.create_user(email='a@example.com', password='p', role=User.Role.ADMIN)
        assert not CustomerProfile.objects.filter(user=user).exists()

    def test_profile_not_created_for_trainer(self):
        """No CustomerProfile is created for trainer users."""
        user = User.objects.create_user(email='t@example.com', password='p', role=User.Role.TRAINER)
        assert not CustomerProfile.objects.filter(user=user).exists()


@pytest.mark.django_db
class TestCustomerProfileCompletion:
    """profile_completed logic."""

    def test_incomplete_when_missing_fields(self):
        """Profile is not marked complete when key fields are empty."""
        user = User.objects.create_user(email='u@example.com', password='p', first_name='A', last_name='B')
        profile = user.customer_profile
        assert profile.profile_completed is False

    def test_complete_when_all_fields_filled(self):
        """Profile is marked complete when all required fields are present."""
        from datetime import date
        user = User.objects.create_user(email='u@example.com', password='p', first_name='A', last_name='B')
        profile = user.customer_profile
        profile.sex = 'masculino'
        profile.date_of_birth = date(1990, 5, 15)
        profile.city = 'Bogotá'
        profile.primary_goal = 'fat_loss'
        profile.save()
        assert profile.profile_completed is True

    def test_kore_start_date_auto_set(self):
        """kore_start_date is auto-set from user.date_joined when not explicitly set."""
        user = User.objects.create_user(email='u@example.com', password='p')
        profile = user.customer_profile
        assert profile.kore_start_date == user.date_joined.date()


@pytest.mark.django_db
class TestMoodEntry:
    """MoodEntry model constraints."""

    def test_create_mood_entry(self):
        """Create a valid mood entry."""
        user = User.objects.create_user(email='u@example.com', password='p')
        entry = MoodEntry.objects.create(user=user, mood='motivated')
        assert entry.mood == 'motivated'
        assert entry.date == timezone.localdate()

    def test_unique_per_user_per_day(self):
        """Only one mood entry per user per day."""
        user = User.objects.create_user(email='u@example.com', password='p')
        MoodEntry.objects.create(user=user, mood='motivated')
        with pytest.raises(IntegrityError):
            MoodEntry.objects.create(user=user, mood='tired')


@pytest.mark.django_db
class TestWeightEntry:
    """WeightEntry model constraints and profile sync."""

    def test_create_weight_entry(self):
        """Create a valid weight entry."""
        user = User.objects.create_user(email='u@example.com', password='p')
        entry = WeightEntry.objects.create(user=user, weight_kg=72.5)
        assert entry.weight_kg == pytest.approx(72.5, abs=0.1)
        assert entry.date == timezone.localdate()

    def test_unique_per_user_per_day(self):
        """Only one weight entry per user per day."""
        user = User.objects.create_user(email='u@example.com', password='p')
        WeightEntry.objects.create(user=user, weight_kg=72)
        with pytest.raises(IntegrityError):
            WeightEntry.objects.create(user=user, weight_kg=73)

    def test_weight_entry_created_without_error(self):
        """Creating a WeightEntry succeeds without syncing to profile."""
        user = User.objects.create_user(email='u@example.com', password='p')
        entry = WeightEntry.objects.create(user=user, weight_kg=80.0)
        assert entry.weight_kg == pytest.approx(80.0, abs=0.1)
