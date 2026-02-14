import pytest

from core_app.models import AnalyticsEvent, User


@pytest.mark.django_db
class TestAnalyticsEventModel:
    def test_defaults(self):
        event = AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.Type.WHATSAPP_CLICK,
        )
        assert event.session_id == ''
        assert event.path == ''
        assert event.referrer == ''
        assert event.metadata == {}
        assert event.user is None

    def test_str(self):
        event = AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.Type.PACKAGE_VIEW,
        )
        assert f'package_view #{event.pk}' in str(event)

    def test_event_type_choices(self):
        assert AnalyticsEvent.Type.WHATSAPP_CLICK == 'whatsapp_click'
        assert AnalyticsEvent.Type.PACKAGE_VIEW == 'package_view'
        assert AnalyticsEvent.Type.BOOKING_CREATED == 'booking_created'
        assert AnalyticsEvent.Type.PAYMENT_CONFIRMED == 'payment_confirmed'

    def test_set_null_on_user_delete(self):
        user = User.objects.create_user(email='analytics@example.com', password='p')
        event = AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.Type.WHATSAPP_CLICK,
            user=user,
        )
        assert event.user == user
        user.delete()
        event.refresh_from_db()
        assert event.user is None

    def test_ordering_by_created_at_desc(self):
        e1 = AnalyticsEvent.objects.create(event_type=AnalyticsEvent.Type.WHATSAPP_CLICK)
        e2 = AnalyticsEvent.objects.create(event_type=AnalyticsEvent.Type.PACKAGE_VIEW)
        ids = list(AnalyticsEvent.objects.values_list('id', flat=True))
        assert ids == [e2.id, e1.id]

    def test_metadata_json(self):
        event = AnalyticsEvent.objects.create(
            event_type=AnalyticsEvent.Type.BOOKING_CREATED,
            metadata={'source': 'test'},
        )
        event.refresh_from_db()
        assert event.metadata == {'source': 'test'}
