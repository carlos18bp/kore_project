"""Vistas del entrenador para NutritionWeekNote (notas semanales de nutrición)."""
from datetime import date

from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import NutritionWeekNote, User
from core_app.permissions import IsTrainerRole


def _serialize_note(n):
    return {
        'id': n.id,
        'cycle_number': n.cycle_number,
        'cycle_start': n.cycle_start.isoformat(),
        'week_number': n.week_number,
        'notes': n.notes,
        'updated_at': n.updated_at.isoformat(),
    }


class CustomerNutritionWeekNoteListView(APIView):
    """GET /api/nutrition-week-notes/customer/<customer_id>/ — todas las notas del cliente."""

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        notes = NutritionWeekNote.objects.filter(customer_id=customer_id)
        return Response([_serialize_note(n) for n in notes])


class UpdateNutritionWeekNoteView(APIView):
    """PATCH /api/nutrition-week-notes/customer/<customer_id>/<cycle>/<week>/ — upsert."""

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def patch(self, request, customer_id, cycle_number, week_number):
        if week_number < 1 or week_number > 4:
            return Response(
                {'detail': 'week_number must be between 1 and 4.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cycle_number < 1:
            return Response(
                {'detail': 'cycle_number must be >= 1.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not User.objects.filter(pk=customer_id, role='customer').exists():
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        current_max = (
            NutritionWeekNote.objects.filter(customer_id=customer_id)
            .aggregate(m=Max('cycle_number'))['m'] or 0
        )
        if cycle_number > current_max + 1:
            return Response(
                {'detail': 'cycle_number skips ahead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = NutritionWeekNote.objects.filter(
            customer_id=customer_id, cycle_number=cycle_number,
        ).first()
        if existing:
            cycle_start = existing.cycle_start
        else:
            raw = request.data.get('cycle_start')
            try:
                cycle_start = date.fromisoformat(raw) if raw else timezone.localdate()
            except (ValueError, TypeError):
                return Response(
                    {'detail': 'Invalid cycle_start format (use YYYY-MM-DD).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        note, _ = NutritionWeekNote.objects.update_or_create(
            customer_id=customer_id,
            cycle_number=cycle_number,
            week_number=week_number,
            defaults={
                'notes': request.data.get('notes', '') or '',
                'cycle_start': cycle_start,
            },
        )
        return Response(_serialize_note(note))
