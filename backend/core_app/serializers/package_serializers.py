from rest_framework import serializers

from core_app.models import Package


class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = (
            'id',
            'title',
            'short_description',
            'description',
            'sessions_count',
            'session_duration_minutes',
            'price',
            'currency',
            'validity_days',
            'terms_and_conditions',
            'is_active',
            'order',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
