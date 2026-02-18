from datetime import timedelta

from django.db import models as db_models, transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_app.models import AvailabilitySlot, Booking, Subscription
from core_app.permissions import IsAdminRole, is_admin_user
from core_app.serializers.booking_serializers import BookingSerializer
from core_app.services.email_service import (
    send_booking_cancellation,
    send_booking_confirmation,
    send_booking_reschedule,
)

CANCEL_RESCHEDULE_HOURS = 24


class BookingViewSet(viewsets.ModelViewSet):
    """ViewSet for managing bookings.

    Customers can list their own bookings, create new ones (subject to
    business-rule validations in the serializer), and use the ``cancel``
    and ``reschedule`` custom actions.  Admin users have full CRUD access
    across all bookings.

    Supported query parameters (list):
        - ``subscription`` (int): filter bookings by subscription ID.

    Custom actions:
        - ``POST /api/bookings/{id}/cancel/``
        - ``POST /api/bookings/{id}/reschedule/``  (body: ``{"new_slot_id": <int>}``)
        - ``GET  /api/bookings/upcoming-reminder/``
    """

    serializer_class = BookingSerializer

    def get_permissions(self):
        """Return appropriate permissions per action.

        Returns:
            list: Permission instances.
        """
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Return bookings with optional subscription filtering.

        Admin users receive the full queryset.  Customers receive only
        their own bookings.  Both can filter by ``subscription`` query param.

        Returns:
            QuerySet: Booking instances with related objects pre-loaded.
        """
        qs = Booking.objects.select_related(
            'customer', 'package', 'slot', 'trainer__user', 'subscription',
        )
        if not is_admin_user(self.request.user):
            qs = qs.filter(customer=self.request.user)

        # Filter by subscription
        subscription_param = self.request.query_params.get('subscription')
        if subscription_param:
            qs = qs.filter(subscription_id=subscription_param)

        return qs

    def perform_create(self, serializer):
        """Delegate creation to the serializer, then send confirmation email.

        Args:
            serializer: Validated BookingSerializer instance.
        """
        booking = serializer.save()
        send_booking_confirmation(booking)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """Cancel an existing booking.

        Business rules:
        - Only the booking owner (or an admin) can cancel.
        - The session must be ≥24 hours in the future.
        - On success: booking status → canceled, slot unblocked,
          subscription sessions_used decremented (if applicable).

        Request body (optional):
            ``{"canceled_reason": "string"}``

        Returns:
            Response: Updated booking data or error detail.
        """
        booking = self.get_object()

        if booking.status == Booking.Status.CANCELED:
            return Response(
                {'detail': 'La reserva ya está cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        time_until = booking.slot.starts_at - timezone.now()
        if time_until < timedelta(hours=CANCEL_RESCHEDULE_HOURS):
            return Response(
                {'detail': f'No puedes cancelar con menos de {CANCEL_RESCHEDULE_HOURS} horas de anticipación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            booking.status = Booking.Status.CANCELED
            booking.canceled_reason = request.data.get('canceled_reason', '')
            booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])

            # Unblock the slot
            slot = AvailabilitySlot.objects.select_for_update().get(pk=booking.slot_id)
            slot.is_blocked = False
            slot.save(update_fields=['is_blocked', 'updated_at'])

            # Restore subscription session
            if booking.subscription_id:
                sub = Subscription.objects.select_for_update().get(pk=booking.subscription_id)
                sub.sessions_used = db_models.F('sessions_used') - 1
                sub.save(update_fields=['sessions_used', 'updated_at'])

        booking.refresh_from_db()
        send_booking_cancellation(booking)
        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='reschedule')
    def reschedule(self, request, pk=None):
        """Reschedule a booking to a new slot.

        Cancels the current booking and creates a new one in the new slot,
        all within a single atomic transaction.

        Business rules:
        - Only the booking owner (or an admin) can reschedule.
        - The **current** session must be ≥24 hours in the future.
        - The new slot must be valid (active, unblocked, future, not booked).
        - The new slot must fall between the previous and next sessions in the same program.

        Request body:
            ``{"new_slot_id": <int>}``

        Returns:
            Response: Newly created booking data or error detail.
        """
        booking = self.get_object()

        if booking.status == Booking.Status.CANCELED:
            return Response(
                {'detail': 'No se puede reprogramar una reserva cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        time_until = booking.slot.starts_at - timezone.now()
        if time_until < timedelta(hours=CANCEL_RESCHEDULE_HOURS):
            return Response(
                {'detail': f'No puedes reprogramar con menos de {CANCEL_RESCHEDULE_HOURS} horas de anticipación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_slot_id = request.data.get('new_slot_id')
        if not new_slot_id:
            return Response(
                {'detail': 'El campo new_slot_id es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_slot = AvailabilitySlot.objects.get(pk=new_slot_id)
        except AvailabilitySlot.DoesNotExist:
            return Response(
                {'detail': 'No se encontró el nuevo horario.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            # Cancel current booking
            booking.status = Booking.Status.CANCELED
            booking.canceled_reason = 'Reprogramada por el usuario.'
            booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])

            # Unblock old slot
            old_slot = AvailabilitySlot.objects.select_for_update().get(pk=booking.slot_id)
            old_slot.is_blocked = False
            old_slot.save(update_fields=['is_blocked', 'updated_at'])

            # Lock and validate new slot
            new_slot = AvailabilitySlot.objects.select_for_update().get(pk=new_slot.pk)
            if (
                not new_slot.is_active
                or new_slot.is_blocked
                or new_slot.ends_at <= timezone.now()
                or Booking.objects.filter(slot=new_slot).exclude(status=Booking.Status.CANCELED).exists()
            ):
                return Response(
                    {'detail': 'El nuevo horario no está disponible.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Chronological order validation: must remain between previous and next sessions
            if booking.subscription:
                base_qs = Booking.objects.filter(
                    subscription=booking.subscription,
                    status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
                ).exclude(pk=booking.pk).select_related('slot')

                previous_booking = base_qs.filter(
                    slot__starts_at__lt=booking.slot.starts_at,
                ).order_by('-slot__starts_at').first()
                next_booking = base_qs.filter(
                    slot__starts_at__gt=booking.slot.starts_at,
                ).order_by('slot__starts_at').first()

                if previous_booking and new_slot.starts_at < previous_booking.slot.ends_at:
                    return Response(
                        {'detail': 'La sesión debe iniciar después del final de la sesión anterior del programa.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if next_booking and new_slot.ends_at > next_booking.slot.starts_at:
                    return Response(
                        {'detail': 'La sesión debe finalizar antes del inicio de la siguiente sesión del programa.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            new_slot.is_blocked = True
            new_slot.save(update_fields=['is_blocked', 'updated_at'])

            # Create new booking (subscription stays the same, no session count change)
            new_booking = Booking.objects.create(
                customer=booking.customer,
                package=booking.package,
                slot=new_slot,
                trainer=booking.trainer,
                subscription=booking.subscription,
                status=Booking.Status.PENDING,
            )

        send_booking_reschedule(booking, new_booking)
        serializer = self.get_serializer(new_booking)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='upcoming-reminder')
    def upcoming_reminder(self, request):
        """Return the user's next confirmed booking for dashboard reminders.

        Looks for the soonest confirmed booking whose slot starts in the
        future.  The frontend uses this to display a reminder modal when
        the user opens the dashboard.

        Returns:
            Response: Booking data if found, or ``{"detail": null}`` with 204.
        """
        next_booking = (
            Booking.objects.filter(
                customer=request.user,
                status=Booking.Status.CONFIRMED,
                slot__starts_at__gt=timezone.now(),
            )
            .select_related('customer', 'package', 'slot', 'trainer__user', 'subscription')
            .order_by('slot__starts_at')
            .first()
        )

        if not next_booking:
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = self.get_serializer(next_booking)
        return Response(serializer.data)
