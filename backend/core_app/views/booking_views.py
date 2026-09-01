from datetime import timedelta

from django.db import models as db_models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers as drf_serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_app.models import Booking, Subscription, SubscriptionGuest, TrainerProfile
from core_app.models.credit import CreditTransaction
from core_app.models.session_grant import SessionGrant
from core_app.models.session_rating import SessionRating
from core_app.permissions import IsAdminRole, IsTrainerRole, is_admin_user
from core_app.serializers.booking_serializers import BookingSerializer
from core_app.serializers.session_rating_serializers import SessionRatingSerializer
from core_app.services.slot_schedule import is_start_time_available, session_window
from core_app.services.email_service import (
    send_booking_cancellation,
    send_booking_confirmation,
    send_booking_reschedule,
)

def _reschedule_window_hours() -> int:
    """The single window that blocks a late cancel/reschedule AND triggers the
    credit penalty (`credit_engine.on_reschedule` reads the same field)."""
    from core_app.services import credit_engine
    return credit_engine.get_settings().reschedule_window_hours


def _is_trainer_owner(user, booking):
    """True iff ``user`` is the trainer assigned to ``booking``.

    Trainers and admins can manage a client's bookings without the
    customer-facing 16h / 24h windows; this helper centralizes the check.
    """
    trainer_profile = getattr(user, 'trainer_profile', None)
    if trainer_profile is None or booking.trainer_id is None:
        return False
    return booking.trainer_id == trainer_profile.pk


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
        user = self.request.user
        if not is_admin_user(user):
            # Customers see their own bookings; trainers also see bookings
            # of clients they're assigned to (so they can cancel/reschedule).
            trainer_profile = getattr(user, 'trainer_profile', None)
            if trainer_profile is not None:
                qs = qs.filter(Q(customer=user) | Q(trainer=trainer_profile))
            else:
                qs = qs.filter(customer=user)

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

        bypass_window = is_admin_user(request.user) or _is_trainer_owner(request.user, booking)
        if not bypass_window:
            window = _reschedule_window_hours()
            time_until = booking.starts_at - timezone.now()
            if time_until < timedelta(hours=window):
                return Response(
                    {'detail': f'No puedes cancelar con menos de {window} horas de anticipación.'},
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

            if booking.session_grant_id:
                grant = SessionGrant.objects.select_for_update().get(pk=booking.session_grant_id)
                grant.sessions_used = db_models.F('sessions_used') - 1
                grant.save(update_fields=['sessions_used', 'updated_at'])

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

        bypass_window = is_admin_user(request.user) or _is_trainer_owner(request.user, booking)
        if not bypass_window:
            window = _reschedule_window_hours()
            time_until = booking.starts_at - timezone.now()
            if time_until < timedelta(hours=window):
                return Response(
                    {'detail': f'No puedes reprogramar con menos de {window} horas de anticipación.'},
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
            new_slot_advance_hours = 0 if bypass_window else None
            check_kwargs = {'now': timezone.now()}
            if new_slot_advance_hours is not None:
                check_kwargs['min_advance_hours'] = new_slot_advance_hours
            if not is_start_time_available(booking.trainer, new_starts_at, **check_kwargs):
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
        from core_app.services import credit_engine
        credit_engine.on_reschedule(booking, new_booking, acting_user=request.user)
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

    @action(detail=True, methods=['post'], url_path='confirm-attendance', permission_classes=[IsTrainerRole])
    def confirm_attendance(self, request, pk=None):
        """Trainer marks whether the customer attended a session that already started.

        Body: ``{"attended": true|false}``. Emits credit awards/penalties via the
        credit engine (late confirmation reverses a prior no-show penalty).
        """
        try:
            booking = Booking.objects.select_related('trainer', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Sesión no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not is_admin_user(request.user):
            # Fail closed on unassigned bookings: attendance moves credits, so
            # only the booking's own trainer (or an admin) may confirm it.
            if not trainer_profile or booking.trainer_id is None or booking.trainer_id != trainer_profile.pk:
                return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status == Booking.Status.CANCELED:
            return Response(
                {'detail': 'No se puede confirmar asistencia de una sesión cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.starts_at > timezone.now():
            return Response(
                {'detail': 'La sesión aún no ha iniciado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attended = request.data.get('attended')
        if not isinstance(attended, bool):
            return Response(
                {'detail': 'El campo attended (true/false) es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from core_app.services import credit_engine
        credit_engine.record_attendance(booking, attended=attended)
        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='rate')
    def rate(self, request, pk=None):
        """Rate an attended session. The rater's role is derived from the user.

        Body: ``{"score": 1..5, "comment": "..."}``. The customer's rating awards
        `session_rated` credits once; the unique constraint on (booking, rater_role)
        is what caps it.
        """
        try:
            booking = Booking.objects.select_related('trainer', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Sesión no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.customer_id == request.user.pk:
            rater_role = SessionRating.RaterRole.CUSTOMER
        elif _is_trainer_owner(request.user, booking) or is_admin_user(request.user):
            rater_role = SessionRating.RaterRole.TRAINER
        else:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.attendance_status != Booking.AttendanceStatus.ATTENDED:
            return Response(
                {'detail': 'Solo se puede calificar una sesión a la que se asistió.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if SessionRating.objects.filter(booking=booking, rater_role=rater_role).exists():
            return Response(
                {'detail': 'Ya calificaste esta sesión.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SessionRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = serializer.save(booking=booking, rater_role=rater_role)

        if rater_role == SessionRating.RaterRole.CUSTOMER:
            from core_app.services import credit_engine
            credit_engine.award(
                booking.customer,
                CreditTransaction.Action.SESSION_RATED,
                'booking',
                booking.pk,
                'Calificaste tu sesión',
            )

        return Response(SessionRatingSerializer(rating).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='pending-rating')
    def pending_rating(self, request):
        """Attended sessions of the requesting customer that they have not rated yet."""
        rated_ids = SessionRating.objects.filter(
            rater_role=SessionRating.RaterRole.CUSTOMER,
        ).values_list('booking_id', flat=True)
        bookings = (
            Booking.objects.filter(
                customer=request.user,
                attendance_status=Booking.AttendanceStatus.ATTENDED,
            )
            .exclude(pk__in=rated_ids)
            .select_related('trainer__user')
            .order_by('-starts_at')
        )
        results = [
            {
                'id': b.pk,
                'starts_at': b.starts_at,
                'trainer_name': (
                    f'{b.trainer.user.first_name} {b.trainer.user.last_name}'.strip()
                    if b.trainer_id else ''
                ),
            }
            for b in bookings
        ]
        return Response({'count': len(results), 'results': results})

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
