"""Tests for create_fake_users management command."""

from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import User


@pytest.mark.django_db
class TestCreateFakeUsers:
    """Validates fake user creation outcomes and command options."""

    def test_creates_admin_and_customers(self):
        """Command creates one admin and the requested number of customers."""
        out = StringIO()
        call_command('create_fake_users', customers=3, stdout=out)

        assert User.objects.filter(role=User.Role.ADMIN).count() == 1
        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 3
        assert User.objects.get(email='admin@kore.com').is_staff is True

    def test_idempotent(self):
        """Repeated command runs do not duplicate admin or customer records."""
        out = StringIO()
        call_command('create_fake_users', customers=2, stdout=out)
        call_command('create_fake_users', customers=2, stdout=out)

        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 2
        assert User.objects.filter(role=User.Role.ADMIN).count() == 1

    def test_no_admin_flag(self):
        """no_admin option skips admin creation while creating customers."""
        out = StringIO()
        call_command('create_fake_users', customers=1, no_admin=True, stdout=out)

        assert User.objects.filter(role=User.Role.ADMIN).count() == 0
        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 1

    def test_custom_admin_email(self):
        """Command creates the admin account using provided admin_email value."""
        out = StringIO()
        call_command('create_fake_users', customers=0, admin_email='custom@kore.com', stdout=out)

        assert User.objects.filter(email='custom@kore.com').exists()
