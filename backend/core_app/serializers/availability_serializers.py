from rest_framework import serializers

from core_app.models import AvailabilitySlot


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilitySlot
        fields = (
            'id',
            'starts_at',
            'ends_at',
            'is_active',
            'is_blocked',
            'blocked_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
