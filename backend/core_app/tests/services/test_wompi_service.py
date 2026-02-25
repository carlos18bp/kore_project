"""Tests for the Wompi service module."""

import hashlib
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from core_project.settings import _resolve_wompi_base_url
from core_app.services.wompi_service import (
    WompiError,
    create_payment_source,
    create_transaction,
    create_transaction_with_payment_method,
    generate_integrity_signature,
    generate_reference,
    get_acceptance_token,
    get_transaction_by_id,
    verify_event_checksum,
)

WOMPI_SETTINGS = {
    'WOMPI_PUBLIC_KEY': 'pub_test_abc',
    'WOMPI_PRIVATE_KEY': 'prv_test_xyz',
    'WOMPI_INTEGRITY_KEY': 'test_integrity_secret',
    'WOMPI_EVENTS_KEY': 'test_events_secret',
    'WOMPI_API_BASE_URL': 'https://api-sandbox.co.uat.wompi.dev/v1',
}


class TestGenerateReference:
    def test_returns_string_with_kore_prefix(self):
        ref = generate_reference()
        assert ref.startswith('kore-')

    def test_returns_unique_values(self):
        refs = {generate_reference() for _ in range(100)}
        assert len(refs) == 100


class TestGenerateIntegritySignature:
    @override_settings(**WOMPI_SETTINGS)
    def test_produces_correct_sha256(self):
        ref = 'test-ref-123'
        amount = 5000000
        currency = 'COP'
        expected_concat = f'{ref}{amount}{currency}{WOMPI_SETTINGS["WOMPI_INTEGRITY_KEY"]}'
        expected_hash = hashlib.sha256(expected_concat.encode('utf-8')).hexdigest()

        result = generate_integrity_signature(ref, amount, currency)
        assert result == expected_hash

    @override_settings(**WOMPI_SETTINGS)
    def test_different_inputs_produce_different_signatures(self):
        sig1 = generate_integrity_signature('ref-1', 1000, 'COP')
        sig2 = generate_integrity_signature('ref-2', 1000, 'COP')
        assert sig1 != sig2


class TestGetAcceptanceToken:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_acceptance_token(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {
                'presigned_acceptance': {
                    'acceptance_token': 'eyJ_test_token',
                }
            }
        }
        mock_get.return_value = mock_resp

        token = get_acceptance_token()
        assert token == 'eyJ_test_token'
        mock_get.assert_called_once()

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_raises_wompi_error_on_failure(self, mock_get):
        import requests as req
        mock_get.side_effect = req.ConnectionError('network error')
        with pytest.raises(WompiError):
            get_acceptance_token()


class TestCreatePaymentSource:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='eyJ_test')
    @patch('core_app.services.wompi_service.requests.post')
    def test_returns_source_id(self, mock_post, mock_accept):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'id': 9999, 'status': 'AVAILABLE', 'type': 'CARD'}
        }
        mock_post.return_value = mock_resp

        source_id = create_payment_source('tok_test_123', 'user@example.com')
        assert source_id == 9999
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs.get('json') or call_kwargs[1].get('json')
        assert payload['token'] == 'tok_test_123'
        assert payload['customer_email'] == 'user@example.com'
        assert payload['type'] == 'CARD'

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='eyJ_test')
    @patch('core_app.services.wompi_service.requests.post')
    def test_raises_wompi_error_on_no_id(self, mock_post, mock_accept):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {}}
        mock_post.return_value = mock_resp

        with pytest.raises(WompiError, match='No payment source ID'):
            create_payment_source('tok_test_123', 'user@example.com')


class TestCreateTransaction:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_returns_transaction_data(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'id': 'txn-001', 'status': 'PENDING'}
        }
        mock_post.return_value = mock_resp

        result = create_transaction(
            amount_in_cents=5000000,
            currency='COP',
            customer_email='user@example.com',
            reference='kore-ref-123',
            payment_source_id=9999,
            recurrent=True,
        )
        assert result['id'] == 'txn-001'
        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs.get('json') or call_kwargs[1].get('json')
        assert payload['recurrent'] is True
        assert payload['payment_source_id'] == 9999
        assert payload['payment_method']['installments'] == 1

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_raises_wompi_error_on_no_txn_id(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {'data': {}}
        mock_post.return_value = mock_resp

        with pytest.raises(WompiError, match='No transaction ID'):
            create_transaction(5000000, 'COP', 'u@e.com', 'ref', 9999)

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_normalizes_installments_to_one(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'id': 'txn-002', 'status': 'PENDING'}
        }
        mock_post.return_value = mock_resp

        create_transaction(
            amount_in_cents=5000000,
            currency='COP',
            customer_email='user@example.com',
            reference='kore-ref-124',
            payment_source_id=9999,
            recurrent=True,
            installments=0,
        )

        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs.get('json') or call_kwargs[1].get('json')
        assert payload['payment_method']['installments'] == 1


class TestCreateTransactionWithPaymentMethod:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='accept_test_123')
    @patch('core_app.services.wompi_service.requests.post')
    def test_returns_transaction_data(self, mock_post, mock_acceptance):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'id': 'txn-alt-001', 'status': 'PENDING'}
        }
        mock_post.return_value = mock_resp

        txn = create_transaction_with_payment_method(
            amount_in_cents=2500000,
            currency='COP',
            customer_email='user@example.com',
            reference='kore-alt-ref-001',
            payment_method={
                'type': 'PSE',
                'financial_institution_code': '1007',
                'user_type': 0,
                'user_legal_id_type': 'CC',
                'user_legal_id': '123456789',
            },
            customer_data={
                'phone_number': '573001112233',
                'full_name': 'Test User',
            },
        )

        assert txn['id'] == 'txn-alt-001'
        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs.get('json') or call_kwargs[1].get('json')
        assert payload['acceptance_token'] == 'accept_test_123'
        assert payload['payment_method']['type'] == 'PSE'
        assert payload['customer_data']['full_name'] == 'Test User'

    @override_settings(**WOMPI_SETTINGS)
    def test_requires_payment_method_dict(self):
        with pytest.raises(WompiError, match='payment_method must be a non-empty object'):
            create_transaction_with_payment_method(
                amount_in_cents=2500000,
                currency='COP',
                customer_email='user@example.com',
                reference='kore-alt-ref-002',
                payment_method=None,
            )


class TestVerifyEventChecksum:
    @override_settings(**WOMPI_SETTINGS)
    def test_valid_checksum_returns_true(self):
        txn_id = '1234-txn'
        txn_status = 'APPROVED'
        amount = 4490000
        timestamp = 1530291411

        concat = f'{txn_id}{txn_status}{amount}{timestamp}{WOMPI_SETTINGS["WOMPI_EVENTS_KEY"]}'
        checksum = hashlib.sha256(concat.encode('utf-8')).hexdigest()

        event_body = {
            'event': 'transaction.updated',
            'data': {
                'transaction': {
                    'id': txn_id,
                    'status': txn_status,
                    'amount_in_cents': amount,
                }
            },
            'signature': {
                'properties': [
                    'transaction.id',
                    'transaction.status',
                    'transaction.amount_in_cents',
                ],
                'checksum': checksum,
            },
            'timestamp': timestamp,
        }

        assert verify_event_checksum(event_body) is True

    @override_settings(**WOMPI_SETTINGS)
    def test_invalid_checksum_returns_false(self):
        event_body = {
            'event': 'transaction.updated',
            'data': {
                'transaction': {'id': 'x', 'status': 'APPROVED', 'amount_in_cents': 100}
            },
            'signature': {
                'properties': ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
                'checksum': 'invalid_checksum_value',
            },
            'timestamp': 12345,
        }
        assert verify_event_checksum(event_body) is False

    @override_settings(**WOMPI_SETTINGS)
    def test_malformed_event_returns_false(self):
        assert verify_event_checksum({}) is False

    @override_settings(**WOMPI_SETTINGS)
    def test_non_dict_nested_value_returns_empty_string(self):
        """When a property path traverses a non-dict, value becomes '' (lines 218-219)."""
        timestamp = 9999
        # 'transaction.id.deep' will hit a non-dict (id is a string)
        concat = f'{timestamp}{WOMPI_SETTINGS["WOMPI_EVENTS_KEY"]}'
        checksum = hashlib.sha256(concat.encode('utf-8')).hexdigest()
        event_body = {
            'data': {'transaction': {'id': 'abc'}},
            'signature': {
                'properties': ['transaction.id.deep'],
                'checksum': checksum,
            },
            'timestamp': timestamp,
        }
        # The non-dict branch produces '' so the checksum should still match
        assert verify_event_checksum(event_body) is True

    @override_settings(**WOMPI_SETTINGS)
    def test_exception_in_checksum_returns_false(self):
        """An unexpected exception during verification returns False (lines 230-232)."""
        # Pass a body where 'signature' causes an unhandled exception
        assert verify_event_checksum(None) is False


class TestGetPublicHeaders:
    @override_settings(**WOMPI_SETTINGS)
    def test_returns_public_key_header(self):
        """Covers _get_public_headers (line 46)."""
        from core_app.services.wompi_service import _get_public_headers
        headers = _get_public_headers()
        assert headers['Authorization'] == f'Bearer {WOMPI_SETTINGS["WOMPI_PUBLIC_KEY"]}'
        assert headers['Content-Type'] == 'application/json'


class TestCreatePaymentSourceErrors:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='eyJ_test')
    @patch('core_app.services.wompi_service.requests.post')
    def test_non_available_source_logs_warning(self, mock_post, mock_accept):
        """A source with status != AVAILABLE still returns the ID but logs warning (line 134)."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'id': 7777, 'status': 'PENDING', 'type': 'CARD'}
        }
        mock_post.return_value = mock_resp

        source_id = create_payment_source('tok_test_456', 'u@e.com')
        assert source_id == 7777

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.get_acceptance_token', return_value='eyJ_test')
    @patch('core_app.services.wompi_service.requests.post')
    def test_request_exception_raises_wompi_error(self, mock_post, mock_accept):
        """RequestException in create_payment_source raises WompiError (lines 137-139)."""
        import requests as req
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        exc = req.HTTPError('server error', response=mock_resp)
        mock_post.side_effect = exc

        with pytest.raises(WompiError, match='Failed to create payment source'):
            create_payment_source('tok_test_789', 'u@e.com')


class TestCreateTransactionErrors:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.post')
    def test_request_exception_raises_wompi_error(self, mock_post):
        """RequestException in create_transaction raises WompiError (lines 183-185)."""
        import requests as req
        mock_resp = MagicMock()
        mock_resp.status_code = 502
        exc = req.HTTPError('bad gateway', response=mock_resp)
        mock_post.side_effect = exc

        with pytest.raises(WompiError, match='Failed to create transaction'):
            create_transaction(5000000, 'COP', 'u@e.com', 'ref-err', 9999)


class TestGetTransactionById:
    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_returns_transaction_data(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {
            'data': {'id': 'txn-123', 'status': 'APPROVED', 'payment_method_type': 'CARD'}
        }
        mock_get.return_value = mock_resp

        txn = get_transaction_by_id('txn-123')

        assert txn['id'] == 'txn-123'
        mock_get.assert_called_once()

    @override_settings(**WOMPI_SETTINGS)
    @patch('core_app.services.wompi_service.requests.get')
    def test_raises_wompi_error_on_request_failure(self, mock_get):
        import requests as req
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_get.side_effect = req.HTTPError('server error', response=mock_resp)

        with pytest.raises(WompiError, match='Failed to fetch transaction'):
            get_transaction_by_id('txn-500')


class TestResolveWompiBaseUrl:
    @pytest.mark.parametrize('environment', ['test', 'sandbox', 'uat'])
    def test_sandbox_aliases_use_sandbox_base_url(self, environment):
        assert _resolve_wompi_base_url(environment) == 'https://sandbox.wompi.co/v1'

    @pytest.mark.parametrize('environment', ['production', 'prod', '', None])
    def test_non_sandbox_values_use_production_base_url(self, environment):
        assert _resolve_wompi_base_url(environment) == 'https://production.wompi.co/v1'
