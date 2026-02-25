"""Tests for content-related API views (site settings, FAQs, contact messages)."""

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import ContactMessage, FAQCategory, FAQItem, SiteSettings
from core_app.tests.helpers import get_results


@pytest.mark.django_db
class TestSiteSettingsView:
    """Covers read/update access rules for site settings endpoint."""

    def test_get_public(self, api_client):
        """Site settings endpoint is publicly readable and returns persisted values."""
        obj = SiteSettings.load()
        obj.company_name = 'KÓRE'
        obj.save()

        url = reverse('site-settings')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['company_name'] == 'KÓRE'

    def test_patch_requires_admin(self, api_client, existing_user):
        """Non-admin authenticated users cannot patch site settings."""
        api_client.force_authenticate(user=existing_user)
        url = reverse('site-settings')
        response = api_client.patch(url, {'company_name': 'Hack'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_patch_anonymous_denied(self, api_client):
        """Anonymous users cannot patch site settings."""
        url = reverse('site-settings')
        response = api_client.patch(url, {'company_name': 'Hack'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_patch_allowed_for_admin(self, api_client, admin_user):
        """Admin users can patch site settings and persist changes."""
        SiteSettings.load()
        api_client.force_authenticate(user=admin_user)
        url = reverse('site-settings')
        response = api_client.patch(url, {'company_name': 'Updated'}, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['company_name'] == 'Updated'
        assert SiteSettings.load().company_name == 'Updated'


@pytest.mark.django_db
class TestFAQItemViewSet:
    """Covers FAQ item visibility and creation permissions."""

    def test_list_public_shows_only_active(self, api_client):
        """Public FAQ list includes only active FAQ items."""
        FAQItem.objects.create(question='Active', answer='a', is_active=True)
        FAQItem.objects.create(question='Inactive', answer='a', is_active=False)

        url = reverse('faq-list')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        questions = {item['question'] for item in get_results(response.data)}
        assert questions == {'Active'}

    def test_list_admin_shows_all(self, api_client, admin_user):
        """Admin FAQ list includes active and inactive FAQ items."""
        FAQItem.objects.create(question='Active', answer='a', is_active=True)
        FAQItem.objects.create(question='Inactive', answer='a', is_active=False)

        api_client.force_authenticate(user=admin_user)
        url = reverse('faq-list')
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(get_results(response.data)) == 2

    def test_create_requires_admin(self, api_client):
        """FAQ item creation is blocked for unauthenticated users."""
        url = reverse('faq-list')
        response = api_client.post(url, {'question': 'Q?', 'answer': 'A.'}, format='json')
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_create_allowed_for_admin(self, api_client, admin_user):
        """Admin users can create FAQ items."""
        api_client.force_authenticate(user=admin_user)
        url = reverse('faq-list')
        response = api_client.post(url, {'question': 'New Q?', 'answer': 'New A.'}, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert FAQItem.objects.filter(question='New Q?').exists()


@pytest.mark.django_db
class TestFAQCategoryViewSet:
    """Covers FAQ category list visibility for public and admin consumers."""

    def test_list_public_shows_only_active_categories(self, api_client):
        """Public FAQ category list includes only active categories."""
        FAQCategory.objects.create(name='Active', slug='active', is_active=True)
        FAQCategory.objects.create(name='Inactive', slug='inactive', is_active=False)

        url = reverse('faq-category-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        names = {category['name'] for category in get_results(response.data)}
        assert names == {'Active'}

    def test_list_admin_shows_all_categories(self, api_client, admin_user):
        """Admin FAQ category list includes active and inactive categories."""
        FAQCategory.objects.create(name='Active', slug='active', is_active=True)
        FAQCategory.objects.create(name='Inactive', slug='inactive', is_active=False)

        api_client.force_authenticate(user=admin_user)
        url = reverse('faq-category-list')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(get_results(response.data)) == 2


@pytest.mark.django_db
class TestFAQPublicGrouped:
    """Covers grouped public FAQ response composition rules."""

    def test_public_grouped_returns_categories_and_uncategorized_items(self, api_client):
        """Return active categorized FAQs plus an uncategorized group when applicable."""
        category = FAQCategory.objects.create(name='General', slug='general', is_active=True, order=1)
        empty_category = FAQCategory.objects.create(name='Empty', slug='empty', is_active=True, order=2)
        FAQItem.objects.create(category=category, question='Q1', answer='A1', is_active=True, order=1)
        FAQItem.objects.create(category=category, question='Q2', answer='A2', is_active=False, order=2)
        FAQItem.objects.create(category=None, question='Q3', answer='A3', is_active=True, order=1)

        url = reverse('faq-public')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        groups = response.data
        category_ids = {group['category']['id'] for group in groups if group['category']}
        uncategorized_groups = [group for group in groups if group['category'] is None]

        assert category.id in category_ids
        assert empty_category.id not in category_ids
        assert len(uncategorized_groups) == 1
        assert {item['question'] for item in uncategorized_groups[0]['items']} == {'Q3'}

    def test_public_grouped_omits_uncategorized_group_when_none_exist(self, api_client):
        """Grouped FAQ response omits uncategorized block when all active items have category."""
        category = FAQCategory.objects.create(name='General', slug='general', is_active=True, order=1)
        FAQItem.objects.create(category=category, question='Q1', answer='A1', is_active=True, order=1)

        url = reverse('faq-public')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        groups = response.data
        assert len(groups) == 1
        assert groups[0]['category']['id'] == category.id
        assert groups[0]['items'][0]['question'] == 'Q1'


@pytest.mark.django_db
class TestContactMessageViewSet:
    """Covers public contact message creation and admin-only listing."""

    def test_create_allows_anonymous(self, api_client):
        """Anonymous users can submit contact messages successfully."""
        url = reverse('contact-message-list')
        response = api_client.post(
            url,
            {'name': 'Ana', 'email': 'ana@example.com', 'phone': '300', 'message': 'Hola'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['detail'] == 'Mensaje recibido correctamente.'
        assert ContactMessage.objects.filter(email='ana@example.com').exists()
        assert ContactMessage.objects.get(email='ana@example.com').status == ContactMessage.Status.NEW

    def test_list_requires_admin(self, api_client, existing_user):
        """Contact message listing denies non-admin authenticated users."""
        ContactMessage.objects.create(
            name='Ana', email='ana@example.com', phone='300', message='Hola',
        )

        api_client.force_authenticate(user=existing_user)
        url = reverse('contact-message-list')
        response = api_client.get(url)

        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
