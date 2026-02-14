import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import AvailabilitySlot
from core_app.serializers import AvailabilitySlotSerializer


@pytest.mark.django_db
class TestAvailabilitySlotSerializer:
    def test_serialization_fields(self):
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now, ends_at=now + timedelta(hours=1),
        )
        data = AvailabilitySlotSerializer(slot).data
        expected_fields = {
            'id', 'trainer_id', 'starts_at', 'ends_at', 'is_active', 'is_blocked',
            'blocked_reason', 'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['is_active'] is True
        assert data['is_blocked'] is False

    def test_read_only_timestamps(self):
        now = timezone.now()
        serializer = AvailabilitySlotSerializer(data={
            'starts_at': now.isoformat(),
            'ends_at': (now + timedelta(hours=1)).isoformat(),
            'created_at': '2020-01-01T00:00:00Z',
            'updated_at': '2020-01-01T00:00:00Z',
        })
        assert serializer.is_valid(), serializer.errors
        slot = serializer.save()
        assert str(slot.created_at) != '2020-01-01 00:00:00+00:00'

    def test_deserialization_creates_slot(self):
        now = timezone.now()
        serializer = AvailabilitySlotSerializer(data={
            'starts_at': (now + timedelta(hours=1)).isoformat(),
            'ends_at': (now + timedelta(hours=2)).isoformat(),
        })
        assert serializer.is_valid(), serializer.errors
        slot = serializer.save()
        assert slot.pk is not None
        assert slot.is_active is True
