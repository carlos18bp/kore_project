import pytest
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APIRequestFactory

from core_app.models import AvailabilitySlot, Booking, Package, Payment, User
from core_app.serializers import PaymentSerializer


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='pay_s_cust@example.com', password='p')


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email='pay_s_admin@example.com', password='p',
        role=User.Role.ADMIN, is_staff=True,
    )


@pytest.fixture
def booking(db, customer):
    pkg = Package.objects.create(title='Pkg', price=Decimal('150000.00'), currency='COP')
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


def _make_request(user):
    factory = APIRequestFactory()
    request = factory.post('/fake/')
    request.user = user
    return request


@pytest.mark.django_db
class TestPaymentSerializerValidation:
    def test_customer_cannot_pay_other_users_booking(self, booking):
        other = User.objects.create_user(email='other@example.com', password='p')
        request = _make_request(other)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'booking_id' in serializer.errors

    def test_admin_can_pay_any_booking(self, booking, admin):
        request = _make_request(admin)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id},
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors

    def test_owner_can_pay_own_booking(self, booking, customer):
        request = _make_request(customer)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id},
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
class TestPaymentSerializerCreate:
    def test_auto_assigns_amount_and_currency_from_package(self, booking, customer):
        request = _make_request(customer)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        assert payment.amount == Decimal('150000.00')
        assert payment.currency == 'COP'
        assert payment.customer == customer

    def test_explicit_amount_overrides_package_price(self, booking, customer):
        request = _make_request(customer)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id, 'amount': '200000.00', 'currency': 'USD'},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        assert payment.amount == Decimal('200000.00')
        assert payment.currency == 'USD'

    def test_confirmed_status_sets_confirmed_at(self, booking, customer):
        request = _make_request(customer)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id, 'status': 'confirmed'},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        assert payment.status == Payment.Status.CONFIRMED
        assert payment.confirmed_at is not None

    def test_pending_status_does_not_set_confirmed_at(self, booking, customer):
        request = _make_request(customer)
        serializer = PaymentSerializer(
            data={'booking_id': booking.id, 'status': 'pending'},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        assert payment.status == Payment.Status.PENDING
        assert payment.confirmed_at is None
