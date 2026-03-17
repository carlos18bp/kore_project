"""Tests for Wompi payment integration serializers."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from core_app.models import Package, Payment, PaymentIntent, Subscription, User
from core_app.serializers.wompi_serializers import (
    CheckoutPreparationSerializer,
    IntegritySignatureRequestSerializer,
    IntegritySignatureResponseSerializer,
    PaymentIntentStatusSerializer,
    PSEDataSerializer,
    SubscriptionCheckoutPrepareSerializer,
    SubscriptionPaymentHistorySerializer,
    SubscriptionPurchaseAlternativeSerializer,
    SubscriptionPurchaseSerializer,
    WompiConfigSerializer,
)


# ----------------------------------------------------------------
# WompiConfigSerializer
# ----------------------------------------------------------------


class TestWompiConfigSerializer:
    """Validate WompiConfigSerializer field behavior."""

    def test_valid_data_passes(self):
        """Accept valid public_key and environment values."""
        serializer = WompiConfigSerializer(data={
            'public_key': 'pub_test_abc123',
            'environment': 'test',
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['public_key'] == 'pub_test_abc123'
        assert serializer.validated_data['environment'] == 'test'

    def test_missing_public_key_rejected(self):
        """Reject payload without public_key."""
        serializer = WompiConfigSerializer(data={'environment': 'test'})
        assert not serializer.is_valid()
        assert 'public_key' in serializer.errors

    def test_missing_environment_rejected(self):
        """Reject payload without environment."""
        serializer = WompiConfigSerializer(data={'public_key': 'pub_test_abc'})
        assert not serializer.is_valid()
        assert 'environment' in serializer.errors


# ----------------------------------------------------------------
# IntegritySignatureRequestSerializer
# ----------------------------------------------------------------


class TestIntegritySignatureRequestSerializer:
    """Validate IntegritySignatureRequestSerializer constraints."""

    def test_valid_data_passes(self):
        """Accept valid reference, amount_in_cents, and currency."""
        serializer = IntegritySignatureRequestSerializer(data={
            'reference': 'ref-001',
            'amount_in_cents': 15000000,
            'currency': 'COP',
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['amount_in_cents'] == 15000000

    def test_default_currency_applied(self):
        """Apply COP as default currency when omitted."""
        serializer = IntegritySignatureRequestSerializer(data={
            'reference': 'ref-002',
            'amount_in_cents': 5000,
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['currency'] == 'COP'

    def test_zero_amount_rejected(self):
        """Reject amount_in_cents of zero (min_value=1)."""
        serializer = IntegritySignatureRequestSerializer(data={
            'reference': 'ref-003',
            'amount_in_cents': 0,
        })
        assert not serializer.is_valid()
        assert 'amount_in_cents' in serializer.errors

    def test_negative_amount_rejected(self):
        """Reject negative amount_in_cents."""
        serializer = IntegritySignatureRequestSerializer(data={
            'reference': 'ref-004',
            'amount_in_cents': -100,
        })
        assert not serializer.is_valid()
        assert 'amount_in_cents' in serializer.errors

    def test_missing_reference_rejected(self):
        """Reject payload missing reference field."""
        serializer = IntegritySignatureRequestSerializer(data={
            'amount_in_cents': 5000,
        })
        assert not serializer.is_valid()
        assert 'reference' in serializer.errors


# ----------------------------------------------------------------
# IntegritySignatureResponseSerializer
# ----------------------------------------------------------------


class TestIntegritySignatureResponseSerializer:
    """Validate IntegritySignatureResponseSerializer output fields."""

    def test_valid_data_passes(self):
        """Accept valid signature and reference."""
        serializer = IntegritySignatureResponseSerializer(data={
            'signature': 'sha256-abc',
            'reference': 'ref-001',
        })
        assert serializer.is_valid(), serializer.errors

    def test_missing_signature_rejected(self):
        """Reject payload without signature."""
        serializer = IntegritySignatureResponseSerializer(data={
            'reference': 'ref-001',
        })
        assert not serializer.is_valid()
        assert 'signature' in serializer.errors


# ----------------------------------------------------------------
# SubscriptionCheckoutPrepareSerializer
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestSubscriptionCheckoutPrepareSerializer:
    """Validate SubscriptionCheckoutPrepareSerializer FK resolution and optional fields."""

    @pytest.fixture
    def active_package(self):
        return Package.objects.create(
            title='Plan Activo', price=Decimal('150000'), is_active=True,
        )

    @pytest.fixture
    def inactive_package(self):
        return Package.objects.create(
            title='Plan Inactivo', price=Decimal('100000'), is_active=False,
        )

    def test_valid_active_package_passes(self, active_package):
        """Accept an active package_id."""
        serializer = SubscriptionCheckoutPrepareSerializer(data={
            'package_id': active_package.pk,
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['package_id'] == active_package

    def test_inactive_package_rejected(self, inactive_package):
        """Reject an inactive package_id (queryset filters is_active=True)."""
        serializer = SubscriptionCheckoutPrepareSerializer(data={
            'package_id': inactive_package.pk,
        })
        assert not serializer.is_valid()
        assert 'package_id' in serializer.errors

    def test_nonexistent_package_rejected(self):
        """Reject a package_id that does not exist."""
        serializer = SubscriptionCheckoutPrepareSerializer(data={
            'package_id': 99999,
        })
        assert not serializer.is_valid()
        assert 'package_id' in serializer.errors

    def test_registration_token_optional(self, active_package):
        """Accept payload without registration_token (optional field)."""
        serializer = SubscriptionCheckoutPrepareSerializer(data={
            'package_id': active_package.pk,
        })
        assert serializer.is_valid(), serializer.errors

    def test_registration_token_accepted(self, active_package):
        """Accept payload with a registration_token value."""
        serializer = SubscriptionCheckoutPrepareSerializer(data={
            'package_id': active_package.pk,
            'registration_token': 'signed-token-abc',
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['registration_token'] == 'signed-token-abc'


# ----------------------------------------------------------------
# CheckoutPreparationSerializer
# ----------------------------------------------------------------


class TestCheckoutPreparationSerializer:
    """Validate CheckoutPreparationSerializer response fields."""

    def test_valid_full_payload_passes(self):
        """Accept a full response payload with all fields."""
        serializer = CheckoutPreparationSerializer(data={
            'reference': 'ref-001',
            'signature': 'sha256-sig',
            'amount_in_cents': 15000000,
            'currency': 'COP',
            'package_title': 'Plan Premium',
            'checkout_access_token': 'tok-abc',
        })
        assert serializer.is_valid(), serializer.errors

    def test_checkout_access_token_optional(self):
        """Accept payload without checkout_access_token (optional)."""
        serializer = CheckoutPreparationSerializer(data={
            'reference': 'ref-001',
            'signature': 'sha256-sig',
            'amount_in_cents': 15000000,
            'currency': 'COP',
            'package_title': 'Plan Premium',
        })
        assert serializer.is_valid(), serializer.errors

    def test_zero_amount_rejected(self):
        """Reject amount_in_cents of zero."""
        serializer = CheckoutPreparationSerializer(data={
            'reference': 'ref-001',
            'signature': 'sha256-sig',
            'amount_in_cents': 0,
            'currency': 'COP',
            'package_title': 'Plan',
        })
        assert not serializer.is_valid()
        assert 'amount_in_cents' in serializer.errors


# ----------------------------------------------------------------
# SubscriptionPurchaseSerializer
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestSubscriptionPurchaseSerializer:
    """Validate SubscriptionPurchaseSerializer card tokenization input."""

    @pytest.fixture
    def package(self):
        return Package.objects.create(
            title='Card Plan', price=Decimal('200000'), is_active=True,
        )

    def test_valid_card_purchase_passes(self, package):
        """Accept valid package_id and card_token with default installments."""
        serializer = SubscriptionPurchaseSerializer(data={
            'package_id': package.pk,
            'card_token': 'tok_test_abc123',
        })
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['installments'] == 1

    def test_installments_greater_than_one_rejected(self, package):
        """Reject installments != 1 per current business policy."""
        serializer = SubscriptionPurchaseSerializer(data={
            'package_id': package.pk,
            'card_token': 'tok_test_abc123',
            'installments': 3,
        })
        assert not serializer.is_valid()
        assert 'installments' in serializer.errors
        assert 'solo se admite 1 cuota' in str(serializer.errors['installments'])

    def test_missing_card_token_rejected(self, package):
        """Reject payload without card_token."""
        serializer = SubscriptionPurchaseSerializer(data={
            'package_id': package.pk,
        })
        assert not serializer.is_valid()
        assert 'card_token' in serializer.errors

    def test_registration_token_optional(self, package):
        """Accept payload without registration_token."""
        serializer = SubscriptionPurchaseSerializer(data={
            'package_id': package.pk,
            'card_token': 'tok_test_abc',
        })
        assert serializer.is_valid(), serializer.errors

    def test_installments_zero_rejected(self, package):
        """Reject installments of zero (min_value=1)."""
        serializer = SubscriptionPurchaseSerializer(data={
            'package_id': package.pk,
            'card_token': 'tok_test_abc',
            'installments': 0,
        })
        assert not serializer.is_valid()
        assert 'installments' in serializer.errors


# ----------------------------------------------------------------
# PSEDataSerializer
# ----------------------------------------------------------------


class TestPSEDataSerializer:
    """Validate PSEDataSerializer field constraints."""

    def test_valid_pse_data_passes(self):
        """Accept valid PSE bank transfer fields."""
        serializer = PSEDataSerializer(data={
            'financial_institution_code': '1007',
            'user_type': 0,
            'user_legal_id_type': 'CC',
            'user_legal_id': '1234567890',
            'full_name': 'Juan Pérez',
            'phone_number': '3101234567',
        })
        assert serializer.is_valid(), serializer.errors

    def test_missing_financial_institution_rejected(self):
        """Reject payload missing financial_institution_code."""
        serializer = PSEDataSerializer(data={
            'user_type': 0,
            'user_legal_id_type': 'CC',
            'user_legal_id': '123',
            'full_name': 'Test',
            'phone_number': '310',
        })
        assert not serializer.is_valid()
        assert 'financial_institution_code' in serializer.errors

    def test_user_type_out_of_range_rejected(self):
        """Reject user_type > 1 (max_value=1)."""
        serializer = PSEDataSerializer(data={
            'financial_institution_code': '1007',
            'user_type': 2,
            'user_legal_id_type': 'CC',
            'user_legal_id': '123',
            'full_name': 'Test',
            'phone_number': '310',
        })
        assert not serializer.is_valid()
        assert 'user_type' in serializer.errors

    def test_negative_user_type_rejected(self):
        """Reject user_type < 0 (min_value=0)."""
        serializer = PSEDataSerializer(data={
            'financial_institution_code': '1007',
            'user_type': -1,
            'user_legal_id_type': 'CC',
            'user_legal_id': '123',
            'full_name': 'Test',
            'phone_number': '310',
        })
        assert not serializer.is_valid()
        assert 'user_type' in serializer.errors


# ----------------------------------------------------------------
# SubscriptionPurchaseAlternativeSerializer
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestSubscriptionPurchaseAlternativeSerializer:
    """Validate alternative payment method input and cross-field validation."""

    @pytest.fixture
    def package(self):
        return Package.objects.create(
            title='Alt Plan', price=Decimal('100000'), is_active=True,
        )

    def test_nequi_valid_passes(self, package):
        """Accept valid NEQUI payment with phone_number."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'NEQUI',
            'phone_number': '3101234567',
        })
        assert serializer.is_valid(), serializer.errors

    def test_nequi_missing_phone_rejected(self, package):
        """Reject NEQUI payment without phone_number."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'NEQUI',
        })
        assert not serializer.is_valid()
        assert 'phone_number' in serializer.errors

    def test_nequi_blank_phone_rejected(self, package):
        """Reject NEQUI payment with blank phone_number."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'NEQUI',
            'phone_number': '   ',
        })
        assert not serializer.is_valid()
        assert 'phone_number' in serializer.errors

    def test_pse_valid_passes(self, package):
        """Accept valid PSE payment with pse_data."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'PSE',
            'pse_data': {
                'financial_institution_code': '1007',
                'user_type': 0,
                'user_legal_id_type': 'CC',
                'user_legal_id': '1234567890',
                'full_name': 'Juan Pérez',
                'phone_number': '3101234567',
            },
        })
        assert serializer.is_valid(), serializer.errors

    def test_pse_missing_pse_data_rejected(self, package):
        """Reject PSE payment without pse_data."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'PSE',
        })
        assert not serializer.is_valid()
        assert 'pse_data' in serializer.errors

    def test_bancolombia_valid_passes(self, package):
        """Accept valid BANCOLOMBIA_TRANSFER payment."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'BANCOLOMBIA_TRANSFER',
        })
        assert serializer.is_valid(), serializer.errors

    def test_invalid_payment_method_rejected(self, package):
        """Reject unsupported payment method choice."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'BITCOIN',
        })
        assert not serializer.is_valid()
        assert 'payment_method' in serializer.errors

    def test_registration_token_optional(self, package):
        """Accept BANCOLOMBIA_TRANSFER without registration_token."""
        serializer = SubscriptionPurchaseAlternativeSerializer(data={
            'package_id': package.pk,
            'payment_method': 'BANCOLOMBIA_TRANSFER',
        })
        assert serializer.is_valid(), serializer.errors


# ----------------------------------------------------------------
# PaymentIntentStatusSerializer
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestPaymentIntentStatusSerializer:
    """Validate PaymentIntentStatusSerializer read-only output."""

    @pytest.fixture
    def intent(self, db):
        pkg = Package.objects.create(
            title='Intent Pkg', price=Decimal('120000'), is_active=True,
        )
        return PaymentIntent.objects.create(
            package=pkg,
            reference='ref-intent-001',
            wompi_transaction_id='txn-001',
            amount=Decimal('120000.00'),
            currency='COP',
            status=PaymentIntent.Status.PENDING,
            public_access_token='pub-tok-xyz',
        )

    def test_serializes_expected_fields(self, intent):
        """Output contains all declared read-only fields."""
        data = PaymentIntentStatusSerializer(intent).data
        expected_fields = {
            'id', 'reference', 'wompi_transaction_id', 'status',
            'amount', 'currency', 'package_title', 'checkout_access_token',
            'created_at',
        }
        assert set(data.keys()) == expected_fields

    def test_package_title_from_nested_relation(self, intent):
        """Resolve package_title from intent.package.title."""
        data = PaymentIntentStatusSerializer(intent).data
        assert data['package_title'] == 'Intent Pkg'

    def test_checkout_access_token_maps_to_public_access_token(self, intent):
        """Map checkout_access_token from public_access_token source field."""
        data = PaymentIntentStatusSerializer(intent).data
        assert data['checkout_access_token'] == 'pub-tok-xyz'

    def test_all_fields_read_only(self, intent):
        """Verify all fields in Meta.read_only_fields match Meta.fields."""
        meta = PaymentIntentStatusSerializer.Meta
        assert set(meta.read_only_fields) == set(meta.fields)


# ----------------------------------------------------------------
# SubscriptionPaymentHistorySerializer
# ----------------------------------------------------------------


@pytest.mark.django_db
class TestSubscriptionPaymentHistorySerializer:
    """Validate SubscriptionPaymentHistorySerializer read-only output."""

    @pytest.fixture
    def payment(self, db):
        customer = User.objects.create_user(
            email='hist_cust@example.com', password='p',
        )
        now = timezone.now()
        pkg = Package.objects.create(title='Hist Pkg', price=Decimal('80000'))
        sub = Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=4, sessions_used=1,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        return Payment.objects.create(
            customer=customer,
            subscription=sub,
            status=Payment.Status.CONFIRMED,
            amount=Decimal('80000.00'),
            currency='COP',
            provider=Payment.Provider.WOMPI,
            provider_reference='wompi-ref-001',
            confirmed_at=now,
        )

    def test_serializes_expected_fields(self, payment):
        """Output contains all declared read-only fields."""
        data = SubscriptionPaymentHistorySerializer(payment).data
        expected_fields = {
            'id', 'status', 'amount', 'currency', 'provider',
            'provider_reference', 'confirmed_at', 'created_at',
        }
        assert set(data.keys()) == expected_fields

    def test_amount_matches_payment_record(self, payment):
        """Serialize amount as the recorded payment value."""
        data = SubscriptionPaymentHistorySerializer(payment).data
        assert Decimal(data['amount']) == Decimal('80000.00')

    def test_all_fields_read_only(self):
        """Verify all fields in Meta.read_only_fields match Meta.fields."""
        meta = SubscriptionPaymentHistorySerializer.Meta
        assert set(meta.read_only_fields) == set(meta.fields)
