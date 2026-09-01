"""Trainer-administered biweekly physical tests (credit source)."""
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from core_app.models.physical_test import PhysicalTest
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.serializers.credit_serializers import PhysicalTestSerializer


class PhysicalTestViewSet(viewsets.ModelViewSet):
    serializer_class = PhysicalTestSerializer
    permission_classes = [IsTrainerRole]

    def get_queryset(self):
        qs = PhysicalTest.objects.select_related('customer', 'trainer')
        if not is_admin_user(self.request.user):
            trainer_profile = getattr(self.request.user, 'trainer_profile', None)
            qs = qs.filter(customer__assigned_trainer=trainer_profile)
        customer_param = self.request.query_params.get('customer')
        if customer_param:
            qs = qs.filter(customer_id=customer_param)
        return qs

    def perform_create(self, serializer):
        # A passed test awards credits — only the assigned trainer (or an
        # admin) may record one for a given customer.
        trainer_profile = getattr(self.request.user, 'trainer_profile', None)
        customer = serializer.validated_data['customer']
        if not is_admin_user(self.request.user):
            if trainer_profile is None or getattr(customer, 'assigned_trainer_id', None) != trainer_profile.pk:
                raise PermissionDenied('Solo puedes registrar tests de tus clientes asignados.')
        serializer.save(trainer=trainer_profile)
