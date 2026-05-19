from datetime import timedelta

from django.db import models as db_models, transaction
from django.utils import timezone
from rest_framework import serializers as drf_serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_app.models import Booking, Subscription, SubscriptionGuest, TrainerProfile
from core_app.permissions import IsAdminRole, IsTrainerRole, is_admin_user
from core_app.serializers.booking_serializers import BookingSerializer
from core_app.services.slot_schedule import is_start_time_available, session_window
from core_app.services.email_service import (
    send_booking_cancellation,
    send_booking_confirmation,
    send_booking_reschedule,
)

CANCEL_RESCHEDULE_HOURS = 24


def _maybe_create_guest_booking(host_booking):
    """Auto-create a parallel booking for an accepted guest on a duo plan."""
    try:
        gl = host_booking.subscription.guest_link
    except (AttributeError, Exception):
        return
    if gl.status != SubscriptionGuest.STATUS_ACCEPTED or not gl.guest_id:
        return
    guest_booking = Booking.objects.create(
        customer=gl.guest,
        package=host_booking.package,
        starts_at=host_booking.starts_at,
        ends_at=host_booking.ends_at,
        trainer=host_booking.trainer,
        subscription=None,
        status=Booking.Status.PENDING,
    )
    send_booking_confirmation(guest_booking)


def _cancel_guest_booking_for_slot(host_booking):
    """Cancel the guest's booking at the same trainer+time when the host cancels/reschedules."""
    try:
        gl = host_booking.subscription.guest_link
    except (AttributeError, Exception):
        return
    if not gl.guest_id:
        return
    guest_booking = (
        Booking.objects.filter(
            trainer=host_booking.trainer,
            starts_at=host_booking.starts_at,
            customer=gl.guest,
        )
        .exclude(status=Booking.Status.CANCELED)
        .first()
    )
    if guest_booking:
        guest_booking.status = Booking.Status.CANCELED
        guest_booking.canceled_reason = 'Sesión cancelada por el anfitrión.'
        guest_booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])
        send_booking_cancellation(guest_booking)


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
        - ``POST /api/bookings/{id}/reschedule/``  (body: ``{"new_starts_at": "<iso>"}``).
        - ``GET  /api/bookings/upcoming-reminder/``
    """

    serializer_class = BookingSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Booking.objects.select_related(
            'customer', 'package', 'trainer__user', 'subscription',
        )
        if not is_admin_user(self.request.user):
            qs = qs.filter(customer=self.request.user)

        subscription_param = self.request.query_params.get('subscription')
        if subscription_param:
            qs = qs.filter(subscription_id=subscription_param)

        return qs

    def create(self, request, *args, **kwargs):
        """Block active guests from creating bookings directly."""
        if SubscriptionGuest.objects.filter(
            guest=request.user,
            status=SubscriptionGuest.STATUS_ACCEPTED,
        ).exists():
            return Response(
                {'detail': 'Los invitados no pueden agendar sesiones directamente.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        booking = serializer.save()
        send_booking_confirmation(booking)
        _maybe_create_guest_booking(booking)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """Cancel an existing booking.

        Business rules:
        - Only the booking owner (or an admin) can cancel.
        - The session must be ≥24 hours in the future.
        - On success: booking status → canceled, subscription sessions_used decremented.

        Request body (optional):
            ``{"canceled_reason": "string"}``
        """
        booking = self.get_object()

        if booking.status == Booking.Status.CANCELED:
            return Response(
                {'detail': 'La reserva ya está cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        time_until = booking.starts_at - timezone.now()
        if time_until < timedelta(hours=CANCEL_RESCHEDULE_HOURS):
            return Response(
                {'detail': f'No puedes cancelar con menos de {CANCEL_RESCHEDULE_HOURS} horas de anticipación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            booking.status = Booking.Status.CANCELED
            booking.canceled_reason = request.data.get('canceled_reason', '')
            booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])

            if booking.subscription_id:
                sub = Subscription.objects.select_for_update().get(pk=booking.subscription_id)
                sub.sessions_used = db_models.F('sessions_used') - 1
                sub.save(update_fields=['sessions_used', 'updated_at'])

            _cancel_guest_booking_for_slot(booking)

        booking.refresh_from_db()
        send_booking_cancellation(booking)
        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='reschedule')
    def reschedule(self, request, pk=None):
        """Reschedule a booking to a new start time.

        Cancels the current booking and creates a new one at ``new_starts_at``,
        all within a single atomic transaction.

        Business rules:
        - Only the booking owner (or an admin) can reschedule.
        - The **current** session must be ≥24 hours in the future.
        - The new start time must be a valid bookable start for the trainer.

        Request body:
            ``{"new_starts_at": "<ISO 8601>"}``
        """
        booking = self.get_object()

        if booking.status == Booking.Status.CANCELED:
            return Response(
                {'detail': 'No se puede reprogramar una reserva cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        time_until = booking.starts_at - timezone.now()
        if time_until < timedelta(hours=CANCEL_RESCHEDULE_HOURS):
            return Response(
                {'detail': f'No puedes reprogramar con menos de {CANCEL_RESCHEDULE_HOURS} horas de anticipación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw = request.data.get('new_starts_at')
        if not raw:
            return Response(
                {'detail': 'El campo new_starts_at es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            new_starts_at = drf_serializers.DateTimeField().to_internal_value(raw)
        except Exception:
            return Response(
                {'detail': 'Formato de fecha inválido para new_starts_at.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            TrainerProfile.objects.select_for_update().get(pk=booking.trainer_id)
            if not is_start_time_available(booking.trainer, new_starts_at, now=timezone.now()):
                return Response(
                    {'detail': 'El nuevo horario no está disponible.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            booking.status = Booking.Status.CANCELED
            booking.canceled_reason = 'Reprogramada por el usuario.'
            booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])

            _, new_end = session_window(booking.trainer, new_starts_at)
            new_booking = Booking.objects.create(
                customer=booking.customer,
                package=booking.package,
                trainer=booking.trainer,
                subscription=booking.subscription,
                status=Booking.Status.PENDING,
                starts_at=new_starts_at,
                ends_at=new_end,
            )

            _cancel_guest_booking_for_slot(booking)
            _maybe_create_guest_booking(new_booking)

        send_booking_reschedule(booking, new_booking)
        serializer = self.get_serializer(new_booking)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='session-prep', permission_classes=[IsTrainerRole])
    def session_prep(self, request, pk=None):
        """Allow a trainer to set session objective and notes before a session."""
        # Bypass the customer-only get_queryset filter: a trainer must be able
        # to edit a booking that belongs to their client, not to themselves.
        try:
            booking = Booking.objects.select_related('trainer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Sesión no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not is_admin_user(request.user):
            if not trainer_profile or (booking.trainer_id and booking.trainer_id != trainer_profile.pk):
                return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        allowed = {'session_objective', 'session_notes_for_customer'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        if not data:
            return Response(
                {'detail': 'Proporciona session_objective o session_notes_for_customer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for field, value in data.items():
            setattr(booking, field, value)
        booking.save(update_fields=list(data.keys()))
        import logging
        logging.getLogger(__name__).warning('[session_prep] booking=%s payload=%s saved_obj=%r', pk, dict(data), booking.session_objective)
        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='upcoming-reminder')
    def upcoming_reminder(self, request):
        """Return the user's next upcoming booking for dashboard reminders."""
        next_booking = (
            Booking.objects.filter(
                customer=request.user,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
                starts_at__gt=timezone.now(),
            )
            .select_related('customer', 'package', 'trainer__user', 'subscription')
            .order_by('starts_at')
            .first()
        )

        if not next_booking:
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = self.get_serializer(next_booking)
        return Response(serializer.data)
