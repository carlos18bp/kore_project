"""Model tests for booking defaults, protections, and ordering behavior."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.db.models import ProtectedError

from core_app.models import Booking, Package, User

FIXED_NOW = datetime(2026, 1, 15, 10, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def customer(db):
    """Create a customer user used by booking model tests."""
    return User.objects.create_user(email='cust@example.com', password='p')


@pytest.fixture
def package(db):
    """Create an active package fixture linked to bookings."""
    return Package.objects.create(title='Pkg', is_active=True)


@pytest.mark.django_db
class TestBookingModel:
    """Booking model defaults, enums, relation constraints, and ordering."""

    def test_defaults(self, customer, package):
        """Apply expected default status and empty text fields on creation."""
        booking = Booking.objects.create(
            customer=customer, package=package,
            starts_at=FIXED_NOW + timedelta(hours=1),
            ends_at=FIXED_NOW + timedelta(hours=2),
        )
        assert booking.status == Booking.Status.PENDING
        assert booking.notes == ''
        assert booking.canceled_reason == ''

    def test_str(self, customer, package):
        """Render booking string representation with the booking identifier."""
        booking = Booking.objects.create(
            customer=customer, package=package,
            starts_at=FIXED_NOW + timedelta(hours=1),
            ends_at=FIXED_NOW + timedelta(hours=2),
        )
        assert f'Booking #{booking.pk}' in str(booking)

    def test_status_choices(self):
        """Expose expected booking status enum values."""
        assert Booking.Status.PENDING == 'pending'
        assert Booking.Status.CONFIRMED == 'confirmed'
        assert Booking.Status.CANCELED == 'canceled'

    def test_protect_on_customer_delete(self, customer, package):
        """Protect customer deletion while related bookings remain."""
        Booking.objects.create(
            customer=customer, package=package,
            starts_at=FIXED_NOW + timedelta(hours=1),
            ends_at=FIXED_NOW + timedelta(hours=2),
        )
        with pytest.raises(ProtectedError):
            customer.delete()
        assert User.objects.filter(pk=customer.pk).exists()

    def test_protect_on_package_delete(self, customer, package):
        """Protect package deletion while related bookings remain."""
        Booking.objects.create(
            customer=customer, package=package,
            starts_at=FIXED_NOW + timedelta(hours=1),
            ends_at=FIXED_NOW + timedelta(hours=2),
        )
        with pytest.raises(ProtectedError):
            package.delete()
        assert Package.objects.filter(pk=package.pk).exists()

    def test_ordering_by_created_at_desc(self, customer, package):
        """Return latest booking first when querying with default ordering."""
        b1 = Booking.objects.create(
            customer=customer, package=package,
            starts_at=FIXED_NOW + timedelta(hours=1),
            ends_at=FIXED_NOW + timedelta(hours=2),
        )
        b2 = Booking.objects.create(
            customer=customer, package=package,
            starts_at=FIXED_NOW + timedelta(hours=3),
            ends_at=FIXED_NOW + timedelta(hours=4),
        )
        ids = list(Booking.objects.values_list('id', flat=True))
        assert ids == [b2.id, b1.id]
