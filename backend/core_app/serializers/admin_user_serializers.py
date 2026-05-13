"""Admin-only serializers for the User model.

Used by ``AdminUserViewSet`` to expose user management to admins. Customers and
trainers continue using ``UserSerializer`` and the auth-facing serializers.
"""

from django.db.models import Q
from rest_framework import serializers

from core_app.models import Subscription, SubscriptionGuest, TrainerProfile, User


# ---------------------------------------------------------------------------
# Read serializers
# ---------------------------------------------------------------------------

class AdminUserListSerializer(serializers.ModelSerializer):
    """Compact representation for the admin users list page."""

    full_name = serializers.SerializerMethodField()
    has_active_subscription = serializers.SerializerMethodField()
    sessions_used_total = serializers.SerializerMethodField()
    sessions_total_total = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone',
            'role',
            'is_active',
            'must_change_password',
            'date_joined',
            'last_login',
            'has_active_subscription',
            'sessions_used_total',
            'sessions_total_total',
        )

    def get_full_name(self, user):
        return f'{user.first_name} {user.last_name}'.strip() or user.email

    def get_has_active_subscription(self, user):
        if user.role == User.Role.TRAINER:
            return False
        return _user_has_active_subscription(user)

    def get_sessions_used_total(self, user):
        return _aggregate_sessions(user, used=True)

    def get_sessions_total_total(self, user):
        return _aggregate_sessions(user, used=False)


class AdminUserDetailSerializer(AdminUserListSerializer):
    """Detail representation: subscriptions + trainer assignment."""

    subscriptions = serializers.SerializerMethodField()
    assigned_trainer = serializers.SerializerMethodField()
    assigned_clients = serializers.SerializerMethodField()

    class Meta(AdminUserListSerializer.Meta):
        fields = AdminUserListSerializer.Meta.fields + (
            'subscriptions', 'assigned_trainer', 'assigned_clients',
        )

    def get_subscriptions(self, user):
        subs = list(_subscriptions_for_user(user))
        return [_serialize_subscription_for_user(sub, user) for sub in subs]

    def get_assigned_trainer(self, user):
        if user.role != User.Role.CUSTOMER:
            return None
        tp = user.assigned_trainer
        if tp is None:
            return None
        return {'id': tp.id, 'first_name': tp.user.first_name, 'last_name': tp.user.last_name}

    def get_assigned_clients(self, user):
        if user.role != User.Role.TRAINER:
            return None
        tp = getattr(user, 'trainer_profile', None)
        if tp is None:
            return []
        clients = list(
            User.objects.filter(assigned_trainer=tp, role=User.Role.CUSTOMER)
            .order_by('first_name', 'last_name')
        )
        active_subs = {
            sub.customer_id: sub
            for sub in Subscription.objects.filter(
                customer_id__in=[c.id for c in clients],
                status=Subscription.Status.ACTIVE,
            ).select_related('package').order_by('customer_id', 'created_at')
        }
        out = []
        for c in clients:
            active_sub = active_subs.get(c.id)
            out.append({
                'id': c.id,
                'first_name': c.first_name,
                'last_name': c.last_name,
                'email': c.email,
                'is_active': c.is_active,
                'active_package': active_sub.package.title if active_sub else None,
            })
        return out


# ---------------------------------------------------------------------------
# Write serializers
# ---------------------------------------------------------------------------

class AdminUserCreateSerializer(serializers.Serializer):
    """Payload for ``POST /api/admin/users/``.

    The admin only sets identity fields and role. The temporary password is
    generated server-side and emailed to the user — never returned in the API
    response and never visible to the admin.
    """

    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[(User.Role.CUSTOMER, 'Customer'), (User.Role.TRAINER, 'Trainer')],
    )

    def validate_email(self, value):
        normalized = value.lower().strip()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('Ya existe un usuario con este correo.')
        return normalized


class AdminUserUpdateSerializer(serializers.Serializer):
    """Payload for ``PATCH /api/admin/users/{id}/``."""

    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[(User.Role.CUSTOMER, 'Customer'), (User.Role.TRAINER, 'Trainer')],
        required=False,
    )
    is_active = serializers.BooleanField(required=False)
    assigned_trainer_id = serializers.PrimaryKeyRelatedField(
        queryset=TrainerProfile.objects.all(),
        source='assigned_trainer',
        required=False,
        allow_null=True,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_has_active_subscription(user):
    """True if the user has any active subscription as customer or accepted guest."""
    has_owned = Subscription.objects.filter(
        customer=user, status=Subscription.Status.ACTIVE,
    ).exists()
    if has_owned:
        return True
    return SubscriptionGuest.objects.filter(
        guest=user,
        status=SubscriptionGuest.STATUS_ACCEPTED,
        subscription__status=Subscription.Status.ACTIVE,
    ).exists()


def _aggregate_sessions(user, *, used):
    """Sum sessions across this user's *active* subscriptions (own + accepted guest)."""
    field = 'sessions_used' if used else 'sessions_total'
    own_qs = Subscription.objects.filter(
        customer=user, status=Subscription.Status.ACTIVE,
    ).values_list(field, flat=True)
    guest_qs = Subscription.objects.filter(
        guest_link__guest=user,
        guest_link__status=SubscriptionGuest.STATUS_ACCEPTED,
        status=Subscription.Status.ACTIVE,
    ).values_list(field, flat=True)
    return sum(list(own_qs) + list(guest_qs))


def _subscriptions_for_user(user):
    """Return all subscriptions where this user is the customer OR an accepted guest."""
    return Subscription.objects.select_related('package').filter(
        Q(customer=user)
        | Q(guest_link__guest=user, guest_link__status=SubscriptionGuest.STATUS_ACCEPTED),
    ).distinct().order_by('-created_at')


def _serialize_subscription_for_user(sub, user):
    """Return the subscription dict used in AdminUserDetailSerializer.subscriptions."""
    is_duo = sub.package.category == 'semi_personalizado'
    if sub.customer_id == user.id:
        role = 'host' if is_duo else 'individual'
    else:
        role = 'guest'
    return {
        'id': sub.id,
        'package': {
            'title': sub.package.title,
            'category': sub.package.category,
        },
        'status': sub.status,
        'starts_at': sub.starts_at.isoformat() if sub.starts_at else None,
        'expires_at': sub.expires_at.isoformat() if sub.expires_at else None,
        'sessions_used': sub.sessions_used,
        'sessions_total': sub.sessions_total,
        'role': role,
    }
