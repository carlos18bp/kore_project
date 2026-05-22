"""Tests for nutrition_daily_serializers.py.

Targets uncovered branches:
  - MealPhotoSerializer.validate_photo(): size, content_type, PIL resize, PIL error, valid JPEG/PNG
  - MealEntrySerializer.get_photo_url(): no photo, with request context
  - NutritionDailyLogSerializer.get_program_goal(): with/without published program
  - NutritionDailyLogSerializer.get_trainer_nutrition_note(): con/sin nota semanal de nutrición
"""
import io
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image
from rest_framework.exceptions import ValidationError

from core_app.models import User
from core_app.models.monthly_program import MonthlyProgram
from core_app.models.nutrition_daily_log import MealEntry, NutritionDailyLog
from core_app.models.nutrition_week_note import NutritionWeekNote
from core_app.serializers.nutrition_daily_serializers import (
    MealEntrySerializer,
    MealPhotoSerializer,
    NutritionDailyLogSerializer,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_image_file(width=100, height=100, content_type='image/jpeg', size_override=None):
    """Create a real in-memory image file suitable for Django upload handling."""
    img = Image.new('RGB', (width, height), color='red')
    buf = io.BytesIO()
    fmt = 'PNG' if 'png' in content_type else 'JPEG'
    img.save(buf, format=fmt)
    buf.seek(0)
    size = size_override if size_override is not None else buf.getbuffer().nbytes
    return InMemoryUploadedFile(
        buf, 'photo', 'test.jpg', content_type, size, None,
    )


# ---------------------------------------------------------------------------
# MealPhotoSerializer.validate_photo()
# ---------------------------------------------------------------------------

class TestMealPhotoSerializerValidatePhoto:

    def test_file_exceeding_5mb_raises_validation_error(self):
        """A file whose .size > 5 MB must be rejected."""
        big_file = _make_image_file(size_override=6 * 1024 * 1024)
        s = MealPhotoSerializer(data={'photo': big_file})
        # Trigger full_clean on the file so the serializer sees the size
        with pytest.raises(ValidationError) as exc_info:
            s.is_valid(raise_exception=True)
        assert any('5 MB' in str(e) or 'superar' in str(e) for e in exc_info.value.detail.get('photo', []))

    def test_invalid_content_type_raises_validation_error(self):
        """An upload with image/gif content_type must be rejected by validate_photo().

        DRF's ImageField runs PIL validation before our custom validate_photo() method.
        We call validate_photo() directly (after the field check) to isolate our branch,
        passing a mock file whose content_type is 'image/gif'.
        """
        from unittest.mock import MagicMock

        from core_app.serializers.nutrition_daily_serializers import (
            MealPhotoSerializer as _S,
        )

        serializer = _S()
        # Simulate a file that already passed DRF ImageField but has unsupported content_type
        mock_file = MagicMock()
        mock_file.size = 100 * 1024  # 100 KB — under 5 MB
        mock_file.content_type = 'image/gif'
        mock_file.name = 'test.gif'

        with pytest.raises(ValidationError) as exc_info:
            serializer.validate_photo(mock_file)
        assert 'Formato' in str(exc_info.value.detail) or 'JPG' in str(exc_info.value.detail)

    def test_valid_jpeg_returns_inmemory_uploaded_file(self):
        """A valid JPEG under 5 MB should pass and return an InMemoryUploadedFile."""
        jpeg_file = _make_image_file(width=100, height=100, content_type='image/jpeg')
        s = MealPhotoSerializer(data={'photo': jpeg_file})
        assert s.is_valid(), s.errors
        result = s.validated_data['photo']
        assert isinstance(result, InMemoryUploadedFile)
        assert result.content_type == 'image/jpeg'

    def test_valid_png_returns_inmemory_uploaded_file(self):
        """A valid PNG under 5 MB should pass and return an InMemoryUploadedFile (converted to JPEG internally)."""
        png_file = _make_image_file(width=80, height=80, content_type='image/png')
        s = MealPhotoSerializer(data={'photo': png_file})
        assert s.is_valid(), s.errors
        result = s.validated_data['photo']
        assert isinstance(result, InMemoryUploadedFile)

    def test_image_wider_than_1600px_is_resized(self):
        """An image with width > 1600 must be resized down."""
        wide_file = _make_image_file(width=2000, height=500, content_type='image/jpeg')
        s = MealPhotoSerializer(data={'photo': wide_file})
        assert s.is_valid(), s.errors
        result = s.validated_data['photo']
        # Verify we can open the result and its width is <= 1600
        result.seek(0)
        out_img = Image.open(result)
        assert out_img.width <= 1600

    def test_image_taller_than_1600px_is_resized(self):
        """An image with height > 1600 must be resized down."""
        tall_file = _make_image_file(width=300, height=3000, content_type='image/jpeg')
        s = MealPhotoSerializer(data={'photo': tall_file})
        assert s.is_valid(), s.errors
        result = s.validated_data['photo']
        result.seek(0)
        out_img = Image.open(result)
        assert out_img.height <= 1600

    def test_pil_exception_falls_back_to_original_value(self):
        """If PIL raises during processing, the original value is returned (no crash).

        We call validate_photo() directly (bypassing DRF ImageField validation)
        to isolate the except branch in our custom method.
        """
        from core_app.serializers.nutrition_daily_serializers import (
            MealPhotoSerializer as _S,
        )

        serializer = _S()
        jpeg_file = _make_image_file(width=100, height=100, content_type='image/jpeg')

        # Patch PilImage.open AFTER the field validation, inside validate_photo.
        # The except block returns the original value so no exception should escape.
        with patch('core_app.serializers.nutrition_daily_serializers.PilImage.open', side_effect=Exception('corrupt')):
            result = serializer.validate_photo(jpeg_file)
        # Must return the original file object (not crash)
        assert result is jpeg_file

    def test_image_within_limits_not_resized(self):
        """An image within 1600×1600 should not trigger the resize path."""
        small_file = _make_image_file(width=800, height=600, content_type='image/jpeg')
        s = MealPhotoSerializer(data={'photo': small_file})
        assert s.is_valid(), s.errors
        result = s.validated_data['photo']
        result.seek(0)
        out_img = Image.open(result)
        # Dimensions should remain unchanged (PIL save/reload may round-trip identically)
        assert out_img.width == 800
        assert out_img.height == 600


# ---------------------------------------------------------------------------
# MealEntrySerializer.get_photo_url()
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestMealEntrySerializerPhotoUrl:

    @pytest.fixture
    def customer(self):
        return User.objects.create_user(
            email='nu-photo@test.com', password='pass',
            role=User.Role.CUSTOMER,
        )

    @pytest.fixture
    def log(self, customer):
        return NutritionDailyLog.objects.create(customer=customer, date=date.today())

    def test_no_photo_returns_none(self, log):
        entry = MealEntry.objects.create(daily_log=log, meal_block='desayuno')
        s = MealEntrySerializer(entry, context={})
        assert s.data['photo_url'] is None

    def test_with_request_context_returns_absolute_url(self, log):
        entry = MealEntry.objects.create(daily_log=log, meal_block='almuerzo')
        # Simulate a photo file by setting a mock
        mock_photo = MagicMock()
        mock_photo.url = '/media/nutrition/2026/05/test.jpg'
        mock_photo.__bool__ = lambda self: True  # truthy

        mock_request = MagicMock()
        mock_request.build_absolute_uri.return_value = 'https://example.com/media/nutrition/2026/05/test.jpg'

        with patch.object(type(entry), 'photo', new_callable=lambda: property(lambda self: mock_photo)):
            s = MealEntrySerializer(entry, context={'request': mock_request})
            url = s.data['photo_url']

        assert url == 'https://example.com/media/nutrition/2026/05/test.jpg'
        mock_request.build_absolute_uri.assert_called_once_with('/media/nutrition/2026/05/test.jpg')

    def test_without_request_context_returns_relative_url(self, log):
        entry = MealEntry.objects.create(daily_log=log, meal_block='cena')
        mock_photo = MagicMock()
        mock_photo.url = '/media/nutrition/test.jpg'
        mock_photo.__bool__ = lambda self: True

        with patch.object(type(entry), 'photo', new_callable=lambda: property(lambda self: mock_photo)):
            s = MealEntrySerializer(entry, context={})
            url = s.data['photo_url']

        assert url == '/media/nutrition/test.jpg'


# ---------------------------------------------------------------------------
# NutritionDailyLogSerializer — get_program_goal / get_trainer_nutrition_note
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNutritionDailyLogSerializerMethods:

    @pytest.fixture
    def customer(self):
        return User.objects.create_user(
            email='nu-serial@test.com', password='pass',
            role=User.Role.CUSTOMER,
        )

    @pytest.fixture
    def log(self, customer):
        return NutritionDailyLog.objects.create(customer=customer, date=date.today())

    def test_get_program_goal_no_active_program_returns_none(self, log):
        s = NutritionDailyLogSerializer(log)
        assert s.data['program_goal'] is None

    def test_get_program_goal_with_active_program_returns_goal(self, log, customer):
        today = date.today()
        MonthlyProgram.objects.create(
            customer=customer, fitness_level=2, goal='weight_loss',
            start_date=today, end_date=today + timedelta(days=27),
            status=MonthlyProgram.Status.PUBLISHED,
        )
        s = NutritionDailyLogSerializer(log)
        assert s.data['program_goal'] == 'weight_loss'

    def test_get_trainer_nutrition_note_no_cycle_returns_none(self, log):
        s = NutritionDailyLogSerializer(log)
        assert s.data['trainer_nutrition_note'] is None

    def test_get_trainer_nutrition_note_returns_current_week_note(self, log, customer):
        today = date.today()
        NutritionWeekNote.objects.create(
            customer=customer, cycle_number=1, cycle_start=today,
            week_number=1, notes='Come más proteína.',
        )
        s = NutritionDailyLogSerializer(log)
        assert s.data['trainer_nutrition_note'] == 'Come más proteína.'

    def test_get_trainer_nutrition_note_with_empty_notes_returns_none(self, log, customer):
        today = date.today()
        NutritionWeekNote.objects.create(
            customer=customer, cycle_number=1, cycle_start=today,
            week_number=1, notes='',  # vacío → None
        )
        s = NutritionDailyLogSerializer(log)
        assert s.data['trainer_nutrition_note'] is None

    def test_trainer_nutrition_note_uses_current_nutrition_week(self, log, customer):
        """get_trainer_nutrition_note devuelve la nota de la semana de nutrición vigente."""
        today = date.today()
        cycle_start = today - timedelta(days=8)  # día 9 → semana 2
        NutritionWeekNote.objects.create(
            customer=customer, cycle_number=1, cycle_start=cycle_start,
            week_number=1, notes='Semana 1 nutrición')
        NutritionWeekNote.objects.create(
            customer=customer, cycle_number=1, cycle_start=cycle_start,
            week_number=2, notes='Semana 2 nutrición')
        s = NutritionDailyLogSerializer(log)
        assert s.data['trainer_nutrition_note'] == 'Semana 2 nutrición'

    def test_active_program_cache_is_reused(self, log, customer):
        """_active_program() caches result on obj to avoid double queries."""
        today = date.today()
        MonthlyProgram.objects.create(
            customer=customer, fitness_level=1, goal='endurance',
            start_date=today, end_date=today + timedelta(days=27),
            status=MonthlyProgram.Status.PUBLISHED,
        )
        s = NutritionDailyLogSerializer(log)
        # program_goal dispara _active_program(), que cachea el resultado en el log.
        goal = s.data['program_goal']
        assert goal == 'endurance'
        assert hasattr(log, '_cached_program')
