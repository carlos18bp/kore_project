import pytest
from io import StringIO

from django.core.management import call_command

from core_app.models import User


@pytest.mark.django_db
class TestCreateFakeUsers:
    def test_creates_admin_and_customers(self):
        out = StringIO()
        call_command('create_fake_users', customers=3, stdout=out)

        assert User.objects.filter(role=User.Role.ADMIN).count() == 1
        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 3
        assert User.objects.get(email='admin@kore.com').is_staff is True

    def test_idempotent(self):
        out = StringIO()
        call_command('create_fake_users', customers=2, stdout=out)
        call_command('create_fake_users', customers=2, stdout=out)

        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 2
        assert User.objects.filter(role=User.Role.ADMIN).count() == 1

    def test_no_admin_flag(self):
        out = StringIO()
        call_command('create_fake_users', customers=1, no_admin=True, stdout=out)

        assert User.objects.filter(role=User.Role.ADMIN).count() == 0
        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 1

    def test_custom_admin_email(self):
        out = StringIO()
        call_command('create_fake_users', customers=0, admin_email='custom@kore.com', stdout=out)

        assert User.objects.filter(email='custom@kore.com').exists()
