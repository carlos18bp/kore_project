"""Tests for trainer profile serializers."""

import pytest

from core_app.models import TrainerProfile, User
from core_app.serializers.trainer_profile_serializers import TrainerProfileSerializer


@pytest.fixture
def trainer_user(db):
    """Create a user with trainer role."""
    return User.objects.create_user(
        email='trainer_ser@example.com', password='p',
        first_name='Carlos', last_name='Gómez',
        role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    """Create a TrainerProfile linked to the trainer user."""
    return TrainerProfile.objects.create(
        user=trainer_user,
        specialty='Rehabilitación',
        bio='Entrenador certificado con 10 años de experiencia.',
        location='Bogotá, Colombia',
        session_duration_minutes=45,
    )


@pytest.mark.django_db
class TestTrainerProfileSerializer:
    """Validate TrainerProfileSerializer field output and nested user data."""

    def test_serializes_expected_fields(self, trainer_profile):
        """Output contains all declared fields."""
        data = TrainerProfileSerializer(trainer_profile).data
        expected_fields = {
            'id', 'user_id', 'first_name', 'last_name', 'email',
            'specialty', 'bio', 'location', 'session_duration_minutes',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields

    def test_user_id_from_nested_relation(self, trainer_profile, trainer_user):
        """Resolve user_id from the nested user relation."""
        data = TrainerProfileSerializer(trainer_profile).data
        assert data['user_id'] == trainer_user.pk

    def test_first_name_from_nested_user(self, trainer_profile):
        """Resolve first_name from user.first_name."""
        data = TrainerProfileSerializer(trainer_profile).data
        assert data['first_name'] == 'Carlos'

    def test_last_name_from_nested_user(self, trainer_profile):
        """Resolve last_name from user.last_name."""
        data = TrainerProfileSerializer(trainer_profile).data
        assert data['last_name'] == 'Gómez'

    def test_email_from_nested_user(self, trainer_profile, trainer_user):
        """Resolve email from user.email."""
        data = TrainerProfileSerializer(trainer_profile).data
        assert data['email'] == trainer_user.email

    def test_specialty_value(self, trainer_profile):
        """Serialize specialty field correctly."""
        data = TrainerProfileSerializer(trainer_profile).data
        assert data['specialty'] == 'Rehabilitación'

    def test_session_duration_minutes_value(self, trainer_profile):
        """Serialize session_duration_minutes correctly."""
        data = TrainerProfileSerializer(trainer_profile).data
        assert data['session_duration_minutes'] == 45

    def test_read_only_timestamps(self, trainer_profile):
        """Ignore created_at and updated_at in input payloads."""
        serializer = TrainerProfileSerializer(
            trainer_profile,
            data={'created_at': '2020-01-01T00:00:00Z', 'updated_at': '2020-01-01T00:00:00Z'},
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors
