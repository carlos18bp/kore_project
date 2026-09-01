import importlib

import pytest
from django.apps import apps as django_apps

from core_app.models.credit import CreditSettings
from core_app.services import credit_engine

MIGRATION_MODULE = 'core_app.migrations.0059_enable_workout_captures'


@pytest.mark.django_db
def test_credit_values_returns_config(api_client, existing_user):
    credit_engine.get_settings()  # seed presets
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/values/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['action_values']['checkin'] == 5
    assert data['streak_bonuses']['7'] == 50
    assert data['water_goal_glasses'] == 8
    assert 'require_workout_captures' in data


@pytest.mark.django_db
def test_credit_values_requires_auth(api_client):
    assert api_client.get('/api/credits/values/').status_code == 401


@pytest.mark.django_db
def test_enable_workout_captures_migration_flips_existing_row():
    CreditSettings.load()
    mod = importlib.import_module(MIGRATION_MODULE)
    mod.enable_workout_captures(django_apps, None)
    assert CreditSettings.load().require_workout_captures is True
