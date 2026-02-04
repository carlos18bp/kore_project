from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core_app.models import Booking
from core_app.permissions import IsAdminRole
from core_app.serializers.booking_serializers import BookingSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Booking.objects.select_related('customer', 'package', 'slot')
        user = self.request.user
        if user and user.is_authenticated and (user.is_staff or user.is_superuser or getattr(user, 'role', None) == 'admin'):
            return qs
        return qs.filter(customer=user)

    def perform_create(self, serializer):
        serializer.save()
