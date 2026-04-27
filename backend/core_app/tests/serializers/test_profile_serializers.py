"""Tests for profile serializers covering avatar, kore_start_date, validation edge cases."""

from datetime import date
from unittest.mock import MagicMock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from django.utils import timezone

from core_app.models import CustomerProfile, MoodEntry, User
from core_app.serializers.profile_serializers import (
    AvatarUploadSerializer,
    ChangePasswordSerializer,
    CustomerProfileSerializer,
    MoodEntrySerializer,
    ProfileResponseSerializer,
    UpdateProfileSerializer,
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

    def test_kore_start_date_falls_back_via_user_relation_when_unsaved(self):
        """Returns user.date_joined.date() for an unsaved profile with user_id but no kore_start_date."""
        unsaved = CustomerProfile(kore_start_date=None, user_id=self.user.pk)
        serializer = CustomerProfileSerializer(unsaved, context={})
        self.assertEqual(serializer.data['kore_start_date'], str(self.user.date_joined.date()))


@pytest.mark.django_db
class TestAvatarUploadValidation(TestCase):
    """Cover avatar size and content-type validation."""

    @staticmethod
    def _make_image_bytes(width=10, height=10, fmt='JPEG'):
        from io import BytesIO
        from PIL import Image
        buf = BytesIO()
        Image.new('RGB', (width, height), color='blue').save(buf, format=fmt)
        return buf.getvalue()

    def test_rejects_file_over_5mb(self):
        """validate_avatar rejects a valid image whose size exceeds 5 MB."""
        from io import BytesIO
        from PIL import Image
        # BMP is uncompressed: 1500×1500×3 ≈ 6.75 MB — PIL can verify it, size check fires first
        buf = BytesIO()
        Image.new('RGB', (1500, 1500), color='red').save(buf, format='BMP')
        large_file = SimpleUploadedFile('big.bmp', buf.getvalue(), content_type='image/bmp')
        serializer = AvatarUploadSerializer(data={'avatar': large_file})
        self.assertFalse(serializer.is_valid())
        self.assertIn('avatar', serializer.errors)

    def test_rejects_invalid_content_type(self):
        """validate_avatar rejects a real GIF image (PIL detects 'image/gif', not in allowed set)."""
        from io import BytesIO
        from PIL import Image
        # Django's ImageField sets f.content_type = Image.MIME[image.format], so we need
        # a real GIF so PIL returns 'image/gif' which is not in the allowed set.
        buf = BytesIO()
        Image.new('P', (10, 10)).save(buf, format='GIF')
        gif_file = SimpleUploadedFile('anim.gif', buf.getvalue(), content_type='image/gif')
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


@pytest.mark.django_db
class TestProfileResponseSerializerTodayMood(TestCase):
    """Cover ProfileResponseSerializer.get_today_mood branches."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='mood_ser@test.com', password='pass1234', role='customer',
        )

    def test_returns_mood_when_entry_exists_today(self):
        """get_today_mood returns score/notes/date when a MoodEntry exists for today."""
        MoodEntry.objects.create(user=self.user, date=timezone.localdate(), score=8, notes='great')
        serializer = ProfileResponseSerializer(self.user)
        mood = serializer.data['today_mood']
        self.assertEqual(mood['score'], 8)
        self.assertEqual(mood['notes'], 'great')

    def test_returns_none_when_no_entry_today(self):
        """get_today_mood returns None when no MoodEntry exists for today."""
        serializer = ProfileResponseSerializer(self.user)
        self.assertIsNone(serializer.data['today_mood'])


@pytest.mark.django_db
class TestUpdateProfileSerializer(TestCase):
    """Cover UpdateProfileSerializer.update() user and profile field paths."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='update_prof@test.com', password='pass1234',
            first_name='Old', last_name='Name', role='customer',
        )

    def test_updates_user_fields(self):
        """update() saves first_name and last_name onto the User model."""
        serializer = UpdateProfileSerializer(data={'first_name': 'New', 'last_name': 'Updated'})
        self.assertTrue(serializer.is_valid())
        serializer.update(self.user, serializer.validated_data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'New')
        self.assertEqual(self.user.last_name, 'Updated')

    def test_updates_profile_fields(self):
        """update() persists city and address onto the CustomerProfile."""
        serializer = UpdateProfileSerializer(data={'city': 'Bogotá', 'address': 'Cra 1'})
        self.assertTrue(serializer.is_valid())
        serializer.update(self.user, serializer.validated_data)
        profile = self.user.customer_profile
        profile.refresh_from_db()
        self.assertEqual(profile.city, 'Bogotá')
        self.assertEqual(profile.address, 'Cra 1')

    def test_no_user_save_when_no_user_fields(self):
        """update() skips saving the User when only profile fields are provided."""
        original_name = self.user.first_name
        serializer = UpdateProfileSerializer(data={'city': 'Medellín'})
        self.assertTrue(serializer.is_valid())
        serializer.update(self.user, serializer.validated_data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, original_name)


@pytest.mark.django_db
class TestChangePasswordSerializer(TestCase):
    """Cover ChangePasswordSerializer validation and save paths."""

    def _make_request(self, user):
        request = RequestFactory().post('/')
        request.user = user
        return request

    def setUp(self):
        self.user = User.objects.create_user(
            email='changepw@test.com', password='OldPass1234!', role='customer',
        )

    def test_rejects_wrong_current_password(self):
        """validate_current_password raises error when existing password is wrong."""
        request = self._make_request(self.user)
        serializer = ChangePasswordSerializer(
            data={
                'current_password': 'WrongPassword!',
                'new_password': 'NewPass1234!',
                'new_password_confirm': 'NewPass1234!',
            },
            context={'request': request},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('current_password', serializer.errors)

    def test_rejects_mismatched_new_passwords(self):
        """validate raises error when new_password and new_password_confirm differ."""
        request = self._make_request(self.user)
        serializer = ChangePasswordSerializer(
            data={
                'current_password': 'OldPass1234!',
                'new_password': 'NewPass1234!',
                'new_password_confirm': 'Different1234!',
            },
            context={'request': request},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('new_password_confirm', serializer.errors)

    def test_save_updates_user_password(self):
        """save() hashes and persists the new password onto the User."""
        request = self._make_request(self.user)
        serializer = ChangePasswordSerializer(
            data={
                'current_password': 'OldPass1234!',
                'new_password': 'NewSecure5678!',
                'new_password_confirm': 'NewSecure5678!',
            },
            context={'request': request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewSecure5678!'))
