"""Unit tests for the read-only renewal-history timeline serializers.

The serializers consume the plain dicts produced by
``renewal_history_service.build_renewal_timeline`` — no database needed.
"""

from datetime import datetime
from datetime import timezone as dt_timezone

from core_app.serializers.renewal_history_serializers import (
    RenewalHistoryItemSerializer,
)

FIXED_START = datetime(2026, 1, 1, 8, 0, 0, tzinfo=dt_timezone.utc)
FIXED_END = datetime(2026, 1, 31, 8, 0, 0, tzinfo=dt_timezone.utc)


def _item(**overrides):
    base = {
        'kind': 'initial',
        'period_start': FIXED_START,
        'period_end': FIXED_END,
        'sessions_granted': 8,
        'package_title': 'Plan Test',
        'actor_email': '',
        'note': '',
        'source': 'record',
        'payment': None,
    }
    base.update(overrides)
    return base


def test_item_serializer_outputs_scalar_fields():
    # Act
    data = RenewalHistoryItemSerializer(_item(actor_email='admin@kore.com')).data

    # Assert
    assert data['kind'] == 'initial'
    assert data['sessions_granted'] == 8
    assert data['package_title'] == 'Plan Test'
    assert data['source'] == 'record'
    assert data['actor_email'] == 'admin@kore.com'


def test_item_serializer_renders_null_payment_as_none():
    # Act
    data = RenewalHistoryItemSerializer(_item(payment=None)).data

    # Assert
    assert data['payment'] is None


def test_item_serializer_nests_payment_fields():
    # Arrange
    payment = {
        'amount': '100000.00',
        'currency': 'COP',
        'provider': 'cash',
        'status': 'confirmed',
    }

    # Act
    data = RenewalHistoryItemSerializer(_item(payment=payment)).data

    # Assert
    assert data['payment'] == payment
