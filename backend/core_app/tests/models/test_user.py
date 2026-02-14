import pytest
from django.db import IntegrityError

from core_app.models import User


@pytest.mark.django_db
class TestUserManager:
    def test_create_user_sets_email_and_password(self):
        user = User.objects.create_user(email='test@example.com', password='securepass')
        assert user.email == 'test@example.com'
        assert user.check_password('securepass')
        assert user.role == User.Role.CUSTOMER
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_create_user_normalizes_email(self):
        user = User.objects.create_user(email='Test@EXAMPLE.com', password='securepass')
        assert user.email == 'Test@example.com'

    def test_create_user_without_email_raises(self):
        with pytest.raises(ValueError, match='Email is required'):
            User.objects.create_user(email='', password='securepass')

    def test_create_superuser_sets_admin_flags(self):
        user = User.objects.create_superuser(email='super@example.com', password='superpass')
        assert user.is_staff is True
        assert user.is_superuser is True
        assert user.role == User.Role.ADMIN

    def test_create_superuser_requires_is_staff(self):
        with pytest.raises(ValueError, match='is_staff=True'):
            User.objects.create_superuser(email='s@example.com', password='p', is_staff=False)

    def test_create_superuser_requires_is_superuser(self):
        with pytest.raises(ValueError, match='is_superuser=True'):
            User.objects.create_superuser(email='s@example.com', password='p', is_superuser=False)


@pytest.mark.django_db
class TestUserModel:
    def test_str_returns_email(self):
        user = User.objects.create_user(email='u@example.com', password='p')
        assert str(user) == 'u@example.com'

    def test_email_is_unique(self):
        User.objects.create_user(email='dup@example.com', password='p')
        with pytest.raises(IntegrityError):
            User.objects.create_user(email='dup@example.com', password='p2')

    def test_role_choices(self):
        assert User.Role.CUSTOMER == 'customer'
        assert User.Role.ADMIN == 'admin'

    def test_username_field_is_email(self):
        assert User.USERNAME_FIELD == 'email'
