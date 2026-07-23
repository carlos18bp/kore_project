"""Extended booking view tests for cancel, reschedule, upcoming-reminder, and new validations."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import (
    Booking,
    Package,
    Subscription,
    SubscriptionGuest,
    TrainerProfile,
    User,
)
from core_app.models.session_grant import SessionGrant
from core_app.tests.helpers import get_results


FIXED_NOW = datetime(2026, 1, 15, 12, 0, tzinfo=dt_timezone.utc)

# Saturday Jan 17 09:00 Bogota = 14:00 UTC — 50h ahead; valid schedule slot for bookings >24h out
BOOKING_STARTS_AT = datetime(2026, 1, 17, 14, 0, tzinfo=dt_timezone.utc)
BOOKING_ENDS_AT = datetime(2026, 1, 17, 15, 0, tzinfo=dt_timezone.utc)

# Monday Jan 19 05:00 Bogota = 10:00 UTC — 70h ahead; valid target for reschedule
NEW_STARTS_AT_STR = '2026-01-19T10:00:00Z'
NEW_STARTS_AT = datetime(2026, 1, 19, 10, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def assigned_trainer(db):
    u = User.objects.create_user(
        email='ext_default_trainer@example.com', password='p', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, specialty='General')


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


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
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=10, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


def _make_booking(customer, package, trainer=None, subscription=None,
                  stat=Booking.Status.CONFIRMED,
                  starts_at=BOOKING_STARTS_AT, ends_at=BOOKING_ENDS_AT):
    return Booking.objects.create(
        customer=customer, package=package,
        trainer=trainer, subscription=subscription, status=stat,
        starts_at=starts_at, ends_at=ends_at,
    )


# ----------------------------------------------------------------
# Cancel tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCancelAction:

    def test_cancel_success(self, api_client, customer, package, trainer_profile, subscription):
        booking = _make_booking(customer, package, trainer_profile, subscription)
        subscription.sessions_used = 1
        subscription.save()

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url, {'canceled_reason': 'Personal'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED
        assert booking.canceled_reason == 'Personal'
        subscription.refresh_from_db()
        assert subscription.sessions_used == 0

    def test_cancel_already_canceled(self, api_client, customer, package):
        booking = _make_booking(customer, package, stat=Booking.Status.CANCELED)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'ya está cancelada' in response.data['detail']

    def test_cancel_within_24h_fails(self, api_client, customer, package):
        booking = _make_booking(
            customer, package,
            starts_at=FIXED_NOW + timedelta(hours=12),
            ends_at=FIXED_NOW + timedelta(hours=13),
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert '24' in response.data['detail']

    def test_cancel_without_subscription(self, api_client, customer, package):
        booking = _make_booking(customer, package, subscription=None)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url, {'canceled_reason': 'No sub'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED

    @pytest.mark.parametrize('url_name', ['booking-cancel', 'booking-reschedule'])
    def test_unknown_booking_returns_404(self, api_client, customer, url_name):
        """An id that matches no booking yields 404 on the custom actions."""
        api_client.force_authenticate(user=customer)

        url = reverse(url_name, args=[999999])
        response = api_client.post(url, {'new_starts_at': NEW_STARTS_AT_STR}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_cancel_by_unrelated_customer_returns_404(self, api_client, customer, package):
        """Another customer cannot see, hence cannot cancel, someone else's booking."""
        booking = _make_booking(customer, package)
        stranger = User.objects.create_user(
            email='bk_stranger@example.com', password='p', role=User.Role.CUSTOMER,
        )

        api_client.force_authenticate(user=stranger)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CONFIRMED

    def test_cancel_restores_session_grant_usage(self, api_client, customer, package):
        """Canceling a grant-backed booking refunds the session to the grant."""
        grant = SessionGrant.objects.create(
            customer=customer, sessions_total=4, sessions_used=1,
            expires_at=FIXED_NOW + timedelta(days=30),
        )
        booking = _make_booking(customer, package)
        booking.session_grant = grant
        booking.save(update_fields=['session_grant'])

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[booking.pk])
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_200_OK
        grant.refresh_from_db()
        assert grant.sessions_used == 0

    def test_cancel_on_duo_subscription_cancels_guest_booking(
        self, api_client, customer, package, trainer_profile, subscription,
    ):
        """When the host cancels, the guest's parallel booking is canceled too."""
        guest = User.objects.create_user(
            email='bk_duo_guest@example.com', password='p', role=User.Role.CUSTOMER,
        )
        SubscriptionGuest.objects.create(
            subscription=subscription, guest=guest,
            invited_email=guest.email, token='duo-cancel-token',
            status=SubscriptionGuest.STATUS_ACCEPTED,
        )
        subscription.sessions_used = 1
        subscription.save(update_fields=['sessions_used'])
        host_booking = _make_booking(customer, package, trainer_profile, subscription)
        guest_booking = _make_booking(guest, package, trainer_profile, subscription=None,
                                      stat=Booking.Status.PENDING)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-cancel', args=[host_booking.pk])
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_200_OK
        guest_booking.refresh_from_db()
        assert guest_booking.status == Booking.Status.CANCELED
        assert guest_booking.canceled_reason == 'Sesión cancelada por el anfitrión.'


# ----------------------------------------------------------------
# Reschedule tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestRescheduleAction:

    def test_reschedule_success(self, api_client, customer, package, trainer_profile, subscription):
        booking = _make_booking(customer, package, trainer_profile, subscription)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': NEW_STARTS_AT_STR}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED

        new_booking = Booking.objects.get(pk=response.data['id'])
        assert new_booking.starts_at == NEW_STARTS_AT
        assert new_booking.status == Booking.Status.PENDING

    def test_reschedule_success_without_subscription(self, api_client, customer, package, trainer_profile):
        booking = _make_booking(customer, package, trainer_profile, subscription=None)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': NEW_STARTS_AT_STR}, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELED

        new_booking = Booking.objects.get(pk=response.data['id'])
        assert new_booking.status == Booking.Status.PENDING
        assert new_booking.subscription is None

    def test_reschedule_canceled_booking_fails(self, api_client, customer, package):
        booking = _make_booking(customer, package, stat=Booking.Status.CANCELED)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': NEW_STARTS_AT_STR}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reschedule_within_24h_fails(self, api_client, customer, package):
        booking = _make_booking(
            customer, package,
            starts_at=FIXED_NOW + timedelta(hours=12),
            ends_at=FIXED_NOW + timedelta(hours=13),
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': NEW_STARTS_AT_STR}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reschedule_missing_new_starts_at(self, api_client, customer, package):
        booking = _make_booking(customer, package)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'new_starts_at' in response.data['detail']

    def test_reschedule_invalid_datetime_format(self, api_client, customer, package, trainer_profile):
        booking = _make_booking(customer, package, trainer_profile)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': 'not-a-date'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_reschedule_unavailable_start_time(self, api_client, customer, package, trainer_profile):
        """Rescheduling to an off-grid time returns 400 unavailable."""
        booking = _make_booking(customer, package, trainer_profile)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': '2026-01-19T10:07:00Z'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'no está disponible' in response.data['detail']

    def test_reschedule_rejects_trainer_buffer_conflict(self, api_client, customer, package, trainer_profile):
        """Rescheduling to a time within 45-min buffer of an existing booking fails."""
        booking = _make_booking(customer, package, trainer_profile)

        other_customer = User.objects.create_user(
            email='buffer_other@example.com', password='p', role=User.Role.CUSTOMER,
        )
        # Existing booking ending 30 min into NEW_STARTS_AT session window (triggers buffer overlap)
        Booking.objects.create(
            customer=other_customer, package=package, trainer=trainer_profile,
            status=Booking.Status.CONFIRMED,
            starts_at=NEW_STARTS_AT - timedelta(minutes=30),
            ends_at=NEW_STARTS_AT + timedelta(minutes=30),
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': NEW_STARTS_AT_STR}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'no está disponible' in response.data['detail']

    def test_reschedule_beyond_30_day_horizon_rejected(self, api_client, customer, package, trainer_profile):
        """Rescheduling to a date beyond the 30-day booking horizon fails."""
        booking = _make_booking(customer, package, trainer_profile)

        # Monday Feb 16 05:00 Bogota = 10:00 UTC — 32 days ahead, beyond 30-day horizon
        api_client.force_authenticate(user=customer)
        url = reverse('booking-reschedule', args=[booking.pk])
        response = api_client.post(url, {'new_starts_at': '2026-02-16T10:00:00Z'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'no está disponible' in response.data['detail']


# ----------------------------------------------------------------
# Upcoming reminder tests
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestUpcomingReminder:

    def test_returns_upcoming_booking(self, api_client, customer, package):
        _make_booking(customer, package,
                      starts_at=FIXED_NOW + timedelta(hours=24),
                      ends_at=FIXED_NOW + timedelta(hours=25))

        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('booking-upcoming-reminder'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] is not None

    def test_returns_pending_future_booking(self, api_client, customer, package):
        booking = _make_booking(customer, package,
                                stat=Booking.Status.PENDING,
                                starts_at=FIXED_NOW + timedelta(hours=24),
                                ends_at=FIXED_NOW + timedelta(hours=25))

        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('booking-upcoming-reminder'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == booking.id

    def test_excludes_canceled_future_booking(self, api_client, customer, package):
        _make_booking(customer, package,
                      stat=Booking.Status.CANCELED,
                      starts_at=FIXED_NOW + timedelta(hours=24),
                      ends_at=FIXED_NOW + timedelta(hours=25))

        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('booking-upcoming-reminder'))

        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_returns_204_when_no_upcoming(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('booking-upcoming-reminder'))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert response.content == b''


# ----------------------------------------------------------------
# Reservas futuras múltiples (secuenciales)
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestOnlyNextSessionValidation:

    def test_can_book_two_future_sessions_sequentially(self, api_client, customer, package, assigned_trainer):
        """Allows creating two non-conflicting future bookings for the same customer."""
        customer.assigned_trainer = assigned_trainer
        customer.save(update_fields=['assigned_trainer'])

        api_client.force_authenticate(user=customer)
        url = reverse('booking-list')

        # Saturday Jan 17 09:00 Bogota = 14:00 UTC (50h ahead)
        resp1 = api_client.post(url, {'package_id': package.id, 'starts_at': '2026-01-17T14:00:00Z'}, format='json')
        assert resp1.status_code == status.HTTP_201_CREATED

        # Monday Jan 19 05:00 Bogota = 10:00 UTC (70h ahead, no buffer conflict with first)
        resp2 = api_client.post(url, {'package_id': package.id, 'starts_at': '2026-01-19T10:00:00Z'}, format='json')
        assert resp2.status_code == status.HTTP_201_CREATED

        assert Booking.objects.filter(customer=customer).count() == 2


# ----------------------------------------------------------------
# Duo plan guest rules
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestGuestBookingRules:

    def test_accepted_guest_cannot_create_booking(self, api_client, customer, package, subscription):
        """A user holding an accepted guest link is blocked from booking directly."""
        guest = User.objects.create_user(
            email='bk_blocked_guest@example.com', password='p', role=User.Role.CUSTOMER,
        )
        SubscriptionGuest.objects.create(
            subscription=subscription, guest=guest,
            invited_email=guest.email, token='guest-block-token',
            status=SubscriptionGuest.STATUS_ACCEPTED,
        )

        api_client.force_authenticate(user=guest)
        url = reverse('booking-list')
        response = api_client.post(
            url, {'package_id': package.id, 'starts_at': '2026-01-17T14:00:00Z'}, format='json',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data['detail'] == 'Los invitados no pueden agendar sesiones directamente.'

    def test_booking_on_duo_subscription_creates_guest_booking(
        self, api_client, customer, package, subscription, assigned_trainer,
    ):
        """Booking on a subscription with an accepted guest spawns a parallel guest booking."""
        customer.assigned_trainer = assigned_trainer
        customer.save(update_fields=['assigned_trainer'])
        guest = User.objects.create_user(
            email='bk_duo_partner@example.com', password='p', role=User.Role.CUSTOMER,
        )
        SubscriptionGuest.objects.create(
            subscription=subscription, guest=guest,
            invited_email=guest.email, token='duo-create-token',
            status=SubscriptionGuest.STATUS_ACCEPTED,
        )

        api_client.force_authenticate(user=customer)
        url = reverse('booking-list')
        response = api_client.post(
            url,
            {
                'package_id': package.id,
                'starts_at': '2026-01-17T14:00:00Z',
                'subscription_id': subscription.id,
            },
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        guest_booking = Booking.objects.get(customer=guest)
        assert guest_booking.starts_at == BOOKING_STARTS_AT
        assert guest_booking.status == Booking.Status.PENDING
        assert guest_booking.subscription is None


# ----------------------------------------------------------------
# Subscription filter
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestSubscriptionFilter:

    def test_filter_bookings_by_subscription(self, api_client, customer, package, subscription, trainer_profile):
        _make_booking(customer, package, trainer_profile, subscription,
                      starts_at=FIXED_NOW + timedelta(hours=48),
                      ends_at=FIXED_NOW + timedelta(hours=49))
        _make_booking(customer, package, trainer_profile, None,
                      starts_at=FIXED_NOW + timedelta(hours=72),
                      ends_at=FIXED_NOW + timedelta(hours=73))

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
        booking = _make_booking(customer, package)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-detail', args=[booking.pk])
        response = api_client.put(url, {
            'package_id': package.id,
            'starts_at': '2026-01-17T14:00:00Z',
        }, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_partial_update_requires_admin(self, api_client, customer, package):
        booking = _make_booking(customer, package)

        api_client.force_authenticate(user=customer)
        url = reverse('booking-detail', args=[booking.pk])
        response = api_client.patch(url, {'status': 'canceled'}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
