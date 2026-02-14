"""Tests for SubscriptionViewSet (authenticated, own subscriptions only)."""

import pytest
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Subscription, User
from core_app.tests.helpers import get_results


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='sub_view_cust@example.com', password='p',
        first_name='Carlos', last_name='Diaz', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def other_customer(db):
    return User.objects.create_user(
        email='sub_view_other@example.com', password='p',
        first_name='Other', last_name='User', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(title='Silver', sessions_count=8, validity_days=30, is_active=True)


@pytest.fixture
def active_subscription(customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=8, sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


@pytest.fixture
def expired_subscription(customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=now - timedelta(days=60), expires_at=now - timedelta(days=30),
    )


@pytest.mark.django_db
class TestSubscriptionViews:
    def test_list_requires_authentication(self, api_client):
        url = reverse('subscription-list')
        response = api_client.get(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_list_returns_own_subscriptions(self, api_client, customer, active_subscription, expired_subscription):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        assert len(results) == 2

    def test_list_excludes_other_users_subscriptions(
        self, api_client, customer, other_customer, active_subscription, package
    ):
        now = timezone.now()
        Subscription.objects.create(
            customer=other_customer, package=package,
            sessions_total=4, starts_at=now, expires_at=now + timedelta(days=30),
        )
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        assert len(results) == 1

    def test_admin_sees_all_subscriptions(
        self, api_client, admin_user, customer, active_subscription, package
    ):
        now = timezone.now()
        Subscription.objects.create(
            customer=admin_user, package=package,
            sessions_total=4, starts_at=now, expires_at=now + timedelta(days=30),
        )
        api_client.force_authenticate(user=admin_user)
        url = reverse('subscription-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        results = get_results(response.data)
        assert len(results) == 2

    def test_retrieve_own_subscription(self, api_client, customer, active_subscription):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-detail', args=[active_subscription.pk])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['sessions_remaining'] == 6
        assert response.data['status'] == 'active'

    def test_create_not_allowed_for_customer(self, api_client, customer, package):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-list')
        response = api_client.post(url, {'package_id': package.pk}, format='json')

        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_subscription_includes_package_data(self, api_client, customer, active_subscription):
        api_client.force_authenticate(user=customer)
        url = reverse('subscription-detail', args=[active_subscription.pk])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'package' in response.data
        assert response.data['package']['title'] == 'Silver'
