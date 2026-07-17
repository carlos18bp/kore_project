"""Tests for Wompi tokenization and recurring-related service helpers.

Covers:
- ``create_nequi_token`` and ``poll_nequi_token_until_approved``.
- ``create_bancolombia_transfer_token`` and
  ``poll_bancolombia_token_until_approved``.
- ``get_personal_data_auth_token`` graceful fallback.
- ``create_payment_source`` payload includes ``accept_personal_auth`` and
  routes ``extra_fields`` (e.g. ``payment_description`` for Bancolombia).
"""
# quality: disable unverified_mock (response MagicMocks are canned Wompi payloads; the mocked transport call itself is asserted)


from unittest.mock import MagicMock, patch

import pytest
import requests as req
from django.test import override_settings

from core_app.services.wompi_service import (
    WompiError,
    create_bancolombia_transfer_token,
    create_nequi_token,
    create_payment_source,
    get_personal_data_auth_token,
    poll_bancolombia_token_until_approved,
    poll_nequi_token_until_approved,
)

WOMPI_SETTINGS = {
    'WOMPI_PUBLIC_KEY': 'pub_test_abc',
    'WOMPI_PRIVATE_KEY': 'prv_test_xyz',
    'WOMPI_INTEGRITY_KEY': 'test_integrity_secret',
    'WOMPI_EVENTS_KEY': 'test_events_secret',
    'WOMPI_API_BASE_URL': 'https://api-sandbox.co.uat.wompi.dev/v1',
}


# ---------- NEQUI tokenization ----------

class TestCreateNequiToken:
    """Covers POST /tokens/nequi requests."""

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_calls_correct_endpoint_with_public_key(self, mock_post):
        """create_nequi_token POSTs the phone_number to /tokens/nequi with public key."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 'nequi_tok_001', 'status': 'PENDING'}}
        mock_post.return_value = mock_resp

        token_id = create_nequi_token('3001112233')

        assert token_id == 'nequi_tok_001'
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        url = call_kwargs.args[0] if call_kwargs.args else call_kwargs.kwargs['url']
        assert url.endswith('/tokens/nequi')
        payload = call_kwargs.kwargs['json']
        assert payload == {'phone_number': '3001112233'}
        headers = call_kwargs.kwargs['headers']
        assert headers['Authorization'] == f'Bearer {WOMPI_SETTINGS["WOMPI_PUBLIC_KEY"]}'

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_raises_when_no_token_id_returned(self, mock_post):
        """Empty data response raises WompiError."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {}}
        mock_post.return_value = mock_resp

        with pytest.raises(WompiError, match='No Nequi token id'):
            create_nequi_token('3001112233')
        assert mock_post.call_count == 1

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_request_exception_raises_wompi_error(self, mock_post):
        """Network failure raises WompiError with status code from response."""
        mock_resp = MagicMock()
        mock_resp.status_code = 422
        mock_post.side_effect = req.HTTPError('unprocessable', response=mock_resp)
        with pytest.raises(WompiError, match='Failed to create Nequi token') as exc_info:
            create_nequi_token('bad')
        mock_post.assert_called_once()
        assert exc_info.value.status_code == 422


class TestPollNequiTokenUntilApproved:
    """Covers the polling helper for Nequi tokens."""

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.time.sleep', return_value=None)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_when_approved(self, mock_get, _mock_sleep):
        """Poll exits as soon as Wompi reports APPROVED status."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 'nequi_tok_a', 'status': 'APPROVED'}}
        mock_get.return_value = mock_resp

        result = poll_nequi_token_until_approved('nequi_tok_a', max_attempts=3, interval_s=0)
        assert result == 'nequi_tok_a'
        mock_get.assert_called_once()

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.time.sleep', return_value=None)
    @patch('core_app.services.wompi_service.requests.get')
    def test_raises_when_declined(self, mock_get, _mock_sleep):
        """DECLINED status raises WompiError immediately."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 'nequi_tok_b', 'status': 'DECLINED'}}
        mock_get.return_value = mock_resp

        with pytest.raises(WompiError, match='ended with status DECLINED'):
            poll_nequi_token_until_approved('nequi_tok_b', max_attempts=3, interval_s=0)
        # Exits on the first DECLINED — does not exhaust max_attempts.
        assert mock_get.call_count == 1

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.time.sleep', return_value=None)
    @patch('core_app.services.wompi_service.requests.get')
    def test_raises_on_timeout(self, mock_get, _mock_sleep):
        """Token that never approves within max_attempts raises WompiError."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 'nequi_tok_c', 'status': 'PENDING'}}
        mock_get.return_value = mock_resp

        with pytest.raises(WompiError, match='not approved within polling window'):
            poll_nequi_token_until_approved('nequi_tok_c', max_attempts=2, interval_s=0)
        assert mock_get.call_count == 2


# ---------- BANCOLOMBIA_TRANSFER tokenization ----------

class TestCreateBancolombiaTransferToken:
    """Covers POST /tokens/bancolombia_transfer requests."""

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_returns_token_id_and_authorization_url(self, mock_post):
        """Token creation returns both the id and the authorization_url."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {
                'id': 'bcol_tok_001',
                'authorization_url': 'https://sucursal.bancolombia.com/auth/abc',
                'status': 'PENDING',
            }
        }
        mock_post.return_value = mock_resp

        result = create_bancolombia_transfer_token('https://kore.app/callback')

        assert result == {
            'token_id': 'bcol_tok_001',
            'authorization_url': 'https://sucursal.bancolombia.com/auth/abc',
        }
        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs['json']
        assert payload == {
            'redirect_url': 'https://kore.app/callback',
            'type_auth': 'TOKEN',
        }
        headers = call_kwargs.kwargs['headers']
        assert headers['Authorization'] == f'Bearer {WOMPI_SETTINGS["WOMPI_PUBLIC_KEY"]}'

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_falls_back_to_async_payment_url(self, mock_post):
        """If authorization_url is absent, async_payment_url is used as a fallback."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {
                'id': 'bcol_tok_002',
                'async_payment_url': 'https://sucursal.bancolombia.com/async/xyz',
            }
        }
        mock_post.return_value = mock_resp

        result = create_bancolombia_transfer_token('https://kore.app/callback')
        assert result['authorization_url'] == 'https://sucursal.bancolombia.com/async/xyz'


class TestPollBancolombiaTokenUntilApproved:
    """Covers the polling helper for Bancolombia tokens."""

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.time.sleep', return_value=None)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_when_approved(self, mock_get, _mock_sleep):
        """Poll exits when Wompi reports APPROVED."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 'bcol_tok_a', 'status': 'APPROVED'}}
        mock_get.return_value = mock_resp

        assert poll_bancolombia_token_until_approved('bcol_tok_a', max_attempts=2, interval_s=0) == 'bcol_tok_a'

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.time.sleep', return_value=None)
    @patch('core_app.services.wompi_service.requests.get')
    def test_raises_on_timeout(self, mock_get, _mock_sleep):
        """Token that never approves within max_attempts raises WompiError."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 'bcol_tok_t', 'status': 'PENDING'}}
        mock_get.return_value = mock_resp

        with pytest.raises(WompiError, match='not approved within polling window'):
            poll_bancolombia_token_until_approved('bcol_tok_t', max_attempts=2, interval_s=0)
        assert mock_get.call_count == 2


# ---------- get_personal_data_auth_token fallback ----------

class TestGetPersonalDataAuthToken:
    """Covers the personal_data_auth resilience behavior."""

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_token_when_present(self, mock_get):
        """Returns the personal_data_auth token when included in merchant data."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {
                'presigned_acceptance': {'acceptance_token': 'eyJaccept'},
                'presigned_personal_data_auth': {'acceptance_token': 'eyJpersonal'},
            }
        }
        mock_get.return_value = mock_resp
        assert get_personal_data_auth_token() == 'eyJpersonal'

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_empty_when_field_missing(self, mock_get):
        """Returns '' when merchant response omits presigned_personal_data_auth."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'presigned_acceptance': {'acceptance_token': 'eyJaccept'}}
        }
        mock_get.return_value = mock_resp
        assert get_personal_data_auth_token() == ''

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_empty_when_merchant_fetch_fails(self, mock_get):
        """Network error during merchant fetch swallows to '' (not WompiError)."""
        mock_get.side_effect = req.ConnectionError('network down')
        assert get_personal_data_auth_token() == ''


# ---------- create_payment_source enhancements ----------

class TestCreatePaymentSourceWithAcceptPersonalAuth:
    """Covers the accept_personal_auth field and extra_fields routing."""

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_personal_data_auth_token', return_value='personal_eyJ')
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='accept_eyJ')
    @patch('core_app.services.wompi_service.requests.post')
    def test_payload_includes_accept_personal_auth(self, mock_post, _accept, _personal):
        """Payment source payload includes accept_personal_auth when token is available."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 4242, 'status': 'AVAILABLE'}}
        mock_post.return_value = mock_resp

        create_payment_source('tok_test', 'u@e.com', source_type='NEQUI')

        payload = mock_post.call_args.kwargs['json']
        assert payload['type'] == 'NEQUI'
        assert payload['acceptance_token'] == 'accept_eyJ'
        assert payload['accept_personal_auth'] == 'personal_eyJ'

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_personal_data_auth_token', return_value='')
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='accept_eyJ')
    @patch('core_app.services.wompi_service.requests.post')
    def test_payload_omits_accept_personal_auth_when_unavailable(self, mock_post, _a, _p):
        """When personal data token is '', the field is omitted from the payload."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 1, 'status': 'AVAILABLE'}}
        mock_post.return_value = mock_resp
        create_payment_source('tok_test', 'u@e.com')
        payload = mock_post.call_args.kwargs['json']
        assert 'accept_personal_auth' not in payload

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_personal_data_auth_token', return_value='personal')
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='accept')
    @patch('core_app.services.wompi_service.requests.post')
    def test_extra_fields_are_merged_into_payload(self, mock_post, _a, _p):
        """extra_fields like payment_description for Bancolombia are sent through."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {'id': 1, 'status': 'AVAILABLE'}}
        mock_post.return_value = mock_resp

        create_payment_source(
            'tok_test', 'u@e.com',
            source_type='BANCOLOMBIA_TRANSFER',
            extra_fields={'payment_description': 'Suscripción KÓRE'},
        )

        payload = mock_post.call_args.kwargs['json']
        assert payload['type'] == 'BANCOLOMBIA_TRANSFER'
        assert payload['payment_description'] == 'Suscripción KÓRE'
