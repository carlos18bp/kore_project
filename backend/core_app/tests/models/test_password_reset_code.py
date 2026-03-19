"""Model tests for PasswordResetCode."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest

from core_app.models import PasswordResetCode, User

FIXED_NOW = datetime(2025, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


@pytest.mark.django_db
class TestPasswordResetCodeModel:
    """Tests for PasswordResetCode creation, validation, and expiry."""

    def _make_user(self, email='user@example.com'):
        return User.objects.create_user(email=email, password='testpass123')

    def test_create_for_user_generates_6_digit_code(self):
        user = self._make_user()
        code = PasswordResetCode.create_for_user(user)
        assert len(code.code) == 6
        assert code.code.isdigit()

    def test_create_for_user_sets_expiry(self, monkeypatch):
        monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)
        user = self._make_user()
        code = PasswordResetCode.create_for_user(user)
        assert code.expires_at > FIXED_NOW
        assert code.expires_at <= FIXED_NOW + timedelta(minutes=11)

    def test_is_valid_returns_true_for_fresh_code(self):
        user = self._make_user()
        code = PasswordResetCode.create_for_user(user)
        assert code.is_valid is True

    def test_is_valid_returns_false_when_used(self):
        user = self._make_user()
        code = PasswordResetCode.create_for_user(user)
        code.used = True
        code.save()
        assert code.is_valid is False

    def test_is_valid_returns_false_when_expired(self, monkeypatch):
        monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)
        user = self._make_user()
        code = PasswordResetCode.create_for_user(user)
        code.expires_at = FIXED_NOW - timedelta(minutes=1)
        code.save()
        assert code.is_valid is False

    def test_create_for_user_invalidates_previous_codes(self):
        user = self._make_user()
        code1 = PasswordResetCode.create_for_user(user)
        code2 = PasswordResetCode.create_for_user(user)
        code1.refresh_from_db()
        assert code1.used is True
        assert code2.used is False
        assert code2.is_valid is True

    def test_str_representation(self):
        user = self._make_user()
        code = PasswordResetCode.create_for_user(user)
        assert 'user@example.com' in str(code)
        assert 'active' in str(code)
        code.used = True
        code.save()
        assert 'used' in str(code)
