from django.utils import timezone
from rest_framework import serializers

from core_app.models import Booking, Payment
from core_app.permissions import is_admin_user


class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all(), source='booking')

    class Meta:
        model = Payment
        fields = (
            'id',
            'booking_id',
            'status',
            'amount',
            'currency',
            'provider',
            'provider_reference',
            'metadata',
            'confirmed_at',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at', 'confirmed_at')

    def validate_booking_id(self, booking):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and not is_admin_user(user):
            if booking.customer_id != user.id:
                raise serializers.ValidationError('You cannot create payments for other users bookings.')
        return booking

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        booking = validated_data['booking']

        if user and user.is_authenticated:
            validated_data['customer'] = user
        else:
            validated_data['customer'] = booking.customer

        if not validated_data.get('amount'):
            validated_data['amount'] = booking.package.price
        if not validated_data.get('currency'):
            validated_data['currency'] = booking.package.currency

        if validated_data.get('status') == Payment.Status.CONFIRMED and not validated_data.get('confirmed_at'):
            validated_data['confirmed_at'] = timezone.now()

        return super().create(validated_data)
