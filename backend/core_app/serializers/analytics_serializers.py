from rest_framework import serializers

from core_app.models import AnalyticsEvent


class AnalyticsEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsEvent
        fields = (
            'id',
            'event_type',
            'user',
            'session_id',
            'path',
            'referrer',
            'metadata',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
