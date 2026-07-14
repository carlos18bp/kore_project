"""Tests for package API views."""

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Package
from core_app.tests.helpers import get_results


@pytest.mark.django_db
def test_package_list_filters_only_active_for_anonymous(api_client):
    """List only active packages for anonymous users."""
    Package.objects.create(title='Active', is_active=True)
    Package.objects.create(title='Inactive', is_active=False)

    url = reverse('package-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    titles = {item['title'] for item in get_results(response.data)}
    assert titles == {'Active'}


@pytest.mark.django_db
def test_package_create_requires_admin(api_client):
    """Reject package creation requests from non-admin users."""
    url = reverse('package-list')
    response = api_client.post(url, {'title': 'New'}, format='json')

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_package_create_allows_admin(api_client, admin_user):
    """Allow admins to create package records."""
    api_client.force_authenticate(user=admin_user)

    url = reverse('package-list')
    response = api_client.post(url, {'title': 'New', 'sessions_count': 4}, format='json')

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['title'] == 'New'


@pytest.mark.django_db
def test_package_list_returns_all_for_admin(api_client, admin_user):
    """Admin sees both active and inactive packages (line 15)."""
    Package.objects.create(title='Active', is_active=True)
    Package.objects.create(title='Inactive', is_active=False)

    api_client.force_authenticate(user=admin_user)
    url = reverse('package-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    titles = {item['title'] for item in get_results(response.data)}
    assert titles == {'Active', 'Inactive'}


@pytest.mark.django_db
def test_package_admin_can_toggle_includes_nutrition(api_client, admin_user):
    """The nutrition flag round-trips through PackageSerializer."""
    package = Package.objects.create(title='Plan', sessions_count=4, includes_nutrition=False)
    api_client.force_authenticate(user=admin_user)

    url = reverse('package-detail', args=[package.pk])
    response = api_client.patch(url, {'includes_nutrition': True}, format='json')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['includes_nutrition'] is True
    package.refresh_from_db()
    assert package.includes_nutrition is True
