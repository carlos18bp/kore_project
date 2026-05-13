from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import AvailabilitySlot, Booking, TrainerProfile
from core_app.permissions import IsAdminOrReadOnly, is_admin_user
from core_app.serializers.availability_serializers import AvailabilitySlotSerializer
from core_app.services.booking_rules import (
    ACTIVE_BOOKING_STATUSES,
    build_trainer_buffer_slot_conflict_q,
)
from core_app.services.slot_schedule import (
    BOOKING_HORIZON_DAYS,
    BUSINESS_TZ,
    compute_available_start_times,
)

BUSINESS_TIMEZONE = ZoneInfo('America/Bogota')


def _local_day_bounds(day):
    day_start = datetime.combine(day, time.min, tzinfo=BUSINESS_TIMEZONE)
    day_end = day_start + timedelta(days=1)
    return day_start, day_end


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

        available = compute_available_start_times(
            trainer, date_from, date_to + timedelta(days=1), now=timezone.now(),
        )
        result = {
            str(day): [dt.isoformat() for dt in starts]
            for day, starts in sorted(available.items())
        }
        return Response(result)


class AvailabilitySlotViewSet(viewsets.ModelViewSet):
    """ViewSet for availability slots (deprecated — will be removed with AvailabilitySlot model).

    Admin users can perform full CRUD.  Customers see only future,
    active, unblocked, and un-booked slots.

    Supported query parameters (customer view):
        - ``date`` (YYYY-MM-DD): filter slots for a specific day.
        - ``trainer`` (int): filter slots by trainer profile ID.
    """

    serializer_class = AvailabilitySlotSerializer
    permission_classes = [IsAdminOrReadOnly]

    @property
    def paginator(self):
        if self.request.query_params.get('date'):
            return None
        return super().paginator

    def get_queryset(self):
        qs = AvailabilitySlot.objects.select_related('trainer').all()
        is_admin = is_admin_user(self.request.user)

        if not is_admin:
            booked_slot_ids = Booking.objects.filter(
                status__in=ACTIVE_BOOKING_STATUSES,
            ).values_list('slot_id', flat=True)

            now = timezone.now()
            horizon = now + timedelta(days=BOOKING_HORIZON_DAYS)
            qs = qs.filter(
                is_active=True,
                is_blocked=False,
                ends_at__gt=now,
                starts_at__lt=horizon,
            ).exclude(id__in=booked_slot_ids)

        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                day = datetime.strptime(date_param, '%Y-%m-%d').date()
                day_start, day_end = _local_day_bounds(day)
                qs = qs.filter(starts_at__gte=day_start, starts_at__lt=day_end)
            except ValueError:
                pass

        trainer_param = self.request.query_params.get('trainer')
        if trainer_param:
            qs = qs.filter(trainer_id=trainer_param)

        if not is_admin:
            active_bookings = Booking.objects.filter(
                status__in=ACTIVE_BOOKING_STATUSES,
            ).select_related('slot')

            if trainer_param:
                active_bookings = active_bookings.filter(
                    Q(slot__trainer_id=trainer_param) | Q(trainer_id=trainer_param),
                )

            conflict_q = build_trainer_buffer_slot_conflict_q(active_bookings)
            if conflict_q.children:
                qs = qs.exclude(conflict_q)

        return qs
