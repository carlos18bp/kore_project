from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import FAQItem, SiteSettings
from core_app.permissions import IsAdminOrReadOnly, IsAdminRole
from core_app.serializers.content_serializers import FAQItemSerializer, SiteSettingsSerializer


class FAQItemViewSet(viewsets.ModelViewSet):
    serializer_class = FAQItemSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = FAQItem.objects.all()
        user = self.request.user
        if user and user.is_authenticated and (user.is_staff or user.is_superuser or getattr(user, 'role', None) == 'admin'):
            return qs
        return qs.filter(is_active=True)


class SiteSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        obj = SiteSettings.load()
        return Response(SiteSettingsSerializer(obj).data, status=status.HTTP_200_OK)

    def patch(self, request):
        if not IsAdminRole().has_permission(request, self):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        obj = SiteSettings.load()
        serializer = SiteSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
