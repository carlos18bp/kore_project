import pytest

from core_app.models import AnalyticsEvent, User
from core_app.serializers import AnalyticsEventSerializer


@pytest.mark.django_db
class TestAnalyticsEventSerializer:
    def test_serialization_fields(self):
        event = AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.Type.WHATSAPP_CLICK,
            session_id='sess-123',
            path='/packages',
        )
        data = AnalyticsEventSerializer(event).data
        expected_fields = {
            'id', 'event_type', 'user', 'session_id', 'path',
            'referrer', 'metadata', 'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['event_type'] == 'whatsapp_click'
        assert data['session_id'] == 'sess-123'

    def test_read_only_timestamps(self):
        serializer = AnalyticsEventSerializer(data={
            'event_type': 'package_view',
            'created_at': '2020-01-01T00:00:00Z',
        })
        assert serializer.is_valid(), serializer.errors
        event = serializer.save()
        assert str(event.created_at) != '2020-01-01 00:00:00+00:00'

    def test_deserialization_creates_event(self):
        user = User.objects.create_user(email='analytics_s@example.com', password='p')
        serializer = AnalyticsEventSerializer(data={
            'event_type': 'booking_created',
            'user': user.id,
            'session_id': 'abc',
            'path': '/',
            'metadata': {'key': 'val'},
        })
        assert serializer.is_valid(), serializer.errors
        event = serializer.save()
        assert event.pk is not None
        assert event.user == user
        assert event.metadata == {'key': 'val'}

    def test_user_is_optional(self):
        serializer = AnalyticsEventSerializer(data={
            'event_type': 'whatsapp_click',
        })
        assert serializer.is_valid(), serializer.errors
        event = serializer.save()
        assert event.user is None
