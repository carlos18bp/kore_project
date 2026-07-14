from rest_framework import serializers

from core_app.models.nutrition_product import NutritionProduct


class NutritionProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionProduct
        fields = ('id', 'name', 'price_cop', 'is_active')
