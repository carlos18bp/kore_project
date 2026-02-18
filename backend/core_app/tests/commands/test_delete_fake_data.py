import pytest
from decimal import Decimal
from io import StringIO

from django.core.management import call_command

from core_app.models import (
    AnalyticsEvent, AvailabilitySlot, Booking, ContactMessage, FAQCategory, FAQItem,
    Notification, Package, Payment, PaymentIntent, SiteSettings, User,
)


@pytest.mark.django_db
class TestDeleteFakeData:
    def _seed_data(self):
        call_command(
            'create_fake_data',
            customers=2,
            days=2,
            bookings=2,
            payments=2,
            notifications=2,
            analytics_events=3,
            stdout=StringIO(),
        )

    def test_requires_confirm_flag(self):
        self._seed_data()
        out = StringIO()
        call_command('delete_fake_data', stdout=out)
        output = out.getvalue()
        assert 'DANGER' in output
        assert User.objects.count() > 0

    def test_deletes_data_with_confirm(self):
        self._seed_data()
        initial_users = User.objects.count()
        assert initial_users > 0

        out = StringIO()
        call_command('delete_fake_data', confirm=True, stdout=out)

        assert Notification.objects.count() == 0
        assert Payment.objects.count() == 0
        assert Booking.objects.count() == 0
        assert AvailabilitySlot.objects.count() == 0
        assert AnalyticsEvent.objects.count() == 0
        assert FAQItem.objects.count() == 0
        assert FAQCategory.objects.count() == 0
        assert ContactMessage.objects.count() == 0
        assert Package.objects.count() == 0

    def test_protects_superusers(self):
        User.objects.create_superuser(email='super@kore.com', password='p')
        out = StringIO()
        call_command('delete_fake_data', confirm=True, stdout=out)
        assert User.objects.filter(email='super@kore.com').exists()

    def test_keep_users_flag(self):
        self._seed_data()
        user_count_before = User.objects.count()

        out = StringIO()
        call_command('delete_fake_data', confirm=True, keep_users=True, stdout=out)

        assert User.objects.count() == user_count_before
        assert Package.objects.count() == 0

    def test_deletes_payment_intents(self):
        pkg = Package.objects.create(title='Pkg', is_active=True)
        PaymentIntent.objects.create(
            package=pkg,
            reference='intent-1',
            amount=Decimal('100.00'),
        )
        assert PaymentIntent.objects.count() == 1

        out = StringIO()
        call_command('delete_fake_data', confirm=True, stdout=out)

        assert PaymentIntent.objects.count() == 0
        assert Package.objects.count() == 0
