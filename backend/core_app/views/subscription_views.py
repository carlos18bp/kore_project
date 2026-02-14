from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core_app.models import Subscription
from core_app.permissions import IsAdminRole, is_admin_user
from core_app.serializers.subscription_serializers import SubscriptionSerializer


class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for Subscription.

    Customers see their own subscriptions (all statuses: active, expired,
    canceled).  Admin users see all subscriptions across all customers.

    Endpoints:
        GET /api/subscriptions/        — list subscriptions
        GET /api/subscriptions/{id}/   — retrieve a single subscription
    """

    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return subscriptions filtered by the current user's role.

        Admin users receive the full queryset.  Customers receive only
        their own subscriptions.

        Returns:
            QuerySet: Subscription instances with related customer and package.
        """
        qs = Subscription.objects.select_related('customer', 'package').all()
        if is_admin_user(self.request.user):
            return qs
        return qs.filter(customer=self.request.user)
