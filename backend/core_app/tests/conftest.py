from datetime import datetime, timedelta, timezone as dt_timezone

import pytest
from rest_framework.test import APIClient

from core_app.models import User

FROZEN_BASE = datetime(2026, 7, 15, 15, 0, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def frozen_now(monkeypatch):
    """Deterministic replacement for django.utils.timezone.now().

    Returns FROZEN_BASE; each subsequent call inside the test ticks forward by
    one microsecond so auto_now_add ordering stays stable.
    """
    state = {'ticks': 0}

    def _now():
        state['ticks'] += 1
        return FROZEN_BASE + timedelta(microseconds=state['ticks'])

    monkeypatch.setattr('django.utils.timezone.now', _now)
    return FROZEN_BASE


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def existing_user(db):
    return User.objects.create_user(
        email='existing@example.com',
        password='existingpassword',
        first_name='Existing',
        last_name='User',
        role=User.Role.CUSTOMER,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@example.com',
        password='adminpassword',
        first_name='Admin',
        last_name='User',
        role=User.Role.ADMIN,
        is_staff=True,
    )
