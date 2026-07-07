# -*- coding: utf-8 -*-
"""Views for nutrition habit entries.

Client endpoints: create and read own nutrition entries (rate-limited to 1/week).
Trainer endpoints: read-only access to their clients' nutrition entries.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Booking, User
from core_app.models.nutrition_habit import NutritionHabit
from core_app.permissions import IsTrainerRole, HasNutritionAccess


NUTRITION_COOLDOWN_DAYS = 7


class NutritionHabitSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionHabit
        fields = (
            'id',
            'customer_id',
            'meals_per_day',
            'water_liters',
            'fruit_weekly',
            'vegetable_weekly',
            'protein_frequency',
            'ultraprocessed_weekly',
            'sugary_drinks_weekly',
            'eats_breakfast',
            'notes',
            'habit_score',
            'habit_category',
            'habit_color',
            'trainer_notes',
            'trainer_approved_at',
            'created_at',
        )
        read_only_fields = (
            'id',
            'customer_id',
            'habit_score',
            'habit_category',
            'habit_color',
            'trainer_notes',
            'trainer_approved_at',
            'created_at',
        )


# ── Client endpoints ──

class ClientNutritionListCreateView(APIView):
    """List and create nutrition entries for the authenticated client.

    GET  /api/my-nutrition/
    POST /api/my-nutrition/
    """

    permission_classes = [IsAuthenticated, HasNutritionAccess]

    def get(self, request):
        entries = NutritionHabit.objects.filter(
            customer=request.user,
        ).order_by('-created_at')
        return Response(NutritionHabitSerializer(entries, many=True).data)

    def post(self, request):
        latest = NutritionHabit.objects.filter(
            customer=request.user,
        ).order_by('-created_at').first()

        if latest and latest.created_at > timezone.now() - timedelta(days=NUTRITION_COOLDOWN_DAYS):
            return Response(
                {'detail': 'Puedes enviar un nuevo registro de nutrición una vez por semana.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = NutritionHabitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = NutritionHabit(
            customer=request.user,
            **serializer.validated_data,
        )
        entry.save()

        return Response(
            NutritionHabitSerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class ClientNutritionDetailView(APIView):
    """Get a specific nutrition entry belonging to the authenticated client.

    GET /api/my-nutrition/<eval_id>/
    """

    permission_classes = [IsAuthenticated, HasNutritionAccess]

    def get(self, request, eval_id):
        try:
            entry = NutritionHabit.objects.get(
                id=eval_id, customer=request.user,
            )
        except NutritionHabit.DoesNotExist:
            return Response({'detail': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(NutritionHabitSerializer(entry).data)


# ── Trainer endpoints (read-only) ──

class TrainerNutritionListView(APIView):
    """List nutrition entries for a trainer's client.

    GET /api/trainer/my-clients/<id>/nutrition/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id,
        ).exists()
        if not has_bookings:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        entries = NutritionHabit.objects.filter(
            customer_id=customer_id,
        ).order_by('-created_at')
        return Response(NutritionHabitSerializer(entries, many=True).data)


class TrainerNutritionDetailView(APIView):
    """GET / PATCH a specific nutrition entry for a trainer's client.

    GET   /api/trainer/my-clients/<id>/nutrition/<eval_id>/
    PATCH /api/trainer/my-clients/<id>/nutrition/<eval_id>/
          Body: { trainer_notes?: str, approve?: bool }
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def _get_entry(self, request, customer_id, eval_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return None, Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id,
        ).exists()
        if not has_bookings:
            return None, Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            entry = NutritionHabit.objects.get(id=eval_id, customer_id=customer_id)
        except NutritionHabit.DoesNotExist:
            return None, Response({'detail': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return entry, None

    def get(self, request, customer_id, eval_id):
        entry, err = self._get_entry(request, customer_id, eval_id)
        if err:
            return err
        return Response(NutritionHabitSerializer(entry).data)

    def patch(self, request, customer_id, eval_id):
        entry, err = self._get_entry(request, customer_id, eval_id)
        if err:
            return err
        update_fields = ['updated_at']
        trainer_notes = request.data.get('trainer_notes')
        if trainer_notes is not None:
            entry.trainer_notes = trainer_notes
            update_fields.append('trainer_notes')
        if request.data.get('approve'):
            entry.trainer_approved_at = timezone.now()
            update_fields.append('trainer_approved_at')
        entry.save(update_fields=update_fields)
        return Response(NutritionHabitSerializer(entry).data)
