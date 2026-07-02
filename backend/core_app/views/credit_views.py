"""Credit economy API: customer wallet/history + trainer review/settings."""
from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import MealEntry
from core_app.models.credit import CreditTransaction
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.serializers.credit_serializers import (
    CreditSettingsSerializer,
    CreditTransactionSerializer,
)
from core_app.services import credit_engine
from core_app.services.credit_engine import DIFFICULTY_PRESETS


class CreditWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = credit_engine.get_wallet(request.user)
        settings_obj = credit_engine.get_settings()
        pending = (
            CreditTransaction.objects.filter(
                customer=request.user,
                status=CreditTransaction.Status.PENDING,
            ).aggregate(total=Sum('amount'))['total'] or 0
        )
        next_milestone = None
        milestones = sorted(int(d) for d in settings_obj.streak_bonuses.keys())
        for days in milestones:
            if days > wallet.current_streak:
                next_milestone = {
                    'days': days,
                    'bonus': int(settings_obj.streak_bonuses[str(days)]),
                    'remaining': days - wallet.current_streak,
                }
                break
        return Response({
            'balance': wallet.balance,
            'pending_balance': pending,
            'current_streak': wallet.current_streak,
            'longest_streak': wallet.longest_streak,
            'last_active_date': wallet.last_active_date,
            'next_milestone': next_milestone,
        })


class CreditTransactionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = CreditTransaction.objects.filter(customer=request.user)
        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
            offset = int(request.query_params.get('offset', 0))
        except ValueError:
            return Response({'detail': 'limit/offset inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        page = qs[offset:offset + limit]
        return Response({
            'count': qs.count(),
            'results': CreditTransactionSerializer(page, many=True).data,
        })


def _scope_to_trainer_clients(qs, request):
    if is_admin_user(request.user):
        return qs
    trainer_profile = getattr(request.user, 'trainer_profile', None)
    return qs.filter(customer__assigned_trainer=trainer_profile)


class TrainerPendingReviewsView(APIView):
    permission_classes = [IsTrainerRole]

    def get(self, request):
        qs = list(_scope_to_trainer_clients(
            CreditTransaction.objects.filter(
                status=CreditTransaction.Status.PENDING,
            ).select_related('customer'),
            request,
        ))
        meal_ids = [
            int(t.reference_id) for t in qs
            if t.reference_type == 'meal_entry' and t.reference_id
        ]
        photos = {
            str(m.pk): (m.photo.url if m.photo else None)
            for m in MealEntry.objects.filter(pk__in=meal_ids)
        }
        results = []
        for tx in qs:
            row = CreditTransactionSerializer(tx).data
            row['customer_email'] = tx.customer.email
            row['customer_name'] = f'{tx.customer.first_name} {tx.customer.last_name}'.strip()
            row['photo_url'] = photos.get(tx.reference_id)
            results.append(row)
        return Response({'count': len(results), 'results': results})


class TrainerReviewTransactionView(APIView):
    permission_classes = [IsTrainerRole]

    def post(self, request, tx_id):
        qs = _scope_to_trainer_clients(
            CreditTransaction.objects.filter(pk=tx_id), request,
        )
        tx = qs.first()
        if tx is None:
            return Response({'detail': 'Transacción no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        decision = request.data.get('decision')
        if decision == 'approve':
            ok = credit_engine.confirm_transaction(tx)
        elif decision == 'reject':
            ok = credit_engine.reject_transaction(tx, request.user, request.data.get('note', ''))
        else:
            return Response(
                {'detail': 'decision debe ser approve o reject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ok:
            return Response(
                {'detail': 'La transacción ya fue revisada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tx.refresh_from_db()
        return Response(CreditTransactionSerializer(tx).data)


class CreditSettingsView(APIView):
    permission_classes = [IsTrainerRole]

    def get(self, request):
        return Response(CreditSettingsSerializer(credit_engine.get_settings()).data)

    def put(self, request):
        settings_obj = credit_engine.get_settings()
        serializer = CreditSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        # Difficulty change with cleared maps reseeds from the preset
        if not obj.action_values or not obj.streak_bonuses:
            preset = DIFFICULTY_PRESETS[obj.difficulty]
            if not obj.action_values:
                obj.action_values = dict(preset['actions'])
            if not obj.streak_bonuses:
                obj.streak_bonuses = dict(preset['streak_bonuses'])
            obj.save(update_fields=['action_values', 'streak_bonuses', 'updated_at'])
        return Response(CreditSettingsSerializer(obj).data)
