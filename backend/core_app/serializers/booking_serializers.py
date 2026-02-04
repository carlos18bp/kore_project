from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from core_app.models import AvailabilitySlot, Booking, Package
from core_app.serializers.availability_serializers import AvailabilitySlotSerializer
from core_app.serializers.package_serializers import PackageSerializer


class BookingSerializer(serializers.ModelSerializer):
    customer_id = serializers.IntegerField(read_only=True, source='customer.id')

    package = PackageSerializer(read_only=True)
    slot = AvailabilitySlotSerializer(read_only=True)

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.all(),
        write_only=True,
        source='package',
    )
    slot_id = serializers.PrimaryKeyRelatedField(
        queryset=AvailabilitySlot.objects.all(),
        write_only=True,
        source='slot',
    )

    class Meta:
        model = Booking
        fields = (
            'id',
            'customer_id',
            'package',
            'slot',
            'package_id',
            'slot_id',
            'status',
            'notes',
            'canceled_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('status', 'created_at', 'updated_at')

    def validate(self, attrs):
        slot = attrs.get('slot')
        if slot:
            if not slot.is_active:
                raise serializers.ValidationError({'slot_id': 'Slot is not active.'})
            if slot.is_blocked:
                raise serializers.ValidationError({'slot_id': 'Slot is blocked.'})
            if slot.ends_at <= timezone.now():
                raise serializers.ValidationError({'slot_id': 'Slot is in the past.'})
            if hasattr(slot, 'booking'):
                raise serializers.ValidationError({'slot_id': 'Slot is already booked.'})
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        customer = getattr(request, 'user', None)
        if not customer or not customer.is_authenticated:
            raise serializers.ValidationError('Authentication required.')

        slot = validated_data['slot']

        with transaction.atomic():
            slot = AvailabilitySlot.objects.select_for_update().get(pk=slot.pk)
            if not slot.is_active or slot.is_blocked or slot.ends_at <= timezone.now() or hasattr(slot, 'booking'):
                raise serializers.ValidationError({'slot_id': 'Slot is not available.'})

            slot.is_blocked = True
            slot.save(update_fields=['is_blocked'])

            booking = Booking.objects.create(customer=customer, **validated_data)

        return booking
