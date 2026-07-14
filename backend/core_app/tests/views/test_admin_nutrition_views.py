"""Tests for the admin nutrition-product endpoint (singleton price of the add-on)."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Subscription
from core_app.models.nutrition_product import NutritionProduct

URL_NAME = 'admin-nutrition-product'


@pytest.mark.django_db
def test_non_admin_cannot_read_the_nutrition_product(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_creates_the_singleton_when_none_exists(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['price_cop'] == 0
    assert response.data['is_active'] is True
    assert NutritionProduct.objects.count() == 1


@pytest.mark.django_db
def test_get_returns_the_existing_row_without_creating_another(api_client, admin_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.data['price_cop'] == 30000
    assert NutritionProduct.objects.count() == 1


@pytest.mark.django_db
def test_get_counts_active_subscriptions_with_nutrition(api_client, admin_user, existing_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    package = Package.objects.create(title='Plan', sessions_count=4)
    now = timezone.now()
    Subscription.objects.create(
        customer=existing_user, package=package, sessions_total=4,
        starts_at=now, expires_at=now + timedelta(days=30),
        status=Subscription.Status.ACTIVE, includes_nutrition=True,
    )
    Subscription.objects.create(
        customer=admin_user, package=package, sessions_total=4,
        starts_at=now, expires_at=now + timedelta(days=30),
        status=Subscription.Status.ACTIVE, includes_nutrition=False,
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.data['active_nutrition_subscriptions'] == 1


@pytest.mark.django_db
def test_patch_updates_the_price(api_client, admin_user):
    product = NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(reverse(URL_NAME), {'price_cop': 45000}, format='json')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['price_cop'] == 45000
    product.refresh_from_db()
    assert product.price_cop == 45000


@pytest.mark.django_db
def test_patch_rejects_a_negative_price(api_client, admin_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(reverse(URL_NAME), {'price_cop': -1}, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST
