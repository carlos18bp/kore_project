"""Shared fixtures for service-layer tests."""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_wompi_merchant_cache():
    """Clear the Wompi merchant-data cache before each test.

    ``_fetch_merchant_data`` caches the merchant response for ~4 minutes;
    that would leak data across unit tests and make mocks of
    ``requests.get`` produce false negatives.
    """
    cache.delete_pattern = getattr(cache, 'delete_pattern', None)
    # Both targeted delete (works regardless of backend) and a full clear
    # for the in-memory fallback used by tests.
    cache.clear()
    yield
    cache.clear()
