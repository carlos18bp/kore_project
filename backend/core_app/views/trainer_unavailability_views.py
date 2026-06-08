"""Trainer-side endpoints for blocking whole days from being bookable.

A blocked date is a UNIQUE(trainer, date) row that the slot-availability
algorithm uses to filter out every business-hour slot on that local Bogota
date.  Existing bookings on the blocked date are unaffected — the block only
prevents new bookings going forward.
"""

from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import TrainerUnavailability
from core_app.permissions import IsTrainerRole
from core_app.services.slot_schedule import BUSINESS_TZ


def _parse_date(raw):
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


class TrainerUnavailabilityView(APIView):
    """Manage the authenticated trainer's blocked dates.

    GET  /api/trainer/unavailability/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
        Defaults to a [today, today+60d) window.
        Response: {"dates": ["YYYY-MM-DD", ...], "details": [{"date", "reason"}, ...]}

    POST /api/trainer/unavailability/
        Body: {"date": "YYYY-MM-DD", "reason": "..."}
        Idempotent: posting an already-blocked date returns 200 with the existing record.
        Response: {"date": "YYYY-MM-DD", "reason": "..."}

    DELETE /api/trainer/unavailability/?date=YYYY-MM-DD
        Returns 204 on success, 404 if the date wasn't blocked.
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def _trainer_profile(self, request):
        return getattr(request.user, 'trainer_profile', None)

    def get(self, request):
        trainer_profile = self._trainer_profile(request)
        if trainer_profile is None:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().astimezone(BUSINESS_TZ).date()
        date_from = _parse_date(request.query_params.get('date_from')) or today
        date_to = _parse_date(request.query_params.get('date_to')) or (today + timedelta(days=60))

        if date_to < date_from:
            return Response(
                {'detail': 'date_to debe ser mayor o igual que date_from.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = TrainerUnavailability.objects.filter(
            trainer=trainer_profile,
            date__gte=date_from,
            date__lte=date_to,
        ).order_by('date')

        details = [{'date': str(u.date), 'reason': u.reason} for u in qs]
        return Response({
            'dates': [d['date'] for d in details],
            'details': details,
        })

    def post(self, request):
        trainer_profile = self._trainer_profile(request)
        if trainer_profile is None:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date = _parse_date(request.data.get('date'))
        if date is None:
            return Response(
                {'detail': 'Formato inválido para date (usa YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().astimezone(BUSINESS_TZ).date()
        if date < today:
            return Response(
                {'detail': 'No puedes bloquear fechas pasadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get('reason') or '')[:255]
        obj, created = TrainerUnavailability.objects.get_or_create(
            trainer=trainer_profile, date=date,
            defaults={'reason': reason},
        )
        if not created and reason and reason != obj.reason:
            obj.reason = reason
            obj.save(update_fields=['reason', 'updated_at'])

        return Response(
            {'date': str(obj.date), 'reason': obj.reason},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request):
        trainer_profile = self._trainer_profile(request)
        if trainer_profile is None:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date = _parse_date(request.query_params.get('date') or request.data.get('date'))
        if date is None:
            return Response(
                {'detail': 'Formato inválido para date (usa YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = TrainerUnavailability.objects.filter(
            trainer=trainer_profile, date=date,
        ).delete()
        if not deleted:
            return Response(
                {'detail': 'Esta fecha no estaba bloqueada.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
