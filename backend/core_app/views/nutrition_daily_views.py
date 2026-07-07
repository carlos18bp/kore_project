from datetime import date

from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from core_app.permissions import HasNutritionAccess
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import MealEntry, NutritionDailyLog, WaterGlassLog
from core_app.serializers.nutrition_daily_serializers import (
    MealEntryUpdateSerializer,
    MealPhotoSerializer,
    NutritionDailyLogSerializer,
    WaterGlassPhotoSerializer,
)
from core_app.services.meal_suggestion_service import get_daily_suggestions

MEAL_BLOCKS = [
    MealEntry.MealBlock.BREAKFAST,
    MealEntry.MealBlock.MID_MORNING,
    MealEntry.MealBlock.LUNCH,
    MealEntry.MealBlock.SNACK,
    MealEntry.MealBlock.DINNER,
]


def _get_plan_suggestions_for_today(customer, today):
    """Return trainer-curated suggestions from published WeeklyNutritionPlan, or None."""
    from core_app.models import WeeklyNutritionPlan

    plan = (
        WeeklyNutritionPlan.objects.filter(
            customer=customer,
            status=WeeklyNutritionPlan.Status.PUBLISHED,
            week_start__lte=today,
            week_end__gte=today,
        )
        .prefetch_related('days__meals__suggestion')
        .first()
    )
    if not plan:
        return None

    plan_day = plan.days.filter(date=today).first()
    if not plan_day:
        return None

    return {
        meal.meal_block: meal.suggestion
        for meal in plan_day.meals.select_related('suggestion').all()
    }


class TodayNutritionView(APIView):
    """GET — today's NutritionDailyLog with 5 MealEntries (creates if needed).

    If there is a published WeeklyNutritionPlan covering today, its curated
    meal suggestions are used instead of the auto-rotation.
    """

    permission_classes = [IsAuthenticated, HasNutritionAccess]

    def get(self, request):
        today = date.today()

        log, log_created = NutritionDailyLog.objects.get_or_create(
            customer=request.user,
            date=today,
        )

        if log_created:
            plan_suggestions = _get_plan_suggestions_for_today(request.user, today)
            if plan_suggestions is not None:
                suggestions = plan_suggestions
            else:
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

    permission_classes = [IsAuthenticated, HasNutritionAccess]

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

    permission_classes = [IsAuthenticated, HasNutritionAccess]

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


class WaterGlassLogCreateView(APIView):
    """POST — register one glass of water with a selfie photo for today's log."""

    permission_classes = [IsAuthenticated, HasNutritionAccess]

    def post(self, request, log_id):
        try:
            log = NutritionDailyLog.objects.get(pk=log_id, customer=request.user)
        except NutritionDailyLog.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if log.is_closed:
            return Response(
                {'detail': 'El registro del día ya está cerrado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = WaterGlassPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        glass = WaterGlassLog.objects.create(
            daily_log=log,
            photo=serializer.validated_data['photo'],
        )

        from core_app.serializers.nutrition_daily_serializers import WaterGlassLogSerializer
        return Response(
            WaterGlassLogSerializer(glass, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class NutritionHistoryView(APIView):
    """GET — last 30 days of NutritionDailyLog for the authenticated customer."""

    permission_classes = [IsAuthenticated, HasNutritionAccess]

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
