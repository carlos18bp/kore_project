"""The feedback a trainer received from customers on their attended sessions."""

from django.db.models import Avg
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.session_rating import SessionRating
from core_app.permissions import IsTrainerRole

RECENT_LIMIT = 5


class TrainerRatingsSummaryView(APIView):
    """GET /api/trainer/ratings/summary/?customer_id=<id>

    Only the ratings customers left on this trainer's bookings — never the ones
    the trainer gave. Optionally scoped to a single customer for the client detail.
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if trainer_profile is None:
            return Response({'average': None, 'count': 0, 'recent': []})

        qs = SessionRating.objects.filter(
            rater_role=SessionRating.RaterRole.CUSTOMER,
            booking__trainer=trainer_profile,
        ).select_related('booking__customer')

        customer_id = request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(booking__customer_id=customer_id)

        aggregate = qs.aggregate(avg=Avg('score'))
        average = round(aggregate['avg'], 2) if aggregate['avg'] is not None else None
        recent = [
            {
                'score': r.score,
                'comment': r.comment,
                'customer_name': (
                    f'{r.booking.customer.first_name} {r.booking.customer.last_name}'.strip()
                ),
                'created_at': r.created_at,
            }
            for r in qs[:RECENT_LIMIT]
        ]
        return Response({'average': average, 'count': qs.count(), 'recent': recent})
