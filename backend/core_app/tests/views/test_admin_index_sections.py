"""Tests for custom section rendering on Django admin index."""

import pytest
from django.urls import reverse


@pytest.fixture
def admin_index_response(client, django_user_model):
    """Return admin index response for an authenticated superuser session."""
    superuser = django_user_model.objects.create_superuser(
        email='superadmin@example.com',
        password='supersecurepassword',
    )
    client.force_login(superuser)

    return client.get(reverse('admin:index'))


@pytest.mark.django_db
def test_admin_index_returns_200(admin_index_response):
    """Admin index endpoint responds with HTML content for superusers."""
    assert admin_index_response.status_code == 200
    assert 'text/html' in admin_index_response['Content-Type']


@pytest.mark.django_db
def test_admin_index_renders_functional_sections_once(admin_index_response):
    """Renders each expected admin index section heading exactly once."""
    content = admin_index_response.content.decode()
    sections = [
        'Users and Profiles',
        'Programs and Availability',
        'Bookings and Subscriptions',
        'Payments and Communication',
        'Content and Analytics',
    ]

    missing_sections = [section for section in sections if section not in content]
    duplicate_sections = [section for section in sections if content.count(section) != 1]

    assert not missing_sections
    assert not duplicate_sections


@pytest.mark.django_db
def test_admin_index_renders_sidebar_guidance(admin_index_response):
    """Admin index includes sidebar guidance helper text."""
    content = admin_index_response.content.decode()
    assert 'Use the navigation sidebar to access administrative sections.' in content


@pytest.mark.django_db
@pytest.mark.parametrize(
    'admin_path',
    [
        '/admin/core_app/user/',
        '/admin/core_app/package/',
        '/admin/core_app/booking/',
        '/admin/core_app/payment/',
        '/admin/core_app/analyticsevent/',
    ],
)
def test_admin_index_renders_core_model_links(admin_index_response, admin_path):
    """Admin index includes links for each expected core model changelist."""
    content = admin_index_response.content.decode()
    assert admin_path in content
