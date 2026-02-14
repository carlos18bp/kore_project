import pytest
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, Payment, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='pay_cust@example.com', password='p')


@pytest.fixture
def booking(db, customer):
    pkg = Package.objects.create(title='Pkg', price=Decimal('100000.00'))
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.mark.django_db
class TestPaymentModel:
    def test_defaults(self, booking, customer):
        payment = Payment.objects.create(booking=booking, customer=customer)
        assert payment.status == Payment.Status.PENDING
        assert payment.amount == Decimal('0.00')
        assert payment.currency == 'COP'
        assert payment.provider == ''
        assert payment.provider_reference == ''
        assert payment.metadata == {}
        assert payment.confirmed_at is None

    def test_str(self, booking, customer):
        payment = Payment.objects.create(booking=booking, customer=customer)
        assert f'Payment #{payment.pk}' in str(payment)
        assert 'pending' in str(payment)

    def test_status_choices(self):
        assert Payment.Status.PENDING == 'pending'
        assert Payment.Status.CONFIRMED == 'confirmed'
        assert Payment.Status.FAILED == 'failed'
        assert Payment.Status.CANCELED == 'canceled'
        assert Payment.Status.REFUNDED == 'refunded'

    def test_provider_choices(self):
        assert Payment.Provider.WOMPI == 'wompi'
        assert Payment.Provider.PAYU == 'payu'
        assert Payment.Provider.EPAYCO == 'epayco'
        assert Payment.Provider.PAYPAL == 'paypal'

    def test_protect_on_booking_delete(self, booking, customer):
        Payment.objects.create(booking=booking, customer=customer)
        with pytest.raises(Exception):
            booking.delete()

    def test_protect_on_customer_delete(self, booking, customer):
        Payment.objects.create(booking=booking, customer=customer)
        with pytest.raises(Exception):
            customer.delete()

    def test_metadata_json(self, booking, customer):
        payment = Payment.objects.create(
            booking=booking, customer=customer, metadata={'key': 'value'}
        )
        payment.refresh_from_db()
        assert payment.metadata == {'key': 'value'}

    def test_ordering_by_created_at_desc(self, customer):
        pkg = Package.objects.create(title='Pkg2')
        now = timezone.now()
        s1 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4))
        s2 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=5), ends_at=now + timedelta(hours=6))
        b1 = Booking.objects.create(customer=customer, package=pkg, slot=s1)
        b2 = Booking.objects.create(customer=customer, package=pkg, slot=s2)
        p1 = Payment.objects.create(booking=b1, customer=customer)
        p2 = Payment.objects.create(booking=b2, customer=customer)
        ids = list(Payment.objects.values_list('id', flat=True))
        assert ids == [p2.id, p1.id]
