"""Tests for create_fake_data orchestration command."""

from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command

from core_app.models import (
    AnalyticsEvent,
    AvailabilitySlot,
    Booking,
    FAQCategory,
    FAQItem,
    Package,
    SiteSettings,
    User,
)


def _run_create_fake_data(stdout):
    call_command(
        'create_fake_data',
        customers=2,
        days=2,
        bookings=2,
        payments=2,
        notifications=2,
        analytics_events=3,
        stdout=stdout,
    )


def _assert_non_overlapping_active_bookings_per_subscription():
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


@pytest.mark.django_db
class TestCreateFakeData:
    """Validates create_fake_data orchestration outputs and guard rails."""

    def test_full_orchestration_creates_expected_user_counts(self):
        """Orchestration creates one admin and requested customer count."""
        out = StringIO()
        _run_create_fake_data(out)

        assert User.objects.filter(role=User.Role.ADMIN).count() >= 1
        assert User.objects.filter(role=User.Role.CUSTOMER).count() == 2

    def test_full_orchestration_creates_expected_catalog_records(self):
        """Orchestration creates required package/content/site configuration records."""
        out = StringIO()
        _run_create_fake_data(out)

        assert Package.objects.count() >= 2
        assert SiteSettings.objects.count() == 1
        assert FAQCategory.objects.count() >= 1
        assert FAQItem.objects.count() >= 1

    def test_full_orchestration_creates_slots_and_bookings(self):
        """Orchestration creates availability slots and at least one booking."""
        out = StringIO()
        _run_create_fake_data(out)

        assert AvailabilitySlot.objects.count() > 0
        assert Booking.objects.count() >= 1

    def test_full_orchestration_creates_analytics_events(self):
        """Orchestration records analytics events when generation is enabled."""
        out = StringIO()
        _run_create_fake_data(out)

        assert AnalyticsEvent.objects.count() >= 1

    def test_full_orchestration_keeps_subscription_booking_timeline_non_overlapping(self):
        """Generated active bookings for each subscription never overlap in time."""
        out = StringIO()
        _run_create_fake_data(out)

        assert Booking.objects.exists()
        _assert_non_overlapping_active_bookings_per_subscription()

    def test_skip_all(self):
        """Print no-op message when every generation step is explicitly skipped."""
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
        """Propagate ensure_inactive=True to the subscription generation subcommand."""
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

    def test_slot_step_minutes_is_forwarded_to_slot_subcommand(self):
        """Propagate ``slot_step_minutes`` option to ``create_fake_slots``."""
        out = StringIO()
        with patch('core_app.management.commands.create_fake_data.call_command') as mock_call:
            call_command(
                'create_fake_data',
                skip_users=True,
                skip_content=True,
                skip_trainers=True,
                skip_packages=True,
                skip_subscriptions=True,
                skip_bookings=True,
                skip_payments=True,
                skip_notifications=True,
                skip_analytics_events=True,
                slot_step_minutes=20,
                stdout=out,
            )

        assert any(
            call.args and call.args[0] == 'create_fake_slots'
            and call.kwargs.get('slot_step_minutes') == 20
            for call in mock_call.call_args_list
        )
