"""Tests for RegistrationVerificationCode model."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest

from core_app.models.registration_verification_code import RegistrationVerificationCode

FIXED_NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def frozen_now(monkeypatch):
    """Freeze django.utils.timezone.now to a fixed UTC datetime."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)
    return FIXED_NOW


@pytest.mark.django_db
class TestRegistrationVerificationCodeSave:
    """Validates auto-generation logic in save() and helper classmethods."""

    def test_save_auto_generates_six_digit_code(self):
        """Save auto-generates a 6-digit numeric code when none is provided."""
        code = RegistrationVerificationCode.objects.create(email='new@test.com')
        assert len(code.code) == 6
        assert code.code.isdigit()

    def test_save_sets_expires_at_ten_minutes_in_future(self, frozen_now):
        """Save sets expires_at to 10 minutes after now when not provided."""
        code = RegistrationVerificationCode.objects.create(email='new@test.com')
        assert code.expires_at == frozen_now + timedelta(minutes=10)

    def test_save_respects_explicit_code(self):
        """Explicit code values are preserved instead of being regenerated."""
        code = RegistrationVerificationCode.objects.create(
            email='new@test.com', code='123456',
        )
        assert code.code == '123456'

    def test_save_respects_explicit_expires_at(self, frozen_now):
        """Explicit expires_at values are preserved instead of being recomputed."""
        custom_expiry = frozen_now + timedelta(hours=1)
        code = RegistrationVerificationCode.objects.create(
            email='new@test.com', expires_at=custom_expiry,
        )
        assert code.expires_at == custom_expiry

    def test_default_used_is_false(self):
        """A freshly created code is not marked as used."""
        code = RegistrationVerificationCode.objects.create(email='new@test.com')
        assert code.used is False


@pytest.mark.django_db
class TestRegistrationVerificationCodeIsValid:
    """Validates the is_valid property across used/expired states."""

    def test_active_unexpired_code_is_valid(self):
        """A non-used and non-expired code reports as valid."""
        code = RegistrationVerificationCode.objects.create(email='new@test.com')
        assert code.is_valid is True

    def test_used_code_is_invalid(self):
        """A code marked as used reports as invalid even before expiration."""
        code = RegistrationVerificationCode.objects.create(email='new@test.com')
        code.used = True
        code.save()
        assert code.is_valid is False

    def test_expired_code_is_invalid(self, frozen_now):
        """A code past its expires_at reports as invalid."""
        code = RegistrationVerificationCode.objects.create(
            email='new@test.com',
            expires_at=frozen_now - timedelta(seconds=1),
        )
        assert code.is_valid is False


@pytest.mark.django_db
class TestRegistrationVerificationCodeClassmethods:
    """Validates create_for_email and recent_count classmethods."""

    def test_create_for_email_invalidates_previous_active_codes(self):
        """create_for_email marks previous active codes as used and creates a new one."""
        old = RegistrationVerificationCode.objects.create(email='same@test.com')
        new = RegistrationVerificationCode.create_for_email('same@test.com')

        old.refresh_from_db()
        assert old.used is True
        assert new.used is False
        assert new.email == 'same@test.com'

    def test_create_for_email_does_not_affect_other_emails(self):
        """create_for_email does not invalidate codes for unrelated email addresses."""
        other = RegistrationVerificationCode.objects.create(email='other@test.com')
        RegistrationVerificationCode.create_for_email('same@test.com')

        other.refresh_from_db()
        assert other.used is False

    def test_recent_count_returns_codes_within_window(self):
        """recent_count returns the number of codes created within N hours for an email."""
        RegistrationVerificationCode.objects.create(email='count@test.com')
        RegistrationVerificationCode.objects.create(email='count@test.com')
        RegistrationVerificationCode.objects.create(email='other@test.com')

        assert RegistrationVerificationCode.recent_count('count@test.com', hours=1) == 2
        assert RegistrationVerificationCode.recent_count('other@test.com', hours=1) == 1
        assert RegistrationVerificationCode.recent_count('missing@test.com', hours=1) == 0

    def test_recent_count_excludes_old_codes(self, frozen_now):
        """Codes created before the cutoff window are not counted."""
        old = RegistrationVerificationCode.objects.create(email='old@test.com')
        RegistrationVerificationCode.objects.filter(pk=old.pk).update(
            created_at=frozen_now - timedelta(hours=2),
        )

        assert RegistrationVerificationCode.recent_count('old@test.com', hours=1) == 0


@pytest.mark.django_db
class TestRegistrationVerificationCodeMeta:
    """Validates ordering and string representation."""

    def test_ordering_by_created_at_descending(self):
        """Default queryset orders codes by created_at descending."""
        first = RegistrationVerificationCode.objects.create(email='a@test.com')
        second = RegistrationVerificationCode.objects.create(email='b@test.com')
        third = RegistrationVerificationCode.objects.create(email='c@test.com')

        ids = list(RegistrationVerificationCode.objects.values_list('pk', flat=True))
        assert ids == [third.pk, second.pk, first.pk]

    def test_str_active_code(self):
        """Active code reports as 'active' in string representation."""
        code = RegistrationVerificationCode.objects.create(email='str@test.com')
        assert str(code) == 'Registration code for str@test.com (active)'

    def test_str_used_code(self):
        """Used code reports as 'used' in string representation."""
        code = RegistrationVerificationCode.objects.create(email='str@test.com')
        code.used = True
        code.save()
        assert str(code) == 'Registration code for str@test.com (used)'
