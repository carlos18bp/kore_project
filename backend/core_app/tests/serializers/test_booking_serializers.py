import pytest
from datetime import timedelta
from unittest.mock import MagicMock

from django.utils import timezone
from rest_framework.test import APIRequestFactory

from core_app.models import AvailabilitySlot, Booking, Package, User
from core_app.serializers import BookingSerializer


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='book_s_cust@example.com', password='p')


@pytest.fixture
def package(db):
    return Package.objects.create(title='Pkg', is_active=True)


@pytest.fixture
def future_slot(db):
    now = timezone.now()
    return AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=2),
        ends_at=now + timedelta(hours=3),
    )


def _make_request(user):
    factory = APIRequestFactory()
    request = factory.post('/fake/')
    request.user = user
    return request


@pytest.mark.django_db
class TestBookingSerializerValidation:
    def test_valid_data(self, customer, package, future_slot):
        request = _make_request(customer)
        data = {'package_id': package.id, 'slot_id': future_slot.id}
        serializer = BookingSerializer(data=data, context={'request': request})
        assert serializer.is_valid(), serializer.errors

    def test_inactive_slot_rejected(self, customer, package):
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3),
            is_active=False,
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': slot.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'slot_id' in serializer.errors

    def test_blocked_slot_rejected(self, customer, package):
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3),
            is_blocked=True,
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': slot.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'slot_id' in serializer.errors

    def test_past_slot_rejected(self, customer, package):
        past = timezone.now() - timedelta(hours=2)
        slot = AvailabilitySlot.objects.create(
            starts_at=past, ends_at=past + timedelta(hours=1),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': slot.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'slot_id' in serializer.errors

    def test_already_booked_slot_rejected(self, customer, package, future_slot):
        Booking.objects.create(customer=customer, package=package, slot=future_slot)
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': future_slot.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'slot_id' in serializer.errors


@pytest.mark.django_db
class TestBookingSerializerCreate:
    def test_create_blocks_slot_and_assigns_customer(self, customer, package, future_slot):
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': future_slot.id},
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors
        booking = serializer.save()

        assert booking.customer == customer
        assert booking.package == package
        assert booking.slot == future_slot
        assert booking.status == Booking.Status.CONFIRMED

        future_slot.refresh_from_db()
        assert future_slot.is_blocked is True

    def test_create_without_auth_raises(self, package, future_slot):
        anon = MagicMock()
        anon.is_authenticated = False
        request = _make_request(anon)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': future_slot.id},
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors
        with pytest.raises(Exception):
            serializer.save()

    def test_read_representation_nests_package_and_slot(self, customer, package, future_slot):
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': future_slot.id},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        output = BookingSerializer(booking).data
        assert isinstance(output['package'], dict)
        assert output['package']['id'] == package.id
        assert isinstance(output['slot'], dict)
        assert output['slot']['id'] == future_slot.id
