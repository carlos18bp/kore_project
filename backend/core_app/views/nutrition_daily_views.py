from datetime import date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import MealEntry, NutritionDailyLog
from core_app.serializers.nutrition_daily_serializers import (
    MealEntryUpdateSerializer,
    MealPhotoSerializer,
    NutritionDailyLogSerializer,
)
from core_app.services.meal_suggestion_service import get_daily_suggestions

MEAL_BLOCKS = [
    MealEntry.MealBlock.BREAKFAST,
    MealEntry.MealBlock.MID_MORNING,
    MealEntry.MealBlock.LUNCH,
    MealEntry.MealBlock.SNACK,
    MealEntry.MealBlock.DINNER,
]


class TodayNutritionView(APIView):
    """GET — today's NutritionDailyLog with 5 MealEntries (creates if needed)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()

        log, log_created = NutritionDailyLog.objects.get_or_create(
            customer=request.user,
            date=today,
        )

        if log_created:
            suggestions = get_daily_suggestions(request.user, today)
            MealEntry.objects.bulk_create([
                MealEntry(
                    daily_log=log,
                    meal_block=block,
                    suggestion=suggestions.get(block),
                )
                for block in MEAL_BLOCKS
            ])
            log.refresh_from_db()

        serializer = NutritionDailyLogSerializer(log, context={'request': request})
        return Response(serializer.data)


class UpdateMealEntryView(APIView):
    """PATCH — update status and/or notes for a single MealEntry."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, log_id, meal_id):
        try:
            entry = MealEntry.objects.select_related('daily_log').get(
                pk=meal_id,
                daily_log__pk=log_id,
                daily_log__customer=request.user,
            )
        except MealEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if entry.daily_log.is_closed:
            return Response({'detail': 'El registro del día ya está cerrado.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MealEntryUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if 'status' in data:
            entry.status = data['status']
        if 'notes' in data:
            entry.notes = data['notes']
        entry.save(update_fields=[f for f in ('status', 'notes') if f in data])

        from core_app.serializers.nutrition_daily_serializers import MealEntrySerializer
        return Response(MealEntrySerializer(entry, context={'request': request}).data)


class MealEntryPhotoView(APIView):
    """POST — upload or replace a photo for a MealEntry."""

    permission_classes = [IsAuthenticated]

    def post(self, request, log_id, meal_id):
        try:
            entry = MealEntry.objects.select_related('daily_log').get(
                pk=meal_id,
                daily_log__pk=log_id,
                daily_log__customer=request.user,
            )
        except MealEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if entry.daily_log.is_closed:
            return Response({'detail': 'El registro del día ya está cerrado.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MealPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if entry.photo:
            entry.photo.delete(save=False)

        entry.photo = serializer.validated_data['photo']
        entry.save(update_fields=['photo'])

        from core_app.serializers.nutrition_daily_serializers import MealEntrySerializer
        return Response(MealEntrySerializer(entry, context={'request': request}).data)


class NutritionHistoryView(APIView):
    """GET — last 30 days of NutritionDailyLog for the authenticated customer."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        cutoff = date.today() - timedelta(days=30)
        logs = (
            NutritionDailyLog.objects
            .filter(customer=request.user, date__gte=cutoff)
            .prefetch_related('meal_entries__suggestion')
            .order_by('-date')
        )
        serializer = NutritionDailyLogSerializer(logs, many=True, context={'request': request})
        return Response(serializer.data)
