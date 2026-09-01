from django.utils import timezone
from rest_framework import serializers

from core_app.models import Subscription
from core_app.serializers.package_serializers import PackageSerializer


class AdminSubscriptionSerializer(serializers.ModelSerializer):
    """Admin-only writable serializer for Subscription.

    Exposes ``status`` as a writable ChoiceField (unlike the customer-facing
    SubscriptionSerializer which computes it).  Also adds ``customer_name``
    for display in the admin panel and host/guest metadata for duo plans.
    """

    customer_id = serializers.IntegerField(source='customer.id', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_name = serializers.SerializerMethodField(read_only=True)
    package = PackageSerializer(read_only=True)
    pending_package = PackageSerializer(read_only=True)
    sessions_remaining = serializers.IntegerField(read_only=True)
    status = serializers.ChoiceField(choices=Subscription.Status.choices, required=False)
    is_duo = serializers.SerializerMethodField(read_only=True)
    guest_info = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Subscription
        fields = (
            'id',
            'customer_id',
            'customer_email',
            'customer_name',
            'package',
            'sessions_total',
            'sessions_used',
            'sessions_remaining',
            'status',
            'starts_at',
            'expires_at',
            'is_recurring',
            'next_billing_date',
            'billing_failed_at',
            'pending_package',
            'cancel_at_period_end',
            'is_duo',
            'guest_info',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'created_at', 'updated_at', 'billing_failed_at',
            'pending_package', 'cancel_at_period_end',
        )

    def get_customer_name(self, obj):
        name = f'{obj.customer.first_name} {obj.customer.last_name}'.strip()
        return name or obj.customer.email

    def get_is_duo(self, obj):
        return obj.package.category == 'semi_personalizado'

    def get_guest_info(self, obj):
        try:
            gl = obj.guest_link
        except Exception:
            return None
        guest_name = None
        guest_user_id = None
        if gl.guest_id:
            full = f'{gl.guest.first_name} {gl.guest.last_name}'.strip()
            guest_name = full or gl.guest.email
            guest_user_id = gl.guest_id
        return {
            'status': gl.status,
            'invited_email': gl.invited_email,
            'guest_name': guest_name,
            'guest_user_id': guest_user_id,
            'accepted_at': gl.accepted_at.isoformat() if gl.accepted_at else None,
        }


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for the Subscription model.

    Provides a read-friendly representation that includes nested package info,
    the computed ``sessions_remaining`` property, and the customer's email.

    The ``status`` field is computed at serialization time: if the DB status is
    ``active`` but ``expires_at`` is in the past, the serializer returns
    ``expired`` so that clients always see the real effective status regardless
    of when the ``expire_subscriptions`` management command last ran.

    For duo (semi_personalizado) plans, also exposes:
      - ``is_guest``: True when the requesting user is the invited guest, not the host.
      - ``guest_info``: Host-only field with current guest invitation state.
    """

    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    package = PackageSerializer(read_only=True)
    pending_package = PackageSerializer(read_only=True)
    sessions_remaining = serializers.IntegerField(read_only=True)
    sessions_completed = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    is_guest = serializers.SerializerMethodField()
    guest_info = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = (
            'id',
            'customer_email',
            'package',
            'sessions_total',
            'sessions_used',
            'sessions_remaining',
            'sessions_completed',
            'status',
            'starts_at',
            'expires_at',
            'next_billing_date',
            'is_recurring',
            'billing_failed_at',
            'pending_package',
            'cancel_at_period_end',
            'is_guest',
            'guest_info',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_sessions_completed(self, obj):
        """Count bookings that are not cancelled and whose slot has already ended."""
        from core_app.models import Booking
        return obj.bookings.filter(
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            ends_at__lte=timezone.now(),
        ).count()

    def get_status(self, obj):
        """Return the effective subscription status."""
        if obj.status == Subscription.Status.ACTIVE and obj.expires_at <= timezone.now():
            return Subscription.Status.EXPIRED
        return obj.status

    def get_is_guest(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.customer_id != request.user.pk

    def get_guest_info(self, obj):
        request = self.context.get('request')
        if not request or obj.customer_id != request.user.pk:
            return None
        try:
            gl = obj.guest_link
        except Exception:
            return None
        guest_name = None
        guest_user_id = None
        if gl.guest_id:
            guest_name = f'{gl.guest.first_name} {gl.guest.last_name}'.strip() or gl.guest.email
            guest_user_id = gl.guest_id
        return {
            'status': gl.status,
            'invited_email': gl.invited_email,
            'guest_name': guest_name,
            'guest_user_id': guest_user_id,
        }
