from rest_framework import viewsets

from core_app.models import Package
from core_app.permissions import IsAdminOrReadOnly
from core_app.serializers.package_serializers import PackageSerializer


class PackageViewSet(viewsets.ModelViewSet):
    serializer_class = PackageSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Package.objects.all()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.filter(is_active=True)
        if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False) or getattr(user, 'role', None) == 'admin':
            return qs
        return qs.filter(is_active=True)
