from datetime import datetime

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets

from core_app.models import AvailabilitySlot, Booking
from core_app.permissions import IsAdminOrReadOnly, is_admin_user
from core_app.serializers.availability_serializers import AvailabilitySlotSerializer
from core_app.services.booking_rules import (
    ACTIVE_BOOKING_STATUSES,
    build_trainer_buffer_slot_conflict_q,
)


class AvailabilitySlotViewSet(viewsets.ModelViewSet):
    """ViewSet for availability slots.

    Admin users can perform full CRUD.  Customers see only future,
    active, unblocked, and un-booked slots.

    Supported query parameters (customer view):
        - ``date`` (YYYY-MM-DD): filter slots for a specific day.
        - ``trainer`` (int): filter slots by trainer profile ID.

    Endpoints:
        GET    /api/availability-slots/
        POST   /api/availability-slots/          (admin only)
        GET    /api/availability-slots/{id}/
        PUT    /api/availability-slots/{id}/      (admin only)
        PATCH  /api/availability-slots/{id}/      (admin only)
        DELETE /api/availability-slots/{id}/      (admin only)
    """

    serializer_class = AvailabilitySlotSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        """Return availability slots with optional filtering.

        Admin users get the full set.  Customers get only bookable slots
        (active, unblocked, future, not already taken by a non-canceled
        booking).  Both can filter by ``date`` and ``trainer``.

        Returns:
            QuerySet: Filtered AvailabilitySlot instances.
        """
        qs = AvailabilitySlot.objects.select_related('trainer').all()
        is_admin = is_admin_user(self.request.user)

        if not is_admin:
            booked_slot_ids = Booking.objects.filter(
                status__in=ACTIVE_BOOKING_STATUSES,
            ).values_list('slot_id', flat=True)

            qs = qs.filter(
                is_active=True,
                is_blocked=False,
                ends_at__gt=timezone.now(),
            ).exclude(id__in=booked_slot_ids)

        # Filter by specific date (YYYY-MM-DD)
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                day = datetime.strptime(date_param, '%Y-%m-%d').date()
                qs = qs.filter(starts_at__date=day)
            except ValueError:
                pass  # Ignore malformed date param

        # Filter by trainer profile ID
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
