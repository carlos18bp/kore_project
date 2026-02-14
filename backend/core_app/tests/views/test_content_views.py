import pytest

from django.urls import reverse
from rest_framework import status

from core_app.models import FAQItem, SiteSettings
from core_app.tests.helpers import get_results


@pytest.mark.django_db
class TestSiteSettingsView:
    def test_get_public(self, api_client):
        obj = SiteSettings.load()
        obj.company_name = 'KÓRE'
        obj.save()

        url = reverse('site-settings')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['company_name'] == 'KÓRE'

    def test_patch_requires_admin(self, api_client, existing_user):
        api_client.force_authenticate(user=existing_user)
        url = reverse('site-settings')
        response = api_client.patch(url, {'company_name': 'Hack'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_patch_anonymous_denied(self, api_client):
        url = reverse('site-settings')
        response = api_client.patch(url, {'company_name': 'Hack'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_patch_allowed_for_admin(self, api_client, admin_user):
        SiteSettings.load()
        api_client.force_authenticate(user=admin_user)
        url = reverse('site-settings')
        response = api_client.patch(url, {'company_name': 'Updated'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['company_name'] == 'Updated'
        assert SiteSettings.load().company_name == 'Updated'


@pytest.mark.django_db
class TestFAQItemViewSet:
    def test_list_public_shows_only_active(self, api_client):
        FAQItem.objects.create(question='Active', answer='a', is_active=True)
        FAQItem.objects.create(question='Inactive', answer='a', is_active=False)

        url = reverse('faq-list')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        questions = {item['question'] for item in get_results(response.data)}
        assert questions == {'Active'}

    def test_list_admin_shows_all(self, api_client, admin_user):
        FAQItem.objects.create(question='Active', answer='a', is_active=True)
        FAQItem.objects.create(question='Inactive', answer='a', is_active=False)

        api_client.force_authenticate(user=admin_user)
        url = reverse('faq-list')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(get_results(response.data)) == 2

    def test_create_requires_admin(self, api_client):
        url = reverse('faq-list')
        response = api_client.post(url, {'question': 'Q?', 'answer': 'A.'}, format='json')
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_create_allowed_for_admin(self, api_client, admin_user):
        api_client.force_authenticate(user=admin_user)
        url = reverse('faq-list')
        response = api_client.post(url, {'question': 'New Q?', 'answer': 'New A.'}, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert FAQItem.objects.filter(question='New Q?').exists()
