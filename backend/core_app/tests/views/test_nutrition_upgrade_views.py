import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import Package, Subscription
from core_app.models.nutrition_product import NutritionProduct


@pytest.mark.django_db
def test_access_endpoint_reports_flag(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/nutrition/access/')
    assert resp.status_code == 200
    assert resp.json()['has_nutrition_access'] is False


@pytest.mark.django_db
def test_upgrade_prorates_half_cycle(api_client, existing_user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000, validity_days=30)
    today = timezone.localdate()
    Subscription.objects.create(customer=existing_user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=15), status='active', next_billing_date=today + timedelta(days=15))
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/nutrition/upgrade/', {}, format='json')
    assert resp.status_code == 201
    body = resp.json()
    assert body['amount_cop'] == 15000  # 15/30 of 30000
    assert body['reference'].startswith('NU-')
    assert 'checkout.wompi.co' in body['checkout_url']


@pytest.mark.django_db
def test_upgrade_requires_active_subscription(api_client, existing_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/nutrition/upgrade/', {}, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_upgrade_rejects_when_already_included(api_client, existing_user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000, validity_days=30)
    Subscription.objects.create(customer=existing_user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=15), status='active', includes_nutrition=True, next_billing_date=timezone.localdate() + timedelta(days=15))
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/nutrition/upgrade/', {}, format='json')
    assert resp.status_code == 400
