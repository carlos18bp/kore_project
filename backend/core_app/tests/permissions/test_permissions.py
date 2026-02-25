"""Tests for permission helpers and DRF permission classes."""

from types import SimpleNamespace

import pytest

from core_app.models import User
from core_app.permissions import IsAdminOrReadOnly, IsAdminRole, is_admin_user


class TestIsAdminUserHelper:
    """Covers low-level admin-user helper behavior across user shapes."""

    def test_returns_false_for_none(self):
        """Helper returns False when user object is None."""
        result = is_admin_user(None)
        assert result is False
        assert isinstance(result, bool)

    def test_returns_false_for_anonymous(self):
        """Helper returns False for unauthenticated anonymous-like objects."""
        anon = SimpleNamespace(is_authenticated=False)
        assert is_admin_user(anon) is False

    @pytest.mark.django_db
    def test_returns_false_for_customer(self):
        """Helper returns False for authenticated customer users."""
        user = User.objects.create_user(email='cust_perm@example.com', password='p')
        assert is_admin_user(user) is False

    @pytest.mark.django_db
    def test_returns_true_for_admin_role(self):
        """Helper returns True when user role is ADMIN."""
        user = User.objects.create_user(
            email='admin_perm@example.com', password='p', role=User.Role.ADMIN,
        )
        assert is_admin_user(user) is True

    @pytest.mark.django_db
    def test_returns_true_for_staff(self):
        """Helper returns True when user has staff flag enabled."""
        user = User.objects.create_user(
            email='staff_perm@example.com', password='p', is_staff=True,
        )
        assert is_admin_user(user) is True

    @pytest.mark.django_db
    def test_returns_true_for_superuser(self):
        """Helper returns True for Django superusers."""
        user = User.objects.create_superuser(
            email='super_perm@example.com', password='p',
        )
        assert is_admin_user(user) is True


def _make_request(user, method='GET'):
    return SimpleNamespace(user=user, method=method)


@pytest.mark.django_db
class TestIsAdminRole:
    """Covers IsAdminRole permission outcomes for common request users."""

    def test_admin_allowed(self):
        """IsAdminRole allows authenticated admin users."""
        user = User.objects.create_user(
            email='admin_role@example.com', password='p',
            role=User.Role.ADMIN, is_staff=True,
        )
        perm = IsAdminRole()
        assert perm.has_permission(_make_request(user), None) is True

    def test_customer_denied(self):
        """IsAdminRole denies authenticated non-admin customers."""
        user = User.objects.create_user(email='cust_role@example.com', password='p')
        perm = IsAdminRole()
        assert perm.has_permission(_make_request(user), None) is False

    def test_anonymous_denied(self):
        """IsAdminRole denies anonymous requests."""
        anon = SimpleNamespace(is_authenticated=False)
        perm = IsAdminRole()
        assert perm.has_permission(_make_request(anon), None) is False


@pytest.mark.django_db
class TestIsAdminOrReadOnly:
    """Covers read/write behavior split for IsAdminOrReadOnly permission."""

    def test_get_allowed_for_anonymous(self):
        """Safe GET requests are allowed for anonymous users."""
        anon = SimpleNamespace(is_authenticated=False)
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(anon, 'GET'), None) is True

    def test_head_allowed_for_anonymous(self):
        """Safe HEAD requests are allowed for anonymous users."""
        anon = SimpleNamespace(is_authenticated=False)
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(anon, 'HEAD'), None) is True

    def test_post_denied_for_customer(self):
        """Write requests are denied for authenticated non-admin users."""
        user = User.objects.create_user(email='cust_ro@example.com', password='p')
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(user, 'POST'), None) is False

    def test_post_allowed_for_admin(self):
        """Write requests are allowed for admin users."""
        user = User.objects.create_user(
            email='admin_ro@example.com', password='p',
            role=User.Role.ADMIN, is_staff=True,
        )
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(user, 'POST'), None) is True

    def test_delete_denied_for_anonymous(self):
        """Unsafe DELETE requests are denied for anonymous users."""
        anon = SimpleNamespace(is_authenticated=False)
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(anon, 'DELETE'), None) is False
