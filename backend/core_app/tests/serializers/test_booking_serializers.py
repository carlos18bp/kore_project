import pytest
from datetime import timedelta
from unittest.mock import MagicMock

from django.utils import timezone
from rest_framework.test import APIRequestFactory

from core_app.models import AvailabilitySlot, Booking, Package, Subscription, User
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

    def test_subscription_no_remaining_sessions_rejected(self, customer, package, future_slot):
        """Subscription with 0 remaining sessions is rejected (lines 114-117)."""
        now = timezone.now()
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=5, sessions_used=5,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={
                'package_id': package.id,
                'slot_id': future_slot.id,
                'subscription_id': sub.id,
            },
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'subscription_id' in serializer.errors

    def test_only_next_session_rule(self, customer, package):
        """Customer with existing future booking cannot book another (lines 150-158)."""
        now = timezone.now()
        slot1 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
        )
        Booking.objects.create(
            customer=customer, package=package, slot=slot1,
            status=Booking.Status.CONFIRMED,
        )
        slot2 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=4),
            ends_at=now + timedelta(hours=5),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': slot2.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        assert 'non_field_errors' in serializer.errors

    def test_overlapping_booking_rejected(self, customer, package):
        """Overlapping slot with active booking is rejected (lines 171-180)."""
        now = timezone.now()
        slot1 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=4),
        )
        Booking.objects.create(
            customer=customer, package=package, slot=slot1,
            status=Booking.Status.CONFIRMED,
        )
        # Overlapping slot: starts during slot1
        slot2 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=3),
            ends_at=now + timedelta(hours=5),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': slot2.id},
            context={'request': request},
        )
        assert not serializer.is_valid()
        # Either non_field_errors or slot_id depending on which check fires first
        assert 'non_field_errors' in serializer.errors or 'slot_id' in serializer.errors

    def test_validate_no_overlap_direct(self, customer, package):
        """Direct call to _validate_no_overlap covers line 178."""
        from rest_framework.exceptions import ValidationError as DRFValidationError
        now = timezone.now()
        slot1 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=4),
        )
        Booking.objects.create(
            customer=customer, package=package, slot=slot1,
            status=Booking.Status.CONFIRMED,
        )
        overlapping_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=3),
            ends_at=now + timedelta(hours=5),
        )
        with pytest.raises(DRFValidationError):
            BookingSerializer._validate_no_overlap(customer, overlapping_slot)

    def test_validate_without_slot_in_attrs(self, customer, package):
        """Validate with no slot in attrs skips slot checks (branch 106→109)."""
        request = _make_request(customer)
        serializer = BookingSerializer(data={}, context={'request': request})
        # Call validate directly with empty attrs (no slot)
        result = serializer.validate({})
        assert result == {}


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

    def test_create_with_subscription_decrements_sessions(self, customer, package, future_slot):
        """Create with subscription decrements sessions_used (lines 224-232)."""
        now = timezone.now()
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=10, sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={
                'package_id': package.id,
                'slot_id': future_slot.id,
                'subscription_id': sub.id,
            },
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors
        booking = serializer.save()

        assert booking.subscription is not None
        sub.refresh_from_db()
        assert sub.sessions_used == 3

    def test_create_race_condition_slot_becomes_blocked(self, customer, package):
        """Slot blocked between validate and create raises error (lines 213-219)."""
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={'package_id': package.id, 'slot_id': slot.id},
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors

        # Simulate race: block the slot after validation
        slot.is_blocked = True
        slot.save(update_fields=['is_blocked'])

        from rest_framework.exceptions import ValidationError
        with pytest.raises(ValidationError):
            serializer.save()

    def test_create_subscription_no_remaining_sessions_in_create(self, customer, package):
        """Subscription exhausted during atomic create (lines 225-229)."""
        now = timezone.now()
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=4),
            ends_at=now + timedelta(hours=5),
        )
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=5, sessions_used=4,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        request = _make_request(customer)
        serializer = BookingSerializer(
            data={
                'package_id': package.id,
                'slot_id': slot.id,
                'subscription_id': sub.id,
            },
            context={'request': request},
        )
        assert serializer.is_valid(), serializer.errors

        # Exhaust sessions after validation
        sub.sessions_used = 5
        sub.save(update_fields=['sessions_used'])

        from rest_framework.exceptions import ValidationError
        with pytest.raises(ValidationError):
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
