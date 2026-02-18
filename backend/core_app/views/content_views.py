from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import ContactMessage, FAQCategory, FAQItem, SiteSettings
from core_app.permissions import IsAdminOrReadOnly, IsAdminRole, is_admin_user
from core_app.serializers.content_serializers import (
    ContactMessageSerializer,
    FAQCategorySerializer,
    FAQItemSerializer,
    SiteSettingsSerializer,
)


class FAQCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = FAQCategorySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = FAQCategory.objects.all()
        if is_admin_user(self.request.user):
            return qs
        return qs.filter(is_active=True)


class FAQItemViewSet(viewsets.ModelViewSet):
    serializer_class = FAQItemSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = FAQItem.objects.select_related('category').all()
        if is_admin_user(self.request.user):
            return qs
        return qs.filter(is_active=True)

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='public',
        url_name='public',
    )
    def public_grouped(self, request):
        categories = FAQCategory.objects.filter(is_active=True).order_by('order', 'id')
        items = FAQItem.objects.filter(is_active=True).select_related('category').order_by('order', 'id')

        grouped = []
        for cat in categories:
            cat_items = [i for i in items if i.category_id == cat.id]
            if cat_items:
                grouped.append({
                    'category': FAQCategorySerializer(cat).data,
                    'items': FAQItemSerializer(cat_items, many=True).data,
                })

        uncategorized = [i for i in items if i.category_id is None]
        if uncategorized:
            grouped.append({
                'category': None,
                'items': FAQItemSerializer(uncategorized, many=True).data,
            })

        return Response(grouped, status=status.HTTP_200_OK)


class SiteSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        obj = SiteSettings.load()
        return Response(SiteSettingsSerializer(obj).data, status=status.HTTP_200_OK)

    def patch(self, request):
        if not is_admin_user(request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        obj = SiteSettings.load()
        serializer = SiteSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class ContactMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ContactMessageSerializer
    queryset = ContactMessage.objects.all()

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAdminRole()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {'detail': 'Mensaje recibido correctamente.'},
            status=status.HTTP_201_CREATED,
        )
