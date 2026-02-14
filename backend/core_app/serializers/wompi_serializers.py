"""Serializers for Wompi payment integration endpoints."""

from rest_framework import serializers

from core_app.models import Package, Payment, Subscription


class WompiConfigSerializer(serializers.Serializer):
    """Response serializer for the Wompi config endpoint."""

    public_key = serializers.CharField()
    environment = serializers.CharField()


class IntegritySignatureRequestSerializer(serializers.Serializer):
    """Request serializer for generating an integrity signature."""

    reference = serializers.CharField(max_length=255)
    amount_in_cents = serializers.IntegerField(min_value=1)
    currency = serializers.CharField(max_length=10, default='COP')


class IntegritySignatureResponseSerializer(serializers.Serializer):
    """Response serializer for the integrity signature endpoint."""

    signature = serializers.CharField()
    reference = serializers.CharField()


class SubscriptionPurchaseSerializer(serializers.Serializer):
    """Validates input for purchasing a subscription via Wompi tokenization.

    Expects the package ID and a card token obtained from the Wompi Widget
    in tokenization mode.
    """

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True),
    )
    card_token = serializers.CharField(
        max_length=255,
        help_text='Card token from Wompi Widget tokenization (e.g. tok_test_...)',
    )


class SubscriptionPaymentHistorySerializer(serializers.ModelSerializer):
    """Read-only serializer for payment history within a subscription."""

    class Meta:
        model = Payment
        fields = (
            'id',
            'status',
            'amount',
            'currency',
            'provider',
            'provider_reference',
            'confirmed_at',
            'created_at',
        )
        read_only_fields = fields
