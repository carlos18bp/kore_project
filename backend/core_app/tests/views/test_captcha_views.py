"""Tests for Google reCAPTCHA views."""

from unittest.mock import Mock, patch

import pytest
import requests
from django.urls import reverse
from django.test import override_settings
from rest_framework import status

from core_app.views.captcha_views import verify_recaptcha


@pytest.mark.django_db
def test_get_site_key_returns_key(api_client):
    """Test that site key endpoint returns the configured key."""
    url = reverse('captcha-site-key')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert 'site_key' in response.data


@pytest.mark.django_db
@patch('core_app.views.captcha_views.verify_recaptcha', return_value=True)
def test_verify_captcha_success(mock_verify, api_client):
    """Test successful captcha verification."""
    url = reverse('captcha-verify')
    response = api_client.post(url, {'token': 'valid-token'}, format='json')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['success'] is True


@pytest.mark.django_db
@patch('core_app.views.captcha_views.verify_recaptcha', return_value=False)
def test_verify_captcha_failure(mock_verify, api_client):
    """Test failed captcha verification."""
    url = reverse('captcha-verify')
    response = api_client.post(url, {'token': 'invalid-token'}, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data['success'] is False


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=False)
def test_login_captcha_failure_returns_error(mock_verify, api_client, existing_user):
    """Test that login fails when captcha verification fails."""
    url = reverse('login-user')
    response = api_client.post(
        url,
        {'email': existing_user.email, 'password': 'existingpassword'},
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'captcha_token' in response.data


@pytest.mark.django_db
def test_verify_recaptcha_returns_true_without_secret_key():
    with override_settings(RECAPTCHA_SECRET_KEY=''):
        assert verify_recaptcha('any-token') is True


@pytest.mark.django_db
def test_verify_recaptcha_returns_false_without_token():
    with override_settings(RECAPTCHA_SECRET_KEY='secret'):
        assert verify_recaptcha('') is False


@pytest.mark.django_db
def test_verify_recaptcha_returns_false_on_request_exception():
    with override_settings(RECAPTCHA_SECRET_KEY='secret'):
        with patch('core_app.views.captcha_views.requests.post', side_effect=requests.RequestException('fail')):
            assert verify_recaptcha('token') is False


@pytest.mark.django_db
def test_verify_recaptcha_returns_false_when_api_fails():
    mock_response = Mock()
    mock_response.json.return_value = {'success': False}
    with override_settings(RECAPTCHA_SECRET_KEY='secret'):
        with patch('core_app.views.captcha_views.requests.post', return_value=mock_response):
            assert verify_recaptcha('token') is False


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=False)
def test_register_captcha_failure_returns_error(mock_verify, api_client):
    """Test that registration fails when captcha verification fails."""
    url = reverse('register-user')
    response = api_client.post(
        url,
        {
            'email': 'test@example.com',
            'password': 'testpassword',
            'password_confirm': 'testpassword',
            'first_name': 'Test',
            'last_name': 'User',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'captcha_token' in response.data
