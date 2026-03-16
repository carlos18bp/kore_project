"""Tests for physical evaluation API views."""

from datetime import timedelta

import pytest
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    PhysicalEvaluation,
    User,
)
from core_app.models.trainer_profile import TrainerProfile


def _make_booking(customer, trainer_profile):
    """Create a valid Booking with all required FKs."""
    pkg = Package.objects.create(title='Test', price=10000, sessions_count=4, category='personalizado')
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(
        customer=customer, package=pkg, slot=slot,
        trainer=trainer_profile, status='confirmed',
    )


SAMPLE_DATA = {
    'squats_reps': 25,
    'pushups_reps': 15,
    'plank_seconds': 45,
    'walk_meters': 500,
    'unipodal_seconds': 30,
    'hip_mobility': 3,
    'shoulder_mobility': 4,
    'ankle_mobility': 3,
    'squats_notes': 'Buena técnica',
    'squats_pain': False,
    'squats_interrupted': False,
    'pushups_pain': False,
    'plank_pain': False,
    'notes': 'Evaluación inicial',
}


@pytest.mark.django_db
class TestTrainerPhysicalEvalListCreate(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='trainer@test.com', password='pass1234', role='trainer',
            first_name='Gus', last_name='Trainer',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='test')
        self.customer = User.objects.create_user(
            email='customer@test.com', password='pass1234', role='customer',
            first_name='Ana', last_name='Client',
        )
        cp = self.customer.customer_profile
        cp.sex = 'femenino'
        cp.date_of_birth = '1990-01-01'
        cp.save()
        _make_booking(self.customer, self.trainer_profile)
        self.client.force_authenticate(user=self.trainer_user)

    def test_create_evaluation_success(self):
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/',
            SAMPLE_DATA,
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data['squats_reps'], 25)
        self.assertIsNotNone(data['squats_score'])
        self.assertIsNotNone(data['general_index'])
        self.assertIn(data['general_color'], ('green', 'yellow', 'red'))
        self.assertEqual(data['age_at_evaluation'], 36)  # born 1990, evaluated ~2026
        self.assertEqual(data['sex_at_evaluation'], 'femenino')

    def test_create_requires_profile(self):
        customer2 = User.objects.create_user(
            email='noprofile@test.com', password='pass1234', role='customer',
        )
        cp = customer2.customer_profile
        cp.sex = ''
        cp.date_of_birth = None
        cp.save()
        _make_booking(customer2, self.trainer_profile)
        resp = self.client.post(
            f'/api/trainer/my-clients/{customer2.id}/physical-evaluation/',
            SAMPLE_DATA, format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_list_evaluations(self):
        self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/',
            SAMPLE_DATA, format='json',
        )
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

    def test_create_no_booking_returns_404(self):
        other_customer = User.objects.create_user(
            email='other@test.com', password='pass1234', role='customer',
        )
        cp = other_customer.customer_profile
        cp.sex = 'masculino'
        cp.date_of_birth = '1995-05-05'
        cp.save()
        resp = self.client.post(
            f'/api/trainer/my-clients/{other_customer.id}/physical-evaluation/',
            SAMPLE_DATA, format='json',
        )
        self.assertEqual(resp.status_code, 404)

    def test_unauthenticated_returns_401(self):
        self.client.logout()
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/',
            SAMPLE_DATA, format='json',
        )
        self.assertEqual(resp.status_code, 401)


@pytest.mark.django_db
class TestTrainerPhysicalEvalDetail(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='trainer2@test.com', password='pass1234', role='trainer',
            first_name='Gus', last_name='T',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='test')
        self.customer = User.objects.create_user(
            email='customer2@test.com', password='pass1234', role='customer',
            first_name='Ana', last_name='C',
        )
        cp = self.customer.customer_profile
        cp.sex = 'masculino'
        cp.date_of_birth = '1985-06-15'
        cp.save()
        _make_booking(self.customer, self.trainer_profile)
        self.client.force_authenticate(user=self.trainer_user)

        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/',
            SAMPLE_DATA, format='json',
        )
        self.eval_id = resp.json()['id']

    def test_get_detail(self):
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/{self.eval_id}/',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['id'], self.eval_id)

    def test_patch_update(self):
        resp = self.client.patch(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/{self.eval_id}/',
            {'squats_reps': 40, 'notes': 'Mejoró'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['squats_reps'], 40)
        self.assertEqual(resp.json()['notes'], 'Mejoró')

    def test_put_update(self):
        resp = self.client.put(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/{self.eval_id}/',
            {'squats_reps': 50},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['squats_reps'], 50)

    def test_delete(self):
        resp = self.client.delete(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/{self.eval_id}/',
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(PhysicalEvaluation.objects.filter(id=self.eval_id).exists())

    def test_not_found(self):
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/99999/',
        )
        self.assertEqual(resp.status_code, 404)


@pytest.mark.django_db
class TestClientPhysicalEvalViews(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='trainer3@test.com', password='pass1234', role='trainer',
            first_name='G', last_name='T',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='t')
        self.customer = User.objects.create_user(
            email='customer3@test.com', password='pass1234', role='customer',
            first_name='B', last_name='C',
        )
        cp = self.customer.customer_profile
        cp.sex = 'femenino'
        cp.date_of_birth = '1992-03-20'
        cp.save()
        _make_booking(self.customer, self.trainer_profile)

        # Create evaluation as trainer
        self.client.force_authenticate(user=self.trainer_user)
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/physical-evaluation/',
            SAMPLE_DATA, format='json',
        )
        self.eval_id = resp.json()['id']

        # Switch to customer
        self.client.force_authenticate(user=self.customer)

    def test_client_list(self):
        resp = self.client.get('/api/my-physical-evaluation/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

    def test_client_detail(self):
        resp = self.client.get(f'/api/my-physical-evaluation/{self.eval_id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['id'], self.eval_id)

    def test_client_cannot_see_other(self):
        other = User.objects.create_user(
            email='other2@test.com', password='pass1234', role='customer',
        )
        self.client.force_authenticate(user=other)
        resp = self.client.get(f'/api/my-physical-evaluation/{self.eval_id}/')
        self.assertEqual(resp.status_code, 404)

    def test_client_detail_not_found(self):
        resp = self.client.get('/api/my-physical-evaluation/99999/')
        self.assertEqual(resp.status_code, 404)
