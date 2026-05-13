"""Admin-only summary of trainer ↔ client assignment coverage."""

from django.db.models import Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription, TrainerProfile, User
from core_app.permissions import IsAdminRole


class TrainerAssignmentSummaryView(APIView):
    """GET /api/admin/trainers/assignment-summary/

    Returns coverage stats for the admin trainers view:
      - active_customers: customers (role=customer) with >=1 active subscription
      - assigned / unassigned: of those, how many have / lack an assigned trainer
      - per_trainer: [{trainer_id, first_name, last_name, client_count}]
        where client_count counts ALL assigned customers (not only active-sub ones)
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        active_customer_ids = set(
            Subscription.objects.filter(status=Subscription.Status.ACTIVE)
            .values_list('customer_id', flat=True)
        )
        active_customers = (
            User.objects.filter(id__in=active_customer_ids, role=User.Role.CUSTOMER)
        )
        active_count = active_customers.count()
        assigned_count = active_customers.filter(assigned_trainer__isnull=False).count()

        trainers = (
            TrainerProfile.objects.select_related('user')
            .annotate(client_count=Count('assigned_clients', filter=Q(assigned_clients__role=User.Role.CUSTOMER)))
            .order_by('user__first_name')
        )
        per_trainer = [
            {
                'trainer_id': tp.id,
                'first_name': tp.user.first_name,
                'last_name': tp.user.last_name,
                'client_count': tp.client_count,
            }
            for tp in trainers
        ]

        return Response({
            'active_customers': active_count,
            'assigned': assigned_count,
            'unassigned': active_count - assigned_count,
            'per_trainer': per_trainer,
        })
