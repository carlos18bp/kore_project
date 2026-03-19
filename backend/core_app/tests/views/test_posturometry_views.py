"""Tests for posturometry API views."""

import json
from datetime import timedelta

import pytest
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    PosturometryEvaluation,
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


def _seg(is_normal=True, severity=0, sub_fields=None):
    return {'is_normal': is_normal, 'severity': severity, 'sub_fields': sub_fields or {}}


def _altered(severity=1, sub_fields=None):
    return _seg(is_normal=False, severity=severity, sub_fields=sub_fields)


def _normal():
    return _seg()


SAMPLE_ANTERIOR = {
    'cabeza': _altered(2, {'inclinacion': 'M', 'rotacion': 'L'}),
    'cuello': _normal(),
    'hombros': _altered(1, {'ascendido_derecho': 'L'}),
    'rodillas': _normal(),
    'pie': _normal(),
}

SAMPLE_POSTERIOR = {
    'cabeza': _normal(),
    'hombros': _normal(),
    'escapulas': _altered(1),
    'rodillas': _normal(),
    'pies': _normal(),
}


@pytest.mark.django_db
class TestTrainerPosturometryListCreate(TestCase):
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
        # Signal auto-creates CustomerProfile; update it with required fields
        cp = self.customer.customer_profile
        cp.sex = 'femenino'
        cp.date_of_birth = '1990-01-01'
        cp.save()
        _make_booking(self.customer, self.trainer_profile)
        self.client.force_authenticate(user=self.trainer_user)

    def test_create_evaluation_success(self):
        """Trainer creates posturometry evaluation; response includes computed global_index, segment_scores, and auto-generated recommendations."""
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/',
            data={
                'anterior_data': json.dumps(SAMPLE_ANTERIOR),
                'posterior_data': json.dumps(SAMPLE_POSTERIOR),
                'notes': 'Test evaluation',
            },
            format='multipart',
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn('global_index', data)
        self.assertIn('segment_scores', data)
        self.assertIn('findings', data)
        self.assertEqual(data['notes'], 'Test evaluation')
        self.assertIsNotNone(data['global_index'])
        # Recommendations should be auto-generated
        self.assertTrue(len(data['recommendations']) > 0)

    def test_list_evaluations(self):
        PosturometryEvaluation.objects.create(
            customer=self.customer, trainer=self.trainer_profile,
            anterior_data=SAMPLE_ANTERIOR,
        )
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

    def test_create_without_booking_fails(self):
        other_customer = User.objects.create_user(
            email='other@test.com', password='pass1234', role='customer',
        )
        resp = self.client.post(
            f'/api/trainer/my-clients/{other_customer.id}/posturometry/',
            data={'anterior_data': json.dumps({})},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 404)

    def test_unauthenticated_fails(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/',
        )
        self.assertEqual(resp.status_code, 401)


@pytest.mark.django_db
class TestTrainerPosturometryDetail(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='trainer2@test.com', password='pass1234', role='trainer',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='test')
        self.customer = User.objects.create_user(
            email='customer2@test.com', password='pass1234', role='customer',
        )
        _make_booking(self.customer, self.trainer_profile)
        self.evaluation = PosturometryEvaluation.objects.create(
            customer=self.customer, trainer=self.trainer_profile,
            anterior_data=SAMPLE_ANTERIOR,
            posterior_data=SAMPLE_POSTERIOR,
        )
        self.client.force_authenticate(user=self.trainer_user)

    def test_get_detail(self):
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['id'], self.evaluation.id)
        self.assertIn('global_index', data)

    def test_patch_recommendations(self):
        new_recs = {'global': {'result': 'Custom result', 'action': 'Custom action'}}
        resp = self.client.patch(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
            data={'recommendations': json.dumps(new_recs)},
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['recommendations']['global']['result'], 'Custom result')

    def test_not_found_other_trainer(self):
        other_trainer_user = User.objects.create_user(
            email='other_trainer@test.com', password='pass1234', role='trainer',
        )
        TrainerProfile.objects.create(user=other_trainer_user, bio='other')
        self.client.force_authenticate(user=other_trainer_user)
        resp = self.client.get(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
        )
        self.assertEqual(resp.status_code, 404)


@pytest.mark.django_db
class TestClientPosturometryViews(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email='client3@test.com', password='pass1234', role='customer',
        )
        self.trainer_user = User.objects.create_user(
            email='trainer3@test.com', password='pass1234', role='trainer',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='test')
        self.evaluation = PosturometryEvaluation.objects.create(
            customer=self.customer, trainer=self.trainer_profile,
            anterior_data=SAMPLE_ANTERIOR,
        )
        self.client.force_authenticate(user=self.customer)

    def test_list_own_evaluations(self):
        resp = self.client.get('/api/my-posturometry/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], self.evaluation.id)

    def test_detail_own_evaluation(self):
        resp = self.client.get(f'/api/my-posturometry/{self.evaluation.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['id'], self.evaluation.id)

    def test_cannot_see_other_client_evaluation(self):
        other = User.objects.create_user(
            email='other_client@test.com', password='pass1234', role='customer',
        )
        self.client.force_authenticate(user=other)
        resp = self.client.get(f'/api/my-posturometry/{self.evaluation.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_computed_fields_present(self):
        resp = self.client.get(f'/api/my-posturometry/{self.evaluation.id}/')
        data = resp.json()
        for key in ['global_index', 'global_category', 'global_color',
                     'upper_index', 'central_index', 'lower_index',
                     'segment_scores', 'findings']:
            self.assertIn(key, data)
