"""Model tests for subscription WOMPI fields and payment relations."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    Payment,
    Subscription,
    User,
)

FIXED_NOW = timezone.make_aware(datetime(2024, 1, 15, 10, 0, 0))


@pytest.fixture
def customer(db):
    """Create a customer user used by subscription model tests."""
    return User.objects.create_user(email='sub_model_cust@example.com', password='p')


@pytest.fixture
def package(db):
    """Create a package fixture with deterministic pricing and validity."""
    return Package.objects.create(
        title='Test Package',
        sessions_count=10,
        price=Decimal('300000.00'),
        currency='COP',
        validity_days=30,
    )


@pytest.fixture
def subscription(customer, package):
    """Create an active subscription anchored to the fixed reference datetime."""
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=package.sessions_count,
        sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=package.validity_days),
    )


@pytest.mark.django_db
class TestSubscriptionWompiFields:
    """Subscription WOMPI-related fields defaults and persistence behavior."""

    def test_payment_source_id_defaults_to_blank(self, subscription):
        """Persist blank default for ``payment_source_id`` in new subscriptions."""
        subscription.refresh_from_db()
        assert subscription.payment_source_id == ''
        assert isinstance(subscription.payment_source_id, str)

    def test_wompi_transaction_id_defaults_to_blank(self, subscription):
        """Persist blank default for ``wompi_transaction_id`` in new subscriptions."""
        subscription.refresh_from_db()
        assert subscription.wompi_transaction_id == ''
        assert isinstance(subscription.wompi_transaction_id, str)

    def test_next_billing_date_defaults_to_none(self, subscription):
        """Leave ``next_billing_date`` unset by default for active subscriptions."""
        subscription.refresh_from_db()
        assert subscription.next_billing_date is None
        assert subscription.status == Subscription.Status.ACTIVE

    def test_can_set_payment_source_id(self, subscription):
        """Allow saving a concrete WOMPI payment source identifier."""
        subscription.payment_source_id = '12345'
        subscription.save()
        subscription.refresh_from_db()
        assert subscription.payment_source_id == '12345'

    def test_can_set_next_billing_date(self, subscription):
        """Allow saving an explicit next billing date value."""
        billing_date = date.today() + timedelta(days=30)
        subscription.next_billing_date = billing_date
        subscription.save()
        subscription.refresh_from_db()
        assert subscription.next_billing_date == billing_date


@pytest.mark.django_db
class TestSubscriptionSessionsRemaining:
    """Derived ``sessions_remaining`` calculations across usage scenarios."""

    def test_sessions_remaining_full(self, subscription):
        """Return full remaining count when no sessions were consumed."""
        assert subscription.sessions_used == 0
        assert subscription.sessions_remaining == 10

    def test_sessions_remaining_partial(self, subscription):
        """Decrease remaining sessions when usage is partially consumed."""
        subscription.sessions_used = 7
        assert subscription.sessions_remaining == 3

    def test_sessions_remaining_floored_at_zero(self, subscription):
        """Clamp remaining sessions at zero when usage exceeds total sessions."""
        subscription.sessions_used = 15
        assert subscription.sessions_remaining == 0


@pytest.mark.django_db
class TestPaymentSubscriptionFK:
    """Payment relation behavior for subscription and booking foreign keys."""

    def test_payment_can_be_created_with_subscription_only(self, subscription, customer):
        """Allow creating payments linked only through a subscription FK."""
        payment = Payment.objects.create(
            customer=customer,
            subscription=subscription,
            amount=Decimal('300000.00'),
            currency='COP',
            provider=Payment.Provider.WOMPI,
            provider_reference='txn_test_123',
        )
        assert payment.booking is None
        assert payment.subscription == subscription

    def test_payment_can_be_created_with_booking_only(self, customer):
        """Payment supports booking-only linkage when no subscription is associated."""
        pkg = Package.objects.create(title='Pkg2', price=Decimal('100000.00'))
        now = FIXED_NOW
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=1),
            ends_at=now + timedelta(hours=2),
        )
        booking = Booking.objects.create(customer=customer, package=pkg, slot=slot)
        payment = Payment.objects.create(
            customer=customer,
            booking=booking,
            amount=Decimal('100000.00'),
        )
        assert payment.booking == booking
        assert payment.subscription is None

    def test_subscription_payments_reverse_relation(self, subscription, customer):
        """Expose linked payments through the subscription reverse relation manager."""
        Payment.objects.create(
            customer=customer,
            subscription=subscription,
            amount=Decimal('300000.00'),
            provider=Payment.Provider.WOMPI,
        )
        Payment.objects.create(
            customer=customer,
            subscription=subscription,
            amount=Decimal('300000.00'),
            provider=Payment.Provider.WOMPI,
        )
        assert subscription.payments.count() == 2
