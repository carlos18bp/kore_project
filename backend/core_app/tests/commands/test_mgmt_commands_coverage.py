"""Tests for management commands to cover remaining uncovered lines."""

import pytest
from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot,
    Booking,
    FAQItem,
    Notification,
    Package,
    Payment,
    SiteSettings,
    Subscription,
    TrainerProfile,
    User,
)


# ----------------------------------------------------------------
# create_fake_packages
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakePackages:
    def test_extra_flag_creates_additional_packages(self):
        """--extra flag creates extra packages (lines 51-67)."""
        out = StringIO()
        call_command('create_fake_packages', extra=2, stdout=out)
        output = out.getvalue()
        assert 'Packages' in output
        # 16 base + 2 extra = 18
        assert Package.objects.count() == 18

    def test_idempotent_run(self):
        """Re-running does not duplicate base packages (branch 48-49)."""
        out1 = StringIO()
        call_command('create_fake_packages', stdout=out1)
        count_first = Package.objects.count()

        out2 = StringIO()
        call_command('create_fake_packages', stdout=out2)
        assert Package.objects.count() == count_first


# ----------------------------------------------------------------
# create_fake_subscriptions
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeSubscriptions:
    def test_no_customers_warning(self):
        """No customers → warning message (lines 27-31)."""
        # Ensure there are packages but no customers
        Package.objects.create(title='Pkg', is_active=True)
        out = StringIO()
        call_command('create_fake_subscriptions', stdout=out)
        assert 'No customers found' in out.getvalue()

    def test_no_packages_warning(self):
        """No packages → warning message (lines 32-36)."""
        User.objects.create_user(
            email='sub_cust@example.com', password='p', role=User.Role.CUSTOMER,
        )
        out = StringIO()
        call_command('create_fake_subscriptions', stdout=out)
        assert 'No packages found' in out.getvalue()

    def test_skip_existing_active_subscription(self):
        """Existing active subscription is skipped (lines 42-45)."""
        from datetime import timedelta
        from django.utils import timezone

        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=5, validity_days=30)
        customer = User.objects.create_user(
            email='sub_skip@example.com', password='p', role=User.Role.CUSTOMER,
        )
        now = timezone.now()
        Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=5, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )

        out = StringIO()
        call_command('create_fake_subscriptions', stdout=out)
        output = out.getvalue()
        assert 'created: 0' in output


# ----------------------------------------------------------------
# create_fake_bookings
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeBookings:
    def test_no_eligible_subs_warning(self):
        """No active subscriptions → warning."""
        out = StringIO()
        call_command('create_fake_bookings', num=1, stdout=out)
        assert 'No customers with active subscriptions found' in out.getvalue()

    def test_no_available_slots_stops(self):
        """No available slots → loop breaks."""
        now = timezone.now()
        customer = User.objects.create_user(
            email='bk_cust2@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=5, validity_days=30)
        Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=5, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        out = StringIO()
        call_command('create_fake_bookings', num=5, stdout=out)
        output = out.getvalue()
        assert 'created: 0' in output

    def test_slot_already_locked_continues(self):
        """Slot locked between query and atomic block → continue."""
        now = timezone.now()
        customer = User.objects.create_user(
            email='bk_lock@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=5, validity_days=30)
        Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=5, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
            is_active=True, is_blocked=False,
        )
        # Create an existing booking on this slot so the check fails
        Booking.objects.create(customer=customer, package=pkg, slot=slot)

        out = StringIO()
        call_command('create_fake_bookings', num=1, stdout=out)
        output = out.getvalue()
        assert 'created: 0' in output


# ----------------------------------------------------------------
# create_fake_slots
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeSlots:
    def test_custom_timezone(self):
        """--timezone flag uses custom tz (line 28)."""
        # Create a trainer first
        user = User.objects.create_user(
            email='slot_trainer@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        out = StringIO()
        call_command('create_fake_slots', days=1, timezone='America/Bogota', stdout=out)
        assert AvailabilitySlot.objects.count() > 0

    def test_end_hour_lte_start_hour_error(self):
        """--end-hour <= --start-hour exits with error (line 32-33)."""
        with pytest.raises(SystemExit):
            call_command('create_fake_slots', start_hour=18, end_hour=9)

    def test_slot_minutes_zero_error(self):
        """--slot-minutes <= 0 exits with error (line 34-35)."""
        with pytest.raises(SystemExit):
            call_command('create_fake_slots', slot_minutes=0)

    def test_idempotent_slots(self):
        """Re-running does not duplicate existing slots (line 71-72 branch)."""
        user = User.objects.create_user(
            email='slot_trainer2@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        out1 = StringIO()
        call_command('create_fake_slots', days=1, stdout=out1)
        count1 = AvailabilitySlot.objects.count()

        out2 = StringIO()
        call_command('create_fake_slots', days=1, stdout=out2)
        assert AvailabilitySlot.objects.count() == count1

    def test_late_start_date_advances_day(self):
        """If now >= end_hour, start_date advances (line 40)."""
        from unittest.mock import patch
        from datetime import datetime as dt

        user = User.objects.create_user(
            email='slot_late@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        # Mock now to be 19:00 (past default end_hour=18)
        import zoneinfo
        tz = zoneinfo.ZoneInfo('America/Bogota')
        late_now = dt(2025, 7, 10, 19, 0, 0, tzinfo=tz)
        with patch('django.utils.timezone.now', return_value=late_now):
            out = StringIO()
            call_command('create_fake_slots', days=1, timezone='America/Bogota', stdout=out)
        # Slots should be on the NEXT day (July 11), not July 10
        for slot in AvailabilitySlot.objects.all():
            assert slot.starts_at.astimezone(tz).date() >= late_now.date() + timedelta(days=1)

    def test_slot_exceeds_end_boundary_breaks(self):
        """Slot that would exceed end boundary breaks loop (line 55)."""
        user = User.objects.create_user(
            email='slot_break@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        out = StringIO()
        # 1 hour range with 45-min slots → only 1 slot fits, second breaks
        call_command(
            'create_fake_slots', days=1, start_hour=9, end_hour=10,
            slot_minutes=45, stdout=out,
        )
        # Should create exactly 1 slot per day
        assert AvailabilitySlot.objects.count() == 1

    def test_past_slots_skipped(self):
        """Slots in the past are skipped (lines 58-59)."""
        from unittest.mock import patch
        from datetime import datetime as dt

        user = User.objects.create_user(
            email='slot_past@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        import zoneinfo
        tz = zoneinfo.ZoneInfo('America/Bogota')
        # Set now to 14:00 today, with slots from 9 to 18
        mid_day = dt(2025, 7, 10, 14, 0, 0, tzinfo=tz)
        with patch('django.utils.timezone.now', return_value=mid_day):
            out = StringIO()
            call_command(
                'create_fake_slots', days=1, start_hour=9, end_hour=18,
                slot_minutes=60, timezone='America/Bogota', stdout=out,
            )
        # Only slots from 14:00 onwards should be created (4 slots: 14, 15, 16, 17)
        assert AvailabilitySlot.objects.count() == 4
        for slot in AvailabilitySlot.objects.all():
            assert slot.ends_at > mid_day


# ----------------------------------------------------------------
# create_fake_trainers
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeTrainers:
    def test_existing_user_wrong_role_updated(self):
        """Existing user with wrong role gets updated (lines 54-56)."""
        user = User.objects.create_user(
            email='german.franco@kore.com', password='p', role=User.Role.CUSTOMER,
        )
        out = StringIO()
        call_command('create_fake_trainers', stdout=out)

        user.refresh_from_db()
        assert user.role == User.Role.TRAINER
        assert TrainerProfile.objects.filter(user=user).exists()

    def test_idempotent_trainers(self):
        """Re-running does not duplicate trainers."""
        out1 = StringIO()
        call_command('create_fake_trainers', stdout=out1)
        count1 = TrainerProfile.objects.count()

        out2 = StringIO()
        call_command('create_fake_trainers', stdout=out2)
        assert TrainerProfile.objects.count() == count1


# ----------------------------------------------------------------
# create_fake_content
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeContent:
    def test_idempotent_content_prefilled(self):
        """Pre-filled settings skip updates; FAQs are idempotent (all branches)."""
        settings_obj = SiteSettings.load()
        settings_obj.company_name = 'Already Set'
        settings_obj.email = 'already@set.com'
        settings_obj.whatsapp = '+1 000'
        settings_obj.footer_text = 'Already here'
        settings_obj.save()

        out1 = StringIO()
        call_command('create_fake_content', stdout=out1)

        settings_obj.refresh_from_db()
        assert settings_obj.company_name == 'Already Set'
        assert FAQItem.objects.count() >= 1

        # Re-run to cover get_or_create existing FAQ branch
        out2 = StringIO()
        call_command('create_fake_content', stdout=out2)
        assert 'faqs_created: 0' in out2.getvalue()


# ----------------------------------------------------------------
# create_fake_payments
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakePayments:
    def test_no_bookings_warning(self):
        """No bookings without payment → warning (lines 22-24)."""
        out = StringIO()
        call_command('create_fake_payments', num=1, stdout=out)
        assert 'No bookings without payment found' in out.getvalue()


# ----------------------------------------------------------------
# create_fake_notifications
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeNotifications:
    def test_no_data_warning(self):
        """No bookings/payments → warning (lines 20-22)."""
        out = StringIO()
        call_command('create_fake_notifications', num=1, stdout=out)
        assert 'No bookings/payments found' in out.getvalue()
