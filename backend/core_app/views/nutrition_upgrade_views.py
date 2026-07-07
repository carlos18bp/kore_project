from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription
from core_app.models.nutrition_upgrade import NutritionUpgrade
from core_app.serializers.nutrition_upgrade_serializers import NutritionUpgradeStatusSerializer
from core_app.services.nutrition_access import has_nutrition_access, active_nutrition_price
from core_app.services.wompi_service import generate_reference, build_wompi_checkout_url


class NutritionAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'has_nutrition_access': has_nutrition_access(request.user),
            'price_cop': active_nutrition_price(),
        })


class NutritionUpgradeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub = Subscription.objects.filter(customer=request.user, status=Subscription.Status.ACTIVE).select_related('package').first()
        if sub is None:
            return Response({'detail': 'Necesitas un plan activo para agregar nutrición.'}, status=status.HTTP_400_BAD_REQUEST)
        if sub.includes_nutrition:
            return Response({'detail': 'Tu plan ya incluye nutrición.'}, status=status.HTTP_400_BAD_REQUEST)
        price = active_nutrition_price()
        if price is None:
            return Response({'detail': 'Nutrición no disponible por ahora.'}, status=status.HTTP_400_BAD_REQUEST)
        cycle = sub.package.validity_days or 30
        today = timezone.localdate()
        if sub.next_billing_date:
            days_remaining = (sub.next_billing_date - today).days
        else:
            days_remaining = (sub.expires_at.date() - today).days
        days_remaining = max(1, min(days_remaining, cycle))
        amount_cop = round(price * days_remaining / cycle)
        reference = f'NU-{generate_reference()}'
        NutritionUpgrade.objects.create(customer=request.user, subscription=sub, amount_cop=amount_cop, reference=reference)
        checkout_url = build_wompi_checkout_url(reference, amount_cop * 100, f'/my-nutrition?ref={reference}')
        return Response({'reference': reference, 'checkout_url': checkout_url, 'amount_cop': amount_cop}, status=status.HTTP_201_CREATED)


class NutritionUpgradeStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        upgrade = NutritionUpgrade.objects.filter(reference=reference, customer=request.user).first()
        if upgrade is None:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(NutritionUpgradeStatusSerializer(upgrade).data)
