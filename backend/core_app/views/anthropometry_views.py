"""Views for anthropometry evaluations.

Trainer endpoints: list/create/detail evaluations for their clients.
Client endpoints: read-only access to their own evaluations.
"""

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import AnthropometryEvaluation, Booking, User
from core_app.permissions import IsTrainerRole


class AnthropometrySerializer(serializers.ModelSerializer):
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = AnthropometryEvaluation
        fields = (
            'id',
            'customer_id',
            'trainer_name',
            'evaluation_date',
            'weight_kg', 'height_cm', 'waist_cm', 'hip_cm',
            'perimeters', 'skinfolds',
            'notes', 'recommendations',
            'age_at_evaluation',
            'bmi', 'bmi_category', 'bmi_color',
            'waist_hip_ratio', 'whr_risk', 'whr_color',
            'waist_height_ratio', 'whe_risk', 'whe_color',
            'body_fat_pct', 'bf_category', 'bf_color', 'bf_method',
            'fat_mass_kg', 'lean_mass_kg',
            'waist_risk', 'waist_risk_color',
            'sum_skinfolds', 'asymmetries',
            'created_at',
        )
        read_only_fields = (
            'id', 'customer_id', 'trainer_name',
            'age_at_evaluation',
            'bmi', 'bmi_category', 'bmi_color',
            'waist_hip_ratio', 'whr_risk', 'whr_color',
            'waist_height_ratio', 'whe_risk', 'whe_color',
            'body_fat_pct', 'bf_category', 'bf_color', 'bf_method',
            'fat_mass_kg', 'lean_mass_kg',
            'waist_risk', 'waist_risk_color',
            'sum_skinfolds', 'asymmetries',
            'created_at',
        )

    def get_trainer_name(self, obj):
        if obj.trainer and obj.trainer.user:
            return f'{obj.trainer.user.first_name} {obj.trainer.user.last_name}'.strip()
        return ''


# ── Trainer endpoints ──

class TrainerAnthropometryListCreateView(APIView):
    """List and create anthropometry evaluations for a trainer's client.

    GET  /api/trainer/my-clients/<id>/anthropometry/
    POST /api/trainer/my-clients/<id>/anthropometry/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        evals = AnthropometryEvaluation.objects.filter(
            customer_id=customer_id, trainer=trainer_profile,
        ).order_by('-created_at')
        return Response(AnthropometrySerializer(evals, many=True).data)

    def post(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id,
        ).exists()
        if not has_bookings:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            customer = User.objects.get(id=customer_id, role=User.Role.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        cp = getattr(customer, 'customer_profile', None)
        if not cp or not cp.sex or not cp.date_of_birth:
            return Response(
                {'detail': 'El cliente debe completar su perfil (sexo y fecha de nacimiento) antes de realizar una evaluación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AnthropometrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        evaluation = AnthropometryEvaluation(
            customer=customer,
            trainer=trainer_profile,
            **serializer.validated_data,
        )
        evaluation.save()

        return Response(AnthropometrySerializer(evaluation).data, status=status.HTTP_201_CREATED)


class TrainerAnthropometryDetailView(APIView):
    """Get or partially update a specific anthropometry evaluation.

    GET   /api/trainer/my-clients/<id>/anthropometry/<eval_id>/
    PATCH /api/trainer/my-clients/<id>/anthropometry/<eval_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def _get_evaluation(self, request, customer_id, eval_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return None, Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            evaluation = AnthropometryEvaluation.objects.get(
                id=eval_id, customer_id=customer_id, trainer=trainer_profile,
            )
        except AnthropometryEvaluation.DoesNotExist:
            return None, Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return evaluation, None

    def get(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        return Response(AnthropometrySerializer(evaluation).data)

    def patch(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        allowed = {'recommendations', 'notes'}
        for field in allowed:
            if field in request.data:
                setattr(evaluation, field, request.data[field])
        evaluation.save()
        return Response(AnthropometrySerializer(evaluation).data)


# ── Client endpoints ──

class ClientAnthropometryListView(APIView):
    """List the authenticated client's own anthropometry evaluations.

    GET /api/my-anthropometry/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        evals = AnthropometryEvaluation.objects.filter(
            customer=request.user,
        ).order_by('-created_at')
        return Response(AnthropometrySerializer(evals, many=True).data)


class ClientAnthropometryDetailView(APIView):
    """Get a specific evaluation belonging to the authenticated client.

    GET /api/my-anthropometry/<eval_id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, eval_id):
        try:
            evaluation = AnthropometryEvaluation.objects.get(
                id=eval_id, customer=request.user,
            )
        except AnthropometryEvaluation.DoesNotExist:
            return Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(AnthropometrySerializer(evaluation).data)
