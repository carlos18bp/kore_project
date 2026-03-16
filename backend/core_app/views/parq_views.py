"""Views for PAR-Q+ assessments.

Client endpoints: create and read own PAR-Q entries (rate-limited to 1/90 days).
Trainer endpoints: read-only access to their clients' PAR-Q entries.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Booking, User
from core_app.models.parq_assessment import ParqAssessment
from core_app.permissions import IsTrainerRole


PARQ_COOLDOWN_DAYS = 90


class ParqAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParqAssessment
        fields = (
            'id',
            'customer_id',
            'q1_heart_condition',
            'q2_chest_pain',
            'q3_dizziness',
            'q4_chronic_condition',
            'q5_prescribed_medication',
            'q6_bone_joint_problem',
            'q7_medical_supervision',
            'additional_notes',
            'yes_count',
            'risk_classification',
            'risk_label',
            'risk_color',
            'created_at',
        )
        read_only_fields = (
            'id',
            'customer_id',
            'yes_count',
            'risk_classification',
            'risk_label',
            'risk_color',
            'created_at',
        )


# ── Client endpoints ──

class ClientParqListCreateView(APIView):
    """List and create PAR-Q assessments for the authenticated client.

    GET  /api/my-parq/
    POST /api/my-parq/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = ParqAssessment.objects.filter(
            customer=request.user,
        ).order_by('-created_at')
        return Response(ParqAssessmentSerializer(entries, many=True).data)

    def post(self, request):
        latest = ParqAssessment.objects.filter(
            customer=request.user,
        ).order_by('-created_at').first()

        if latest and latest.created_at > timezone.now() - timedelta(days=PARQ_COOLDOWN_DAYS):
            return Response(
                {'detail': 'Puedes actualizar tu PAR-Q cada 3 meses.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ParqAssessmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = ParqAssessment(
            customer=request.user,
            **serializer.validated_data,
        )
        entry.save()

        return Response(
            ParqAssessmentSerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class ClientParqDetailView(APIView):
    """Get a specific PAR-Q assessment belonging to the authenticated client.

    GET /api/my-parq/<eval_id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, eval_id):
        try:
            entry = ParqAssessment.objects.get(
                id=eval_id, customer=request.user,
            )
        except ParqAssessment.DoesNotExist:
            return Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(ParqAssessmentSerializer(entry).data)


# ── Trainer endpoints (read-only) ──

class TrainerParqListView(APIView):
    """List PAR-Q assessments for a trainer's client.

    GET /api/trainer/my-clients/<id>/parq/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id,
        ).exists()
        if not has_bookings:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        entries = ParqAssessment.objects.filter(
            customer_id=customer_id,
        ).order_by('-created_at')
        return Response(ParqAssessmentSerializer(entries, many=True).data)


class TrainerParqDetailView(APIView):
    """Get a specific PAR-Q assessment for a trainer's client.

    GET /api/trainer/my-clients/<id>/parq/<eval_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id, eval_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id,
        ).exists()
        if not has_bookings:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            entry = ParqAssessment.objects.get(
                id=eval_id, customer_id=customer_id,
            )
        except ParqAssessment.DoesNotExist:
            return Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(ParqAssessmentSerializer(entry).data)
