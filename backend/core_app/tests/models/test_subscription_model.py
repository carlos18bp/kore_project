import pytest
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone

from core_app.models import Package, Payment, Subscription, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='sub_model_cust@example.com', password='p')


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Test Package',
        sessions_count=10,
        price=Decimal('300000.00'),
        currency='COP',
        validity_days=30,
    )


@pytest.fixture
def subscription(customer, package):
    now = timezone.now()
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
    def test_payment_source_id_defaults_to_blank(self, subscription):
        assert subscription.payment_source_id == ''

    def test_wompi_transaction_id_defaults_to_blank(self, subscription):
        assert subscription.wompi_transaction_id == ''

    def test_next_billing_date_defaults_to_none(self, subscription):
        assert subscription.next_billing_date is None

    def test_paused_at_defaults_to_none(self, subscription):
        assert subscription.paused_at is None

    def test_can_set_payment_source_id(self, subscription):
        subscription.payment_source_id = '12345'
        subscription.save()
        subscription.refresh_from_db()
        assert subscription.payment_source_id == '12345'

    def test_can_set_next_billing_date(self, subscription):
        billing_date = date.today() + timedelta(days=30)
        subscription.next_billing_date = billing_date
        subscription.save()
        subscription.refresh_from_db()
        assert subscription.next_billing_date == billing_date


@pytest.mark.django_db
class TestSubscriptionPausedStatus:
    def test_paused_status_exists(self):
        assert 'paused' in [c[0] for c in Subscription.Status.choices]

    def test_can_pause_subscription(self, subscription):
        now = timezone.now()
        subscription.status = Subscription.Status.PAUSED
        subscription.paused_at = now
        subscription.save()
        subscription.refresh_from_db()
        assert subscription.status == Subscription.Status.PAUSED
        assert subscription.paused_at is not None

    def test_can_resume_subscription(self, subscription):
        subscription.status = Subscription.Status.PAUSED
        subscription.paused_at = timezone.now()
        subscription.save()

        subscription.status = Subscription.Status.ACTIVE
        subscription.paused_at = None
        subscription.save()
        subscription.refresh_from_db()
        assert subscription.status == Subscription.Status.ACTIVE
        assert subscription.paused_at is None


@pytest.mark.django_db
class TestSubscriptionSessionsRemaining:
    def test_sessions_remaining_full(self, subscription):
        assert subscription.sessions_remaining == 10

    def test_sessions_remaining_partial(self, subscription):
        subscription.sessions_used = 7
        assert subscription.sessions_remaining == 3

    def test_sessions_remaining_floored_at_zero(self, subscription):
        subscription.sessions_used = 15
        assert subscription.sessions_remaining == 0


@pytest.mark.django_db
class TestPaymentSubscriptionFK:
    def test_payment_can_be_created_with_subscription_only(self, subscription, customer):
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
        from core_app.models import AvailabilitySlot, Booking, Package as Pkg
        pkg = Pkg.objects.create(title='Pkg2', price=Decimal('100000.00'))
        now = timezone.now()
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
