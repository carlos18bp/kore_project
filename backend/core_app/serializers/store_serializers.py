from rest_framework import serializers

from core_app.models.store import StoreItem, RedemptionRequest

MAX_IMAGE_BYTES = 5 * 1024 * 1024


class StoreItemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StoreItem
        fields = ('id', 'name', 'description', 'image', 'image_url', 'price_credits', 'item_type', 'is_active')
        extra_kwargs = {'image': {'write_only': True, 'required': False}}

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def validate_image(self, value):
        if value and value.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError('La imagen no puede superar 5MB.')
        return value


class RedemptionRequestSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_type = serializers.CharField(source='item.item_type', read_only=True)
    item_image_url = serializers.SerializerMethodField(read_only=True)
    delivery_photo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RedemptionRequest
        fields = ('id', 'item', 'item_name', 'item_type', 'item_image_url', 'credits_spent', 'status', 'trainer_note', 'delivery_photo_url', 'created_at', 'resolved_at')
        read_only_fields = ('credits_spent', 'status', 'trainer_note', 'resolved_at')

    def get_item_image_url(self, obj):
        if not obj.item.image:
            return None
        request = self.context.get('request')
        url = obj.item.image.url
        return request.build_absolute_uri(url) if request else url

    def get_delivery_photo_url(self, obj):
        if not obj.delivery_photo:
            return None
        request = self.context.get('request')
        url = obj.delivery_photo.url
        return request.build_absolute_uri(url) if request else url
