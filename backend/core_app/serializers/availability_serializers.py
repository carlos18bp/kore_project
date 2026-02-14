from rest_framework import serializers

from core_app.models import AvailabilitySlot


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    """Serializer for the AvailabilitySlot model.

    Exposes slot details including the linked trainer ID for filtering
    and display purposes.
    """

    trainer_id = serializers.IntegerField(source='trainer.id', read_only=True, allow_null=True)

    class Meta:
        model = AvailabilitySlot
        fields = (
            'id',
            'trainer_id',
            'starts_at',
            'ends_at',
            'is_active',
            'is_blocked',
            'blocked_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
