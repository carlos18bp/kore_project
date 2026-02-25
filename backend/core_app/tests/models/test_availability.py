"""Tests for AvailabilitySlot model behavior."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.db import IntegrityError, transaction

from core_app.models import AvailabilitySlot

FIXED_NOW = datetime(2026, 1, 15, 10, 0, tzinfo=dt_timezone.utc)


@pytest.mark.django_db
class TestAvailabilitySlotModel:
    """Validate constraints, defaults, and ordering for availability slots."""

    def test_defaults(self):
        """Apply expected default field values on slot creation."""
        slot = AvailabilitySlot.objects.create(starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1))
        assert slot.is_active is True
        assert slot.is_blocked is False
        assert slot.blocked_reason == ''

    def test_str_format(self):
        """Include the slot start timestamp in the string representation."""
        slot = AvailabilitySlot.objects.create(starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1))
        assert FIXED_NOW.isoformat() in str(slot)

    def test_is_past_property_true_for_ended_slot(self):
        """Return true for slots ending before the current time."""
        past = datetime(2000, 1, 1, 10, 0, tzinfo=dt_timezone.utc)
        slot = AvailabilitySlot.objects.create(starts_at=past, ends_at=past + timedelta(hours=1))
        assert slot.is_past is True

    def test_is_past_property_false_for_future_slot(self):
        """Return false for slots ending in the future."""
        future = datetime(2100, 1, 1, 10, 0, tzinfo=dt_timezone.utc)
        slot = AvailabilitySlot.objects.create(starts_at=future, ends_at=future + timedelta(hours=1))
        assert slot.is_past is False

    def test_check_constraint_ends_after_starts(self):
        """Reject slots whose end time is earlier than start time."""
        initial_count = AvailabilitySlot.objects.count()
        with transaction.atomic():
            with pytest.raises(IntegrityError):
                AvailabilitySlot.objects.create(starts_at=FIXED_NOW, ends_at=FIXED_NOW - timedelta(hours=1))
        assert AvailabilitySlot.objects.count() == initial_count

    def test_unique_constraint_same_window(self):
        """Enforce uniqueness for identical slot time windows."""
        end = FIXED_NOW + timedelta(hours=1)
        AvailabilitySlot.objects.create(starts_at=FIXED_NOW, ends_at=end)
        assert AvailabilitySlot.objects.count() == 1
        with transaction.atomic():
            with pytest.raises(IntegrityError):
                AvailabilitySlot.objects.create(starts_at=FIXED_NOW, ends_at=end)
        assert AvailabilitySlot.objects.count() == 1

    def test_ordering_by_starts_at(self):
        """Order querysets ascending by starts_at as defined by model metadata."""
        s2 = AvailabilitySlot.objects.create(starts_at=FIXED_NOW + timedelta(hours=2), ends_at=FIXED_NOW + timedelta(hours=3))
        s1 = AvailabilitySlot.objects.create(starts_at=FIXED_NOW, ends_at=FIXED_NOW + timedelta(hours=1))
        ids = list(AvailabilitySlot.objects.values_list('id', flat=True))
        assert ids == [s1.id, s2.id]
