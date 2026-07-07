from rest_framework import serializers

from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


class CreditPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditPackage
        fields = ('id', 'name', 'credits', 'price_cop')


class CreditPurchaseStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditPurchase
        fields = ('reference', 'status', 'credits')
