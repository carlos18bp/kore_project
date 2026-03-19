"""Tests for profile serializers covering avatar, kore_start_date, validation edge cases."""

from datetime import date
from unittest.mock import MagicMock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from core_app.models import CustomerProfile, User
from core_app.serializers.profile_serializers import (
    AvatarUploadSerializer,
    CustomerProfileSerializer,
    MoodEntrySerializer,
)


@pytest.mark.django_db
class TestCustomerProfileSerializerAvatarUrl(TestCase):
    """Cover get_avatar_url branches: with request, without request, no avatar."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='avatar_test@test.com', password='pass1234', role='customer',
        )
        self.profile = self.user.customer_profile

    def test_avatar_url_with_request_returns_absolute_uri(self):
        """get_avatar_url returns absolute URI when request is in context."""
        self.profile.avatar = SimpleUploadedFile(
            'avatar.jpg', b'\xff\xd8\xff\xe0' + b'\x00' * 50, content_type='image/jpeg',
        )
        self.profile.save()
        mock_request = MagicMock()
        mock_request.build_absolute_uri.return_value = 'http://testserver/media/avatar.jpg'
        serializer = CustomerProfileSerializer(self.profile, context={'request': mock_request})
        self.assertEqual(serializer.data['avatar_url'], 'http://testserver/media/avatar.jpg')
        mock_request.build_absolute_uri.assert_called_once()

    def test_avatar_url_without_request_returns_relative(self):
        """get_avatar_url returns relative URL when no request in context."""
        self.profile.avatar = SimpleUploadedFile(
            'avatar2.jpg', b'\xff\xd8\xff\xe0' + b'\x00' * 50, content_type='image/jpeg',
        )
        self.profile.save()
        serializer = CustomerProfileSerializer(self.profile, context={})
        url = serializer.data['avatar_url']
        self.assertIsNotNone(url)
        self.assertNotIn('http', url)

    def test_avatar_url_none_when_no_avatar(self):
        """get_avatar_url returns None when avatar is empty."""
        serializer = CustomerProfileSerializer(self.profile, context={})
        self.assertIsNone(serializer.data['avatar_url'])


@pytest.mark.django_db
class TestCustomerProfileSerializerKoreStartDate(TestCase):
    """Cover get_kore_start_date branches."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='kore_date@test.com', password='pass1234', role='customer',
        )
        self.profile = self.user.customer_profile

    def test_kore_start_date_returns_explicit_date(self):
        """Returns kore_start_date when set explicitly."""
        self.profile.kore_start_date = date(2025, 1, 15)
        self.profile.save()
        serializer = CustomerProfileSerializer(self.profile, context={})
        self.assertEqual(serializer.data['kore_start_date'], '2025-01-15')

    def test_kore_start_date_falls_back_to_date_joined(self):
        """Returns user.date_joined.date() when kore_start_date is null."""
        self.profile.kore_start_date = None
        self.profile.save()
        serializer = CustomerProfileSerializer(self.profile, context={})
        expected = str(self.user.date_joined.date())
        self.assertEqual(serializer.data['kore_start_date'], expected)

    def test_kore_start_date_none_when_no_user_id(self):
        """Returns None when profile has no user_id (unsaved profile)."""
        orphan = CustomerProfile(kore_start_date=None, user_id=None)
        serializer = CustomerProfileSerializer(orphan, context={})
        self.assertIsNone(serializer.data['kore_start_date'])


@pytest.mark.django_db
class TestAvatarUploadValidation(TestCase):
    """Cover avatar size and content-type validation."""

    def test_rejects_file_over_5mb(self):
        """validate_avatar raises error for files > 5 MB."""
        large_file = SimpleUploadedFile(
            'big.jpg', b'\x00' * (5 * 1024 * 1024 + 1), content_type='image/jpeg',
        )
        serializer = AvatarUploadSerializer(data={'avatar': large_file})
        self.assertFalse(serializer.is_valid())
        self.assertIn('avatar', serializer.errors)

    def test_rejects_invalid_content_type(self):
        """validate_avatar raises error for non-allowed content types."""
        gif_file = SimpleUploadedFile(
            'anim.gif', b'\x47\x49\x46\x38' + b'\x00' * 50, content_type='image/gif',
        )
        serializer = AvatarUploadSerializer(data={'avatar': gif_file})
        self.assertFalse(serializer.is_valid())
        self.assertIn('avatar', serializer.errors)

    def test_accepts_valid_jpeg(self):
        """validate_avatar passes for valid JPEG."""
        from io import BytesIO

        from PIL import Image
        buf = BytesIO()
        Image.new('RGB', (10, 10), color='red').save(buf, format='JPEG')
        buf.seek(0)
        valid = SimpleUploadedFile('ok.jpg', buf.read(), content_type='image/jpeg')
        serializer = AvatarUploadSerializer(data={'avatar': valid})
        self.assertTrue(serializer.is_valid())


@pytest.mark.django_db
class TestMoodEntrySerializerValidation(TestCase):
    """Cover mood score out-of-range validation."""

    def test_rejects_score_below_1(self):
        """validate_score rejects score < 1."""
        serializer = MoodEntrySerializer(data={'score': 0, 'notes': ''})
        self.assertFalse(serializer.is_valid())
        self.assertIn('score', serializer.errors)

    def test_rejects_score_above_10(self):
        """validate_score rejects score > 10."""
        serializer = MoodEntrySerializer(data={'score': 11, 'notes': ''})
        self.assertFalse(serializer.is_valid())
        self.assertIn('score', serializer.errors)

    def test_accepts_valid_score(self):
        """validate_score accepts score in range 1-10."""
        serializer = MoodEntrySerializer(data={'score': 5, 'notes': 'Good'})
        self.assertTrue(serializer.is_valid())
