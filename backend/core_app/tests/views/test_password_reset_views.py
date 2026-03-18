"""Tests for password reset API views (request-code, verify-code, reset)."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import signing
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import PasswordResetCode, User


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        email='customer@example.com',
        password='OldPassword123!',
        first_name='Test',
        last_name='User',
    )


# ------------------------------------------------------------------
# request_password_reset_code
# ------------------------------------------------------------------

class TestRequestPasswordResetCode:
    url = reverse('password-reset-request-code')

    @pytest.mark.django_db
    @patch('core_app.services.email_service.send_password_reset_code', return_value=True)
    def test_returns_200_and_sends_email(self, mock_send, api_client, customer_user):
        resp = api_client.post(self.url, {'email': customer_user.email}, format='json')
        assert resp.status_code == status.HTTP_200_OK
        mock_send.assert_called_once()
        assert PasswordResetCode.objects.filter(user=customer_user, used=False).count() == 1

    @pytest.mark.django_db
    def test_returns_200_for_nonexistent_email(self, api_client):
        """Should not reveal whether the email exists."""
        resp = api_client.post(self.url, {'email': 'nobody@example.com'}, format='json')
        assert resp.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_returns_400_when_email_missing(self, api_client):
        resp = api_client.post(self.url, {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    @patch('core_app.services.email_service.send_password_reset_code', return_value=True)
    def test_invalidates_previous_codes(self, mock_send, api_client, customer_user):
        """Requesting a new code should invalidate old ones."""
        api_client.post(self.url, {'email': customer_user.email}, format='json')
        first_code = PasswordResetCode.objects.filter(user=customer_user, used=False).first()

        api_client.post(self.url, {'email': customer_user.email}, format='json')
        first_code.refresh_from_db()
        assert first_code.used is True
        assert PasswordResetCode.objects.filter(user=customer_user, used=False).count() == 1


# ------------------------------------------------------------------
# verify_password_reset_code
# ------------------------------------------------------------------

class TestVerifyPasswordResetCode:
    url = reverse('password-reset-verify-code')

    @pytest.mark.django_db
    def test_valid_code_returns_reset_token(self, api_client, customer_user):
        code_obj = PasswordResetCode.create_for_user(customer_user)
        resp = api_client.post(
            self.url,
            {'email': customer_user.email, 'code': code_obj.code},
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK
        assert 'reset_token' in resp.data

        code_obj.refresh_from_db()
        assert code_obj.used is True

    @pytest.mark.django_db
    def test_wrong_code_returns_400(self, api_client, customer_user):
        PasswordResetCode.create_for_user(customer_user)
        resp = api_client.post(
            self.url,
            {'email': customer_user.email, 'code': '000000'},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_expired_code_returns_400(self, api_client, customer_user):
        code_obj = PasswordResetCode.create_for_user(customer_user)
        code_obj.expires_at = timezone.now() - timedelta(minutes=1)
        code_obj.save()
        resp = api_client.post(
            self.url,
            {'email': customer_user.email, 'code': code_obj.code},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_used_code_returns_400(self, api_client, customer_user):
        code_obj = PasswordResetCode.create_for_user(customer_user)
        code_obj.used = True
        code_obj.save()
        resp = api_client.post(
            self.url,
            {'email': customer_user.email, 'code': code_obj.code},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_missing_fields_returns_400(self, api_client):
        resp = api_client.post(self.url, {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_nonexistent_email_returns_400(self, api_client):
        resp = api_client.post(
            self.url,
            {'email': 'nobody@example.com', 'code': '123456'},
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ------------------------------------------------------------------
# reset_password_with_code
# ------------------------------------------------------------------

class TestResetPasswordWithCode:
    url = reverse('password-reset-reset')

    def _get_valid_token(self, user):
        return signing.dumps(
            {'user_id': user.pk, 'email': user.email},
            salt='password-reset-v1',
        )

    @pytest.mark.django_db
    def test_successful_password_reset(self, api_client, customer_user):
        token = self._get_valid_token(customer_user)
        resp = api_client.post(
            self.url,
            {
                'reset_token': token,
                'new_password': 'NewSecurePass123!',
                'new_password_confirm': 'NewSecurePass123!',
            },
            format='json',
        )
        assert resp.status_code == status.HTTP_200_OK

        customer_user.refresh_from_db()
        assert customer_user.check_password('NewSecurePass123!')

    @pytest.mark.django_db
    def test_password_mismatch_returns_400(self, api_client, customer_user):
        token = self._get_valid_token(customer_user)
        resp = api_client.post(
            self.url,
            {
                'reset_token': token,
                'new_password': 'NewSecurePass123!',
                'new_password_confirm': 'DifferentPass456!',
            },
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_invalid_token_returns_400(self, api_client):
        resp = api_client.post(
            self.url,
            {
                'reset_token': 'bogus-token',
                'new_password': 'NewSecurePass123!',
                'new_password_confirm': 'NewSecurePass123!',
            },
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_expired_token_returns_400(self, api_client, customer_user):
        """Token older than 10 minutes should be rejected."""
        token = signing.dumps(
            {'user_id': customer_user.pk, 'email': customer_user.email},
            salt='password-reset-v1',
        )
        with patch('core_app.views.auth_views.signing.loads', side_effect=signing.BadSignature('expired')):
            resp = api_client.post(
                self.url,
                {
                    'reset_token': token,
                    'new_password': 'NewSecurePass123!',
                    'new_password_confirm': 'NewSecurePass123!',
                },
                format='json',
            )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_missing_fields_returns_400(self, api_client):
        resp = api_client.post(self.url, {}, format='json')
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_weak_password_returns_400(self, api_client, customer_user):
        """Django password validators should reject trivially weak passwords."""
        token = self._get_valid_token(customer_user)
        resp = api_client.post(
            self.url,
            {
                'reset_token': token,
                'new_password': '123',
                'new_password_confirm': '123',
            },
            format='json',
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ------------------------------------------------------------------
# Full flow integration
# ------------------------------------------------------------------

@pytest.mark.django_db
class TestPasswordResetFullFlow:
    """End-to-end: request code → verify → reset password."""

    @patch('core_app.services.email_service.send_password_reset_code', return_value=True)
    def test_complete_flow(self, mock_send, api_client, customer_user):
        # Step 1: Request code
        resp1 = api_client.post(
            reverse('password-reset-request-code'),
            {'email': customer_user.email},
            format='json',
        )
        assert resp1.status_code == status.HTTP_200_OK

        code_obj = PasswordResetCode.objects.filter(
            user=customer_user, used=False,
        ).first()
        assert code_obj is not None

        # Step 2: Verify code
        resp2 = api_client.post(
            reverse('password-reset-verify-code'),
            {'email': customer_user.email, 'code': code_obj.code},
            format='json',
        )
        assert resp2.status_code == status.HTTP_200_OK
        reset_token = resp2.data['reset_token']

        # Step 3: Reset password
        resp3 = api_client.post(
            reverse('password-reset-reset'),
            {
                'reset_token': reset_token,
                'new_password': 'BrandNewPass456!',
                'new_password_confirm': 'BrandNewPass456!',
            },
            format='json',
        )
        assert resp3.status_code == status.HTTP_200_OK

        customer_user.refresh_from_db()
        assert customer_user.check_password('BrandNewPass456!')
        assert not customer_user.check_password('OldPassword123!')
