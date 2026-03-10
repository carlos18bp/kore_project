from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from core_app.models import CustomerProfile, MoodEntry, WeightEntry


class CustomerProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    kore_start_date = serializers.SerializerMethodField()

    class Meta:
        model = CustomerProfile
        fields = (
            'avatar_url',
            'sex',
            'date_of_birth',
            'eps',
            'id_type',
            'id_number',
            'id_expedition_date',
            'address',
            'city',
            'primary_goal',
            'kore_start_date',
            'profile_completed',
        )
        read_only_fields = ('profile_completed', 'kore_start_date', 'avatar_url')

    def get_avatar_url(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_kore_start_date(self, obj):
        if obj.kore_start_date:
            return str(obj.kore_start_date)
        if obj.user_id:
            return str(obj.user.date_joined.date())
        return None


class ProfileResponseSerializer(serializers.Serializer):
    """Read-only serializer for the full profile GET response."""

    id = serializers.IntegerField(source='pk')
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField()
    role = serializers.CharField()
    customer_profile = CustomerProfileSerializer(read_only=True)
    today_mood = serializers.SerializerMethodField()

    def get_today_mood(self, user):
        today = timezone.localdate()
        entry = MoodEntry.objects.filter(user=user, date=today).first()
        if entry:
            return {'mood': entry.mood, 'date': str(entry.date)}
        return None


class UpdateProfileSerializer(serializers.Serializer):
    """Accepts flat fields for both User and CustomerProfile."""

    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    sex = serializers.ChoiceField(choices=CustomerProfile.Sex.choices, required=False)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    eps = serializers.CharField(max_length=255, required=False, allow_blank=True)
    id_type = serializers.ChoiceField(choices=CustomerProfile.IdType.choices, required=False, allow_blank=True)
    id_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    id_expedition_date = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    city = serializers.CharField(max_length=255, required=False, allow_blank=True)
    primary_goal = serializers.ChoiceField(choices=CustomerProfile.Goal.choices, required=False, allow_blank=True)

    def update(self, user, validated_data):
        user_fields = ('first_name', 'last_name', 'phone')
        profile_fields = (
            'sex', 'date_of_birth', 'eps', 'id_type', 'id_number',
            'id_expedition_date', 'address', 'city', 'primary_goal',
        )

        user_changed = False
        for field in user_fields:
            if field in validated_data:
                setattr(user, field, validated_data[field])
                user_changed = True
        if user_changed:
            user.save()

        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        for field in profile_fields:
            if field in validated_data:
                setattr(profile, field, validated_data[field])
        profile.save()

        return user


class AvatarUploadSerializer(serializers.Serializer):
    avatar = serializers.ImageField()

    def validate_avatar(self, value):
        max_size = 5 * 1024 * 1024  # 5 MB
        if value.size > max_size:
            raise serializers.ValidationError('El archivo no puede superar 5 MB.')
        allowed = ('image/jpeg', 'image/png', 'image/webp')
        if value.content_type not in allowed:
            raise serializers.ValidationError('Formato no permitido. Usa JPG, PNG o WebP.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual es incorrecta.')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Las contraseñas no coinciden.'})
        validate_password(attrs['new_password'], self.context['request'].user)
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class MoodEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodEntry
        fields = ('id', 'mood', 'date', 'created_at')
        read_only_fields = ('id', 'date', 'created_at')


class WeightEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightEntry
        fields = ('id', 'weight_kg', 'date', 'created_at')
        read_only_fields = ('id', 'date', 'created_at')
