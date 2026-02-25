"""Wompi payment gateway service.

Provides functions to interact with the Wompi API for:
- Generating integrity signatures for transactions.
- Creating payment sources from tokenized cards.
- Creating transactions (initial and recurring).
- Verifying webhook event checksums.

All API calls use the private key and must only be called from the backend.
"""

import hashlib
import logging
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class WompiError(Exception):
    """Raised when a Wompi API call fails."""

    def __init__(self, message, status_code=None, response_data=None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


def _get_base_url():
    """Return the Wompi API base URL from settings."""
    return settings.WOMPI_API_BASE_URL


def _get_private_headers():
    """Return headers with the private key for server-to-server calls."""
    return {
        'Authorization': f'Bearer {settings.WOMPI_PRIVATE_KEY}',
        'Content-Type': 'application/json',
    }


def _get_public_headers():
    """Return headers with the public key."""
    return {
        'Authorization': f'Bearer {settings.WOMPI_PUBLIC_KEY}',
        'Content-Type': 'application/json',
    }


def _extract_response_details(exc):
    """Extract status code and parsed body from a requests exception response."""
    response = getattr(exc, 'response', None)
    if response is None:
        return None, None

    status_code = getattr(response, 'status_code', None)
    response_data = None

    try:
        response_data = response.json()
    except ValueError:
        raw_text = getattr(response, 'text', '')
        if raw_text:
            response_data = {'raw': raw_text[:2000]}
    except Exception:
        response_data = None

    if response_data is not None and not isinstance(
        response_data,
        (dict, list, str, int, float, bool),
    ):
        response_data = str(response_data)

    return status_code, response_data


def generate_reference():
    """Generate a unique payment reference.

    Returns:
        str: A unique alphanumeric reference suitable for Wompi transactions.
    """
    return f'kore-{uuid.uuid4().hex[:20]}'


def generate_integrity_signature(reference, amount_in_cents, currency):
    """Generate a SHA256 integrity signature for a Wompi transaction.

    The signature is computed as SHA256(reference + amount + currency + integrity_key)
    with no separators, following Wompi's official documentation.

    Args:
        reference: Unique payment reference string.
        amount_in_cents: Transaction amount in cents (int).
        currency: Currency code (e.g. 'COP').

    Returns:
        str: Hex-encoded SHA256 hash.
    """
    integrity_key = settings.WOMPI_INTEGRITY_KEY
    concatenated = f'{reference}{amount_in_cents}{currency}{integrity_key}'
    return hashlib.sha256(concatenated.encode('utf-8')).hexdigest()


def get_acceptance_token():
    """Fetch the presigned acceptance token from Wompi.

    Required when creating payment sources. Obtained from the merchant endpoint.

    Returns:
        str: The acceptance token string.

    Raises:
        WompiError: If the API call fails.
    """
    url = f'{_get_base_url()}/merchants/{settings.WOMPI_PUBLIC_KEY}'
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data['data']['presigned_acceptance']['acceptance_token']
    except (requests.RequestException, KeyError) as exc:
        logger.error('Failed to get Wompi acceptance token: %s', exc)
        raise WompiError(f'Failed to get acceptance token: {exc}') from exc


def create_payment_source(token, customer_email, source_type='CARD'):
    """Create a payment source in Wompi from a card token.

    Args:
        token: Card token obtained from Widget tokenization (e.g. 'tok_test_...').
        customer_email: Customer's email address.
        source_type: Payment source type ('CARD', 'NEQUI', etc.). Defaults to 'CARD'.

    Returns:
        int: The payment source ID.

    Raises:
        WompiError: If the API call fails or the source is not available.
    """
    acceptance_token = get_acceptance_token()
    url = f'{_get_base_url()}/payment_sources'
    payload = {
        'type': source_type,
        'token': token,
        'customer_email': customer_email,
        'acceptance_token': acceptance_token,
    }
    try:
        resp = requests.post(url, json=payload, headers=_get_private_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        source_data = data.get('data', {})
        source_id = source_data.get('id')
        status = source_data.get('status')
        if not source_id:
            raise WompiError('No payment source ID returned', response_data=data)
        if status != 'AVAILABLE':
            logger.warning('Payment source %s has status %s', source_id, status)
        return source_id
    except requests.RequestException as exc:
        status_code, response_data = _extract_response_details(exc)
        logger.error(
            'Failed to create Wompi payment source: %s | status=%s | response=%s',
            exc,
            status_code,
            response_data,
        )
        raise WompiError(
            f'Failed to create payment source: {exc}',
            status_code=status_code,
            response_data=response_data,
        ) from exc


def create_transaction(amount_in_cents, currency, customer_email, reference,
                       payment_source_id, recurrent=True, installments=1):
    """Create a transaction in Wompi using a payment source.

    Used for both the initial charge and recurring charges. The transaction
    is created server-side using the private key.

    Args:
        amount_in_cents: Amount to charge in cents (int).
        currency: Currency code (e.g. 'COP').
        customer_email: Customer's email.
        reference: Unique payment reference.
        payment_source_id: Wompi payment source ID (int).
        recurrent: Whether this is a recurring charge (COF). Defaults to True.
        installments: Number of card installments. Current policy uses 1.

    Returns:
        dict: Transaction data from Wompi response including 'id' and 'status'.

    Raises:
        WompiError: If the API call fails.
    """
    normalized_installments = int(installments or 1)
    if normalized_installments < 1:
        normalized_installments = 1

    signature = generate_integrity_signature(reference, amount_in_cents, currency)
    url = f'{_get_base_url()}/transactions'
    payload = {
        'amount_in_cents': amount_in_cents,
        'currency': currency,
        'customer_email': customer_email,
        'reference': reference,
        'payment_source_id': payment_source_id,
        'signature': signature,
        'recurrent': recurrent,
        'payment_method': {
            'installments': normalized_installments,
        },
    }
    try:
        resp = requests.post(url, json=payload, headers=_get_private_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        txn = data.get('data', {})
        if not txn.get('id'):
            raise WompiError('No transaction ID returned', response_data=data)
        return txn
    except requests.RequestException as exc:
        status_code, response_data = _extract_response_details(exc)
        logger.error(
            'Failed to create Wompi transaction: %s | status=%s | response=%s | payload=%s',
            exc,
            status_code,
            response_data,
            {
                'amount_in_cents': amount_in_cents,
                'currency': currency,
                'customer_email': customer_email,
                'reference': reference,
                'payment_source_id': payment_source_id,
                'recurrent': recurrent,
                'payment_method': {
                    'installments': normalized_installments,
                },
            },
        )
        raise WompiError(
            f'Failed to create transaction: {exc}',
            status_code=status_code,
            response_data=response_data,
        ) from exc


def create_transaction_with_payment_method(
    amount_in_cents,
    currency,
    customer_email,
    reference,
    payment_method,
    customer_data=None,
):
    """Create a Wompi transaction with a direct payment_method payload.

    Used for non-card-tokenized methods such as NEQUI, PSE and
    BANCOLOMBIA_TRANSFER.

    Args:
        amount_in_cents: Amount to charge in cents (int).
        currency: Currency code (e.g. 'COP').
        customer_email: Customer's email.
        reference: Unique payment reference.
        payment_method: Wompi payment_method object.
        customer_data: Optional customer_data object required by some methods.

    Returns:
        dict: Transaction data from Wompi response including 'id' and 'status'.

    Raises:
        WompiError: If validation fails or the API call fails.
    """
    if not isinstance(payment_method, dict) or not payment_method:
        raise WompiError('payment_method must be a non-empty object')

    signature = generate_integrity_signature(reference, amount_in_cents, currency)
    acceptance_token = get_acceptance_token()

    url = f'{_get_base_url()}/transactions'
    payload = {
        'amount_in_cents': amount_in_cents,
        'currency': currency,
        'customer_email': customer_email,
        'reference': reference,
        'signature': signature,
        'acceptance_token': acceptance_token,
        'payment_method': payment_method,
    }
    if customer_data:
        payload['customer_data'] = customer_data

    try:
        resp = requests.post(url, json=payload, headers=_get_private_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        txn = data.get('data', {})
        if not txn.get('id'):
            raise WompiError('No transaction ID returned', response_data=data)
        return txn
    except requests.RequestException as exc:
        status_code, response_data = _extract_response_details(exc)
        logger.error(
            'Failed to create Wompi transaction (payment_method flow): '
            '%s | status=%s | response=%s | payload=%s',
            exc,
            status_code,
            response_data,
            payload,
        )
        raise WompiError(
            f'Failed to create transaction: {exc}',
            status_code=status_code,
            response_data=response_data,
        ) from exc


def get_transaction_by_id(transaction_id):
    """Fetch a Wompi transaction by its ID.

    Uses the private key to retrieve the transaction status when webhook
    delivery fails, enabling backend fallback polling.

    Args:
        transaction_id: Wompi transaction ID string.

    Returns:
        dict: Transaction data payload from Wompi.

    Raises:
        WompiError: If the API call fails or the transaction is missing.
    """
    url = f'{_get_base_url()}/transactions/{transaction_id}'
    try:
        resp = requests.get(url, headers=_get_private_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        txn = data.get('data', {})
        if not txn:
            raise WompiError('No transaction data returned', response_data=data)
        return txn
    except requests.RequestException as exc:
        status_code, response_data = _extract_response_details(exc)
        logger.error(
            'Failed to fetch Wompi transaction %s: %s | status=%s | response=%s',
            transaction_id,
            exc,
            status_code,
            response_data,
        )
        raise WompiError(
            f'Failed to fetch transaction: {exc}',
            status_code=status_code,
            response_data=response_data,
        ) from exc


def verify_event_checksum(event_body):
    """Verify the authenticity of a Wompi webhook event.

    Follows the official Wompi documentation:
    1. Concatenate values from signature.properties (pointing to fields in data).
    2. Concatenate the timestamp (integer).
    3. Concatenate the events secret.
    4. SHA256 the result and compare with signature.checksum.

    Args:
        event_body: The parsed JSON body of the webhook event.

    Returns:
        bool: True if the checksum is valid, False otherwise.
    """
    try:
        signature = event_body.get('signature', {})
        properties = signature.get('properties', [])
        checksum = signature.get('checksum', '')
        timestamp = event_body.get('timestamp', '')
        data = event_body.get('data', {})

        concatenated_values = ''
        for prop in properties:
            parts = prop.split('.')
            value = data
            for part in parts:
                if isinstance(value, dict):
                    value = value.get(part, '')
                else:
                    value = ''
                    break
            concatenated_values += str(value)

        concatenated_values += str(timestamp)
        concatenated_values += settings.WOMPI_EVENTS_KEY

        calculated_checksum = hashlib.sha256(
            concatenated_values.encode('utf-8')
        ).hexdigest()

        return calculated_checksum.upper() == checksum.upper()
    except Exception:
        logger.exception('Error verifying Wompi event checksum')
        return False
