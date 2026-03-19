"""Tests for trainer client management views.

Covers TrainerClientListView, TrainerClientDetailView,
TrainerClientSessionsView, and TrainerDashboardStatsView.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    Payment,
    Subscription,
    TrainerProfile,
    User,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    """Create a trainer user with TrainerProfile."""
    user = User.objects.create_user(
        email='trainer-cv@test.com', password='pass',
        first_name='Ana', last_name='Garcia', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym A')


@pytest.fixture
def customer(db):
    """Create a customer user."""
    return User.objects.create_user(
        email='customer-cv@test.com', password='pass',
        first_name='Carlos', last_name='Lopez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Básico', sessions_count=8, validity_days=30, price='200000.00',
    )


@pytest.fixture
def booking_with_slot(trainer, customer, package):
    """Create a confirmed booking linking trainer and customer."""
    future = timezone.now() + timedelta(days=3)
    slot = AvailabilitySlot.objects.create(
        starts_at=future, ends_at=future + timedelta(hours=1),
        is_active=True, is_blocked=True,
    )
    booking = Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        slot=slot, status=Booking.Status.CONFIRMED,
    )
    return booking, slot


# ── TrainerClientListView ──


@pytest.mark.django_db
class TestTrainerClientListView:
    def test_returns_client_list_for_trainer(self, api_client, trainer, customer, booking_with_slot):
        """Return list of clients assigned to authenticated trainer."""
        api_client.force_authenticate(user=trainer.user)
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['email'] == customer.email
        assert response.data[0]['first_name'] == 'Carlos'
        assert 'total_sessions' in response.data[0]
        assert 'completed_sessions' in response.data[0]

    def test_returns_empty_when_no_clients(self, api_client, trainer):
        """Return empty list when trainer has no bookings."""
        api_client.force_authenticate(user=trainer.user)
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_requires_trainer_role(self, api_client, customer):
        """Reject non-trainer users."""
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_requires_authentication(self, api_client):
        """Reject unauthenticated requests."""
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_404_when_no_trainer_profile(self, api_client, db):
        """Return 404 when trainer user has no TrainerProfile."""
        user = User.objects.create_user(
            email='no-profile@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_includes_active_subscription_data(self, api_client, trainer, customer, package, booking_with_slot):
        """Include active subscription info in client list."""
        Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=8, sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(days=5),
            expires_at=timezone.now() + timedelta(days=25),
        )
        api_client.force_authenticate(user=trainer.user)
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]['active_package'] == 'Plan Básico'
        assert response.data[0]['sessions_remaining'] == 6


# ── TrainerClientDetailView ──


@pytest.mark.django_db
class TestTrainerClientDetailView:
    def test_returns_client_detail(self, api_client, trainer, customer, booking_with_slot):
        """Return full client detail for a trainer's client."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == customer.email
        assert 'profile' in response.data
        assert 'stats' in response.data
        assert response.data['stats']['total'] >= 1

    def test_returns_404_for_unrelated_customer(self, api_client, trainer, db):
        """Return 404 when customer has no bookings with this trainer."""
        other_customer = User.objects.create_user(
            email='other@test.com', password='pass', role=User.Role.CUSTOMER,
        )
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[other_customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_404_for_nonexistent_customer(self, api_client, trainer):
        """Return 404 for a non-existent customer ID."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[99999])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_includes_subscription_and_next_session(self, api_client, trainer, customer, package, booking_with_slot):
        """Include subscription details and next session in detail response."""
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=8, sessions_used=3,
            status=Subscription.Status.ACTIVE,
            starts_at=timezone.now() - timedelta(days=5),
            expires_at=timezone.now() + timedelta(days=25),
        )
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['subscription'] is not None
        assert response.data['subscription']['package_title'] == 'Plan Básico'
        assert response.data['next_session'] is not None

    def test_returns_null_subscription_when_none_active(self, api_client, trainer, customer, booking_with_slot):
        """Return null subscription when customer has no active subscription."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['subscription'] is None

    def test_returns_404_when_no_trainer_profile(self, api_client, db):
        """Return 404 when trainer user has no TrainerProfile."""
        user = User.objects.create_user(
            email='no-profile-detail@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        url = reverse('trainer-client-detail', args=[1])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerClientSessionsView ──


@pytest.mark.django_db
class TestTrainerClientSessionsView:
    def test_returns_session_history(self, api_client, trainer, customer, booking_with_slot):
        """Return booking history for a trainer's client."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-sessions', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['status'] == Booking.Status.CONFIRMED

    def test_returns_empty_for_unrelated_customer(self, api_client, trainer, db):
        """Return empty list when no sessions exist for the customer with this trainer."""
        other = User.objects.create_user(
            email='no-sessions@test.com', password='pass', role=User.Role.CUSTOMER,
        )
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-sessions', args=[other.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_returns_404_when_no_trainer_profile(self, api_client, db):
        """Return 404 when trainer user has no TrainerProfile."""
        user = User.objects.create_user(
            email='no-profile-sessions@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        url = reverse('trainer-client-sessions', args=[1])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── TrainerDashboardStatsView ──


@pytest.mark.django_db
class TestTrainerDashboardStatsView:
    def test_returns_stats(self, api_client, trainer, customer, booking_with_slot):
        """Return dashboard stats for authenticated trainer."""
        api_client.force_authenticate(user=trainer.user)
        response = api_client.get(reverse('trainer-dashboard-stats'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_clients'] == 1
        assert 'today_sessions' in response.data
        assert 'upcoming_sessions' in response.data

    def test_returns_zero_stats_when_no_bookings(self, api_client, trainer):
        """Return zero counts when trainer has no bookings."""
        api_client.force_authenticate(user=trainer.user)
        response = api_client.get(reverse('trainer-dashboard-stats'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_clients'] == 0
        assert response.data['today_sessions'] == 0
        assert response.data['upcoming_sessions'] == []

    def test_returns_404_when_no_trainer_profile(self, api_client, db):
        """Return 404 when trainer user has no TrainerProfile."""
        user = User.objects.create_user(
            email='no-profile-stats@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        response = api_client.get(reverse('trainer-dashboard-stats'))

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_authentication(self, api_client):
        """Reject unauthenticated requests."""
        response = api_client.get(reverse('trainer-dashboard-stats'))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
