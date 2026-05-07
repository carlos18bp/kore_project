"""Admin-only ViewSet for managing platform users.

Exposed at ``/api/admin/users/``. Provides list/retrieve/create/update plus
custom actions to reset the temporary password and toggle the active flag.
The temporary password is generated server-side and emailed to the user;
admins never see it in the API response.
"""

import logging

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_app.models import User
from core_app.permissions import IsAdminRole
from core_app.serializers.admin_user_serializers import (
    AdminUserCreateSerializer,
    AdminUserDetailSerializer,
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
)
from core_app.services.email_service import send_admin_user_invitation
from core_app.utils.passwords import generate_temporary_password

logger = logging.getLogger(__name__)


class AdminUserViewSet(viewsets.ViewSet):
    """CRUD-ish endpoints for admin user management."""

    permission_classes = [IsAuthenticated, IsAdminRole]

    # ---- Helpers --------------------------------------------------------

    def _base_queryset(self):
        return User.objects.exclude(is_deleted=True).order_by('-date_joined')

    def _get_object(self, pk):
        return self._base_queryset().filter(pk=pk).first()

    def _apply_filters(self, qs, request):
        search = (request.query_params.get('search') or '').strip()
        role = (request.query_params.get('role') or 'all').strip().lower()

        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search),
            )

        if role in {User.Role.CUSTOMER, User.Role.TRAINER, User.Role.ADMIN}:
            qs = qs.filter(role=role)

        return qs

    # ---- list / retrieve ------------------------------------------------

    def list(self, request):
        qs = self._apply_filters(self._base_queryset(), request)

        # DRF's standard pagination class is configured globally; we use it here.
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = AdminUserListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        user = self._get_object(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(AdminUserDetailSerializer(user).data)

    # ---- create ---------------------------------------------------------

    def create(self, request):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        temp_password = generate_temporary_password()
        user = User.objects.create_user(
            email=data['email'],
            password=temp_password,
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone', ''),
            role=data['role'],
        )
        user.must_change_password = True
        user.save(update_fields=['must_change_password'])

        try:
            send_admin_user_invitation(user, temp_password)
        except Exception:
            logger.exception('Failed to dispatch admin invitation email to %s', user.email)

        return Response(
            AdminUserDetailSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )

    # ---- update ---------------------------------------------------------

    def partial_update(self, request, pk=None):
        user = self._get_object(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        user.save()

        return Response(AdminUserDetailSerializer(user).data)

    # ---- destroy (soft delete) -----------------------------------------

    def destroy(self, request, pk=None):
        """Soft-delete: mark is_deleted + is_active=False.

        We don't hard-delete because :class:`Subscription.customer` uses
        ``on_delete=PROTECT`` and removing the row would break referential
        integrity. Soft-deleted users are excluded from list/retrieve.
        """
        user = self._get_object(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user.is_deleted = True
        user.is_active = False
        user.save(update_fields=['is_deleted', 'is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- Custom actions -------------------------------------------------

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """Regenerate a temporary password and re-send the invitation email."""
        user = self._get_object(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        temp_password = generate_temporary_password()
        user.set_password(temp_password)
        user.must_change_password = True
        user.save(update_fields=['password', 'must_change_password'])

        try:
            send_admin_user_invitation(user, temp_password)
        except Exception:
            logger.exception('Failed to dispatch reset-password email to %s', user.email)

        return Response({'detail': 'Credenciales reenviadas correctamente.'})

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self._get_object(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response(AdminUserDetailSerializer(user).data)
