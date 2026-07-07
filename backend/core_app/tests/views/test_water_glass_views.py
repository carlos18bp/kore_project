"""Tests for the water-glass photo upload endpoint."""

import io
from datetime import date, timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone as dj_tz
from PIL import Image
from rest_framework.test import APIClient

from core_app.models import NutritionDailyLog, Package, Subscription, User, WaterGlassLog


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


def _grant_nutrition(customer):
    """Give the customer an active subscription that includes nutrition (Part 8 paywall)."""
    pkg = Package.objects.create(title='Nutri', sessions_count=1, price=1, includes_nutrition=True)
    Subscription.objects.create(
        customer=customer, package=pkg, sessions_total=1, status='active',
        starts_at=dj_tz.now(), expires_at=dj_tz.now() + timedelta(days=30), includes_nutrition=True,
    )


def _make_image(name='selfie.jpg', size=(200, 200), color=(120, 180, 240)):
    """Return a SimpleUploadedFile with a real JPEG payload."""
    buf = io.BytesIO()
    Image.new('RGB', size, color).save(buf, format='JPEG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/jpeg')


@pytest.mark.django_db
class TestWaterGlassCreate:
    def _setup(self):
        client = APIClient()
        customer = User.objects.create_user(email='hydra@test.com', password='pass', role='customer')
        _auth(client, customer)
        _grant_nutrition(customer)
        log = NutritionDailyLog.objects.create(customer=customer, date=date.today())
        return client, customer, log

    def test_create_glass_returns_201_and_persists(self):
        client, _, log = self._setup()

        resp = client.post(
            f'/api/my-nutrition-daily/{log.id}/water-glasses/',
            {'photo': _make_image()},
            format='multipart',
        )

        assert resp.status_code == 201
        assert resp.data['id'] is not None
        assert resp.data['photo_url']
        assert WaterGlassLog.objects.filter(daily_log=log).count() == 1

    def test_other_customer_cannot_post_to_log(self):
        client_a, _, log_a = self._setup()
        intruder = User.objects.create_user(email='intruder@test.com', password='pass', role='customer')
        _grant_nutrition(intruder)

        client_b = APIClient()
        _auth(client_b, intruder)

        resp = client_b.post(
            f'/api/my-nutrition-daily/{log_a.id}/water-glasses/',
            {'photo': _make_image()},
            format='multipart',
        )

        assert resp.status_code == 404
        assert WaterGlassLog.objects.filter(daily_log=log_a).count() == 0

    def test_closed_log_rejects_upload(self):
        client, _, log = self._setup()
        log.is_closed = True
        log.save(update_fields=['is_closed'])

        resp = client.post(
            f'/api/my-nutrition-daily/{log.id}/water-glasses/',
            {'photo': _make_image()},
            format='multipart',
        )

        assert resp.status_code == 400
        assert 'cerrado' in resp.data['detail'].lower()

    def test_unauthenticated_rejected(self):
        _, _, log = self._setup()
        anon = APIClient()

        resp = anon.post(
            f'/api/my-nutrition-daily/{log.id}/water-glasses/',
            {'photo': _make_image()},
            format='multipart',
        )

        assert resp.status_code == 401
