from rest_framework import serializers

from core_app.models import Subscription
from core_app.serializers.package_serializers import PackageSerializer


class SubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for the Subscription model.

    Provides a read-friendly representation that includes nested package info,
    the computed ``sessions_remaining`` property, and the customer's email.
    """

    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    package = PackageSerializer(read_only=True)
    sessions_remaining = serializers.IntegerField(read_only=True)

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
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
