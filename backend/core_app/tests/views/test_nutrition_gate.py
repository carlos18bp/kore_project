import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import Package, Subscription


@pytest.mark.django_db
def test_my_nutrition_daily_today_locked_without_access(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/my-nutrition-daily/today/')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_my_nutrition_daily_today_open_with_access(api_client, existing_user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000)
    Subscription.objects.create(customer=existing_user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30), status='active', includes_nutrition=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/my-nutrition-daily/today/')
    assert resp.status_code == 200
