from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core_app.models import Payment
from core_app.permissions import IsAdminRole
from core_app.serializers.payment_serializers import PaymentSerializer


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Payment.objects.select_related('booking', 'customer', 'booking__package')
        user = self.request.user
        if user and user.is_authenticated and (user.is_staff or user.is_superuser or getattr(user, 'role', None) == 'admin'):
            return qs
        return qs.filter(customer=user)
