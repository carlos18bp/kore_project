from rest_framework import viewsets

from core_app.models import Notification
from core_app.permissions import IsAdminRole
from core_app.serializers.notification_serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAdminRole]
