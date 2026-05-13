"""Serializer tests for user registration and login validation flows."""

import pytest
from django.test import override_settings

from core_app.models import User
from core_app.serializers import LoginSerializer, RegisterUserSerializer, UserSerializer


@pytest.mark.django_db
class TestUserSerializer:
    """Output field coverage for user serializer responses."""

    def test_fields(self):
        """Expose expected public fields and normalized role in serialized payload."""
        user = User.objects.create_user(
            email='u@example.com', password='p', first_name='A', last_name='B', phone='123',
        )
        data = UserSerializer(user).data
        assert set(data.keys()) == {'id', 'email', 'first_name', 'last_name', 'phone', 'role'}
        assert data['email'] == 'u@example.com'
        assert data['role'] == 'customer'


@pytest.mark.django_db
class TestRegisterUserSerializer:
    """Validation and persistence behavior for user registration serializer."""

    def test_valid_registration(self):
        """Create a customer user when registration payload is valid."""
        data = {
            'email': 'new@example.com',
            'password': 'securepass',
            'password_confirm': 'securepass',
            'first_name': 'New',
            'last_name': 'User',
        }
        serializer = RegisterUserSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        user = serializer.save()
        assert user.email == 'new@example.com'
        assert user.check_password('securepass')
        assert user.role == User.Role.CUSTOMER

    def test_password_mismatch(self):
        """Reject registration when password and confirmation differ."""
        data = {
            'email': 'new@example.com',
            'password': 'securepass',
            'password_confirm': 'differentpass',
        }
        serializer = RegisterUserSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password_confirm' in serializer.errors

    def test_password_min_length(self):
        """Reject registration when password length is below minimum constraints."""
        data = {
            'email': 'new@example.com',
            'password': 'short',
            'password_confirm': 'short',
        }
        serializer = RegisterUserSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_duplicate_email(self):
        """Reject registration when the submitted email already exists."""
        User.objects.create_user(email='dup@example.com', password='p')
        data = {
            'email': 'dup@example.com',
            'password': 'securepass',
            'password_confirm': 'securepass',
        }
        serializer = RegisterUserSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors


@pytest.mark.django_db
class TestLoginSerializer:
    """Authentication outcomes for login serializer credential checks."""

    def test_valid_login(self):
        """Authenticate successfully with valid credentials and active user."""
        User.objects.create_user(email='login@example.com', password='mypassword')
        serializer = LoginSerializer(data={
            'email': 'login@example.com',
            'password': 'mypassword',
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['user'].email == 'login@example.com'

    def test_invalid_credentials(self):
        """Reject login attempts with incorrect password credentials."""
        User.objects.create_user(email='login@example.com', password='mypassword')
        serializer = LoginSerializer(data={
            'email': 'login@example.com',
            'password': 'wrongpassword',
        })
        assert not serializer.is_valid()

    def test_inactive_user(self):
        """Reject login when credentials are valid but account is inactive."""
        user = User.objects.create_user(email='inactive@example.com', password='mypassword')
        user.is_active = False
        user.save()
        serializer = LoginSerializer(data={
            'email': 'inactive@example.com',
            'password': 'mypassword',
        })
        assert not serializer.is_valid()

    @pytest.mark.django_db
    @override_settings(AUTHENTICATION_BACKENDS=[
        'django.contrib.auth.backends.AllowAllUsersModelBackend',
    ])
    def test_inactive_user_is_active_check(self):
        """Cover line 51: user.is_active is False after authenticate returns user."""
        user = User.objects.create_user(email='inactive2@example.com', password='mypassword')
        user.is_active = False
        user.save()
        serializer = LoginSerializer(data={
            'email': 'inactive2@example.com',
            'password': 'mypassword',
        })
        assert not serializer.is_valid()
        # The error should mention inactive user state.
        errors = serializer.errors
        assert any('inactivo' in str(v).lower() for v in errors.values())
