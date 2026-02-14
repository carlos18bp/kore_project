from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core_app.models import TrainerProfile
from core_app.serializers.trainer_profile_serializers import TrainerProfileSerializer


class TrainerProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for TrainerProfile.

    Allows authenticated users to list and retrieve trainer profiles.
    Admin users see all profiles; customers see only active trainers.

    Endpoints:
        GET /api/trainers/        — list all trainer profiles
        GET /api/trainers/{id}/   — retrieve a single trainer profile
    """

    serializer_class = TrainerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return trainer profiles with related user data pre-loaded.

        Returns:
            QuerySet: TrainerProfile instances ordered by user first name.
        """
        return TrainerProfile.objects.select_related('user').all()
