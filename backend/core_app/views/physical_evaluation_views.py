"""Views for physical evaluations.

Trainer endpoints: list/create/detail evaluations for their clients.
Client endpoints: read-only access to their own evaluations.
"""

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Booking, PhysicalEvaluation, User
from core_app.permissions import IsTrainerRole


class PhysicalEvaluationSerializer(serializers.ModelSerializer):
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = PhysicalEvaluation
        fields = (
            'id',
            'customer_id',
            'trainer_name',
            'evaluation_date',
            'age_at_evaluation', 'sex_at_evaluation',
            # Raw
            'squats_reps', 'pushups_reps', 'plank_seconds',
            'walk_meters', 'unipodal_seconds',
            'hip_mobility', 'shoulder_mobility', 'ankle_mobility',
            # Notes / flags
            'squats_notes', 'squats_pain', 'squats_interrupted',
            'pushups_notes', 'pushups_pain',
            'plank_notes', 'plank_pain',
            'walk_notes', 'walk_effort_perception', 'walk_heart_rate',
            'unipodal_notes', 'mobility_notes',
            'notes', 'recommendations',
            # Scores
            'squats_score', 'pushups_score', 'plank_score',
            'walk_score', 'unipodal_score',
            # Indices
            'strength_index', 'strength_category', 'strength_color',
            'endurance_index', 'endurance_category', 'endurance_color',
            'mobility_index', 'mobility_category', 'mobility_color',
            'balance_index', 'balance_category', 'balance_color',
            'general_index', 'general_category', 'general_color',
            # Cross-module
            'cross_module_alerts',
            'created_at',
        )
        read_only_fields = (
            'id', 'customer_id', 'trainer_name',
            'age_at_evaluation', 'sex_at_evaluation',
            'squats_score', 'pushups_score', 'plank_score',
            'walk_score', 'unipodal_score',
            'strength_index', 'strength_category', 'strength_color',
            'endurance_index', 'endurance_category', 'endurance_color',
            'mobility_index', 'mobility_category', 'mobility_color',
            'balance_index', 'balance_category', 'balance_color',
            'general_index', 'general_category', 'general_color',
            'cross_module_alerts',
            'created_at',
        )

    def get_trainer_name(self, obj):
        if obj.trainer and obj.trainer.user:
            return f'{obj.trainer.user.first_name} {obj.trainer.user.last_name}'.strip()
        return ''


# ── Trainer endpoints ──

class TrainerPhysicalEvalListCreateView(APIView):
    """List and create physical evaluations for a trainer's client.

    GET  /api/trainer/my-clients/<id>/physical-evaluation/
    POST /api/trainer/my-clients/<id>/physical-evaluation/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        evals = PhysicalEvaluation.objects.filter(
            customer_id=customer_id, trainer=trainer_profile,
        ).order_by('-created_at')
        return Response(PhysicalEvaluationSerializer(evals, many=True).data)

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

        serializer = PhysicalEvaluationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        evaluation = PhysicalEvaluation(
            customer=customer,
            trainer=trainer_profile,
            **serializer.validated_data,
        )
        evaluation.save()

        return Response(PhysicalEvaluationSerializer(evaluation).data, status=status.HTTP_201_CREATED)


class TrainerPhysicalEvalDetailView(APIView):
    """Get, update, or delete a specific physical evaluation.

    GET    /api/trainer/my-clients/<id>/physical-evaluation/<eval_id>/
    PATCH  /api/trainer/my-clients/<id>/physical-evaluation/<eval_id>/
    PUT    /api/trainer/my-clients/<id>/physical-evaluation/<eval_id>/
    DELETE /api/trainer/my-clients/<id>/physical-evaluation/<eval_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def _get_evaluation(self, request, customer_id, eval_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return None, Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            evaluation = PhysicalEvaluation.objects.get(
                id=eval_id, customer_id=customer_id, trainer=trainer_profile,
            )
        except PhysicalEvaluation.DoesNotExist:
            return None, Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return evaluation, None

    def get(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        return Response(PhysicalEvaluationSerializer(evaluation).data)

    def _apply_update(self, evaluation, data):
        """Apply mutable fields from request data onto the evaluation."""
        numeric_fields = (
            'squats_reps', 'pushups_reps', 'plank_seconds',
            'walk_meters', 'unipodal_seconds',
            'hip_mobility', 'shoulder_mobility', 'ankle_mobility',
            'walk_effort_perception', 'walk_heart_rate',
        )
        for field in numeric_fields:
            if field in data:
                val = data[field]
                setattr(evaluation, field, int(val) if val not in (None, '', 'null') else None)

        bool_fields = ('squats_pain', 'squats_interrupted', 'pushups_pain', 'plank_pain')
        for field in bool_fields:
            if field in data:
                val = data[field]
                if isinstance(val, bool):
                    setattr(evaluation, field, val)
                elif isinstance(val, str):
                    setattr(evaluation, field, val.lower() in ('true', '1'))

        text_fields = (
            'squats_notes', 'pushups_notes', 'plank_notes',
            'walk_notes', 'unipodal_notes', 'mobility_notes', 'notes',
        )
        for field in text_fields:
            if field in data:
                setattr(evaluation, field, data[field] or '')

        if 'evaluation_date' in data:
            evaluation.evaluation_date = data['evaluation_date'] or None

        if 'recommendations' in data:
            evaluation.recommendations = data['recommendations'] if isinstance(data['recommendations'], dict) else {}

    def put(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        self._apply_update(evaluation, request.data)
        evaluation.save()
        return Response(PhysicalEvaluationSerializer(evaluation).data)

    def patch(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        self._apply_update(evaluation, request.data)
        evaluation.save()
        return Response(PhysicalEvaluationSerializer(evaluation).data)

    def delete(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        evaluation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Client endpoints ──

class ClientPhysicalEvalListView(APIView):
    """List the authenticated client's own physical evaluations.

    GET /api/my-physical-evaluation/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        evals = PhysicalEvaluation.objects.filter(
            customer=request.user,
        ).order_by('-created_at')
        return Response(PhysicalEvaluationSerializer(evals, many=True).data)


class ClientPhysicalEvalDetailView(APIView):
    """Get a specific physical evaluation belonging to the authenticated client.

    GET /api/my-physical-evaluation/<eval_id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, eval_id):
        try:
            evaluation = PhysicalEvaluation.objects.get(
                id=eval_id, customer=request.user,
            )
        except PhysicalEvaluation.DoesNotExist:
            return Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PhysicalEvaluationSerializer(evaluation).data)
