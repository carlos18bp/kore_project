"""Tests for authentication-related API views."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import signing
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import MoodEntry, RegistrationVerificationCode, User
from core_app.views.auth_views import (
    PRE_REGISTRATION_TOKEN_SALT,
    REGISTRATION_TOKEN_SALT,
)


def _make_pre_registration_token(email='pre@example.com', first='Pre', last='User', phone='3001112233'):
    """Build a valid pre-registration token payload for verify/resend endpoints."""
    return signing.dumps(
        {
            'email': email,
            'first_name': first,
            'last_name': last,
            'phone': phone,
            'password_hash': 'pbkdf2_sha256$dummy',
        },
        salt=PRE_REGISTRATION_TOKEN_SALT,
    )


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
def test_pre_register_user_success_without_creating_account(mock_captcha, api_client):
    """Return registration token from pre-register flow without persisting the user."""
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
    assert response.data['verification_pending'] is True
    assert 'pre_registration_token' in response.data
    assert User.objects.filter(email='pre_register@example.com').count() == 0


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=False)
def test_pre_register_user_captcha_failure_returns_400(mock_captcha, api_client):
    """Reject pre-registration when captcha verification fails."""
    url = reverse('pre-register-user')
    response = api_client.post(
        url,
        {
            'email': 'captcha_fail@example.com',
            'password': 'newuserpassword',
            'password_confirm': 'newuserpassword',
            'first_name': 'Captcha',
            'last_name': 'Fail',
            'phone': '123456789',
            'captcha_token': 'captcha-fail',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'captcha_token' in response.data


@pytest.mark.django_db
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
def test_pre_register_existing_email_returns_error(mock_captcha, api_client, existing_user):
    """Reject pre-registration when the provided email already belongs to a user."""
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
    """Create account and return access plus refresh tokens on valid signup."""
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
    """Return tokens and user payload when valid credentials are provided."""
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
    """Return authenticated user profile information."""
    api_client.force_authenticate(user=existing_user)
    url = reverse('get-user-profile')
    response = api_client.get(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data['user']['email'] == existing_user.email


@pytest.mark.django_db
def test_register_user_password_mismatch(api_client):
    """Reject registration when password and confirmation differ."""
    url = reverse('register-user')
    response = api_client.post(url, {
        'email': 'mismatch@example.com',
        'password': 'password1234',
        'password_confirm': 'differentpass',
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_login_user_invalid_credentials(api_client, existing_user):
    """Reject login attempts with invalid credentials."""
    url = reverse('login-user')
    response = api_client.post(url, {
        'email': existing_user.email,
        'password': 'wrongpassword',
    }, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_get_user_profile_requires_auth(api_client):
    """Require authentication for profile retrieval endpoint."""
    url = reverse('get-user-profile')
    response = api_client.get(url)
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_resend_verification_code_returns_400_on_invalid_pre_registration_token(api_client):
    """Returns 400 when pre_registration_token has an invalid or expired signature."""
    url = reverse('resend-verification-code')
    response = api_client.post(
        url,
        {'pre_registration_token': 'tampered.invalid.token'},
        format='json',
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    detail = response.data.get('detail', '')
    assert 'expiró' in detail or 'inválido' in detail


@pytest.mark.django_db
def test_resend_verification_code_missing_token_returns_400(api_client):
    """Reject resend requests that omit the pre_registration_token field."""
    url = reverse('resend-verification-code')
    response = api_client.post(url, {}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'Token' in response.data['detail']


@pytest.mark.django_db
def test_resend_verification_code_token_without_email_returns_400(api_client):
    """Reject resend when the signed payload is missing the email field."""
    token = signing.dumps({'first_name': 'No', 'last_name': 'Email'}, salt=PRE_REGISTRATION_TOKEN_SALT)
    url = reverse('resend-verification-code')
    response = api_client.post(url, {'pre_registration_token': token}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'inválido' in response.data['detail']


@pytest.mark.django_db
@patch('core_app.views.auth_views.send_registration_verification_code')
def test_resend_verification_code_success_returns_pending_payload(mock_send, api_client):
    """Resend returns success payload and creates a new verification code row."""
    mock_send.return_value = None
    token = _make_pre_registration_token(email='resend_ok@example.com')
    url = reverse('resend-verification-code')

    response = api_client.post(url, {'pre_registration_token': token}, format='json')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['verification_pending'] is True
    assert RegistrationVerificationCode.objects.filter(email='resend_ok@example.com').count() == 1
    mock_send.assert_called_once()


@pytest.mark.django_db
@patch('core_app.views.auth_views.MAX_VERIFICATION_CODES_PER_HOUR', 1)
@patch('core_app.views.auth_views.send_registration_verification_code', return_value=None)
def test_resend_verification_code_rate_limited_returns_429(_mock_send, api_client):
    """Resend endpoint returns 429 once hourly rate limit is reached."""
    email = 'rate_resend@example.com'
    RegistrationVerificationCode.objects.create(email=email)

    token = _make_pre_registration_token(email=email)
    url = reverse('resend-verification-code')
    response = api_client.post(url, {'pre_registration_token': token}, format='json')

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert 'demasiados' in response.data['detail']


@pytest.mark.django_db
@patch('core_app.views.auth_views.MAX_VERIFICATION_CODES_PER_HOUR', 1)
@patch('core_app.views.auth_views.verify_recaptcha', return_value=True)
@patch('core_app.views.auth_views.send_registration_verification_code', return_value=None)
def test_pre_register_user_rate_limited_returns_429(_mock_send, _mock_captcha, api_client):
    """Pre-register endpoint returns 429 once hourly rate limit is reached for email."""
    email = 'rate_pre@example.com'
    RegistrationVerificationCode.objects.create(email=email)

    url = reverse('pre-register-user')
    response = api_client.post(
        url,
        {
            'email': email,
            'password': 'newuserpassword',
            'password_confirm': 'newuserpassword',
            'first_name': 'Rate',
            'last_name': 'Limited',
            'phone': '3001112233',
            'captcha_token': 'captcha-ok',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert 'demasiados' in response.data['detail']


@pytest.mark.django_db
class TestVerifyRegistration:
    """Tests for POST /auth/verify-registration/."""

    def test_missing_token_returns_400(self, api_client):
        """Reject verify requests that omit the pre_registration_token."""
        url = reverse('verify-registration')
        response = api_client.post(url, {'code': '123456'}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Token' in response.data['detail']

    def test_missing_code_returns_400(self, api_client):
        """Reject verify requests that omit the code."""
        url = reverse('verify-registration')
        response = api_client.post(
            url, {'pre_registration_token': _make_pre_registration_token()}, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Token' in response.data['detail']

    def test_invalid_or_expired_token_returns_400(self, api_client):
        """Reject verify when the pre-registration token signature is invalid."""
        url = reverse('verify-registration')
        response = api_client.post(
            url,
            {'pre_registration_token': 'tampered.invalid.token', 'code': '123456'},
            format='json',
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'expiró' in response.data['detail'] or 'inválido' in response.data['detail']

    def test_token_without_email_returns_400(self, api_client):
        """Reject verify when the signed payload is missing the email field."""
        token = signing.dumps(
            {'first_name': 'No', 'last_name': 'Email'}, salt=PRE_REGISTRATION_TOKEN_SALT
        )
        url = reverse('verify-registration')
        response = api_client.post(
            url, {'pre_registration_token': token, 'code': '000000'}, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    def test_unknown_code_returns_400(self, api_client):
        """Reject verify when no verification code matches email+code."""
        token = _make_pre_registration_token(email='verify_unknown@example.com')
        url = reverse('verify-registration')
        response = api_client.post(
            url, {'pre_registration_token': token, 'code': '999999'}, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    def test_expired_code_returns_400(self, api_client):
        """Reject verify when the verification code has expired."""
        email = 'verify_expired@example.com'
        code = RegistrationVerificationCode.objects.create(email=email)
        code.expires_at = timezone.now() - timedelta(minutes=1)
        code.save(update_fields=['expires_at'])

        token = _make_pre_registration_token(email=email)
        url = reverse('verify-registration')
        response = api_client.post(
            url, {'pre_registration_token': token, 'code': code.code}, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inválido' in response.data['detail']

    def test_valid_code_returns_registration_token(self, api_client):
        """Return the signed registration_token on a valid code match."""
        email = 'verify_ok@example.com'
        code = RegistrationVerificationCode.objects.create(email=email)

        token = _make_pre_registration_token(email=email)
        url = reverse('verify-registration')
        response = api_client.post(
            url, {'pre_registration_token': token, 'code': code.code}, format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['registration_token']

        payload = signing.loads(
            response.data['registration_token'], salt=REGISTRATION_TOKEN_SALT
        )
        assert payload['email'] == email

    def test_valid_code_marks_verification_used(self, api_client):
        """Successful verify marks the RegistrationVerificationCode row as used."""
        email = 'verify_used@example.com'
        code = RegistrationVerificationCode.objects.create(email=email)

        token = _make_pre_registration_token(email=email)
        url = reverse('verify-registration')
        api_client.post(
            url, {'pre_registration_token': token, 'code': code.code}, format='json'
        )

        code.refresh_from_db()
        assert code.used is True


@pytest.mark.django_db
def test_mood_get_returns_entry_when_present_today(api_client, existing_user):
    """GET /auth/mood/ returns today's entry payload when one already exists."""
    MoodEntry.objects.create(
        user=existing_user,
        date=timezone.localdate(),
        score=7,
        notes='feeling great',
    )

    api_client.force_authenticate(user=existing_user)
    response = api_client.get(reverse('mood'))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['score'] == 7
    assert response.data['notes'] == 'feeling great'


@pytest.mark.django_db
def test_reset_password_returns_400_when_token_user_no_longer_exists(api_client, existing_user):
    """reset_password_with_code returns 400 when the signed user_id has been deleted."""
    token = signing.dumps(
        {'user_id': existing_user.pk, 'email': existing_user.email},
        salt='password-reset-v1',
    )
    existing_user.delete()

    url = reverse('password-reset-reset')
    response = api_client.post(
        url,
        {
            'reset_token': token,
            'new_password': 'NewStrongPassword123!',
            'new_password_confirm': 'NewStrongPassword123!',
        },
        format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'Token' in response.data['detail']
