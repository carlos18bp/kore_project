import pytest

from django.urls import reverse
from rest_framework import status

from core_app.models import AnalyticsEvent
from core_app.tests.helpers import get_results


@pytest.mark.django_db
def test_analytics_create_public(api_client):
    url = reverse('analytics-event-list')
    response = api_client.post(url, {
        'event_type': 'whatsapp_click',
        'session_id': 'sess-1',
        'path': '/home',
    }, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert AnalyticsEvent.objects.count() == 1


@pytest.mark.django_db
def test_analytics_list_requires_admin(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)
    url = reverse('analytics-event-list')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_analytics_list_anonymous_denied(api_client):
    url = reverse('analytics-event-list')
    response = api_client.get(url)
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_analytics_list_allowed_for_admin(api_client, admin_user):
    AnalyticsEvent.objects.create(event_type=AnalyticsEvent.Type.WHATSAPP_CLICK)
    AnalyticsEvent.objects.create(event_type=AnalyticsEvent.Type.PACKAGE_VIEW)

    api_client.force_authenticate(user=admin_user)
    url = reverse('analytics-event-list')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 2


@pytest.mark.django_db
def test_analytics_delete_requires_admin(api_client, existing_user):
    event = AnalyticsEvent.objects.create(event_type=AnalyticsEvent.Type.WHATSAPP_CLICK)
    api_client.force_authenticate(user=existing_user)
    url = reverse('analytics-event-detail', args=[event.id])
    response = api_client.delete(url)
    assert response.status_code == status.HTTP_403_FORBIDDEN
