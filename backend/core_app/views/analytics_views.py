from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from core_app.models import AnalyticsEvent
from core_app.permissions import IsAdminRole
from core_app.serializers.analytics_serializers import AnalyticsEventSerializer


class AnalyticsEventViewSet(viewsets.ModelViewSet):
    serializer_class = AnalyticsEventSerializer

    def get_permissions(self):
        if self.action in ('create',):
            return [AllowAny()]
        return [IsAdminRole()]

    def get_queryset(self):
        return AnalyticsEvent.objects.all()
