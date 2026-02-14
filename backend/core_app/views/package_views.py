from rest_framework import viewsets

from core_app.models import Package
from core_app.permissions import IsAdminOrReadOnly, is_admin_user
from core_app.serializers.package_serializers import PackageSerializer


class PackageViewSet(viewsets.ModelViewSet):
    serializer_class = PackageSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Package.objects.all()
        if is_admin_user(self.request.user):
            return qs
        return qs.filter(is_active=True)
