"""Tests for anthropometry evaluation views.

Covers trainer CRUD endpoints and client read-only endpoints.
"""

from datetime import date, datetime, timedelta
from datetime import timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    TrainerProfile,
    User,
)
from core_app.models.anthropometry import AnthropometryEvaluation

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
    user = User.objects.create_user(
        email='anthro-trainer@test.com', password='pass',
        first_name='Ana', last_name='Trainer', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym')


@pytest.fixture
def customer_with_profile(db):
    """Create a customer with a complete profile (sex + dob required for anthropometry)."""
    user = User.objects.create_user(
        email='anthro-customer@test.com', password='pass',
        first_name='Carlos', last_name='Client', role=User.Role.CUSTOMER,
    )
    # Signal auto-creates CustomerProfile; update the existing one
    profile = user.customer_profile
    profile.sex = 'masculino'
    profile.date_of_birth = date(1990, 5, 15)
    profile.city = 'Bogotá'
    profile.primary_goal = 'fat_loss'
    profile.save()
    return user


@pytest.fixture
def customer_no_profile(db):
    """Create a customer without a profile."""
    return User.objects.create_user(
        email='anthro-noprofile@test.com', password='pass',
        first_name='No', last_name='Profile', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Test Pkg', sessions_count=4, validity_days=30, price='100000.00',
    )


@pytest.fixture
def booking_link(trainer, customer_with_profile, package):
    """Create a booking linking trainer and customer."""
    future = FIXED_NOW + timedelta(days=3)
    slot = AvailabilitySlot.objects.create(
        starts_at=future, ends_at=future + timedelta(hours=1),
        is_active=True, is_blocked=True,
    )
    return Booking.objects.create(
        customer=customer_with_profile, trainer=trainer,
        package=package, slot=slot, status=Booking.Status.CONFIRMED,
    )


@pytest.fixture
def evaluation(trainer, customer_with_profile):
    """Create an anthropometry evaluation."""
    return AnthropometryEvaluation.objects.create(
        customer=customer_with_profile, trainer=trainer,
        weight_kg=75, height_cm=175,
    )


# ── Trainer List/Create ──


@pytest.mark.django_db
class TestTrainerAnthropometryListCreate:
    def test_list_evaluations_for_client(self, api_client, trainer, customer_with_profile, booking_link, evaluation):
        """Return evaluations list for a trainer's client."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-list-create', args=[customer_with_profile.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['weight_kg'] == '75.0'

    def test_create_evaluation(self, api_client, trainer, customer_with_profile, booking_link):
        """Create a new anthropometry evaluation for a client."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-list-create', args=[customer_with_profile.id])
        payload = {
            'weight_kg': 80,
            'height_cm': 180,
            'waist_cm': 85,
            'hip_cm': 100,
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['bmi'] is not None
        assert response.data['bmi_category'] != ''

    def test_create_returns_404_when_no_booking(self, api_client, trainer, customer_with_profile):
        """Return 404 when trainer has no bookings with the customer."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-list-create', args=[customer_with_profile.id])
        payload = {'weight_kg': 80, 'height_cm': 180}
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_returns_400_when_profile_incomplete(self, api_client, trainer, customer_no_profile, package):
        """Return 400 when client profile missing sex/dob."""
        future = FIXED_NOW + timedelta(days=3)
        slot = AvailabilitySlot.objects.create(
            starts_at=future, ends_at=future + timedelta(hours=1),
            is_active=True, is_blocked=True,
        )
        Booking.objects.create(
            customer=customer_no_profile, trainer=trainer,
            package=package, slot=slot, status=Booking.Status.CONFIRMED,
        )

        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-list-create', args=[customer_no_profile.id])
        payload = {'weight_kg': 80, 'height_cm': 180}
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_returns_404_for_nonexistent_customer(self, api_client, trainer):
        """Return 404 when customer does not exist."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-list-create', args=[99999])
        payload = {'weight_kg': 80, 'height_cm': 180}
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_404_when_no_trainer_profile(self, api_client, db):
        """Return 404 when user has no TrainerProfile."""
        user = User.objects.create_user(
            email='no-tp-anthro@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        url = reverse('trainer-anthropometry-list-create', args=[1])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Trainer Detail (GET/PUT/PATCH/DELETE) ──


@pytest.mark.django_db
class TestTrainerAnthropometryDetail:
    def test_get_evaluation(self, api_client, trainer, customer_with_profile, evaluation):
        """Return evaluation detail."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, evaluation.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == evaluation.id

    def test_update_evaluation_with_put(self, api_client, trainer, customer_with_profile, evaluation):
        """Update evaluation via PUT."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, evaluation.id])
        response = api_client.put(url, {'weight_kg': 78, 'height_cm': 175}, format='json')

        assert response.status_code == status.HTTP_200_OK
        evaluation.refresh_from_db()
        assert float(evaluation.weight_kg) == 78.0

    def test_partial_update_with_patch(self, api_client, trainer, customer_with_profile, evaluation):
        """Update evaluation via PATCH."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, evaluation.id])
        response = api_client.patch(url, {'notes': 'Good progress'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        evaluation.refresh_from_db()
        assert evaluation.notes == 'Good progress'

    def test_delete_evaluation(self, api_client, trainer, customer_with_profile, evaluation):
        """Delete evaluation returns 204."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, evaluation.id])
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not AnthropometryEvaluation.objects.filter(id=evaluation.id).exists()

    def test_get_returns_404_for_wrong_eval_id(self, api_client, trainer, customer_with_profile):
        """Return 404 when evaluation does not exist."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, 99999])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_404_when_no_trainer_profile(self, api_client, db):
        """Return 404 when user has no TrainerProfile."""
        user = User.objects.create_user(
            email='no-tp-detail@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        url = reverse('trainer-anthropometry-detail', args=[1, 1])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Client Read-Only ──


@pytest.mark.django_db
class TestClientAnthropometryViews:
    def test_list_own_evaluations(self, api_client, customer_with_profile, evaluation):
        """Client can list their own evaluations."""
        api_client.force_authenticate(user=customer_with_profile)
        response = api_client.get(reverse('client-anthropometry-list'))

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_get_own_evaluation_detail(self, api_client, customer_with_profile, evaluation):
        """Client can view their own evaluation detail."""
        api_client.force_authenticate(user=customer_with_profile)
        url = reverse('client-anthropometry-detail', args=[evaluation.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == evaluation.id

    def test_returns_404_for_other_clients_evaluation(self, api_client, evaluation, db):
        """Client cannot view another client's evaluation."""
        other = User.objects.create_user(
            email='other-client@test.com', password='pass', role=User.Role.CUSTOMER,
        )
        api_client.force_authenticate(user=other)
        url = reverse('client-anthropometry-detail', args=[evaluation.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_authentication(self, api_client):
        """Reject unauthenticated requests."""
        response = api_client.get(reverse('client-anthropometry-list'))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAnthropometrySerializerTrainerName:
    """Cover get_trainer_name returning empty string when trainer is None."""

    def test_trainer_name_empty_when_no_trainer(self, db):
        from core_app.views.anthropometry_views import AnthropometrySerializer
        customer = User.objects.create_user(
            email='anthro-ser@test.com', password='p', role=User.Role.CUSTOMER,
        )
        cp = customer.customer_profile
        cp.sex = 'masculino'
        cp.date_of_birth = date(1990, 1, 1)
        cp.save()
        ev = AnthropometryEvaluation.objects.create(
            customer=customer, trainer=None, weight_kg=70, height_cm=170,
        )
        serializer = AnthropometrySerializer(ev)
        assert serializer.data['trainer_name'] == ''


@pytest.mark.django_db
class TestAnthropometryNoTrainerProfilePost:
    """Cover POST no-trainer-profile branch."""

    def test_post_returns_404_when_no_trainer_profile(self, api_client, db):
        user = User.objects.create_user(
            email='no-tp-anthro-post@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=user)
        url = reverse('trainer-anthropometry-list-create', args=[1])
        response = api_client.post(url, {'weight_kg': 80, 'height_cm': 180}, format='json')
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAnthropometryCustomerDoesNotExist:
    """Cover User.DoesNotExist branch when user exists but has non-customer role."""

    def test_post_returns_404_when_user_not_customer_role(self, api_client, trainer, package):
        non_customer = User.objects.create_user(
            email='anthro-noncust@test.com', password='pass', role=User.Role.TRAINER,
        )
        future = FIXED_NOW + timedelta(days=3)
        slot = AvailabilitySlot.objects.create(
            starts_at=future, ends_at=future + timedelta(hours=1),
            is_active=True, is_blocked=True,
        )
        Booking.objects.create(
            customer=non_customer, trainer=trainer,
            package=package, slot=slot, status=Booking.Status.CONFIRMED,
        )
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-list-create', args=[non_customer.id])
        response = api_client.post(url, {'weight_kg': 80, 'height_cm': 180}, format='json')
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAnthropometryDetailEdgeCases:
    """Cover PUT/PATCH/DELETE error returns and _apply_update edge cases."""

    def test_put_returns_404_for_nonexistent_eval(self, api_client, trainer, customer_with_profile):
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, 99999])
        response = api_client.put(url, {'weight_kg': 80}, format='json')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_returns_404_for_nonexistent_eval(self, api_client, trainer, customer_with_profile):
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, 99999])
        response = api_client.patch(url, {'notes': 'x'}, format='json')
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_returns_404_for_nonexistent_eval(self, api_client, trainer, customer_with_profile):
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, 99999])
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_patch_evaluation_date(self, api_client, trainer, customer_with_profile, evaluation):
        """PATCH updates evaluation_date field."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, evaluation.id])
        response = api_client.patch(url, {'evaluation_date': '2026-06-15'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['evaluation_date'] == '2026-06-15'

    def test_patch_json_field_non_dict_sets_empty(self, api_client, trainer, customer_with_profile, evaluation):
        """PATCH with non-dict JSON field sets empty dict."""
        api_client.force_authenticate(user=trainer.user)
        url = reverse('trainer-anthropometry-detail', args=[customer_with_profile.id, evaluation.id])
        response = api_client.patch(url, {'perimeters': 'not-a-dict'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['perimeters'] == {}
