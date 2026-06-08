from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import TrainerProfile
from core_app.permissions import is_admin_user
from core_app.services.slot_schedule import (
    BUSINESS_TZ,
    MIN_ADVANCE_HOURS,
    compute_available_start_times,
)


class AvailabilityView(APIView):
    """Return computed free start-times grouped by local date.

    GET /api/availability/
    Query params:
        trainer   — TrainerProfile PK; defaults to request.user.assigned_trainer for customers
        date_from — YYYY-MM-DD (default: today in America/Bogota)
        date_to   — YYYY-MM-DD, inclusive (default: date_from + 6 days)

    Response: {"YYYY-MM-DD": ["ISO-UTC start-time", ...], ...}
    Only days with at least one free slot appear in the response.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Resolve trainer
        trainer_param = request.query_params.get('trainer')
        if trainer_param:
            try:
                trainer = TrainerProfile.objects.get(pk=int(trainer_param))
            except (ValueError, TrainerProfile.DoesNotExist):
                return Response(
                    {'detail': 'Entrenador no encontrado.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        elif getattr(request.user, 'role', None) == 'customer':
            trainer = getattr(request.user, 'assigned_trainer', None)
            if trainer is None:
                return Response({})
        elif getattr(request.user, 'role', None) == 'trainer':
            trainer = getattr(request.user, 'trainer_profile', None)
            if trainer is None:
                # Trainer-role user without a profile can't query their own
                # availability — surface the same hint as the generic case so
                # the caller knows to pass ?trainer=<id> explicitly.
                return Response(
                    {'detail': 'Se requiere el parámetro trainer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            return Response(
                {'detail': 'Se requiere el parámetro trainer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve date range
        today = timezone.now().astimezone(BUSINESS_TZ).date()

        date_from_param = request.query_params.get('date_from')
        if date_from_param:
            try:
                date_from = datetime.strptime(date_from_param, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'Formato inválido para date_from (usa YYYY-MM-DD).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            date_from = today

        date_to_param = request.query_params.get('date_to')
        if date_to_param:
            try:
                date_to = datetime.strptime(date_to_param, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'Formato inválido para date_to (usa YYYY-MM-DD).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            date_to = date_from + timedelta(days=6)

        if date_to < date_from:
            return Response(
                {'detail': 'date_to debe ser mayor o igual que date_from.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Trainers querying their own availability (and admins) are exempt
        # from the customer-facing 16h advance cutoff: they can manually book
        # for a client at any biz-hour slot, not just ≥16h ahead.
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        actor_is_target_trainer = (
            trainer_profile is not None and trainer_profile.pk == trainer.pk
        )
        min_advance_hours = (
            0
            if actor_is_target_trainer or is_admin_user(request.user)
            else MIN_ADVANCE_HOURS
        )

        available = compute_available_start_times(
            trainer, date_from, date_to + timedelta(days=1),
            now=timezone.now(), min_advance_hours=min_advance_hours,
        )
        result = {
            str(day): [dt.isoformat() for dt in starts]
            for day, starts in sorted(available.items())
        }
        return Response(result)
