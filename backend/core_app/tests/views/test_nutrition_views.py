"""Tests for nutrition habit views (client create/read + trainer read-only)."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core_app.models import Booking, Package, User
from core_app.models.availability import AvailabilitySlot
from core_app.models.nutrition_habit import NutritionHabit
from core_app.models.trainer_profile import TrainerProfile

FIXED_NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


def _valid_payload():
    return {
        'meals_per_day': 3,
        'water_liters': '2.0',
        'fruit_weekly': 5,
        'vegetable_weekly': 5,
        'protein_frequency': 4,
        'ultraprocessed_weekly': 2,
        'sugary_drinks_weekly': 1,
        'eats_breakfast': True,
        'notes': 'Test entry',
    }


@pytest.mark.django_db
class TestClientNutritionListCreate:
    def test_create_entry(self):
        client = APIClient()
        customer = User.objects.create_user(email='nutri@test.com', password='pass', role='customer')
        _auth(client, customer)

        resp = client.post('/api/my-nutrition/', _valid_payload(), format='json')
        assert resp.status_code == 201
        assert resp.data['habit_score'] is not None
        assert resp.data['habit_color'] in ('red', 'yellow', 'green')
        assert resp.data['customer_id'] == customer.id

    def test_list_entries(self):
        client = APIClient()
        customer = User.objects.create_user(email='nutri2@test.com', password='pass', role='customer')
        _auth(client, customer)

        NutritionHabit.objects.create(
            customer=customer, meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=4,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )

        resp = client.get('/api/my-nutrition/')
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_rate_limit_within_week(self):
        client = APIClient()
        customer = User.objects.create_user(email='nutri3@test.com', password='pass', role='customer')
        _auth(client, customer)

        NutritionHabit.objects.create(
            customer=customer, meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=4,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )

        resp = client.post('/api/my-nutrition/', _valid_payload(), format='json')
        assert resp.status_code == 400
        assert 'una vez por semana' in resp.data['detail']

    def test_rate_limit_allows_after_week(self, monkeypatch):
        """Submitting a new nutrition habit succeeds when the previous one is older than 7 days."""
        monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)
        client = APIClient()
        customer = User.objects.create_user(email='nutri4@test.com', password='pass', role='customer')
        _auth(client, customer)

        old = NutritionHabit.objects.create(
            customer=customer, meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=4,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )
        NutritionHabit.objects.filter(pk=old.pk).update(
            created_at=FIXED_NOW - timedelta(days=8),
        )

        resp = client.post('/api/my-nutrition/', _valid_payload(), format='json')
        assert resp.status_code == 201

    def test_unauthenticated_rejected(self):
        client = APIClient()
        resp = client.post('/api/my-nutrition/', _valid_payload(), format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestClientNutritionDetail:
    def test_get_own_entry(self):
        client = APIClient()
        customer = User.objects.create_user(email='nutri5@test.com', password='pass', role='customer')
        _auth(client, customer)

        entry = NutritionHabit.objects.create(
            customer=customer, meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=4,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )

        resp = client.get(f'/api/my-nutrition/{entry.id}/')
        assert resp.status_code == 200
        assert resp.data['id'] == entry.id

    def test_other_user_entry_not_found(self):
        client = APIClient()
        customer1 = User.objects.create_user(email='nutri6@test.com', password='pass', role='customer')
        customer2 = User.objects.create_user(email='nutri7@test.com', password='pass', role='customer')
        _auth(client, customer1)

        entry = NutritionHabit.objects.create(
            customer=customer2, meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=4,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )

        resp = client.get(f'/api/my-nutrition/{entry.id}/')
        assert resp.status_code == 404


@pytest.mark.django_db
class TestTrainerNutritionViews:
    def _setup(self):
        customer = User.objects.create_user(email='nutri_c@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='nutri_t@test.com', password='pass', role='trainer')
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Strength', location='Studio')
        pkg = Package.objects.create(title='Pack', sessions_count=4, validity_days=30, price=Decimal('100.00'))
        slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(days=1), ends_at=FIXED_NOW + timedelta(days=1, hours=1),
            is_active=True, is_blocked=False,
        )
        Booking.objects.create(customer=customer, package=pkg, slot=slot, trainer=trainer, status='confirmed')

        entry = NutritionHabit.objects.create(
            customer=customer, meals_per_day=3, water_liters=Decimal('2.0'),
            fruit_weekly=5, vegetable_weekly=5, protein_frequency=4,
            ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
        )
        return customer, trainer_user, entry

    def test_trainer_list_client_entries(self):
        customer, trainer_user, entry = self._setup()
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/nutrition/')
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_trainer_detail_client_entry(self):
        customer, trainer_user, entry = self._setup()
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/nutrition/{entry.id}/')
        assert resp.status_code == 200
        assert resp.data['id'] == entry.id

    def test_trainer_no_booking_rejected(self):
        customer = User.objects.create_user(email='nutri_nb@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='nutri_nt@test.com', password='pass', role='trainer')
        TrainerProfile.objects.create(user=trainer_user, specialty='S', location='L')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/nutrition/')
        assert resp.status_code == 404

    def test_trainer_list_no_trainer_profile_returns_404(self):
        """Trainer user without TrainerProfile gets 404 on list endpoint."""
        customer = User.objects.create_user(email='nutri_ntp@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='nutri_ntp2@test.com', password='pass', role='trainer')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/nutrition/')
        assert resp.status_code == 404
        assert resp.data['detail'] == 'No trainer profile.'

    def test_trainer_detail_no_trainer_profile_returns_404(self):
        """Trainer user without TrainerProfile gets 404 on detail endpoint."""
        trainer_user = User.objects.create_user(email='nutri_ntp3@test.com', password='pass', role='trainer')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get('/api/trainer/my-clients/1/nutrition/1/')
        assert resp.status_code == 404
        assert resp.data['detail'] == 'No trainer profile.'

    def test_trainer_detail_no_booking_returns_404(self):
        """Trainer with profile but no booking for customer gets 404 on detail."""
        customer = User.objects.create_user(email='nutri_dnb@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='nutri_dnb2@test.com', password='pass', role='trainer')
        TrainerProfile.objects.create(user=trainer_user, specialty='S', location='L')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/nutrition/999/')
        assert resp.status_code == 404

    def test_trainer_detail_entry_not_found(self):
        """Trainer gets 404 when nutrition entry does not exist."""
        customer, trainer_user, entry = self._setup()
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/nutrition/99999/')
        assert resp.status_code == 404
