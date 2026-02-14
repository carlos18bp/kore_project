import pytest
from rest_framework.test import APIClient

from core_app.models import User


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
