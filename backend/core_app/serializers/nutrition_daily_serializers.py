import io

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image as PilImage
from rest_framework import serializers

from core_app.models import MealEntry, NutritionDailyLog, WaterGlassLog
from core_app.models.meal_suggestion import MealSuggestion


class FoodBriefSerializer(serializers.ModelSerializer):
    class Meta:
        from core_app.models.food import Food
        model = Food
        fields = ('id', 'name', 'category', 'calories_per_100g')


class MealSuggestionBriefSerializer(serializers.ModelSerializer):
    foods = FoodBriefSerializer(many=True, read_only=True)

    class Meta:
        model = MealSuggestion
        fields = ('id', 'title', 'description', 'calories_estimate', 'meal_block', 'foods')


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


class WaterGlassLogSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = WaterGlassLog
        fields = ('id', 'photo_url', 'created_at')

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url


class NutritionDailyLogSerializer(serializers.ModelSerializer):
    meal_entries = MealEntrySerializer(many=True, read_only=True)
    water_glasses = WaterGlassLogSerializer(many=True, read_only=True)
    program_goal = serializers.SerializerMethodField()
    trainer_nutrition_note = serializers.SerializerMethodField()

    class Meta:
        model = NutritionDailyLog
        fields = ('id', 'date', 'is_closed', 'closed_at', 'notes', 'meal_entries',
                  'water_glasses', 'program_goal', 'trainer_nutrition_note')

    def _active_program(self, obj):
        if not hasattr(obj, '_cached_program'):
            obj._cached_program = (
                obj.customer.monthly_programs
                .filter(status='published')
                .order_by('-start_date')
                .first()
            )
        return obj._cached_program

    def get_program_goal(self, obj):
        program = self._active_program(obj)
        return program.goal if program else None

    def get_trainer_nutrition_note(self, obj):
        program = self._active_program(obj)
        return program.trainer_notes or None if program else None


class MealEntryUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=MealEntry.Status.choices, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)


def _normalise_uploaded_photo(value):
    """Validate + compress an uploaded image (max 5MB, JPEG/PNG/WebP, resize to 1600px, JPEG 80%)."""
    if value.size > 5 * 1024 * 1024:
        raise serializers.ValidationError('El archivo no puede superar 5 MB.')
    allowed = ('image/jpeg', 'image/png', 'image/webp')
    if value.content_type not in allowed:
        raise serializers.ValidationError('Formato no permitido. Usa JPG, PNG o WebP.')

    # Mirrors the frontend compressImage: max 1600px longest side, JPEG 80%.
    try:
        img = PilImage.open(value)
        img = img.convert('RGB')
        w, h = img.size
        max_dim = 1600
        if w > max_dim or h > max_dim:
            ratio = min(max_dim / w, max_dim / h)
            img = img.resize((round(w * ratio), round(h * ratio)), PilImage.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80, optimize=True)
        buf.seek(0)
        base_name = value.name.rsplit('.', 1)[0] if '.' in value.name else value.name
        return InMemoryUploadedFile(
            buf, 'photo', f'{base_name}.jpg', 'image/jpeg',
            buf.getbuffer().nbytes, None,
        )
    except Exception:
        return value


class MealPhotoSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, value):
        return _normalise_uploaded_photo(value)


class WaterGlassPhotoSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, value):
        return _normalise_uploaded_photo(value)
