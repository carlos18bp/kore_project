"""Tests for the PaymentIntent model."""

from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from core_app.models import Package, PaymentIntent, User


@pytest.mark.django_db
class TestPaymentIntentModel:
    """Validate PaymentIntent persistence, uniqueness, and ordering behavior."""

    @pytest.fixture
    def package(self, db):
        """Create a package fixture used by payment intent tests."""
        return Package.objects.create(
            title='PI Test Pkg', price=Decimal('200000.00'), currency='COP',
            sessions_count=5, validity_days=30,
        )

    @pytest.fixture
    def customer(self, db):
        """Create a customer fixture used by payment intent tests."""
        return User.objects.create_user(
            email='pi_model@example.com', password='p',
            first_name='PI', last_name='User', role=User.Role.CUSTOMER,
        )

    def test_create_payment_intent(self, customer, package):
        """Persist payment intents with expected defaults and string representation."""
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
        """Reject creating a second payment intent with an existing reference."""
        PaymentIntent.objects.create(
            customer=customer, package=package,
            reference='ref-unique-001',
            amount=Decimal('200000.00'),
        )
        assert PaymentIntent.objects.count() == 1
        with transaction.atomic():
            with pytest.raises(IntegrityError):
                PaymentIntent.objects.create(
                    customer=customer, package=package,
                    reference='ref-unique-001',
                    amount=Decimal('200000.00'),
                )
        assert PaymentIntent.objects.count() == 1

    def test_status_choices(self, customer, package):
        """Persist valid status transitions from pending to approved and failed."""
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
        """Return newest payment intents first according to model ordering."""
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
