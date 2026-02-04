import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import Package


def _results(data):
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


@pytest.mark.django_db
def test_package_list_filters_only_active_for_anonymous(api_client):
    Package.objects.create(title='Active', is_active=True)
    Package.objects.create(title='Inactive', is_active=False)

    url = reverse('package-list')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    titles = {item['title'] for item in _results(response.data)}
    assert titles == {'Active'}


@pytest.mark.django_db
def test_package_create_requires_admin(api_client):
    url = reverse('package-list')
    response = api_client.post(url, {'title': 'New'}, format='json')

    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_package_create_allows_admin(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    url = reverse('package-list')
    response = api_client.post(url, {'title': 'New', 'sessions_count': 4}, format='json')

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['title'] == 'New'
