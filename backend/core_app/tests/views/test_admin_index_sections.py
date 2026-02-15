import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_admin_index_groups_core_models_into_functional_sections(client, django_user_model):
    superuser = django_user_model.objects.create_superuser(
        email='superadmin@example.com',
        password='supersecurepassword',
    )
    client.force_login(superuser)

    response = client.get(reverse('admin:index'))

    assert response.status_code == 200

    content = response.content.decode()
    sections = [
        'Users and Profiles',
        'Programs and Availability',
        'Bookings and Subscriptions',
        'Payments and Communication',
        'Content and Analytics',
    ]
    for section in sections:
        assert section in content
        assert content.count(section) == 1

    assert 'Use the navigation sidebar to access administrative sections.' in content

    assert '/admin/core_app/user/' in content
    assert '/admin/core_app/package/' in content
    assert '/admin/core_app/booking/' in content
    assert '/admin/core_app/payment/' in content
    assert '/admin/core_app/analyticsevent/' in content
