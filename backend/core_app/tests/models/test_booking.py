import pytest
from datetime import timedelta
from django.db import IntegrityError
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='cust@example.com', password='p')


@pytest.fixture
def package(db):
    return Package.objects.create(title='Pkg', is_active=True)


@pytest.fixture
def slot(db):
    now = timezone.now()
    return AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )


@pytest.mark.django_db
class TestBookingModel:
    def test_defaults(self, customer, package, slot):
        booking = Booking.objects.create(customer=customer, package=package, slot=slot)
        assert booking.status == Booking.Status.PENDING
        assert booking.notes == ''
        assert booking.canceled_reason == ''

    def test_str(self, customer, package, slot):
        booking = Booking.objects.create(customer=customer, package=package, slot=slot)
        assert f'Booking #{booking.pk}' in str(booking)

    def test_status_choices(self):
        assert Booking.Status.PENDING == 'pending'
        assert Booking.Status.CONFIRMED == 'confirmed'
        assert Booking.Status.CANCELED == 'canceled'

    def test_slot_allows_multiple_bookings(self, customer, package, slot):
        Booking.objects.create(customer=customer, package=package, slot=slot)
        customer2 = User.objects.create_user(email='c2@example.com', password='p')
        Booking.objects.create(customer=customer2, package=package, slot=slot)
        assert Booking.objects.filter(slot=slot).count() == 2

    def test_protect_on_customer_delete(self, customer, package, slot):
        Booking.objects.create(customer=customer, package=package, slot=slot)
        with pytest.raises(Exception):
            customer.delete()

    def test_protect_on_package_delete(self, customer, package, slot):
        Booking.objects.create(customer=customer, package=package, slot=slot)
        with pytest.raises(Exception):
            package.delete()

    def test_protect_on_slot_delete(self, customer, package, slot):
        Booking.objects.create(customer=customer, package=package, slot=slot)
        with pytest.raises(Exception):
            slot.delete()

    def test_ordering_by_created_at_desc(self, customer, package):
        now = timezone.now()
        s1 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2))
        s2 = AvailabilitySlot.objects.create(starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4))
        b1 = Booking.objects.create(customer=customer, package=package, slot=s1)
        b2 = Booking.objects.create(customer=customer, package=package, slot=s2)
        ids = list(Booking.objects.values_list('id', flat=True))
        assert ids == [b2.id, b1.id]
