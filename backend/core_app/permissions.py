from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'admin')


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'admin')
