from urllib.parse import quote

from django.conf import settings
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.serializers.credit_purchase_serializers import (
    CreditPackageSerializer, CreditPurchaseStatusSerializer,
)
from core_app.services.wompi_service import generate_reference, generate_integrity_signature

WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/'


class CreditPackageListView(ListAPIView):
    serializer_class = CreditPackageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return CreditPackage.objects.filter(is_active=True)


class CreditPurchaseCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pkg = CreditPackage.objects.filter(pk=request.data.get('credit_package_id'), is_active=True).first()
        if pkg is None:
            return Response({'detail': 'Paquete no disponible.'}, status=status.HTTP_400_BAD_REQUEST)
        reference = f'CR-{generate_reference()}'
        amount_in_cents = pkg.price_cop * 100
        purchase = CreditPurchase.objects.create(
            customer=request.user, credit_package=pkg,
            credits=pkg.credits, amount_cop=pkg.price_cop, reference=reference,
        )
        signature = generate_integrity_signature(reference, amount_in_cents, 'COP')
        redirect_url = f'{settings.FRONTEND_BASE_URL}/comprar-creditos?ref={reference}'
        checkout_url = (
            f'{WOMPI_CHECKOUT_URL}?public-key={settings.WOMPI_PUBLIC_KEY}'
            f'&currency=COP&amount-in-cents={amount_in_cents}'
            f'&reference={reference}&signature:integrity={signature}'
            f'&redirect-url={quote(redirect_url, safe="")}'
        )
        return Response({'reference': reference, 'checkout_url': checkout_url}, status=status.HTTP_201_CREATED)


class CreditPurchaseStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        purchase = CreditPurchase.objects.filter(reference=reference, customer=request.user).first()
        if purchase is None:
            return Response({'detail': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CreditPurchaseStatusSerializer(purchase).data)
