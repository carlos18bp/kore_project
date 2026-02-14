import pytest
from datetime import timedelta
from django.db import IntegrityError
from django.utils import timezone

from core_app.models import AvailabilitySlot


@pytest.mark.django_db
class TestAvailabilitySlotModel:
    def test_defaults(self):
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1))
        assert slot.is_active is True
        assert slot.is_blocked is False
        assert slot.blocked_reason == ''

    def test_str_format(self):
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1))
        assert now.isoformat() in str(slot)

    def test_is_past_property_true_for_ended_slot(self):
        past = timezone.now() - timedelta(hours=2)
        slot = AvailabilitySlot.objects.create(starts_at=past, ends_at=past + timedelta(hours=1))
        assert slot.is_past is True

    def test_is_past_property_false_for_future_slot(self):
        future = timezone.now() + timedelta(hours=1)
        slot = AvailabilitySlot.objects.create(starts_at=future, ends_at=future + timedelta(hours=1))
        assert slot.is_past is False

    def test_check_constraint_ends_after_starts(self):
        now = timezone.now()
        with pytest.raises(IntegrityError):
            AvailabilitySlot.objects.create(starts_at=now, ends_at=now - timedelta(hours=1))

    def test_unique_constraint_same_window(self):
        now = timezone.now()
        end = now + timedelta(hours=1)
        AvailabilitySlot.objects.create(starts_at=now, ends_at=end)
        with pytest.raises(IntegrityError):
            AvailabilitySlot.objects.create(starts_at=now, ends_at=end)

    def test_ordering_by_starts_at(self):
        now = timezone.now()
        s2 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3))
        s1 = AvailabilitySlot.objects.create(starts_at=now, ends_at=now + timedelta(hours=1))
        ids = list(AvailabilitySlot.objects.values_list('id', flat=True))
        assert ids == [s1.id, s2.id]
