"""Tests for PAR-Q+ assessment views (client create/read + trainer read-only)."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from core_app.models import Booking, Package, User
from core_app.models.availability import AvailabilitySlot
from core_app.models.parq_assessment import ParqAssessment
from core_app.models.trainer_profile import TrainerProfile

FIXED_NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


def _valid_payload():
    return {
        'q1_heart_condition': False,
        'q2_chest_pain': False,
        'q3_dizziness': False,
        'q4_chronic_condition': True,
        'q5_prescribed_medication': True,
        'q6_bone_joint_problem': False,
        'q7_medical_supervision': False,
        'additional_notes': 'Tomo medicamento para tiroides',
    }


@pytest.mark.django_db
class TestClientParqListCreate:
    def test_create_assessment(self):
        client = APIClient()
        customer = User.objects.create_user(email='parq@test.com', password='pass', role='customer')
        _auth(client, customer)

        resp = client.post('/api/my-parq/', _valid_payload(), format='json')
        assert resp.status_code == 201
        assert resp.data['yes_count'] == 2
        assert resp.data['risk_classification'] == 'apto_con_precaucion'
        assert resp.data['risk_color'] == 'yellow'

    def test_create_all_false_apto(self):
        """All seven PAR-Q answers false yields yes_count=0, classification 'apto', and green color."""
        client = APIClient()
        customer = User.objects.create_user(email='parq2@test.com', password='pass', role='customer')
        _auth(client, customer)

        payload = {k: False for k in [
            'q1_heart_condition', 'q2_chest_pain', 'q3_dizziness',
            'q4_chronic_condition', 'q5_prescribed_medication',
            'q6_bone_joint_problem', 'q7_medical_supervision',
        ]}
        resp = client.post('/api/my-parq/', payload, format='json')
        assert resp.status_code == 201
        assert resp.data['yes_count'] == 0
        assert resp.data['risk_classification'] == 'apto'
        assert resp.data['risk_color'] == 'green'

    def test_list_assessments(self):
        client = APIClient()
        customer = User.objects.create_user(email='parq3@test.com', password='pass', role='customer')
        _auth(client, customer)

        ParqAssessment.objects.create(customer=customer)

        resp = client.get('/api/my-parq/')
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_rate_limit_within_90_days(self):
        client = APIClient()
        customer = User.objects.create_user(email='parq4@test.com', password='pass', role='customer')
        _auth(client, customer)

        ParqAssessment.objects.create(customer=customer)

        resp = client.post('/api/my-parq/', _valid_payload(), format='json')
        assert resp.status_code == 400
        assert '3 meses' in resp.data['detail']

    def test_rate_limit_allows_after_90_days(self, monkeypatch):
        monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)
        client = APIClient()
        customer = User.objects.create_user(email='parq5@test.com', password='pass', role='customer')
        _auth(client, customer)

        old = ParqAssessment.objects.create(customer=customer)
        ParqAssessment.objects.filter(pk=old.pk).update(
            created_at=FIXED_NOW - timedelta(days=91),
        )

        resp = client.post('/api/my-parq/', _valid_payload(), format='json')
        assert resp.status_code == 201

    def test_unauthenticated_rejected(self):
        client = APIClient()
        resp = client.post('/api/my-parq/', _valid_payload(), format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestClientParqDetail:
    def test_get_own_assessment(self):
        client = APIClient()
        customer = User.objects.create_user(email='parq6@test.com', password='pass', role='customer')
        _auth(client, customer)

        entry = ParqAssessment.objects.create(customer=customer, q1_heart_condition=True)

        resp = client.get(f'/api/my-parq/{entry.id}/')
        assert resp.status_code == 200
        assert resp.data['yes_count'] == 1

    def test_other_user_not_found(self):
        client = APIClient()
        c1 = User.objects.create_user(email='parq7@test.com', password='pass', role='customer')
        c2 = User.objects.create_user(email='parq8@test.com', password='pass', role='customer')
        _auth(client, c1)

        entry = ParqAssessment.objects.create(customer=c2)

        resp = client.get(f'/api/my-parq/{entry.id}/')
        assert resp.status_code == 404


@pytest.mark.django_db
class TestTrainerParqViews:
    def _setup(self):
        customer = User.objects.create_user(email='parq_c@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='parq_t@test.com', password='pass', role='trainer')
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='S', location='L')
        pkg = Package.objects.create(title='Pack', sessions_count=4, validity_days=30, price=Decimal('100.00'))
        slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(days=1), ends_at=FIXED_NOW + timedelta(days=1, hours=1),
            is_active=True, is_blocked=False,
        )
        Booking.objects.create(customer=customer, package=pkg, slot=slot, trainer=trainer, status='confirmed')
        entry = ParqAssessment.objects.create(customer=customer, q3_dizziness=True)
        return customer, trainer_user, entry

    def test_trainer_list(self):
        customer, trainer_user, entry = self._setup()
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/parq/')
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_trainer_detail(self):
        customer, trainer_user, entry = self._setup()
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/parq/{entry.id}/')
        assert resp.status_code == 200
        assert resp.data['yes_count'] == 1

    def test_trainer_no_booking_rejected(self):
        customer = User.objects.create_user(email='parq_nb@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='parq_nt@test.com', password='pass', role='trainer')
        TrainerProfile.objects.create(user=trainer_user, specialty='S', location='L')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/parq/')
        assert resp.status_code == 404

    def test_trainer_list_no_trainer_profile_returns_404(self):
        """Trainer user without TrainerProfile gets 404 on list endpoint."""
        customer = User.objects.create_user(email='parq_ntp@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='parq_ntp2@test.com', password='pass', role='trainer')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/parq/')
        assert resp.status_code == 404
        assert resp.data['detail'] == 'No trainer profile.'

    def test_trainer_detail_no_trainer_profile_returns_404(self):
        """Trainer user without TrainerProfile gets 404 on detail endpoint."""
        trainer_user = User.objects.create_user(email='parq_ntp3@test.com', password='pass', role='trainer')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get('/api/trainer/my-clients/1/parq/1/')
        assert resp.status_code == 404
        assert resp.data['detail'] == 'No trainer profile.'

    def test_trainer_detail_no_booking_returns_404(self):
        """Trainer with profile but no booking for customer gets 404 on detail."""
        customer = User.objects.create_user(email='parq_dnb@test.com', password='pass', role='customer')
        trainer_user = User.objects.create_user(email='parq_dnb2@test.com', password='pass', role='trainer')
        TrainerProfile.objects.create(user=trainer_user, specialty='S', location='L')
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/parq/999/')
        assert resp.status_code == 404

    def test_trainer_detail_entry_not_found(self):
        """Trainer gets 404 when parq entry does not exist."""
        customer, trainer_user, entry = self._setup()
        client = APIClient()
        _auth(client, trainer_user)

        resp = client.get(f'/api/trainer/my-clients/{customer.id}/parq/99999/')
        assert resp.status_code == 404
