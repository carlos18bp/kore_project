from rest_framework import serializers

from core_app.models.session_grant import SessionGrant


class SessionGrantSerializer(serializers.ModelSerializer):
    sessions_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = SessionGrant
        fields = ('id', 'sessions_total', 'sessions_used', 'sessions_remaining', 'expires_at')
