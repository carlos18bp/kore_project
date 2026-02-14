import pytest

from core_app.models import TrainerProfile, User


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='trainer@example.com',
        password='p',
        first_name='Jane',
        last_name='Doe',
        role=User.Role.TRAINER,
    )


@pytest.mark.django_db
class TestTrainerProfileModel:
    def test_create_profile(self, trainer_user):
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
        profile = TrainerProfile.objects.create(
            user=trainer_user,
            specialty='Yoga',
        )
        assert 'Jane' in str(profile)
        assert 'Yoga' in str(profile)

    def test_default_session_duration(self, trainer_user):
        profile = TrainerProfile.objects.create(
            user=trainer_user,
            specialty='Pilates',
        )
        assert profile.session_duration_minutes == 60

    def test_one_to_one_with_user(self, trainer_user):
        TrainerProfile.objects.create(user=trainer_user, specialty='A')
        with pytest.raises(Exception):
            TrainerProfile.objects.create(user=trainer_user, specialty='B')

    def test_cascade_delete_with_user(self, trainer_user):
        TrainerProfile.objects.create(user=trainer_user, specialty='A')
        assert TrainerProfile.objects.count() == 1
        trainer_user.delete()
        assert TrainerProfile.objects.count() == 0
