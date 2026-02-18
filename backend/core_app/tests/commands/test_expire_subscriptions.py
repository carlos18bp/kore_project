"""Tests for the expire_subscriptions management command."""

from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, Subscription, User
from core_app.services.subscription_cleanup import CANCEL_REASON


@pytest.mark.django_db
class TestExpireSubscriptionsCommand:
    def test_expires_subscription_and_cancels_future_bookings(self):
        now = timezone.now()
        customer = User.objects.create_user(email='expire@example.com', password='pass')
        package = Package.objects.create(
            title='Expire Package',
            sessions_count=4,
            validity_days=30,
            price='200000.00',
        )
        subscription = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=package.sessions_count,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=10),
            expires_at=now - timedelta(days=1),
            next_billing_date=now.date(),
        )

        future_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(days=2),
            ends_at=now + timedelta(days=2, hours=1),
            is_active=True,
            is_blocked=True,
        )
        past_slot = AvailabilitySlot.objects.create(
            starts_at=now - timedelta(days=3),
            ends_at=now - timedelta(days=3, hours=-1),
            is_active=True,
            is_blocked=True,
        )
        future_booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=future_slot,
            subscription=subscription,
            status=Booking.Status.CONFIRMED,
        )
        past_booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=past_slot,
            subscription=subscription,
            status=Booking.Status.CONFIRMED,
        )

        out = StringIO()
        call_command('expire_subscriptions', stdout=out)

        subscription.refresh_from_db()
        assert subscription.status == Subscription.Status.EXPIRED
        assert subscription.next_billing_date is None
        assert subscription.sessions_used == subscription.sessions_total

        future_booking.refresh_from_db()
        future_slot.refresh_from_db()
        assert future_booking.status == Booking.Status.CANCELED
        assert future_booking.canceled_reason == CANCEL_REASON
        assert future_slot.is_blocked is False

        past_booking.refresh_from_db()
        past_slot.refresh_from_db()
        assert past_booking.status == Booking.Status.CONFIRMED
        assert past_slot.is_blocked is True

        output = out.getvalue()
        assert 'processed: 1' in output
        assert 'bookings_canceled: 1' in output

    def test_noop_when_no_expired_subscriptions(self):
        now = timezone.now()
        customer = User.objects.create_user(email='future@example.com', password='pass')
        package = Package.objects.create(
            title='Future Package',
            sessions_count=3,
            validity_days=30,
            price='150000.00',
        )
        subscription = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=package.sessions_count,
            sessions_used=1,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=2),
            expires_at=now + timedelta(days=5),
            next_billing_date=now.date(),
        )

        out = StringIO()
        call_command('expire_subscriptions', stdout=out)

        subscription.refresh_from_db()
        assert subscription.status == Subscription.Status.ACTIVE
        assert subscription.next_billing_date == now.date()

        output = out.getvalue()
        assert 'processed: 0' in output
        assert 'bookings_canceled: 0' in output
