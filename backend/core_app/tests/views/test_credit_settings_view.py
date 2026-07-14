"""The customer reads the reschedule window; only the trainer writes the settings."""

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import TrainerProfile, User
from core_app.models.credit import CreditSettings
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='settings-trainer@kore.com', password='p',
        first_name='Tina', last_name='Trainer', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=user)
    return user


@pytest.mark.django_db
def test_credit_values_exposes_the_reschedule_window(api_client, existing_user):
    settings_obj = credit_engine.get_settings()
    settings_obj.reschedule_window_hours = 36
    settings_obj.save(update_fields=['reschedule_window_hours'])
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse('credits-values'))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['reschedule_window_hours'] == 36


@pytest.mark.django_db
def test_a_customer_cannot_write_the_settings(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)

    response = api_client.put(
        reverse('credits-settings'), {'reschedule_window_hours': 12}, format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_the_trainer_updates_the_window(api_client, trainer_user):
    api_client.force_authenticate(user=trainer_user)

    response = api_client.put(
        reverse('credits-settings'), {'reschedule_window_hours': 48}, format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert CreditSettings.load().reschedule_window_hours == 48


@pytest.mark.django_db
def test_an_absurd_window_is_rejected(api_client, trainer_user):
    # Without a ceiling, a typo would freeze everyone's booking for weeks.
    api_client.force_authenticate(user=trainer_user)

    response = api_client.put(
        reverse('credits-settings'), {'reschedule_window_hours': 200}, format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_changing_the_difficulty_reseeds_the_action_values(api_client, trainer_user):
    credit_engine.get_settings()  # seed the medium preset
    api_client.force_authenticate(user=trainer_user)

    response = api_client.put(
        reverse('credits-settings'),
        {'difficulty': 'hard', 'action_values': {}, 'streak_bonuses': {}},
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    settings_obj = CreditSettings.load()
    assert settings_obj.difficulty == 'hard'
    assert settings_obj.action_values['workout_day'] == 10  # the hard preset
