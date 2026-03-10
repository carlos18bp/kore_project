"""View tests for profile, avatar, change-password, mood, and weight endpoints."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image as PILImage
from rest_framework.test import APIClient

from core_app.models import CustomerProfile, MoodEntry, User, WeightEntry


def _auth_client(user):
    """Return an APIClient authenticated for *user*."""
    from rest_framework_simplejwt.tokens import RefreshToken
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')
    return client


def _make_image(fmt='PNG', size=(100, 100)):
    """Create a minimal in-memory image file."""
    img = PILImage.new('RGB', size, color='red')
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    ext = fmt.lower()
    return SimpleUploadedFile(f'test.{ext}', buf.read(), content_type=f'image/{ext}')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer@test.com', password='testpass123',
        first_name='Test', last_name='Customer',
    )


# ── GET /api/auth/profile/ ──


@pytest.mark.django_db
class TestGetProfile:

    def test_returns_profile_with_customer_profile(self, customer):
        client = _auth_client(customer)
        resp = client.get('/api/auth/profile/')
        assert resp.status_code == 200
        data = resp.json()['user']
        assert data['email'] == 'customer@test.com'
        assert 'customer_profile' in data
        assert data['customer_profile']['profile_completed'] is False

    def test_returns_today_mood_null_when_none(self, customer):
        client = _auth_client(customer)
        resp = client.get('/api/auth/profile/')
        assert resp.json()['user']['today_mood'] is None

    def test_returns_today_mood_when_set(self, customer):
        MoodEntry.objects.create(user=customer, mood='motivated')
        client = _auth_client(customer)
        resp = client.get('/api/auth/profile/')
        mood = resp.json()['user']['today_mood']
        assert mood['mood'] == 'motivated'


# ── PATCH /api/auth/profile/ ──


@pytest.mark.django_db
class TestUpdateProfile:

    def test_update_user_and_profile_fields(self, customer):
        client = _auth_client(customer)
        resp = client.patch('/api/auth/profile/', {
            'first_name': 'Nuevo',
            'sex': 'masculino',
            'date_of_birth': '1990-05-15',
            'city': 'Medellín',
            'primary_goal': 'muscle_gain',
        }, format='json')
        assert resp.status_code == 200
        data = resp.json()['user']
        assert data['first_name'] == 'Nuevo'
        cp = data['customer_profile']
        assert cp['sex'] == 'masculino'
        assert cp['city'] == 'Medellín'
        assert cp['date_of_birth'] == '1990-05-15'
        assert cp['profile_completed'] is True

    def test_partial_update_keeps_existing_data(self, customer):
        profile = customer.customer_profile
        profile.city = 'Bogotá'
        profile.save()
        client = _auth_client(customer)
        resp = client.patch('/api/auth/profile/', {'sex': 'femenino'}, format='json')
        assert resp.status_code == 200
        customer.customer_profile.refresh_from_db()
        assert customer.customer_profile.city == 'Bogotá'
        assert customer.customer_profile.sex == 'femenino'


# ── POST /api/auth/profile/avatar/ ──


@pytest.mark.django_db
class TestUploadAvatar:

    def test_upload_png_avatar(self, customer):
        client = _auth_client(customer)
        image = _make_image('PNG')
        resp = client.post('/api/auth/profile/avatar/', {'avatar': image}, format='multipart')
        assert resp.status_code == 200
        assert resp.json()['avatar_url'] is not None
        customer.customer_profile.refresh_from_db()
        assert bool(customer.customer_profile.avatar)

    def test_rejects_oversized_file(self, customer):
        client = _auth_client(customer)
        # Create a file > 5MB
        big = SimpleUploadedFile('big.png', b'x' * (6 * 1024 * 1024), content_type='image/png')
        resp = client.post('/api/auth/profile/avatar/', {'avatar': big}, format='multipart')
        assert resp.status_code == 400


# ── POST /api/auth/change-password/ ──


@pytest.mark.django_db
class TestChangePassword:

    def test_successful_password_change(self, customer):
        client = _auth_client(customer)
        resp = client.post('/api/auth/change-password/', {
            'current_password': 'testpass123',
            'new_password': 'newSecure123!',
            'new_password_confirm': 'newSecure123!',
        }, format='json')
        assert resp.status_code == 200
        customer.refresh_from_db()
        assert customer.check_password('newSecure123!')

    def test_wrong_current_password(self, customer):
        client = _auth_client(customer)
        resp = client.post('/api/auth/change-password/', {
            'current_password': 'wrongpass',
            'new_password': 'newSecure123!',
            'new_password_confirm': 'newSecure123!',
        }, format='json')
        assert resp.status_code == 400

    def test_mismatched_confirm(self, customer):
        client = _auth_client(customer)
        resp = client.post('/api/auth/change-password/', {
            'current_password': 'testpass123',
            'new_password': 'newSecure123!',
            'new_password_confirm': 'different!',
        }, format='json')
        assert resp.status_code == 400


# ── GET/POST /api/auth/mood/ ──


@pytest.mark.django_db
class TestMoodEndpoint:

    def test_get_mood_returns_null_when_none(self, customer):
        client = _auth_client(customer)
        resp = client.get('/api/auth/mood/')
        assert resp.status_code == 200
        assert resp.json()['mood'] is None

    def test_post_mood_creates_entry(self, customer):
        client = _auth_client(customer)
        resp = client.post('/api/auth/mood/', {'mood': 'tired'}, format='json')
        assert resp.status_code == 201
        assert resp.json()['mood'] == 'tired'
        assert MoodEntry.objects.filter(user=customer).count() == 1

    def test_post_mood_updates_existing(self, customer):
        MoodEntry.objects.create(user=customer, mood='neutral')
        client = _auth_client(customer)
        resp = client.post('/api/auth/mood/', {'mood': 'motivated'}, format='json')
        assert resp.status_code == 200
        assert MoodEntry.objects.filter(user=customer).count() == 1
        assert MoodEntry.objects.get(user=customer).mood == 'motivated'


# ── POST /api/auth/weight/ ──


@pytest.mark.django_db
class TestWeightEndpoint:

    def test_post_weight_creates_entry(self, customer):
        client = _auth_client(customer)
        resp = client.post('/api/auth/weight/', {'weight_kg': '72.5'}, format='json')
        assert resp.status_code == 201
        assert WeightEntry.objects.filter(user=customer).count() == 1

    def test_post_weight_syncs_profile(self, customer):
        client = _auth_client(customer)
        client.post('/api/auth/weight/', {'weight_kg': '80.0'}, format='json')
        customer.customer_profile.refresh_from_db()
        assert float(customer.customer_profile.current_weight_kg) == pytest.approx(80.0, abs=0.1)

    def test_post_weight_updates_existing_today(self, customer):
        WeightEntry.objects.create(user=customer, weight_kg=70)
        client = _auth_client(customer)
        resp = client.post('/api/auth/weight/', {'weight_kg': '72.0'}, format='json')
        assert resp.status_code == 200
        assert WeightEntry.objects.filter(user=customer).count() == 1
        assert float(WeightEntry.objects.get(user=customer).weight_kg) == pytest.approx(72.0, abs=0.1)
