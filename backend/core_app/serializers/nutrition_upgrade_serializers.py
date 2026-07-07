from rest_framework import serializers

from core_app.models.nutrition_upgrade import NutritionUpgrade


class NutritionUpgradeStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionUpgrade
        fields = ('reference', 'status')
