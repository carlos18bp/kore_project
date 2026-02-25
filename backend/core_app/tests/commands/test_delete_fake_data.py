"""Tests for the delete_fake_data management command."""

from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import (
    AnalyticsEvent,
    AvailabilitySlot,
    Booking,
    ContactMessage,
    FAQCategory,
    FAQItem,
    Notification,
    Package,
    Payment,
    PaymentIntent,
    User,
)


@pytest.mark.django_db
class TestDeleteFakeData:
    """Covers destructive and guard-rail scenarios for fake data cleanup."""

    def _seed_data(self):
        """Create representative fake records consumed by deletion tests."""
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
        """Command warns and skips deletion when confirm flag is absent."""
        self._seed_data()
        out = StringIO()
        call_command('delete_fake_data', stdout=out)
        output = out.getvalue()
        assert 'DANGER' in output
        assert User.objects.count() > 0

    def test_deletes_scheduling_payment_data_with_confirm(self):
        """Confirmed deletion removes scheduling, payment, and analytics records."""
        self._seed_data()

        out = StringIO()
        call_command('delete_fake_data', confirm=True, stdout=out)

        assert Notification.objects.count() == 0
        assert Payment.objects.count() == 0
        assert Booking.objects.count() == 0
        assert AvailabilitySlot.objects.count() == 0
        assert AnalyticsEvent.objects.count() == 0

    def test_deletes_content_catalog_data_with_confirm(self):
        """Confirmed deletion removes generated content and catalog entities."""
        self._seed_data()

        out = StringIO()
        call_command('delete_fake_data', confirm=True, stdout=out)

        assert FAQItem.objects.count() == 0
        assert FAQCategory.objects.count() == 0
        assert ContactMessage.objects.count() == 0
        assert Package.objects.count() == 0

    def test_protects_superusers(self):
        """Deletion preserves existing superuser accounts."""
        User.objects.create_superuser(email='super@kore.com', password='p')
        out = StringIO()
        call_command('delete_fake_data', confirm=True, stdout=out)
        assert User.objects.filter(email='super@kore.com').exists()

    def test_keep_users_flag(self):
        """keep_users option retains users while deleting other fake entities."""
        self._seed_data()
        user_count_before = User.objects.count()

        out = StringIO()
        call_command('delete_fake_data', confirm=True, keep_users=True, stdout=out)

        assert User.objects.count() == user_count_before
        assert Package.objects.count() == 0

    def test_deletes_payment_intents(self):
        """Confirmed deletion removes payment intents and associated package data."""
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
