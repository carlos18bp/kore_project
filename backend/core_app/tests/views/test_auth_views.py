from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import User


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
def test_pre_register_user_success_without_creating_account(mock_captcha, api_client):
    url = reverse('pre-register-user')
    response = api_client.post(
        url,
        {
            'email': 'pre_register@example.com',
            'password': 'newuserpassword',
            'password_confirm': 'newuserpassword',
            'first_name': 'Pre',
            'last_name': 'Register',
            'phone': '123456789',
            'captcha_token': 'captcha-ok',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert 'registration_token' in response.data
    assert User.objects.filter(email='pre_register@example.com').count() == 0


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
def test_pre_register_existing_email_returns_error(mock_captcha, api_client, existing_user):
    url = reverse('pre-register-user')
    response = api_client.post(
        url,
        {
            'email': existing_user.email,
            'password': 'newuserpassword',
            'password_confirm': 'newuserpassword',
            'first_name': 'Pre',
            'last_name': 'Register',
            'phone': '123456789',
            'captcha_token': 'captcha-ok',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'email' in response.data


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
def test_register_user_success(mock_captcha, api_client):
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
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
def test_login_user_success(mock_captcha, api_client, existing_user):
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


@pytest.mark.django_db
def test_register_user_password_mismatch(api_client):
    url = reverse('register-user')
    response = api_client.post(url, {
        'email': 'mismatch@example.com',
        'password': 'password1234',
        'password_confirm': 'differentpass',
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_login_user_invalid_credentials(api_client, existing_user):
    url = reverse('login-user')
    response = api_client.post(url, {
        'email': existing_user.email,
        'password': 'wrongpassword',
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_get_user_profile_requires_auth(api_client):
    url = reverse('get-user-profile')
    response = api_client.get(url)
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
