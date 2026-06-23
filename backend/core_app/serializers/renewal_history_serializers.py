from rest_framework import serializers


class RenewalHistoryPaymentSerializer(serializers.Serializer):
    amount = serializers.CharField()
    currency = serializers.CharField()
    provider = serializers.CharField()
    status = serializers.CharField()


class RenewalHistoryItemSerializer(serializers.Serializer):
    """Read-only serializer for one timeline item built by the service layer."""

    kind = serializers.CharField()
    period_start = serializers.DateTimeField()
    period_end = serializers.DateTimeField()
    sessions_granted = serializers.IntegerField()
    package_title = serializers.CharField()
    actor_email = serializers.CharField(allow_blank=True)
    note = serializers.CharField(allow_blank=True)
    source = serializers.CharField()
    payment = RenewalHistoryPaymentSerializer(allow_null=True)
