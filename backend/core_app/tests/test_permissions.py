"""Tests for custom permission classes and helpers."""

from types import SimpleNamespace

import pytest
from rest_framework.test import APIRequestFactory

from core_app.models import User
from core_app.permissions import IsAdminOrReadOnly, IsAdminRole, is_admin_user


# ----------------------------------------------------------------
# is_admin_user helper
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestIsAdminUser:
    """Validate is_admin_user helper for all role/flag combinations."""

    def test_admin_role_returns_true(self):
        """Return True for user with role=admin."""
        user = User.objects.create_user(
            email='perm_admin@example.com', password='p', role=User.Role.ADMIN,
        )
        assert is_admin_user(user) is True

    def test_staff_user_returns_true(self):
        """Return True for user with is_staff=True."""
        user = User.objects.create_user(
            email='perm_staff@example.com', password='p', is_staff=True,
        )
        assert is_admin_user(user) is True

    def test_superuser_returns_true(self):
        """Return True for superuser."""
        user = User.objects.create_superuser(
            email='perm_super@example.com', password='p',
        )
        assert is_admin_user(user) is True

    def test_customer_returns_false(self):
        """Return False for regular customer."""
        user = User.objects.create_user(
            email='perm_cust@example.com', password='p', role=User.Role.CUSTOMER,
        )
        assert is_admin_user(user) is False

    def test_trainer_returns_false(self):
        """Return False for trainer role without staff/admin flags."""
        user = User.objects.create_user(
            email='perm_trainer@example.com', password='p', role=User.Role.TRAINER,
        )
        assert is_admin_user(user) is False

    def test_none_user_returns_false(self):
        """Return False when user is None."""
        assert is_admin_user(None) is False

    def test_anonymous_user_returns_false(self):
        """Return False for unauthenticated (anonymous) user object."""
        anon = SimpleNamespace(is_authenticated=False)
        assert is_admin_user(anon) is False


# ----------------------------------------------------------------
# IsAdminRole permission class
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestIsAdminRole:
    """Validate IsAdminRole permission class."""

    def _make_request(self, user, method='GET'):
        factory = APIRequestFactory()
        request = factory.generic(method, '/fake/')
        request.user = user
        return request

    def test_admin_allowed(self):
        """Grant access for admin-role user."""
        user = User.objects.create_user(
            email='perm_is_admin@example.com', password='p', role=User.Role.ADMIN,
        )
        request = self._make_request(user)
        assert IsAdminRole().has_permission(request, view=None) is True

    def test_customer_denied(self):
        """Deny access for customer-role user."""
        user = User.objects.create_user(
            email='perm_is_cust@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user)
        assert IsAdminRole().has_permission(request, view=None) is False

    def test_staff_allowed(self):
        """Grant access for staff user regardless of role."""
        user = User.objects.create_user(
            email='perm_is_staff@example.com', password='p', is_staff=True,
        )
        request = self._make_request(user)
        assert IsAdminRole().has_permission(request, view=None) is True

    def test_write_method_admin_allowed(self):
        """Grant POST access for admin user."""
        user = User.objects.create_user(
            email='perm_post_admin@example.com', password='p', role=User.Role.ADMIN,
        )
        request = self._make_request(user, method='POST')
        assert IsAdminRole().has_permission(request, view=None) is True


# ----------------------------------------------------------------
# IsAdminOrReadOnly permission class
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestIsAdminOrReadOnly:
    """Validate IsAdminOrReadOnly permission class for SAFE and write methods."""

    def _make_request(self, user, method='GET'):
        factory = APIRequestFactory()
        request = factory.generic(method, '/fake/')
        request.user = user
        return request

    def test_safe_method_allows_customer(self):
        """Allow GET for non-admin user."""
        user = User.objects.create_user(
            email='perm_ro_cust@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user, method='GET')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is True

    def test_safe_method_head_allows_customer(self):
        """Allow HEAD for non-admin user."""
        user = User.objects.create_user(
            email='perm_ro_head@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user, method='HEAD')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is True

    def test_safe_method_options_allows_customer(self):
        """Allow OPTIONS for non-admin user."""
        user = User.objects.create_user(
            email='perm_ro_opt@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user, method='OPTIONS')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is True

    def test_write_method_denied_for_customer(self):
        """Deny POST for non-admin user."""
        user = User.objects.create_user(
            email='perm_ro_post@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user, method='POST')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is False

    def test_write_method_denied_for_put(self):
        """Deny PUT for non-admin user."""
        user = User.objects.create_user(
            email='perm_ro_put@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user, method='PUT')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is False

    def test_write_method_denied_for_delete(self):
        """Deny DELETE for non-admin user."""
        user = User.objects.create_user(
            email='perm_ro_del@example.com', password='p', role=User.Role.CUSTOMER,
        )
        request = self._make_request(user, method='DELETE')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is False

    def test_write_method_allowed_for_admin(self):
        """Allow POST for admin-role user."""
        user = User.objects.create_user(
            email='perm_ro_admin@example.com', password='p', role=User.Role.ADMIN,
        )
        request = self._make_request(user, method='POST')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is True

    def test_patch_allowed_for_staff(self):
        """Allow PATCH for staff user."""
        user = User.objects.create_user(
            email='perm_ro_patch@example.com', password='p', is_staff=True,
        )
        request = self._make_request(user, method='PATCH')
        assert IsAdminOrReadOnly().has_permission(request, view=None) is True
