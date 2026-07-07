"""Wompi payment gateway service.

Provides functions to interact with the Wompi API for:
- Generating integrity signatures for transactions.
- Creating payment sources from tokenized cards / Nequi / Bancolombia tokens.
- Creating transactions (initial and recurring).
- Verifying webhook event checksums.
- Tokenizing Nequi and Bancolombia Transfer for recurring billing.

All server-to-server calls use the private key. Tokenization endpoints
(``/tokens/cards``, ``/tokens/nequi``, ``/tokens/bancolombia_transfer``) use
the public key.
"""

import hashlib
import logging
import time
import uuid
from urllib.parse import quote

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Merchant data (acceptance + personal-data tokens) is cached briefly to avoid
# one extra HTTP round-trip to Wompi on every payment_source / transaction
# creation. Wompi-issued tokens are presigned and valid for several minutes;
# 240s keeps us well within their validity window.
_MERCHANT_CACHE_TTL_S = 240


def _merchant_cache_key():
    return f'wompi:merchant_data:{settings.WOMPI_PUBLIC_KEY}'


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


def _fetch_merchant_data():
    """Fetch merchant details from Wompi (cached briefly).

    Used to retrieve presigned acceptance tokens (end-user policy and
    personal data authorization). Both tokens are required by the current
    Wompi API when creating payment sources and transactions.

    The response is cached for ``_MERCHANT_CACHE_TTL_S`` seconds (default
    240s) using Django's cache backend (Redis in production) to avoid one
    extra round-trip to Wompi per payment.

    Returns:
        dict: The 'data' object from the merchant response.

    Raises:
        WompiError: If the API call fails and no cached value is available.
    """
    cache_key = _merchant_cache_key()
    cached = cache.get(cache_key)
    if isinstance(cached, dict) and cached:
        return cached

    url = f'{_get_base_url()}/merchants/{settings.WOMPI_PUBLIC_KEY}'
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        body = resp.json()
        data = body.get('data', {})
        if isinstance(data, dict) and data:
            cache.set(cache_key, data, _MERCHANT_CACHE_TTL_S)
        return data
    except (requests.RequestException, ValueError) as exc:
        logger.error('Failed to fetch Wompi merchant data: %s', exc)
        raise WompiError(f'Failed to fetch merchant data: {exc}') from exc


def get_acceptance_token():
    """Fetch the presigned acceptance token (end-user policy) from Wompi.

    Required when creating payment sources and transactions.

    Returns:
        str: The acceptance token string.

    Raises:
        WompiError: If the API call fails.
    """
    data = _fetch_merchant_data()
    try:
        return data['presigned_acceptance']['acceptance_token']
    except (KeyError, TypeError) as exc:
        raise WompiError(f'Missing presigned_acceptance in merchant data: {exc}') from exc


def get_personal_data_auth_token():
    """Fetch the presigned personal data authorization token from Wompi.

    Required by the current Wompi API alongside the acceptance token when
    creating payment sources and transactions. Returns an empty string if
    the merchant response does not include this field (older sandbox
    environments) or if the call fails — callers should treat the empty
    string as "not available" and skip the ``accept_personal_auth`` payload
    field rather than aborting the transaction.

    Returns:
        str: The personal data auth token, or '' if unavailable.
    """
    try:
        data = _fetch_merchant_data()
    except WompiError:
        logger.debug('Could not fetch personal_data_auth token; proceeding without it')
        return ''
    presigned = data.get('presigned_personal_data_auth') or {}
    return presigned.get('acceptance_token', '') or ''


def create_payment_source(token, customer_email, source_type='CARD', extra_fields=None):
    """Create a payment source in Wompi from a token.

    Args:
        token: Token from prior tokenization step. For CARD it comes from
            ``/tokens/cards``; for NEQUI from ``/tokens/nequi``; for
            BANCOLOMBIA_TRANSFER from ``/tokens/bancolombia_transfer``.
        customer_email: Customer's email address.
        source_type: Payment source type ('CARD', 'NEQUI', 'BANCOLOMBIA_TRANSFER').
        extra_fields: Optional dict of additional payload fields required by
            specific source types (e.g. ``payment_description`` for
            BANCOLOMBIA_TRANSFER).

    Returns:
        int: The payment source ID.

    Raises:
        WompiError: If the API call fails or the source is not available.
    """
    acceptance_token = get_acceptance_token()
    personal_data_auth = get_personal_data_auth_token()
    url = f'{_get_base_url()}/payment_sources'
    payload = {
        'type': source_type,
        'token': token,
        'customer_email': customer_email,
        'acceptance_token': acceptance_token,
    }
    if personal_data_auth:
        payload['accept_personal_auth'] = personal_data_auth
    if extra_fields:
        payload.update(extra_fields)
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
    is created server-side using the private key. The acceptance and
    personal-data tokens are included in the payload because Wompi marks
    them as mandatory for payment-source charges.

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
    acceptance_token = get_acceptance_token()
    personal_data_auth = get_personal_data_auth_token()

    url = f'{_get_base_url()}/transactions'
    payload = {
        'amount_in_cents': amount_in_cents,
        'currency': currency,
        'customer_email': customer_email,
        'reference': reference,
        'payment_source_id': payment_source_id,
        'signature': signature,
        'recurrent': recurrent,
        'acceptance_token': acceptance_token,
        'payment_method': {
            'installments': normalized_installments,
        },
    }
    if personal_data_auth:
        payload['accept_personal_auth'] = personal_data_auth
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

    Used for non-tokenized methods such as PSE where the customer authenticates
    once and the transaction completes synchronously after a redirect.

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
    personal_data_auth = get_personal_data_auth_token()

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
    if personal_data_auth:
        payload['accept_personal_auth'] = personal_data_auth
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


# ----- NEQUI tokenization for recurring billing -----

def create_nequi_token(phone_number):
    """Create a Nequi token for a customer's phone number.

    Calls ``POST /v1/tokens/nequi`` with the public key. The token starts in
    PENDING status; the customer must approve the subscription on their
    Nequi app. Use :func:`poll_nequi_token_until_approved` afterwards.

    Args:
        phone_number: 10-digit Colombian mobile number registered with Nequi.

    Returns:
        str: The Nequi token id.

    Raises:
        WompiError: If the API call fails or no id is returned.
    """
    url = f'{_get_base_url()}/tokens/nequi'
    payload = {'phone_number': phone_number}
    try:
        resp = requests.post(url, json=payload, headers=_get_public_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json().get('data', {})
        token_id = data.get('id')
        if not token_id:
            raise WompiError('No Nequi token id returned', response_data=data)
        return token_id
    except requests.RequestException as exc:
        status_code, response_data = _extract_response_details(exc)
        logger.error(
            'Failed to create Nequi token: %s | status=%s | response=%s',
            exc, status_code, response_data,
        )
        raise WompiError(
            f'Failed to create Nequi token: {exc}',
            status_code=status_code,
            response_data=response_data,
        ) from exc


def poll_nequi_token_until_approved(token_id, max_attempts=8, interval_s=3):
    """Poll a Nequi token until the customer approves or it fails.

    Calls ``GET /v1/tokens/nequi/{token_id}`` periodically. Returns the token
    id once status is APPROVED. Raises :class:`WompiError` if it becomes
    DECLINED, ERROR, or the polling window expires.

    Args:
        token_id: The Nequi token id from :func:`create_nequi_token`.
        max_attempts: Maximum number of poll attempts. Default 8 attempts at
            3s = 24s, leaving headroom inside the 30s gunicorn worker timeout.
        interval_s: Seconds to sleep between attempts.

    Returns:
        str: The same token id once APPROVED.

    Raises:
        WompiError: On declined/error/timeout.
    """
    url = f'{_get_base_url()}/tokens/nequi/{token_id}'
    last_status = None
    for _ in range(max_attempts):
        try:
            resp = requests.get(url, headers=_get_private_headers(), timeout=15)
            resp.raise_for_status()
            data = resp.json().get('data', {})
            status = (data.get('status') or '').upper()
            last_status = status
            if status == 'APPROVED':
                return token_id
            if status in ('DECLINED', 'ERROR'):
                raise WompiError(
                    f'Nequi token {token_id} ended with status {status}',
                    response_data=data,
                )
        except requests.RequestException as exc:
            logger.warning('Transient error polling Nequi token %s: %s', token_id, exc)
        time.sleep(interval_s)
    raise WompiError(
        f'Nequi token {token_id} not approved within polling window '
        f'(last status={last_status})'
    )


# ----- BANCOLOMBIA_TRANSFER tokenization for recurring billing -----

def create_bancolombia_transfer_token(redirect_url, type_auth='TOKEN'):
    """Create a Bancolombia Transfer token.

    Calls ``POST /v1/tokens/bancolombia_transfer`` with the public key.
    Returns an ``authorization_url`` the customer must visit to log into
    Bancolombia and authorize the recurring debit. Afterwards use
    :func:`poll_bancolombia_token_until_approved`.

    Args:
        redirect_url: URL where Bancolombia returns the customer.
        type_auth: 'TOKEN' for recurring subscriptions (recommended) or
            'TRANSACTION' for one-shot.

    Returns:
        dict: ``{token_id, authorization_url}``.

    Raises:
        WompiError: On API failure.
    """
    url = f'{_get_base_url()}/tokens/bancolombia_transfer'
    payload = {'redirect_url': redirect_url, 'type_auth': type_auth}
    try:
        resp = requests.post(url, json=payload, headers=_get_public_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json().get('data', {})
        token_id = data.get('id')
        authorization_url = data.get('authorization_url') or data.get('async_payment_url')
        if not token_id:
            raise WompiError('No Bancolombia token id returned', response_data=data)
        return {'token_id': token_id, 'authorization_url': authorization_url}
    except requests.RequestException as exc:
        status_code, response_data = _extract_response_details(exc)
        logger.error(
            'Failed to create Bancolombia token: %s | status=%s | response=%s',
            exc, status_code, response_data,
        )
        raise WompiError(
            f'Failed to create Bancolombia token: {exc}',
            status_code=status_code,
            response_data=response_data,
        ) from exc


def poll_bancolombia_token_until_approved(token_id, max_attempts=8, interval_s=3):
    """Poll a Bancolombia Transfer token until approved or it fails.

    Calls ``GET /v1/tokens/bancolombia_transfer/{token_id}`` periodically.
    Because the confirm endpoint is invoked AFTER Bancolombia has already
    redirected the customer back (so the token is normally APPROVED by
    then), a short window is sufficient. The default 8 × 3s = 24s fits
    within the 30s gunicorn worker timeout.

    Args:
        token_id: Token id from :func:`create_bancolombia_transfer_token`.
        max_attempts: Max poll attempts.
        interval_s: Seconds between attempts.

    Returns:
        str: The same token id once APPROVED.

    Raises:
        WompiError: On declined/error/timeout.
    """
    url = f'{_get_base_url()}/tokens/bancolombia_transfer/{token_id}'
    last_status = None
    for _ in range(max_attempts):
        try:
            resp = requests.get(url, headers=_get_private_headers(), timeout=15)
            resp.raise_for_status()
            data = resp.json().get('data', {})
            status = (data.get('status') or '').upper()
            last_status = status
            if status == 'APPROVED':
                return token_id
            if status in ('DECLINED', 'ERROR'):
                raise WompiError(
                    f'Bancolombia token {token_id} ended with status {status}',
                    response_data=data,
                )
        except requests.RequestException as exc:
            logger.warning('Transient error polling Bancolombia token %s: %s', token_id, exc)
        time.sleep(interval_s)
    raise WompiError(
        f'Bancolombia token {token_id} not approved within polling window '
        f'(last status={last_status})'
    )


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


def build_wompi_checkout_url(reference, amount_in_cents, redirect_path):
    """Build a Wompi Web Checkout redirect URL for a one-time payment."""
    signature = generate_integrity_signature(reference, amount_in_cents, 'COP')
    redirect_url = f'{settings.FRONTEND_BASE_URL}{redirect_path}'
    return (
        f'https://checkout.wompi.co/p/?public-key={settings.WOMPI_PUBLIC_KEY}'
        f'&currency=COP&amount-in-cents={amount_in_cents}'
        f'&reference={reference}&signature:integrity={signature}'
        f'&redirect-url={quote(redirect_url, safe="")}'
    )
