from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import TrainerMessage
from core_app.models.credit import CreditTransaction
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.serializers.store_serializers import (
    StoreItemSerializer, RedemptionRequestSerializer, MAX_IMAGE_BYTES,
)
from core_app.services import credit_engine


class StoreItemViewSet(viewsets.ModelViewSet):
    """Trainer/admin CRUD of the (global) catalog."""
    serializer_class = StoreItemSerializer
    permission_classes = [IsTrainerRole]

    def get_queryset(self):
        return StoreItem.objects.all()


class StoreCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = StoreItem.objects.filter(is_active=True)
        wallet = credit_engine.get_wallet(request.user)
        pending = (
            CreditTransaction.objects.filter(customer=request.user, status=CreditTransaction.Status.PENDING)
            .aggregate(total=Sum('amount'))['total'] or 0
        )
        return Response({
            'items': StoreItemSerializer(items, many=True, context={'request': request}).data,
            'balance': wallet.balance,
            'pending_balance': pending,
        })


class RedemptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RedemptionRequest.objects.filter(customer=request.user).select_related('item')
        return Response(RedemptionRequestSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        item_id = request.data.get('item_id')
        item = StoreItem.objects.filter(pk=item_id, is_active=True).first()
        if item is None:
            return Response({'detail': 'Ítem no disponible.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            req = RedemptionRequest.objects.create(
                customer=request.user, item=item, credits_spent=item.price_credits,
            )
            tx = credit_engine.spend(
                request.user, item.price_credits, 'redemption_request', req.pk,
                f'Canje: {item.name}',
            )
            if tx is None:
                transaction.set_rollback(True)
                return Response({'detail': 'No tienes créditos suficientes para este canje.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(RedemptionRequestSerializer(req, context={'request': request}).data, status=status.HTTP_201_CREATED)


def _notify(customer, trainer_profile, message, ref_id):
    TrainerMessage.objects.create(
        customer=customer, trainer=trainer_profile, trigger_type='manual',
        trigger_ref_id=ref_id, message=message,
    )


class TrainerRedemptionView(APIView):
    permission_classes = [IsTrainerRole]

    def get(self, request):
        qs = RedemptionRequest.objects.filter(status=RedemptionRequest.Status.PENDING).select_related('item', 'customer')
        if not is_admin_user(request.user):
            tp = getattr(request.user, 'trainer_profile', None)
            qs = qs.filter(customer__assigned_trainer=tp)
        results = []
        for r in qs:
            row = RedemptionRequestSerializer(r, context={'request': request}).data
            row['customer_email'] = r.customer.email
            row['customer_name'] = f'{r.customer.first_name} {r.customer.last_name}'.strip()
            results.append(row)
        return Response({'count': len(results), 'results': results})


class TrainerRedemptionReviewView(APIView):
    permission_classes = [IsTrainerRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        qs = RedemptionRequest.objects.filter(pk=pk).select_related('item', 'customer')
        if not is_admin_user(request.user):
            tp = getattr(request.user, 'trainer_profile', None)
            qs = qs.filter(customer__assigned_trainer=tp)
        req = qs.first()
        if req is None:
            return Response({'detail': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if req.status != RedemptionRequest.Status.PENDING:
            return Response({'detail': 'La solicitud ya fue resuelta.'}, status=status.HTTP_400_BAD_REQUEST)
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        decision = request.data.get('decision')
        if decision == 'fulfill':
            requires_photo = req.item.item_type in (StoreItem.ItemType.PRODUCTO, StoreItem.ItemType.SERVICIO)
            # Only accept a photo for producto/servicio; ignore any upload otherwise.
            photo = request.FILES.get('delivery_photo') if requires_photo else None
            if requires_photo:
                if photo is None:
                    return Response({'detail': 'La foto de entrega es obligatoria.'}, status=status.HTTP_400_BAD_REQUEST)
                if photo.size > MAX_IMAGE_BYTES:
                    return Response({'detail': 'La foto no puede superar 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    drf_serializers.ImageField().run_validation(photo)
                except Exception:
                    return Response({'detail': 'El archivo debe ser una imagen válida.'}, status=status.HTTP_400_BAD_REQUEST)
                photo.seek(0)
            req.status = RedemptionRequest.Status.FULFILLED
            req.trainer_note = request.data.get('note', '')
            req.resolved_by = request.user
            req.resolved_at = timezone.now()
            if photo is not None:
                req.delivery_photo = photo
                req.save(update_fields=['status', 'trainer_note', 'resolved_by', 'resolved_at', 'delivery_photo', 'updated_at'])
            else:
                req.save(update_fields=['status', 'trainer_note', 'resolved_by', 'resolved_at', 'updated_at'])
            _notify(req.customer, trainer_profile, f'Tu canje "{req.item.name}" fue entregado. ¡Disfrútalo!', req.pk)
        elif decision == 'reject':
            credit_engine.refund_redemption(req, request.user, request.data.get('note', ''))
            _notify(req.customer, trainer_profile, f'Tu canje "{req.item.name}" no pudo entregarse; te devolvimos {req.credits_spent} créditos.', req.pk)
        else:
            return Response({'detail': 'decision debe ser fulfill o reject.'}, status=status.HTTP_400_BAD_REQUEST)
        req.refresh_from_db()
        return Response(RedemptionRequestSerializer(req, context={'request': request}).data)
