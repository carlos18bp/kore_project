"""Extended booking view tests for cancel, reschedule, upcoming-reminder, and new validations."""

import pytest
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
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


# ----------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------

@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='bk_cust@example.com', password='p',
        first_name='Cust', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='bk_trainer@example.com', password='p',
        first_name='Trainer', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    return TrainerProfile.objects.create(
        user=trainer_user, specialty='Functional', location='Studio',
    )


@pytest.fixture
def package(db):
    return Package.objects.create(title='TestPkg', sessions_count=10, is_active=True)


@pytest.fixture
def subscription(customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=10, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


def _make_slot(trainer_profile=None, hours_ahead=48):
    now = timezone.now()
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
    def test_cancel_success(self, api_client, customer, package, trainer_profile, subscription):
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
        slot = _make_slot(hours_ahead=48)
        booking = _make_booking(customer, package, slot, stat=Booking.Status.CANCELED)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already canceled' in response.data['detail']

    def test_cancel_within_24h_fails(self, api_client, customer, package):
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
    def test_reschedule_success(self, api_client, customer, package, trainer_profile, subscription):
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
        assert new_booking.status == Booking.Status.CONFIRMED

    def test_reschedule_canceled_booking_fails(self, api_client, customer, package):
        slot = _make_slot(hours_ahead=48)
        booking = _make_booking(customer, package, slot, stat=Booking.Status.CANCELED)
        new_slot = _make_slot(hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': new_slot.pk}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reschedule_within_24h_fails(self, api_client, customer, package):
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
        slot = _make_slot(hours_ahead=48)
        slot.is_blocked = True
        slot.save()
        booking = _make_booking(customer, package, slot)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_slot_id': 999999}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ----------------------------------------------------------------
# Upcoming reminder tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestUpcomingReminder:
    def test_returns_upcoming_booking(self, api_client, customer, package):
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
        api_client.force_authenticate(user=customer)
        url = reverse('booking-upcoming-reminder')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT


# ----------------------------------------------------------------
# "Only next session" validation
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestOnlyNextSessionValidation:
    def test_cannot_book_two_future_sessions(self, api_client, customer, package):
        slot1 = _make_slot(hours_ahead=48)
        slot2 = _make_slot(hours_ahead=72)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-list')

        resp1 = api_client.post(url, {'package_id': package.id, 'slot_id': slot1.id}, format='json')
        assert resp1.status_code == status.HTTP_201_CREATED

        resp2 = api_client.post(url, {'package_id': package.id, 'slot_id': slot2.id}, format='json')
        assert resp2.status_code == status.HTTP_400_BAD_REQUEST


# ----------------------------------------------------------------
# Subscription filter
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestSubscriptionFilter:
    def test_filter_bookings_by_subscription(self, api_client, customer, package, subscription, trainer_profile):
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
    def test_update_requires_admin(self, api_client, customer, package):
        """update action requires IsAdminRole permission (line 48)."""
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
    def test_reschedule_to_inactive_slot_fails(self, api_client, customer, package):
        """Rescheduling to an inactive/blocked/past/booked slot returns 400 (line 205)."""
        old_slot = _make_slot(hours_ahead=48)
        old_slot.is_blocked = True
        old_slot.save()
        booking = _make_booking(customer, package, old_slot)

        # Create a new slot that is inactive
        now = timezone.now()
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
        assert 'not available' in response.data['detail']
