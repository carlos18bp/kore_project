from rest_framework import serializers

from core_app.models import MealEntry, NutritionDailyLog
from core_app.models.meal_suggestion import MealSuggestion


class MealSuggestionBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealSuggestion
        fields = ('id', 'title', 'description', 'calories_estimate', 'meal_block')


class MealEntrySerializer(serializers.ModelSerializer):
    suggestion = MealSuggestionBriefSerializer(read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = MealEntry
        fields = ('id', 'meal_block', 'suggestion', 'status', 'notes', 'photo_url')

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url


class NutritionDailyLogSerializer(serializers.ModelSerializer):
    meal_entries = MealEntrySerializer(many=True, read_only=True)

    class Meta:
        model = NutritionDailyLog
        fields = ('id', 'date', 'is_closed', 'closed_at', 'notes', 'meal_entries')


class MealEntryUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=MealEntry.Status.choices, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)


class MealPhotoSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('El archivo no puede superar 5 MB.')
        allowed = ('image/jpeg', 'image/png', 'image/webp')
        if value.content_type not in allowed:
            raise serializers.ValidationError('Formato no permitido. Usa JPG, PNG o WebP.')
        return value
