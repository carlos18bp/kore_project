import pytest
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command

from core_app.models import (
    AnalyticsEvent, AvailabilitySlot, Booking, FAQCategory, FAQItem,
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
        assert FAQCategory.objects.count() >= 1
        assert FAQItem.objects.count() >= 1
        assert Booking.objects.count() >= 1
        assert AnalyticsEvent.objects.count() >= 1
        for subscription_id in Booking.objects.values_list('subscription_id', flat=True).distinct():
            if subscription_id is None:
                continue
            bookings = Booking.objects.filter(
                subscription_id=subscription_id,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            ).select_related('slot').order_by('slot__starts_at')
            previous_end = None
            for booking in bookings:
                if previous_end is not None:
                    assert booking.slot.starts_at >= previous_end
                previous_end = booking.slot.ends_at

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

    def test_ensure_inactive_default(self):
        out = StringIO()
        with patch('core_app.management.commands.create_fake_data.call_command') as mock_call:
            call_command(
                'create_fake_data',
                skip_users=True,
                skip_content=True,
                skip_trainers=True,
                skip_packages=True,
                skip_slots=True,
                skip_bookings=True,
                skip_payments=True,
                skip_notifications=True,
                skip_analytics_events=True,
                stdout=out,
            )

        assert any(
            call.args and call.args[0] == 'create_fake_subscriptions'
            and call.kwargs.get('ensure_inactive') is True
            for call in mock_call.call_args_list
        )
