from django.utils import timezone
from rest_framework import serializers

from core_app.models import Subscription
from core_app.serializers.package_serializers import PackageSerializer


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for the Subscription model.

    Provides a read-friendly representation that includes nested package info,
    the computed ``sessions_remaining`` property, and the customer's email.

    The ``status`` field is computed at serialization time: if the DB status is
    ``active`` but ``expires_at`` is in the past, the serializer returns
    ``expired`` so that clients always see the real effective status regardless
    of when the ``expire_subscriptions`` management command last ran.
    """

    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    package = PackageSerializer(read_only=True)
    sessions_remaining = serializers.IntegerField(read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = (
            'id',
            'customer_email',
            'package',
            'sessions_total',
            'sessions_used',
            'sessions_remaining',
            'status',
            'starts_at',
            'expires_at',
            'next_billing_date',
            'is_recurring',
            'billing_failed_at',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_status(self, obj):
        """Return the effective subscription status.

        If the database status is still ``active`` but ``expires_at`` has
        already passed, return ``expired`` to reflect the real state.
        """
        if obj.status == Subscription.Status.ACTIVE and obj.expires_at <= timezone.now():
            return Subscription.Status.EXPIRED
        return obj.status
