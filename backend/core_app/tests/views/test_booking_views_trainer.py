"""Tests for trainer-initiated booking flows (create / cancel / reschedule).

The trainer can act on behalf of any client assigned to them, and is exempt
from the 16h advance window (book) and 24h window (cancel / reschedule).
"""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Booking, Package, Subscription, TrainerProfile, User


FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)

# Thursday Jan 15 09:00 Bogota = 14:00 UTC — only 2h ahead. Within business hours
# (Mon-Fri 5-13h) but below the 16h customer cutoff. Trainer should be allowed,
# customer should be blocked.
NEAR_STARTS_AT = '2026-01-15T14:00:00Z'

# Saturday Jan 17 09:00 Bogota = 14:00 UTC — 50h ahead; always valid.
FAR_STARTS_AT_STR = '2026-01-17T14:00:00Z'
FAR_STARTS_AT = datetime(2026, 1, 17, 14, 0, tzinfo=dt_timezone.utc)
FAR_ENDS_AT = datetime(2026, 1, 17, 15, 0, tzinfo=dt_timezone.utc)

# 5h ahead → within the 24h cancel/reschedule window. Customer blocked, trainer not.
SOON_STARTS_AT = datetime(2026, 1, 15, 17, 0, tzinfo=dt_timezone.utc)
SOON_ENDS_AT = datetime(2026, 1, 15, 18, 0, tzinfo=dt_timezone.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='tr_booking_trainer@example.com', password='p',
        first_name='Tr', last_name='Booker', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer_user):
    return TrainerProfile.objects.create(user=trainer_user, specialty='General')


@pytest.fixture
def other_trainer_profile(db):
    u = User.objects.create_user(
        email='tr_other@example.com', password='p', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, specialty='General')


@pytest.fixture
def assigned_customer(trainer_profile):
    """Customer assigned to ``trainer_profile``."""
    return User.objects.create_user(
        email='tr_customer@example.com', password='p',
        first_name='Cust', last_name='Assigned', role=User.Role.CUSTOMER,
        assigned_trainer=trainer_profile,
    )


@pytest.fixture
def foreign_customer(other_trainer_profile):
    """Customer assigned to a DIFFERENT trainer."""
    return User.objects.create_user(
        email='tr_foreign@example.com', password='p',
        first_name='Cust', last_name='Foreign', role=User.Role.CUSTOMER,
        assigned_trainer=other_trainer_profile,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(title='Pkg', sessions_count=10, is_active=True)


@pytest.fixture
def subscription(assigned_customer, package):
    return Subscription.objects.create(
        customer=assigned_customer, package=package,
        sessions_total=10, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )


# ----------------------------------------------------------------
# CREATE — trainer books for client
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestTrainerCreateBooking:

    def test_trainer_books_for_assigned_client(
        self, api_client, trainer_user, assigned_customer, package, subscription,
    ):
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-list')
        response = api_client.post(
            url,
            {
                'package_id': package.id,
                'starts_at': FAR_STARTS_AT_STR,
                'customer_id': assigned_customer.id,
                'subscription_id': subscription.id,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        booking = Booking.objects.get()
        assert booking.customer_id == assigned_customer.id
        assert booking.trainer_id == trainer_user.trainer_profile.pk
        subscription.refresh_from_db()
        assert subscription.sessions_used == 1

    def test_trainer_books_inside_16h_window(
        self, api_client, trainer_user, assigned_customer, package, subscription,
    ):
        """Trainer is exempt from the customer-facing 16h advance rule."""
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-list')
        response = api_client.post(
            url,
            {
                'package_id': package.id,
                'starts_at': NEAR_STARTS_AT,
                'customer_id': assigned_customer.id,
                'subscription_id': subscription.id,
            },
            format='json',
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data

    def test_trainer_cannot_book_for_foreign_client(
        self, api_client, trainer_user, foreign_customer, package,
    ):
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-list')
        response = api_client.post(
            url,
            {
                'package_id': package.id,
                'starts_at': FAR_STARTS_AT_STR,
                'customer_id': foreign_customer.id,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'customer_id' in response.data
        assert Booking.objects.count() == 0

    def test_trainer_requires_customer_id(
        self, api_client, trainer_user, package,
    ):
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-list')
        response = api_client.post(
            url,
            {'package_id': package.id, 'starts_at': FAR_STARTS_AT_STR},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'customer_id' in response.data

    def test_trainer_subscription_must_belong_to_target_customer(
        self, api_client, trainer_user, assigned_customer, foreign_customer, package,
    ):
        """Defense in depth: subscription.customer must match payload customer_id."""
        foreign_sub = Subscription.objects.create(
            customer=foreign_customer, package=package,
            sessions_total=10, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
        )
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-list')
        response = api_client.post(
            url,
            {
                'package_id': package.id,
                'starts_at': FAR_STARTS_AT_STR,
                'customer_id': assigned_customer.id,
                'subscription_id': foreign_sub.id,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'subscription_id' in response.data


# ----------------------------------------------------------------
# CANCEL — trainer cancels client booking
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestTrainerCancelBooking:

    def _booking(self, customer, package, trainer_profile, subscription,
                 starts_at=FAR_STARTS_AT, ends_at=FAR_ENDS_AT):
        return Booking.objects.create(
            customer=customer, package=package, trainer=trainer_profile,
            subscription=subscription, status=Booking.Status.CONFIRMED,
            starts_at=starts_at, ends_at=ends_at,
        )

    def test_trainer_cancels_inside_24h_window(
        self, api_client, trainer_user, trainer_profile, assigned_customer,
        package, subscription,
    ):
        """Trainer is exempt from the customer-facing 24h cancel cutoff."""
        booking = self._booking(
            assigned_customer, package, trainer_profile, subscription,
            starts_at=SOON_STARTS_AT, ends_at=SOON_ENDS_AT,
        )
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-cancel', args=[booking.pk])

        response = api_client.post(url, {'canceled_reason': 'Trainer-side'}, format='json')

        assert response.status_code == status.HTTP_200_OK, response.data
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED
        subscription.refresh_from_db()
        assert subscription.sessions_used == -1  # was 0; refund -> -1

    def test_trainer_cannot_cancel_foreign_booking(
        self, api_client, trainer_user, other_trainer_profile, foreign_customer, package,
    ):
        """Bookings whose trainer is someone else are invisible to this trainer."""
        booking = self._booking(
            foreign_customer, package, other_trainer_profile, subscription=None,
        )
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-cancel', args=[booking.pk])

        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ----------------------------------------------------------------
# RESCHEDULE — trainer reschedules client booking
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestTrainerRescheduleBooking:

    def test_trainer_reschedules_inside_24h_window(
        self, api_client, trainer_user, trainer_profile, assigned_customer,
        package, subscription,
    ):
        booking = Booking.objects.create(
            customer=assigned_customer, package=package, trainer=trainer_profile,
            subscription=subscription, status=Booking.Status.CONFIRMED,
            starts_at=SOON_STARTS_AT, ends_at=SOON_ENDS_AT,
        )
        api_client.force_authenticate(user=trainer_user)
        url = reverse('booking-reschedule', args=[booking.pk])

        # New slot only 2h ahead — also inside customer cutoff; trainer exempt.
        response = api_client.post(url, {'new_starts_at': NEAR_STARTS_AT}, format='json')

        assert response.status_code == status.HTTP_201_CREATED, response.data
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED
        # Net effect on sessions_used: cancel old (-1) + create new (+1) = 0.
        subscription.refresh_from_db()
        assert subscription.sessions_used == 0


# ----------------------------------------------------------------
# Customer flow regression — make sure rules still apply
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCustomerFlowUnchanged:

    def test_customer_cannot_book_inside_16h_window(
        self, api_client, trainer_profile, package,
    ):
        cust = User.objects.create_user(
            email='reg_customer@example.com', password='p',
            role=User.Role.CUSTOMER, assigned_trainer=trainer_profile,
        )
        api_client.force_authenticate(user=cust)
        url = reverse('booking-list')

        response = api_client.post(
            url, {'package_id': package.id, 'starts_at': NEAR_STARTS_AT},
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'starts_at' in response.data

    def test_customer_cannot_cancel_inside_24h_window(
        self, api_client, trainer_profile, package,
    ):
        cust = User.objects.create_user(
            email='reg_cust_cancel@example.com', password='p',
            role=User.Role.CUSTOMER, assigned_trainer=trainer_profile,
        )
        booking = Booking.objects.create(
            customer=cust, package=package, trainer=trainer_profile,
            status=Booking.Status.CONFIRMED,
            starts_at=SOON_STARTS_AT, ends_at=SOON_ENDS_AT,
        )
        api_client.force_authenticate(user=cust)
        url = reverse('booking-cancel', args=[booking.pk])

        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'anticipación' in response.data['detail']

    def test_customer_payload_customer_id_is_ignored(
        self, api_client, trainer_profile, package,
    ):
        """Customers cannot book on behalf of another user even by passing customer_id."""
        cust_a = User.objects.create_user(
            email='reg_cust_a@example.com', password='p',
            role=User.Role.CUSTOMER, assigned_trainer=trainer_profile,
        )
        cust_b = User.objects.create_user(
            email='reg_cust_b@example.com', password='p',
            role=User.Role.CUSTOMER, assigned_trainer=trainer_profile,
        )
        api_client.force_authenticate(user=cust_a)
        url = reverse('booking-list')

        response = api_client.post(
            url,
            {
                'package_id': package.id,
                'starts_at': FAR_STARTS_AT_STR,
                'customer_id': cust_b.id,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        booking = Booking.objects.get()
        assert booking.customer_id == cust_a.id
