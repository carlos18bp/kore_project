"""Tests for trainer profile model behavior."""

import pytest
from django.db import IntegrityError, transaction

from core_app.models import TrainerProfile, User


@pytest.fixture
def trainer_user(db):
    """Create a trainer user fixture for profile model tests."""
    return User.objects.create_user(
        email='trainer@example.com',
        password='p',
        first_name='Jane',
        last_name='Doe',
        role=User.Role.TRAINER,
    )


@pytest.mark.django_db
class TestTrainerProfileModel:
    """Validate TrainerProfile defaults, relations, and lifecycle behavior."""

    def test_create_profile(self, trainer_user):
        """Create a trainer profile with expected persisted field values."""
        profile = TrainerProfile.objects.create(
            user=trainer_user,
            specialty='Functional training',
            bio='Bio text',
            location='Studio A',
            session_duration_minutes=60,
        )
        assert profile.pk is not None
        assert profile.specialty == 'Functional training'
        assert profile.session_duration_minutes == 60

    def test_str_representation(self, trainer_user):
        """Include trainer name and specialty in string representation."""
        profile = TrainerProfile.objects.create(
            user=trainer_user,
            specialty='Yoga',
        )
        assert 'Jane' in str(profile)
        assert 'Yoga' in str(profile)

    def test_default_session_duration(self, trainer_user):
        """Default session duration to sixty minutes when omitted."""
        profile = TrainerProfile.objects.create(
            user=trainer_user,
            specialty='Pilates',
        )
        assert profile.session_duration_minutes == 60

    def test_one_to_one_with_user(self, trainer_user):
        """Enforce one profile per user via one-to-one relation constraint."""
        TrainerProfile.objects.create(user=trainer_user, specialty='A')
        assert TrainerProfile.objects.count() == 1
        with transaction.atomic():
            with pytest.raises(IntegrityError):
                TrainerProfile.objects.create(user=trainer_user, specialty='B')
        assert TrainerProfile.objects.count() == 1

    def test_cascade_delete_with_user(self, trainer_user):
        """Delete trainer profile automatically when linked user is deleted."""
        TrainerProfile.objects.create(user=trainer_user, specialty='A')
        assert TrainerProfile.objects.count() == 1
        trainer_user.delete()
        assert TrainerProfile.objects.count() == 0
