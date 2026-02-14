import pytest
from io import StringIO

from django.core.management import call_command

from core_app.models import (
    AnalyticsEvent, AvailabilitySlot, Booking, FAQItem,
    Notification, Package, Payment, SiteSettings, User,
)


@pytest.mark.django_db
class TestCreateFakeData:
    def test_full_orchestration(self):
        out = StringIO()
        call_command(
            'create_fake_data',
            customers=2,
            days=2,
            bookings=2,
            payments=2,
            notifications=2,
            analytics_events=3,
            stdout=out,
        )

        assert User.objects.filter(role=User.Role.ADMIN).count() >= 1
        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 2
        assert Package.objects.count() >= 2
        assert AvailabilitySlot.objects.count() > 0
        assert SiteSettings.objects.count() == 1
        assert FAQItem.objects.count() >= 1
        assert Booking.objects.count() >= 1
        assert AnalyticsEvent.objects.count() >= 1

    def test_skip_all(self):
        out = StringIO()
        call_command(
            'create_fake_data',
            skip_users=True,
            skip_content=True,
            skip_trainers=True,
            skip_packages=True,
            skip_subscriptions=True,
            skip_slots=True,
            skip_bookings=True,
            skip_payments=True,
            skip_notifications=True,
            skip_analytics_events=True,
            stdout=out,
        )
        output = out.getvalue()
        assert 'Nothing executed' in output
