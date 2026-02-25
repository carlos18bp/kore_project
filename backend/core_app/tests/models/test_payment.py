"""Model tests for payment defaults, choices, relations, and ordering."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

import pytest
from django.db.models import ProtectedError

from core_app.models import AvailabilitySlot, Booking, Package, Payment, User

FIXED_NOW = datetime(2026, 1, 15, 10, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def customer(db):
    """Create a customer user used by payment model tests."""
    return User.objects.create_user(email='pay_cust@example.com', password='p')


@pytest.fixture
def booking(db, customer):
    """Create a booking fixture that can be linked to payments."""
    pkg = Package.objects.create(title='Pkg', price=Decimal('100000.00'))
    slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=1),
        ends_at=FIXED_NOW + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.mark.django_db
class TestPaymentModel:
    """Payment model behavior across defaults, enums, and FK protections."""

    def test_defaults(self, booking, customer):
        """Apply expected default values when creating a payment with minimal fields."""
        payment = Payment.objects.create(booking=booking, customer=customer)
        assert payment.status == Payment.Status.PENDING
        assert payment.amount == Decimal('0.00')
        assert payment.currency == 'COP'
        assert payment.provider == ''
        assert payment.provider_reference == ''
        assert payment.metadata == {}
        assert payment.confirmed_at is None

    def test_str(self, booking, customer):
        """Render payment string representation with record id and status."""
        payment = Payment.objects.create(booking=booking, customer=customer)
        assert f'Payment #{payment.pk}' in str(payment)
        assert 'pending' in str(payment)

    def test_status_choices(self):
        """Expose expected status enum values used by the payment lifecycle."""
        assert Payment.Status.PENDING == 'pending'
        assert Payment.Status.CONFIRMED == 'confirmed'
        assert Payment.Status.FAILED == 'failed'
        assert Payment.Status.CANCELED == 'canceled'
        assert Payment.Status.REFUNDED == 'refunded'

    def test_provider_choices(self):
        """Expose expected provider enum values supported by the payment model."""
        assert Payment.Provider.WOMPI == 'wompi'
        assert Payment.Provider.PAYU == 'payu'
        assert Payment.Provider.EPAYCO == 'epayco'
        assert Payment.Provider.PAYPAL == 'paypal'

    def test_protect_on_booking_delete(self, booking, customer):
        """Protect booking deletion while linked payments still exist."""
        Payment.objects.create(booking=booking, customer=customer)
        with pytest.raises(ProtectedError):
            booking.delete()
        assert Booking.objects.filter(pk=booking.pk).exists()

    def test_protect_on_customer_delete(self, booking, customer):
        """Protect customer deletion while linked payments still exist."""
        Payment.objects.create(booking=booking, customer=customer)
        with pytest.raises(ProtectedError):
            customer.delete()
        assert User.objects.filter(pk=customer.pk).exists()

    def test_metadata_json(self, booking, customer):
        """Persist and reload metadata JSON payload without mutation."""
        payment = Payment.objects.create(
            booking=booking, customer=customer, metadata={'key': 'value'}
        )
        payment.refresh_from_db()
        assert payment.metadata == {'key': 'value'}

    def test_ordering_by_created_at_desc(self, customer):
        """Return newest payments first when listing without explicit ordering."""
        pkg = Package.objects.create(title='Pkg2')
        s1 = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(hours=3),
            ends_at=FIXED_NOW + timedelta(hours=4),
        )
        s2 = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(hours=5),
            ends_at=FIXED_NOW + timedelta(hours=6),
        )
        b1 = Booking.objects.create(customer=customer, package=pkg, slot=s1)
        b2 = Booking.objects.create(customer=customer, package=pkg, slot=s2)
        p1 = Payment.objects.create(booking=b1, customer=customer)
        p2 = Payment.objects.create(booking=b2, customer=customer)
        ids = list(Payment.objects.values_list('id', flat=True))
        assert ids == [p2.id, p1.id]
