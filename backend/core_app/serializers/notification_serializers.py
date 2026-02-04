from rest_framework import serializers

from core_app.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            'id',
            'booking',
            'payment',
            'notification_type',
            'status',
            'sent_to',
            'provider_message_id',
            'payload',
            'error_message',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
