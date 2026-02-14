from rest_framework import serializers

from core_app.models import TrainerProfile


class TrainerProfileSerializer(serializers.ModelSerializer):
    """Serializer for the TrainerProfile model.

    Exposes trainer-specific data along with the linked user's name and email
    for read-only consumption by authenticated customers.
    """

    user_id = serializers.IntegerField(source='user.id', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = TrainerProfile
        fields = (
            'id',
            'user_id',
            'first_name',
            'last_name',
            'email',
            'specialty',
            'bio',
            'location',
            'session_duration_minutes',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
