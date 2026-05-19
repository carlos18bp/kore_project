"""Serializers for Wompi payment integration endpoints."""

from rest_framework import serializers

from core_app.models import Package, Payment, PaymentIntent, Subscription


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


class SubscriptionCheckoutPrepareSerializer(serializers.Serializer):
    """Validates input for preparing a Wompi Checkout transaction."""

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True),
    )
    registration_token = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        help_text='Signed pre-registration token for guest checkout flow.',
    )


class CheckoutPreparationSerializer(serializers.Serializer):
    """Response serializer for Wompi Checkout preparation."""

    reference = serializers.CharField()
    signature = serializers.CharField()
    amount_in_cents = serializers.IntegerField(min_value=1)
    currency = serializers.CharField(max_length=10)
    package_title = serializers.CharField()
    checkout_access_token = serializers.CharField(required=False, allow_blank=True)


class SubscriptionPurchaseSerializer(serializers.Serializer):
    """Validates input for purchasing a subscription via Wompi tokenization.

    Expects the package ID and a card token obtained from the Wompi Widget
    in tokenization mode.  The backend creates a payment source and a Wompi
    transaction, stores a PaymentIntent, and returns the intent for polling.
    """

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True),
    )
    card_token = serializers.CharField(
        max_length=255,
        help_text='Card token from Wompi Widget tokenization (e.g. tok_test_...)',
    )
    installments = serializers.IntegerField(
        required=False,
        default=1,
        min_value=1,
        help_text='Card installments. Current backend policy allows only 1 installment.',
    )
    registration_token = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        help_text='Signed pre-registration token for guest checkout flow.',
    )

    def validate_installments(self, value):
        if value != 1:
            raise serializers.ValidationError(
                'Por ahora solo se admite 1 cuota para pagos con tarjeta.',
            )
        return value


class PSEDataSerializer(serializers.Serializer):
    """Validates required PSE fields for alternative subscription purchase."""

    financial_institution_code = serializers.CharField(max_length=20)
    user_type = serializers.IntegerField(min_value=0, max_value=1)
    user_legal_id_type = serializers.CharField(max_length=10)
    user_legal_id = serializers.CharField(max_length=50)
    full_name = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=30)


class SubscriptionPurchaseAlternativeSerializer(serializers.Serializer):
    """Validates input for alternative payment methods (non-card)."""

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True),
    )
    payment_method = serializers.ChoiceField(
        choices=('NEQUI', 'PSE', 'BANCOLOMBIA_TRANSFER'),
    )
    phone_number = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
        help_text='Required only for NEQUI payments.',
    )
    pse_data = PSEDataSerializer(
        required=False,
        help_text='Required only for PSE payments.',
    )
    registration_token = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        help_text='Signed pre-registration token for guest checkout flow.',
    )

    def validate(self, attrs):
        payment_method = attrs.get('payment_method')
        if payment_method == 'NEQUI':
            phone_number = str(attrs.get('phone_number', '')).strip()
            if not phone_number:
                raise serializers.ValidationError({
                    'phone_number': 'Este campo es obligatorio para pagos con Nequi.',
                })

        if payment_method == 'PSE' and not attrs.get('pse_data'):
            raise serializers.ValidationError({
                'pse_data': 'Este campo es obligatorio para pagos con PSE.',
            })

        return attrs


class SubscriptionNequiStartSerializer(serializers.Serializer):
    """Validates input for starting a NEQUI subscription purchase.

    The customer's phone number is sent to Wompi via POST /tokens/nequi.
    Wompi returns a token in PENDING status that the customer must approve
    from their Nequi app; the confirm endpoint then polls and proceeds.
    """

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True),
    )
    phone_number = serializers.CharField(
        max_length=30,
        help_text='10-digit Colombian mobile number registered with Nequi.',
    )
    registration_token = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        help_text='Signed pre-registration token for guest checkout flow.',
    )


class SubscriptionBancolombiaStartSerializer(serializers.Serializer):
    """Validates input for starting a BANCOLOMBIA_TRANSFER subscription purchase.

    redirect_url is the page where Bancolombia returns the customer after
    they authorize the recurring debit.
    """

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.filter(is_active=True),
    )
    redirect_url = serializers.URLField(
        max_length=2000,
        help_text='Frontend URL Bancolombia will redirect the customer to after authorization.',
    )
    registration_token = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        help_text='Signed pre-registration token for guest checkout flow.',
    )


class SubscriptionTokenizedConfirmSerializer(serializers.Serializer):
    """Validates input for confirming a NEQUI/BANCOLOMBIA tokenized purchase.

    Used after the customer has approved the token (Nequi app or Bancolombia
    redirect). The backend polls the token status, creates a payment_source
    and a recurring transaction.
    """

    reference = serializers.CharField(max_length=255)


class PaymentIntentStatusSerializer(serializers.ModelSerializer):
    """Read-only serializer for polling a PaymentIntent status.

    Returns the current resolution state so the frontend can display
    processing / success / failure screens.
    """

    package_title = serializers.CharField(source='package.title', read_only=True)
    checkout_access_token = serializers.CharField(source='public_access_token', read_only=True)

    class Meta:
        model = PaymentIntent
        fields = (
            'id',
            'reference',
            'wompi_transaction_id',
            'status',
            'amount',
            'currency',
            'package_title',
            'checkout_access_token',
            'created_at',
        )
        read_only_fields = fields


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
