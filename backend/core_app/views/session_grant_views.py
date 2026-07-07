from django.db.models import F
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from core_app.models.session_grant import SessionGrant
from core_app.serializers.session_grant_serializers import SessionGrantSerializer


class SessionGrantListView(ListAPIView):
    serializer_class = SessionGrantSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return SessionGrant.objects.filter(
            customer=self.request.user,
            expires_at__gt=timezone.now(),
            sessions_used__lt=F('sessions_total'),
        )
