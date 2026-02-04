from django.utils import timezone
from rest_framework import viewsets

from core_app.models import AvailabilitySlot
from core_app.permissions import IsAdminOrReadOnly
from core_app.serializers.availability_serializers import AvailabilitySlotSerializer


class AvailabilitySlotViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilitySlotSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = AvailabilitySlot.objects.all()
        user = self.request.user
        if user and user.is_authenticated and (user.is_staff or user.is_superuser or getattr(user, 'role', None) == 'admin'):
            return qs

        return qs.filter(is_active=True, is_blocked=False, ends_at__gt=timezone.now())
