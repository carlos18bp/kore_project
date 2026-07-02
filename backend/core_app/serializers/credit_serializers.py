from rest_framework import serializers

from core_app.models.credit import CreditSettings, CreditTransaction
from core_app.models.physical_test import PhysicalTest


class CreditTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditTransaction
        fields = (
            'id', 'action', 'amount', 'status', 'description',
            'reference_type', 'reference_id', 'review_deadline', 'created_at',
        )


class CreditSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditSettings
        fields = (
            'difficulty', 'action_values', 'streak_bonuses',
            'training_day_threshold', 'nutrition_min_meals', 'water_goal_glasses',
            'meal_review_days', 'reschedule_window_hours', 'require_workout_captures',
        )


class PhysicalTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhysicalTest
        fields = ('id', 'customer', 'trainer', 'performed_at', 'result', 'notes', 'created_at')
        read_only_fields = ('trainer',)
