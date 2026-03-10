"""Views for trainer client management.

Provides endpoints for trainers to view their assigned clients,
access individual client profiles, and review session history.
"""

from django.db.models import Count, Max, Q

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Booking, Subscription, User
from core_app.permissions import IsTrainerRole


class TrainerClientListView(APIView):
    """List all clients assigned to the authenticated trainer.

    A client is any customer who has at least one booking with this trainer.

    GET /api/trainer/my-clients/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        customer_ids = (
            Booking.objects.filter(trainer=trainer_profile)
            .values_list('customer_id', flat=True)
            .distinct()
        )

        customers = (
            User.objects.filter(id__in=customer_ids, role=User.Role.CUSTOMER)
            .select_related('customer_profile')
            .annotate(
                total_sessions=Count(
                    'bookings',
                    filter=Q(bookings__trainer=trainer_profile),
                ),
                completed_sessions=Count(
                    'bookings',
                    filter=Q(
                        bookings__trainer=trainer_profile,
                        bookings__status=Booking.Status.CONFIRMED,
                    ),
                ),
                last_session_date=Max(
                    'bookings__slot__starts_at',
                    filter=Q(
                        bookings__trainer=trainer_profile,
                        bookings__status__in=[
                            Booking.Status.CONFIRMED,
                            Booking.Status.PENDING,
                        ],
                    ),
                ),
            )
            .order_by('first_name', 'last_name')
        )

        results = []
        for c in customers:
            cp = getattr(c, 'customer_profile', None)
            active_sub = (
                Subscription.objects.filter(
                    customer=c, status=Subscription.Status.ACTIVE
                )
                .select_related('package')
                .first()
            )
            avatar_url = None
            if cp and cp.avatar and hasattr(cp.avatar, 'url'):
                avatar_url = request.build_absolute_uri(cp.avatar.url)

            results.append({
                'id': c.id,
                'first_name': c.first_name,
                'last_name': c.last_name,
                'email': c.email,
                'avatar_url': avatar_url,
                'primary_goal': cp.primary_goal if cp else '',
                'active_package': active_sub.package.title if active_sub else None,
                'sessions_remaining': active_sub.sessions_remaining if active_sub else 0,
                'total_sessions': c.total_sessions,
                'completed_sessions': c.completed_sessions,
                'last_session_date': (
                    c.last_session_date.isoformat() if c.last_session_date else None
                ),
            })

        return Response(results)


class TrainerClientDetailView(APIView):
    """Get detailed info for a specific client of the authenticated trainer.

    GET /api/trainer/my-clients/<customer_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id
        ).exists()
        if not has_bookings:
            return Response(
                {'detail': 'Cliente no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            customer = User.objects.select_related('customer_profile').get(
                id=customer_id, role=User.Role.CUSTOMER
            )
        except User.DoesNotExist:
            return Response(
                {'detail': 'Cliente no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        cp = getattr(customer, 'customer_profile', None)
        avatar_url = None
        if cp and cp.avatar and hasattr(cp.avatar, 'url'):
            avatar_url = request.build_absolute_uri(cp.avatar.url)

        active_sub = (
            Subscription.objects.filter(
                customer=customer, status=Subscription.Status.ACTIVE
            )
            .select_related('package')
            .first()
        )

        from django.utils import timezone as tz

        booking_stats = Booking.objects.filter(
            trainer=trainer_profile, customer=customer
        ).aggregate(
            total=Count('id'),
            completed=Count('id', filter=Q(status=Booking.Status.CONFIRMED)),
            canceled=Count('id', filter=Q(status=Booking.Status.CANCELED)),
            pending=Count('id', filter=Q(status=Booking.Status.PENDING)),
        )

        next_session = (
            Booking.objects.filter(
                trainer=trainer_profile,
                customer=customer,
                slot__starts_at__gte=tz.now(),
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            )
            .select_related('slot', 'package')
            .order_by('slot__starts_at')
            .first()
        )

        from core_app.models import Payment
        last_payment = (
            Payment.objects.filter(
                customer=customer,
                subscription=active_sub,
                status=Payment.Status.CONFIRMED,
            )
            .order_by('-created_at')
            .first()
            if active_sub else None
        )

        return Response({
            'id': customer.id,
            'first_name': customer.first_name,
            'last_name': customer.last_name,
            'email': customer.email,
            'phone': customer.phone,
            'avatar_url': avatar_url,
            'date_joined': customer.date_joined.isoformat(),
            'profile': {
                'sex': cp.sex if cp else '',
                'height_cm': str(cp.height_cm) if cp and cp.height_cm else None,
                'current_weight_kg': str(cp.current_weight_kg) if cp and cp.current_weight_kg else None,
                'city': cp.city if cp else '',
                'primary_goal': cp.primary_goal if cp else '',
                'kore_start_date': str(cp.kore_start_date) if cp and cp.kore_start_date else None,
            },
            'subscription': {
                'id': active_sub.id,
                'package_title': active_sub.package.title,
                'package_price': str(active_sub.package.price),
                'package_currency': active_sub.package.currency,
                'sessions_total': active_sub.sessions_total,
                'sessions_used': active_sub.sessions_used,
                'sessions_remaining': active_sub.sessions_remaining,
                'starts_at': active_sub.starts_at.isoformat(),
                'expires_at': active_sub.expires_at.isoformat(),
                'next_billing_date': str(active_sub.next_billing_date) if active_sub.next_billing_date else None,
                'is_recurring': active_sub.is_recurring,
                'status': active_sub.status,
            } if active_sub else None,
            'next_session': {
                'id': next_session.id,
                'starts_at': next_session.slot.starts_at.isoformat(),
                'ends_at': next_session.slot.ends_at.isoformat(),
                'package_title': next_session.package.title if next_session.package else '',
                'status': next_session.status,
            } if next_session else None,
            'last_payment': {
                'amount': str(last_payment.amount),
                'currency': last_payment.currency,
                'created_at': last_payment.created_at.isoformat(),
            } if last_payment else None,
            'stats': booking_stats,
        })


class TrainerClientSessionsView(APIView):
    """Get session history for a specific client of the authenticated trainer.

    GET /api/trainer/my-clients/<customer_id>/sessions/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        bookings = (
            Booking.objects.filter(
                trainer=trainer_profile, customer_id=customer_id
            )
            .select_related('package', 'slot', 'subscription')
            .order_by('-slot__starts_at')
        )

        results = []
        for b in bookings:
            results.append({
                'id': b.id,
                'status': b.status,
                'package_title': b.package.title if b.package else '',
                'starts_at': b.slot.starts_at.isoformat() if b.slot else None,
                'ends_at': b.slot.ends_at.isoformat() if b.slot else None,
                'notes': b.notes,
                'canceled_reason': b.canceled_reason,
                'created_at': b.created_at.isoformat(),
            })

        return Response(results)


class TrainerDashboardStatsView(APIView):
    """Get summary stats for the trainer dashboard.

    GET /api/trainer/dashboard-stats/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        from django.utils import timezone
        from datetime import datetime, time, timedelta
        from zoneinfo import ZoneInfo

        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        tz = ZoneInfo('America/Bogota')
        now = timezone.now()
        today = now.astimezone(tz).date()
        day_start = datetime.combine(today, time.min, tzinfo=tz)
        day_end = day_start + timedelta(days=1)

        total_clients = (
            Booking.objects.filter(trainer=trainer_profile)
            .values('customer_id')
            .distinct()
            .count()
        )

        today_sessions = Booking.objects.filter(
            trainer=trainer_profile,
            slot__starts_at__gte=day_start,
            slot__starts_at__lt=day_end,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).count()

        upcoming_sessions = (
            Booking.objects.filter(
                trainer=trainer_profile,
                slot__starts_at__gte=now,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            )
            .select_related('customer', 'slot', 'package')
            .order_by('slot__starts_at')[:5]
        )

        upcoming_list = []
        for b in upcoming_sessions:
            upcoming_list.append({
                'id': b.id,
                'customer_name': f'{b.customer.first_name} {b.customer.last_name}'.strip(),
                'customer_id': b.customer.id,
                'package_title': b.package.title if b.package else '',
                'starts_at': b.slot.starts_at.isoformat(),
                'ends_at': b.slot.ends_at.isoformat(),
                'status': b.status,
            })

        return Response({
            'total_clients': total_clients,
            'today_sessions': today_sessions,
            'upcoming_sessions': upcoming_list,
        })
