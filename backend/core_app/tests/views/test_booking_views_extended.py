"""Extended booking view tests for cancel, reschedule, upcoming-reminder, and new validations."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    Subscription,
    TrainerProfile,
    User,
)
from core_app.tests.helpers import get_results

FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze timezone.now to a fixed instant for deterministic booking tests."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


# ----------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------

@pytest.fixture
def customer(db):
    """Create a customer user for booking API scenarios."""
    return User.objects.create_user(
        email='bk_cust@example.com', password='p',
        first_name='Cust', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer_user(db):
    """Create a trainer user linked to availability slots."""
    return User.objects.create_user(
        email='bk_trainer@example.com', password='p',
        first_name='Trainer', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    """Create a trainer profile associated with the trainer user."""
    return TrainerProfile.objects.create(
        user=trainer_user, specialty='Functional', location='Studio',
    )


@pytest.fixture
def package(db):
    """Create an active package used for booking creation tests."""
    return Package.objects.create(title='TestPkg', sessions_count=10, is_active=True)


@pytest.fixture
def subscription(customer, package):
    """Create an active subscription consumed by booking and reschedule flows."""
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=10, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


def _make_slot(trainer_profile=None, hours_ahead=48):
    now = FIXED_NOW
    return AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=hours_ahead),
        ends_at=now + timedelta(hours=hours_ahead + 1),
        trainer=trainer_profile,
    )


def _make_booking(customer, package, slot, trainer=None, subscription=None, stat=Booking.Status.CONFIRMED):
    return Booking.objects.create(
        customer=customer, package=package, slot=slot,
        trainer=trainer, subscription=subscription, status=stat,
    )


# ----------------------------------------------------------------
# Cancel tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCancelAction:
    """Covers booking cancel endpoint outcomes and guard rails."""

    def test_cancel_success(self, api_client, customer, package, trainer_profile, subscription):
        """Cancels a booking, unblocks the slot, and restores subscription usage."""
        slot = _make_slot(trainer_profile, hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot, trainer_profile, subscription)
        subscription.sessions_used = 1
        subscription.save()

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url, {'canceled_reason': 'Personal'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED
        assert booking.canceled_reason == 'Personal'

        slot.refresh_from_db()
        assert slot.is_blocked is False

        subscription.refresh_from_db()
        assert subscription.sessions_used == 0

    def test_cancel_already_canceled(self, api_client, customer, package):
        """Cancel endpoint rejects bookings already in canceled status."""
        slot = _make_slot(hours_ahead=48)
        booking = _make_booking(customer, package, slot, stat=Booking.Status.CANCELED)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'ya está cancelada' in response.data['detail']

    def test_cancel_within_24h_fails(self, api_client, customer, package):
        """Cancel endpoint rejects bookings starting in less than 24 hours."""
        slot = _make_slot(hours_ahead=12)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert '24' in response.data['detail']

    def test_cancel_without_subscription(self, api_client, customer, package):
        """Cancel booking without subscription skips session restore (branch 128->133)."""
        slot = _make_slot(hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot, subscription=None)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url, {'canceled_reason': 'No sub'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED
        slot.refresh_from_db()
        assert slot.is_blocked is False


# ----------------------------------------------------------------
# Reschedule tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestRescheduleAction:
    """Covers reschedule endpoint validation and success scenarios."""

    def test_reschedule_success(self, api_client, customer, package, trainer_profile, subscription):
        """Reschedules booking to a new slot and creates a pending replacement booking."""
        old_slot = _make_slot(trainer_profile, hours_ahead=48)
        old_slot.is_blocked = True
        old_slot.save()
        booking = _make_booking(customer, package, old_slot, trainer_profile, subscription)

        new_slot = _make_slot(trainer_profile, hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_201_CREATED

        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED

        old_slot.refresh_from_db()
        assert old_slot.is_blocked is False

        new_slot.refresh_from_db()
        assert new_slot.is_blocked is True

        new_booking = Booking.objects.filter(slot=new_slot).first()
        assert new_booking is not None
        assert new_booking.status == Booking.Status.PENDING

    def test_reschedule_success_without_subscription(self, api_client, customer, package, trainer_profile):
        """Reschedule succeeds for bookings without subscription and keeps replacement subscription empty."""
        old_slot = _make_slot(trainer_profile, hours_ahead=48)
        old_slot.is_blocked = True
        old_slot.save()
        booking = _make_booking(customer, package, old_slot, trainer_profile, subscription=None)

        new_slot = _make_slot(trainer_profile, hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_201_CREATED

        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED

        replacement_booking = Booking.objects.get(slot=new_slot)
        assert replacement_booking.status == Booking.Status.PENDING
        assert replacement_booking.subscription is None

    def test_reschedule_canceled_booking_fails(self, api_client, customer, package):
        """Reschedule endpoint rejects bookings already canceled."""
        slot = _make_slot(hours_ahead=48)
        booking = _make_booking(customer, package, slot, stat=Booking.Status.CANCELED)
        new_slot = _make_slot(hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reschedule_within_24h_fails(self, api_client, customer, package):
        """Reschedule endpoint rejects bookings starting within the 24-hour window."""
        slot = _make_slot(hours_ahead=12)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)
        new_slot = _make_slot(hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reschedule_missing_new_slot_id(self, api_client, customer, package):
        """Reschedule endpoint requires new_slot_id in the payload."""
        slot = _make_slot(hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'new_slot_id' in response.data['detail']

    def test_reschedule_nonexistent_slot(self, api_client, customer, package):
        """Reschedule endpoint returns 404 when new_slot_id does not exist."""
        slot = _make_slot(hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': 999999}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_reschedule_rejects_trainer_buffer_conflict(self, api_client, customer, package, trainer_profile):
        """Reschedule rejects slots that violate 45-minute trainer travel buffer."""
        old_slot = _make_slot(trainer_profile, hours_ahead=48)
        old_slot.is_blocked = True
        old_slot.save()
        booking = _make_booking(customer, package, old_slot, trainer_profile)

        other_customer = User.objects.create_user(
            email='buffer_other@example.com', password='p', role=User.Role.CUSTOMER,
        )
        existing_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(hours=72),
            ends_at=FIXED_NOW + timedelta(hours=73),
            trainer=trainer_profile,
            is_blocked=True,
        )
        _make_booking(other_customer, package, existing_slot, trainer_profile, stat=Booking.Status.CONFIRMED)

        conflicting_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(hours=73, minutes=30),
            ends_at=FIXED_NOW + timedelta(hours=74, minutes=30),
            trainer=trainer_profile,
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': conflicting_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert '45 minutos' in response.data['detail']

    def test_reschedule_before_last_session_fails(self, api_client, customer, package, trainer_profile, subscription):
        """Reschedule to a slot before last session ends is rejected."""
        now = FIXED_NOW
        # First booking: 72 hours ahead
        slot1 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=72),
            ends_at=now + timedelta(hours=73),
            trainer=trainer_profile,
            is_blocked=True,
        )
        _make_booking(customer, package, slot1, trainer_profile, subscription)

        # Second booking (to reschedule): 96 hours ahead
        slot2 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=96),
            ends_at=now + timedelta(hours=97),
            trainer=trainer_profile,
            is_blocked=True,
        )
        booking2 = _make_booking(customer, package, slot2, trainer_profile, subscription)

        # Try to reschedule booking2 to 48 hours ahead (before booking1 ends)
        new_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=48),
            ends_at=now + timedelta(hours=49),
            trainer=trainer_profile,
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking2.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'sesión anterior' in response.data['detail']

    def test_reschedule_after_next_session_fails(self, api_client, customer, package, trainer_profile, subscription):
        """Reschedule to a slot that ends after the next session starts is rejected."""
        now = FIXED_NOW
        # Previous booking: 48 hours ahead
        slot1 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=48),
            ends_at=now + timedelta(hours=49),
            trainer=trainer_profile,
            is_blocked=True,
        )
        _make_booking(customer, package, slot1, trainer_profile, subscription)

        # Booking to reschedule: 72 hours ahead
        slot2 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=72),
            ends_at=now + timedelta(hours=73),
            trainer=trainer_profile,
            is_blocked=True,
        )
        booking2 = _make_booking(customer, package, slot2, trainer_profile, subscription)

        # Next booking: 96 hours ahead
        slot3 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=96),
            ends_at=now + timedelta(hours=97),
            trainer=trainer_profile,
            is_blocked=True,
        )
        _make_booking(customer, package, slot3, trainer_profile, subscription)

        # Attempt to reschedule booking2 to a slot that ends after slot3 starts
        new_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=95),
            ends_at=now + timedelta(hours=97),
            trainer=trainer_profile,
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking2.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'siguiente sesión' in response.data['detail']

    def test_reschedule_after_last_session_success(self, api_client, customer, package, trainer_profile, subscription):
        """Reschedule succeeds when there is no next session constraint."""
        now = FIXED_NOW
        # Previous booking: 24 hours ahead
        slot1 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=24),
            ends_at=now + timedelta(hours=25),
            trainer=trainer_profile,
            is_blocked=True,
        )
        _make_booking(customer, package, slot1, trainer_profile, subscription)

        # Booking to reschedule: 48 hours ahead
        slot2 = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=48),
            ends_at=now + timedelta(hours=49),
            trainer=trainer_profile,
            is_blocked=True,
        )
        booking2 = _make_booking(customer, package, slot2, trainer_profile, subscription)

        # Reschedule to 74 hours ahead (no next session exists)
        new_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=74),
            ends_at=now + timedelta(hours=75),
            trainer=trainer_profile,
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking2.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_201_CREATED


# ----------------------------------------------------------------
# Upcoming reminder tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestUpcomingReminder:
    """Covers upcoming reminder endpoint behavior with and without future bookings."""

    def test_returns_upcoming_booking(self, api_client, customer, package):
        """Upcoming reminder returns the next scheduled booking when present."""
        slot = _make_slot(hours_ahead=24)
        slot.is_blocked = True
        slot.save()
        _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-upcoming-reminder')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] is not None

    def test_returns_204_when_no_upcoming(self, api_client, customer):
        """Upcoming reminder returns 204 when customer has no upcoming bookings."""
        api_client.force_authenticate(user=customer)
        url = reverse('booking-upcoming-reminder')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert response.content == b''


# ----------------------------------------------------------------
# Reservas futuras múltiples (secuenciales)
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestOnlyNextSessionValidation:
    """Validates customer can hold sequential future bookings."""

    def test_can_book_two_future_sessions_sequentially(self, api_client, customer, package):
        """Allows creating two sequential future bookings for the same customer."""
        slot1 = _make_slot(hours_ahead=48)
        slot2 = _make_slot(hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-list')

        resp1 = api_client.post(url, {'package_id': package.id, 'slot_id': slot1.id}, format='json')
        assert resp1.status_code == status.HTTP_201_CREATED

        resp2 = api_client.post(url, {'package_id': package.id, 'slot_id': slot2.id}, format='json')
        assert resp2.status_code == status.HTTP_201_CREATED

        assert Booking.objects.filter(customer=customer).count() == 2
        slot1.refresh_from_db()
        slot2.refresh_from_db()
        assert slot1.is_blocked is True
        assert slot2.is_blocked is True


# ----------------------------------------------------------------
# Subscription filter
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestSubscriptionFilter:
    """Ensures booking list filtering by subscription id works as expected."""

    def test_filter_bookings_by_subscription(self, api_client, customer, package, subscription, trainer_profile):
        """Returns only bookings linked to the requested subscription filter value."""
        slot1 = _make_slot(trainer_profile, hours_ahead=48)
        slot1.is_blocked = True
        slot1.save()
        _make_booking(customer, package, slot1, trainer_profile, subscription)

        slot2 = _make_slot(trainer_profile, hours_ahead=72)
        slot2.is_blocked = True
        slot2.save()
        _make_booking(customer, package, slot2, trainer_profile, None)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-list')
        response = api_client.get(url, {'subscription': subscription.pk})

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        assert len(results) == 1


# ----------------------------------------------------------------
# Permission tests (update/partial_update/destroy require admin)
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestBookingAdminPermissions:
    """Ensures booking mutation endpoints remain admin-protected."""

    def test_update_requires_admin(self, api_client, customer, package):
        """Update action requires IsAdminRole permission (line 48)."""
        slot = _make_slot(hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-detail', args=[booking.pk])
        response = api_client.put(url, {
            'package_id': package.id,
            'slot_id': slot.id,
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_partial_update_requires_admin(self, api_client, customer, package):
        """partial_update action requires IsAdminRole permission (line 48)."""
        slot = _make_slot(hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-detail', args=[booking.pk])
        response = api_client.patch(url, {'status': 'canceled'}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN


# ----------------------------------------------------------------
# Reschedule – unavailable new slot
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestRescheduleUnavailableSlot:
    """Covers reschedule attempts to slots that are not currently bookable."""

    def test_reschedule_to_inactive_slot_fails(self, api_client, customer, package):
        """Rescheduling to an inactive/blocked/past/booked slot returns 400 (line 205)."""
        old_slot = _make_slot(hours_ahead=48)
        old_slot.is_blocked = True
        old_slot.save()
        booking = _make_booking(customer, package, old_slot)

        # Create a new slot that is inactive
        now = FIXED_NOW
        inactive_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=72),
            ends_at=now + timedelta(hours=73),
            is_active=False,
            is_blocked=False,
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': inactive_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'no está disponible' in response.data['detail']
