"""Tests for notification serializers."""

from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Notification,
    Package,
    User,
)
from core_app.serializers import NotificationSerializer


@pytest.fixture
def booking(db):
    """Create a booking with an upcoming slot for notification serializer tests."""
    customer = User.objects.create_user(email='notif_s@example.com', password='p')
    pkg = Package.objects.create(title='Pkg')
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.mark.django_db
class TestNotificationSerializer:
    """Validate NotificationSerializer read and write behavior."""

    def test_serialization_fields(self, booking):
        """Return notification payload with expected fields and persisted enum values."""
        notif = Notification.objects.create(
            booking=booking,
            notification_type=Notification.Type.BOOKING_CONFIRMED,
            status=Notification.Status.SENT,
            sent_to='test@example.com',
        )
        data = NotificationSerializer(notif).data
        expected_fields = {
            'id', 'booking', 'payment', 'notification_type', 'status',
            'sent_to', 'provider_message_id', 'payload', 'error_message',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['notification_type'] == 'booking_confirmed'
        assert data['status'] == 'sent'
        assert data['sent_to'] == 'test@example.com'

    def test_read_only_timestamps(self, booking):
        """Ignore created_at and updated_at inputs on write operations."""
        serializer = NotificationSerializer(data={
            'booking': booking.id,
            'notification_type': 'booking_confirmed',
            'created_at': '2020-01-01T00:00:00Z',
            'updated_at': '2020-01-01T00:00:00Z',
        })
        assert serializer.is_valid(), serializer.errors
        notif = serializer.save()
        assert str(notif.created_at) != '2020-01-01 00:00:00+00:00'

    def test_deserialization_creates_notification(self, booking):
        """Persist a notification instance from a valid serializer payload."""
        serializer = NotificationSerializer(data={
            'booking': booking.id,
            'notification_type': 'receipt_email',
            'sent_to': 'new@example.com',
        })
        assert serializer.is_valid(), serializer.errors
        notif = serializer.save()
        assert notif.pk is not None
        assert notif.booking == booking
        assert notif.sent_to == 'new@example.com'
