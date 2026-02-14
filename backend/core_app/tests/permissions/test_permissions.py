import pytest
from unittest.mock import MagicMock

from core_app.models import User
from core_app.permissions import IsAdminOrReadOnly, IsAdminRole, is_admin_user


class TestIsAdminUserHelper:
    def test_returns_false_for_none(self):
        assert is_admin_user(None) is False

    def test_returns_false_for_anonymous(self):
        anon = MagicMock()
        anon.is_authenticated = False
        assert is_admin_user(anon) is False

    @pytest.mark.django_db
    def test_returns_false_for_customer(self):
        user = User.objects.create_user(email='cust_perm@example.com', password='p')
        assert is_admin_user(user) is False

    @pytest.mark.django_db
    def test_returns_true_for_admin_role(self):
        user = User.objects.create_user(
            email='admin_perm@example.com', password='p', role=User.Role.ADMIN,
        )
        assert is_admin_user(user) is True

    @pytest.mark.django_db
    def test_returns_true_for_staff(self):
        user = User.objects.create_user(
            email='staff_perm@example.com', password='p', is_staff=True,
        )
        assert is_admin_user(user) is True

    @pytest.mark.django_db
    def test_returns_true_for_superuser(self):
        user = User.objects.create_superuser(
            email='super_perm@example.com', password='p',
        )
        assert is_admin_user(user) is True


def _make_request(user, method='GET'):
    request = MagicMock()
    request.user = user
    request.method = method
    return request


@pytest.mark.django_db
class TestIsAdminRole:
    def test_admin_allowed(self):
        user = User.objects.create_user(
            email='admin_role@example.com', password='p',
            role=User.Role.ADMIN, is_staff=True,
        )
        perm = IsAdminRole()
        assert perm.has_permission(_make_request(user), None) is True

    def test_customer_denied(self):
        user = User.objects.create_user(email='cust_role@example.com', password='p')
        perm = IsAdminRole()
        assert perm.has_permission(_make_request(user), None) is False

    def test_anonymous_denied(self):
        anon = MagicMock()
        anon.is_authenticated = False
        perm = IsAdminRole()
        assert perm.has_permission(_make_request(anon), None) is False


@pytest.mark.django_db
class TestIsAdminOrReadOnly:
    def test_get_allowed_for_anonymous(self):
        anon = MagicMock()
        anon.is_authenticated = False
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(anon, 'GET'), None) is True

    def test_head_allowed_for_anonymous(self):
        anon = MagicMock()
        anon.is_authenticated = False
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(anon, 'HEAD'), None) is True

    def test_post_denied_for_customer(self):
        user = User.objects.create_user(email='cust_ro@example.com', password='p')
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(user, 'POST'), None) is False

    def test_post_allowed_for_admin(self):
        user = User.objects.create_user(
            email='admin_ro@example.com', password='p',
            role=User.Role.ADMIN, is_staff=True,
        )
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(user, 'POST'), None) is True

    def test_delete_denied_for_anonymous(self):
        anon = MagicMock()
        anon.is_authenticated = False
        perm = IsAdminOrReadOnly()
        assert perm.has_permission(_make_request(anon, 'DELETE'), None) is False
