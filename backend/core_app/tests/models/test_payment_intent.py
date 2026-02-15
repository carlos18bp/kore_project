"""Tests for the PaymentIntent model."""

from decimal import Decimal

import pytest

from core_app.models import Package, PaymentIntent, User


@pytest.mark.django_db
class TestPaymentIntentModel:
    @pytest.fixture
    def package(self, db):
        return Package.objects.create(
            title='PI Test Pkg', price=Decimal('200000.00'), currency='COP',
            sessions_count=5, validity_days=30,
        )

    @pytest.fixture
    def customer(self, db):
        return User.objects.create_user(
            email='pi_model@example.com', password='p',
            first_name='PI', last_name='User', role=User.Role.CUSTOMER,
        )

    def test_create_payment_intent(self, customer, package):
        intent = PaymentIntent.objects.create(
            customer=customer,
            package=package,
            reference='ref-model-001',
            wompi_transaction_id='txn-model-001',
            payment_source_id='ps-model-001',
            amount=Decimal('200000.00'),
            currency='COP',
        )
        assert intent.status == PaymentIntent.Status.PENDING
        assert intent.reference == 'ref-model-001'
        assert str(intent) == f'PaymentIntent #{intent.pk} — ref-model-001 (pending)'

    def test_unique_reference(self, customer, package):
        PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='ref-unique-001',
            amount=Decimal('200000.00'),
        )
        with pytest.raises(Exception):
            PaymentIntent.objects.create(
                customer=customer, package=package,
                reference='ref-unique-001',
                amount=Decimal('200000.00'),
            )

    def test_status_choices(self, customer, package):
        intent = PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='ref-status-001',
            amount=Decimal('200000.00'),
        )
        assert intent.status == 'pending'

        intent.status = PaymentIntent.Status.APPROVED
        intent.save()
        intent.refresh_from_db()
        assert intent.status == 'approved'

        intent.status = PaymentIntent.Status.FAILED
        intent.save()
        intent.refresh_from_db()
        assert intent.status == 'failed'

    def test_ordering(self, customer, package):
        i1 = PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='ref-order-001', amount=Decimal('100.00'),
        )
        i2 = PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='ref-order-002', amount=Decimal('200.00'),
        )
        intents = list(PaymentIntent.objects.all())
        assert intents[0].pk == i2.pk
        assert intents[1].pk == i1.pk
