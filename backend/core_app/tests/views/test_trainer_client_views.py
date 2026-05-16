"""Tests for trainer client management views.

Covers TrainerClientListView, TrainerClientDetailView,
TrainerClientSessionsView, and TrainerDashboardStatsView.
"""

from datetime import datetime, timedelta
from datetime import timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import (
    Booking,
    Package,
    Subscription,
    TrainerProfile,
    User,
)

FIXED_NOW = datetime(2026, 3, 1, 10, 0, tzinfo=dt_tz.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze timezone.now so time-based assertions are deterministic."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


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
    """Create a confirmed booking linking trainer and customer, and assign the trainer."""
    future = FIXED_NOW + timedelta(days=3)
    booking = Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=future, ends_at=future + timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )
    customer.assigned_trainer = trainer
    customer.save(update_fields=['assigned_trainer'])
    return booking


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
            starts_at=FIXED_NOW - timedelta(days=5),
            expires_at=FIXED_NOW + timedelta(days=25),
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
        Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=8, sessions_used=3,
            status=Subscription.Status.ACTIVE,
            starts_at=FIXED_NOW - timedelta(days=5),
            expires_at=FIXED_NOW + timedelta(days=25),
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


# ── Avatar URL branches ──


@pytest.mark.django_db
class TestTrainerClientAvatarUrl:
    """Cover avatar_url branches in list and detail client views."""

    def test_client_list_includes_avatar_url_when_avatar_set(
        self, api_client, trainer, customer, booking_with_slot
    ):
        """Client list returns non-null avatar_url when customer profile has an avatar."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        cp = customer.customer_profile
        cp.avatar = SimpleUploadedFile('av.jpg', b'\xff\xd8\xff' + b'\x00' * 20, content_type='image/jpeg')
        cp.save(update_fields=['avatar'])

        api_client.force_authenticate(user=trainer.user)
        response = api_client.get(reverse('trainer-client-list'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]['avatar_url'] is not None

    def test_client_detail_returns_404_when_customer_role_changed(
        self, api_client, trainer, customer, booking_with_slot
    ):
        """Detail view returns 404 when the user no longer has CUSTOMER role."""
        customer.role = User.Role.TRAINER
        customer.save(update_fields=['role'])

        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_client_detail_includes_absolute_avatar_url_when_avatar_set(
        self, api_client, trainer, customer, booking_with_slot
    ):
        """Detail view builds absolute URI for customer avatar when avatar is set."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        cp = customer.customer_profile
        # Use a real SimpleUploadedFile to satisfy hasattr check
        cp.avatar = SimpleUploadedFile('av.jpg', b'\xff\xd8\xff' + b'\x00' * 20, content_type='image/jpeg')
        cp.save(update_fields=['avatar'])

        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-detail', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data.get('avatar_url') is not None


# ── TrainerClientFitnessLevelView ──


@pytest.mark.django_db
class TestTrainerClientFitnessLevelView:
    """Tests for GET and PATCH on the trainer fitness-level override endpoint."""

    def test_get_returns_override_and_computed(self, api_client, trainer, customer, booking_with_slot):
        """GET returns fitness_level_override (null) and fitness_level_computed (1) for customer with no evals."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'fitness_level_override' in response.data
        assert 'fitness_level_computed' in response.data

    def test_get_nonexistent_customer_returns_404(self, api_client, trainer):
        """GET for nonexistent customer ID returns 404."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[99999])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_valid_value_sets_override(self, api_client, trainer, customer, booking_with_slot):
        """PATCH with a valid integer (1-5) sets fitness_level_override and returns 200."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.patch(url, {'fitness_level': 3}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['fitness_level_override'] == 3

    def test_patch_non_integer_string_returns_400(self, api_client, trainer, customer, booking_with_slot):
        """PATCH with non-integer value ('abc') returns 400."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.patch(url, {'fitness_level': 'abc'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'entero' in response.data['detail']

    def test_patch_value_zero_returns_400(self, api_client, trainer, customer, booking_with_slot):
        """PATCH with fitness_level=0 (out of 1-5 range) returns 400."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.patch(url, {'fitness_level': 0}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'entre 1 y 5' in response.data['detail']

    def test_patch_value_six_returns_400(self, api_client, trainer, customer, booking_with_slot):
        """PATCH with fitness_level=6 (out of 1-5 range) returns 400."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.patch(url, {'fitness_level': 6}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'entre 1 y 5' in response.data['detail']

    def test_patch_null_clears_override(self, api_client, trainer, customer, booking_with_slot):
        """PATCH with fitness_level=null clears the override (sets to None)."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        # Set first
        api_client.patch(url, {'fitness_level': 4}, format='json')
        # Then clear
        response = api_client.patch(url, {'fitness_level': None}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['fitness_level_override'] is None

    def test_patch_trainer_without_profile_returns_404(self, api_client, customer, db):
        """PATCH by trainer user with no TrainerProfile returns 404."""
        trainer_no_profile = User.objects.create_user(
            email='trainer-no-profile-fl@test.com', password='p', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=trainer_no_profile)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.patch(url, {'fitness_level': 3}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_unrelated_customer_returns_404(self, api_client, trainer, db):
        """PATCH for a customer not assigned to this trainer returns 404."""
        other_customer = User.objects.create_user(
            email='unrelated-fl@test.com', password='p', role=User.Role.CUSTOMER,
        )
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[other_customer.id])
        response = api_client.patch(url, {'fitness_level': 3}, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── _get_fitness_level_from_evals helper ──


@pytest.mark.django_db
class TestGetFitnessLevelFromEvals:
    """Exercise the _get_fitness_level_from_evals helper indirectly via the GET endpoint."""

    def test_no_physical_evaluation_returns_computed_level_1(
        self, api_client, trainer, customer, booking_with_slot
    ):
        """Customer with no PhysicalEvaluation → computed level defaults to 1."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['fitness_level_computed'] == 1

    def test_physical_evaluation_with_general_index_computes_level(
        self, api_client, trainer, customer, booking_with_slot
    ):
        """Customer with PhysicalEvaluation general_index=3.0 → computed level is 3."""
        from datetime import date
        from core_app.models.physical_evaluation import PhysicalEvaluation

        # Create the evaluation, then force-set general_index via update() to bypass
        # save() which recomputes the index from raw test data.
        eval_ = PhysicalEvaluation.objects.create(
            customer=customer,
            trainer=trainer,
            evaluation_date=date(2026, 1, 10),
        )
        PhysicalEvaluation.objects.filter(pk=eval_.pk).update(general_index=3.0)

        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # floor(3.0 + 0.5) = 3
        assert response.data['fitness_level_computed'] == 3

    def test_physical_evaluation_with_null_general_index_returns_1(
        self, api_client, trainer, customer, booking_with_slot
    ):
        """PhysicalEvaluation where general_index=None → computed level is 1 (filter excludes it)."""
        from datetime import date
        from core_app.models.physical_evaluation import PhysicalEvaluation

        # The save() computes general_index from raw data; with no raw data provided,
        # general_index may end up None — either way the filter (general_index__isnull=False)
        # excludes the record and the fallback is 1.
        PhysicalEvaluation.objects.create(
            customer=customer,
            trainer=trainer,
            evaluation_date=date(2026, 1, 10),
        )

        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-client-fitness-level', args=[customer.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['fitness_level_computed'] == 1
