"""Tests for posturometry API views."""

import json
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.test import TestCase
from rest_framework.test import APIClient

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    PosturometryEvaluation,
    User,
)
from core_app.models.trainer_profile import TrainerProfile

FIXED_NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


def _make_booking(customer, trainer_profile):
    """Create a valid Booking with all required FKs."""
    pkg = Package.objects.create(title='Test', price=10000, sessions_count=4, category='personalizado')
    slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=1),
        ends_at=FIXED_NOW + timedelta(hours=2),
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

    def test_patch_not_found_returns_404(self):
        """PATCH returns 404 when evaluation does not exist."""
        resp = self.client.patch(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/99999/',
            data={'notes': 'test'},
            content_type='application/json',
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


@pytest.mark.django_db
class TestTrainerPosturometryListCreateNoProfile(TestCase):
    """Cover the no-trainer-profile branch on list/create view."""

    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='no_tp_posturometry@test.com', password='pass1234', role='trainer',
        )
        self.customer = User.objects.create_user(
            email='customer_ntp@test.com', password='pass1234', role='customer',
        )
        self.client.force_authenticate(user=self.trainer_user)

    def test_get_returns_404_when_no_trainer_profile(self):
        """GET returns 404 when authenticated user has no TrainerProfile."""
        resp = self.client.get(f'/api/trainer/my-clients/{self.customer.id}/posturometry/')
        self.assertEqual(resp.status_code, 404)
        self.assertIn('No trainer profile', resp.json()['detail'])

    def test_post_returns_404_when_no_trainer_profile(self):
        """POST returns 404 when authenticated user has no TrainerProfile."""
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/',
            data={'anterior_data': json.dumps({})},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 404)

    def test_post_returns_404_for_nonexistent_customer(self):
        """POST returns 404 when customer_id does not exist in the User table."""
        from core_app.models.trainer_profile import TrainerProfile as TP
        TP.objects.create(user=self.trainer_user, bio='t')
        pkg = Package.objects.create(title='T', price=10000, sessions_count=4, category='personalizado')
        slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(hours=1), ends_at=FIXED_NOW + timedelta(hours=2),
        )
        Booking.objects.create(
            customer=self.customer, package=pkg, slot=slot,
            trainer=self.trainer_user.trainer_profile, status='confirmed',
        )
        resp = self.client.post(
            '/api/trainer/my-clients/99999/posturometry/',
            data={'anterior_data': json.dumps({})},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 404)


@pytest.mark.django_db
class TestTrainerPosturometryDetailNoProfile(TestCase):
    """Cover no-trainer-profile branch on detail view."""

    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='no_tp_detail_posturometry@test.com', password='pass1234', role='trainer',
        )
        self.client.force_authenticate(user=self.trainer_user)

    def test_get_returns_404_when_no_trainer_profile(self):
        """GET detail returns 404 when user has no TrainerProfile."""
        resp = self.client.get('/api/trainer/my-clients/1/posturometry/1/')
        self.assertEqual(resp.status_code, 404)

    def test_put_returns_404_when_no_trainer_profile(self):
        """PUT returns 404 when user has no TrainerProfile."""
        resp = self.client.put('/api/trainer/my-clients/1/posturometry/1/', {}, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_delete_returns_404_when_no_trainer_profile(self):
        """DELETE returns 404 when user has no TrainerProfile."""
        resp = self.client.delete('/api/trainer/my-clients/1/posturometry/1/')
        self.assertEqual(resp.status_code, 404)


@pytest.mark.django_db
class TestTrainerPosturometryPutDelete(TestCase):
    """Cover PUT full-update and DELETE on the detail view."""

    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='trainer_pd@test.com', password='pass1234', role='trainer',
            first_name='Gus', last_name='T',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='t')
        self.customer = User.objects.create_user(
            email='customer_pd@test.com', password='pass1234', role='customer',
        )
        cp = self.customer.customer_profile
        cp.sex = 'femenino'
        cp.date_of_birth = '1990-01-01'
        cp.save()
        _make_booking(self.customer, self.trainer_profile)
        self.evaluation = PosturometryEvaluation.objects.create(
            customer=self.customer, trainer=self.trainer_profile,
            anterior_data=SAMPLE_ANTERIOR,
        )
        self.client.force_authenticate(user=self.trainer_user)

    def test_put_updates_all_fields(self):
        """PUT updates JSON fields, text fields, evaluation_date and recommendations."""
        new_anterior = {'cabeza': _normal(), 'cuello': _normal()}
        resp = self.client.put(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
            data=json.dumps({
                'anterior_data': new_anterior,
                'anterior_observations': 'Updated obs',
                'evaluation_date': '2026-06-15',
                'notes': 'Updated notes',
                'recommendations': {'global': {'result': 'OK', 'action': 'Continue'}},
            }),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['anterior_observations'], 'Updated obs')
        self.assertEqual(data['notes'], 'Updated notes')
        self.assertEqual(data['recommendations']['global']['result'], 'OK')

    def test_put_with_string_recommendations(self):
        """PUT parses recommendations from JSON string."""
        recs = json.dumps({'global': {'result': 'Parsed', 'action': 'Test'}})
        resp = self.client.put(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
            data=json.dumps({'recommendations': recs}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)

    def test_put_with_invalid_recommendations_string(self):
        """PUT handles non-JSON recommendations string gracefully."""
        resp = self.client.put(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
            data=json.dumps({'recommendations': 'not-valid-json'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)

    def test_delete_evaluation(self):
        """DELETE removes evaluation and returns 204."""
        resp = self.client.delete(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{self.evaluation.id}/',
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(PosturometryEvaluation.objects.filter(id=self.evaluation.id).exists())


@pytest.mark.django_db
class TestPosturometrySerializerHelpers(TestCase):
    """Cover serializer helper methods: _photo_url and get_trainer_name edge cases."""

    def test_photo_url_returns_none_when_no_photo(self):
        """_photo_url returns None when photo field has no file."""
        from core_app.views.posturometry_views import PosturometrySerializer
        customer = User.objects.create_user(email='ser_help@test.com', password='p', role='customer')
        trainer_user = User.objects.create_user(email='ser_t@test.com', password='p', role='trainer')
        tp = TrainerProfile.objects.create(user=trainer_user, bio='t')
        ev = PosturometryEvaluation.objects.create(customer=customer, trainer=tp)
        serializer = PosturometrySerializer(ev, context={})
        self.assertIsNone(serializer.data['anterior_photo'])

    def test_photo_url_returns_relative_url_without_request(self):
        """_photo_url returns relative URL when no request in context."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        from core_app.views.posturometry_views import PosturometrySerializer
        customer = User.objects.create_user(email='ser_help3@test.com', password='p', role='customer')
        trainer_user = User.objects.create_user(email='ser_t3@test.com', password='p', role='trainer')
        tp = TrainerProfile.objects.create(user=trainer_user, bio='t')
        ev = PosturometryEvaluation.objects.create(customer=customer, trainer=tp)
        ev.anterior_photo = SimpleUploadedFile('test.jpg', b'\xff\xd8\xff\xe0' + b'\x00' * 50, content_type='image/jpeg')
        ev.save()
        serializer = PosturometrySerializer(ev, context={})
        self.assertIsNotNone(serializer.data['anterior_photo'])
        self.assertNotIn('http', serializer.data['anterior_photo'])

    def test_trainer_name_empty_when_no_trainer(self):
        """get_trainer_name returns empty string when trainer is None."""
        from core_app.views.posturometry_views import PosturometrySerializer
        customer = User.objects.create_user(email='ser_help2@test.com', password='p', role='customer')
        ev = PosturometryEvaluation.objects.create(customer=customer, trainer=None)
        serializer = PosturometrySerializer(ev, context={})
        self.assertEqual(serializer.data['trainer_name'], '')


@pytest.mark.django_db
class TestParseJsonField(TestCase):
    """Cover _parse_json_field helper with various input types."""

    def test_returns_empty_dict_for_none(self):
        from core_app.views.posturometry_views import _parse_json_field
        self.assertEqual(_parse_json_field({}, 'missing_field'), {})

    def test_returns_dict_when_already_dict(self):
        from core_app.views.posturometry_views import _parse_json_field
        data = {'field': {'key': 'value'}}
        self.assertEqual(_parse_json_field(data, 'field'), {'key': 'value'})

    def test_parses_valid_json_string(self):
        from core_app.views.posturometry_views import _parse_json_field
        data = {'field': '{"key": "value"}'}
        self.assertEqual(_parse_json_field(data, 'field'), {'key': 'value'})

    def test_returns_empty_dict_for_invalid_json_string(self):
        from core_app.views.posturometry_views import _parse_json_field
        data = {'field': 'not-valid-json'}
        self.assertEqual(_parse_json_field(data, 'field'), {})

    def test_returns_empty_dict_for_non_string_non_dict(self):
        from core_app.views.posturometry_views import _parse_json_field
        data = {'field': 12345}
        self.assertEqual(_parse_json_field(data, 'field'), {})


@pytest.mark.django_db
class TestPosturometryPhotoUpload(TestCase):
    """Cover photo upload branches in create and update views."""

    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='photo_trainer@test.com', password='pass1234', role='trainer',
            first_name='Photo', last_name='Trainer',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='t')
        self.customer = User.objects.create_user(
            email='photo_customer@test.com', password='pass1234', role='customer',
        )
        cp = self.customer.customer_profile
        cp.sex = 'masculino'
        cp.date_of_birth = '1990-01-01'
        cp.save()
        _make_booking(self.customer, self.trainer_profile)
        self.client.force_authenticate(user=self.trainer_user)

    def test_create_with_photo_upload(self):
        """POST with photo file triggers the setattr photo branch."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        photo = SimpleUploadedFile('anterior.jpg', b'\xff\xd8\xff\xe0' + b'\x00' * 100, content_type='image/jpeg')
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/',
            data={
                'anterior_data': json.dumps({}),
                'anterior_photo': photo,
            },
            format='multipart',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIsNotNone(resp.json()['anterior_photo'])

    def test_put_with_photo_upload(self):
        """PUT with photo file triggers the photo branch in _apply_full_update."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        ev = PosturometryEvaluation.objects.create(
            customer=self.customer, trainer=self.trainer_profile,
        )
        photo = SimpleUploadedFile('lateral.jpg', b'\xff\xd8\xff\xe0' + b'\x00' * 100, content_type='image/jpeg')
        resp = self.client.put(
            f'/api/trainer/my-clients/{self.customer.id}/posturometry/{ev.id}/',
            data={
                'anterior_data': json.dumps({}),
                'lateral_right_photo': photo,
            },
            format='multipart',
        )
        self.assertEqual(resp.status_code, 200)


@pytest.mark.django_db
class TestPosturometryCustomerDoesNotExist(TestCase):
    """Cover the User.DoesNotExist branch when customer has booking but role mismatch."""

    def setUp(self):
        self.client = APIClient()
        self.trainer_user = User.objects.create_user(
            email='dne_trainer@test.com', password='pass1234', role='trainer',
        )
        self.trainer_profile = TrainerProfile.objects.create(user=self.trainer_user, bio='t')
        self.non_customer = User.objects.create_user(
            email='dne_noncust@test.com', password='pass1234', role='trainer',
        )
        _make_booking(self.non_customer, self.trainer_profile)
        self.client.force_authenticate(user=self.trainer_user)

    def test_post_returns_404_when_user_exists_but_not_customer_role(self):
        """POST returns 404 when customer_id user exists but has wrong role."""
        resp = self.client.post(
            f'/api/trainer/my-clients/{self.non_customer.id}/posturometry/',
            data={'anterior_data': json.dumps({})},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 404)
