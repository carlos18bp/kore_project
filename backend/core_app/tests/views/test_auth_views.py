import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
def test_register_user_success(api_client):
    url = reverse('register-user')
    response = api_client.post(
        url,
        {
            'email': 'new_user@example.com',
            'password': 'newuserpassword',
            'password_confirm': 'newuserpassword',
            'first_name': 'New',
            'last_name': 'User',
            'phone': '123456789',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert 'tokens' in response.data
    assert 'access' in response.data['tokens']
    assert 'refresh' in response.data['tokens']


@pytest.mark.django_db
def test_login_user_success(api_client, existing_user):
    url = reverse('login-user')
    response = api_client.post(
        url,
        {
            'email': existing_user.email,
            'password': 'existingpassword',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert 'tokens' in response.data
    assert response.data['user']['email'] == existing_user.email


@pytest.mark.django_db
def test_get_user_profile_success(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)
    url = reverse('get-user-profile')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data['user']['email'] == existing_user.email
