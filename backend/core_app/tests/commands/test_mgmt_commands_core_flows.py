"""Tests for management commands to cover remaining uncovered lines."""

from datetime import datetime, timedelta
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone

from core_app.management.commands.create_fake_bookings import (
    Command as CreateFakeBookingsCommand,
)
from core_app.management.commands.create_fake_bookings import (
    _pick_booking_ratio,
)
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

FIXED_NOW = timezone.make_aware(datetime(2025, 7, 10, 9, 0, 0))


def _force_limit_before_candidate_scan(candidates):
    """Force candidate booking count to its limit before the command's inner scan.

    Used as a ``random.shuffle`` side-effect so the candidate-limit guard in
    ``create_fake_bookings`` is exercised mid-iteration.
    """
    import inspect

    if not candidates:
        return
    for frame_info in inspect.stack():
        frame = frame_info.frame
        if 'sub_booking_counts' not in frame.f_locals:
            continue
        if 'sub_booking_limits' not in frame.f_locals:
            continue
        counts = frame.f_locals['sub_booking_counts']
        limits = frame.f_locals['sub_booking_limits']
        candidate = candidates[0]
        counts[candidate.pk] = limits[candidate.pk]
        return


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze ``timezone.now`` to keep management command tests deterministic."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


# ----------------------------------------------------------------
# create_fake_packages
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakePackages:
    """Behavior checks for ``create_fake_packages`` command options."""

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

    def test_extra_packages_are_idempotent_on_second_run(self):
        """Second run with ``--extra`` does not duplicate already-created extra packages."""
        out1 = StringIO()
        call_command('create_fake_packages', extra=1, stdout=out1)

        out2 = StringIO()
        call_command('create_fake_packages', extra=1, stdout=out2)

        assert Package.objects.filter(title='Paquete Extra 1').count() == 1
        assert '- created: 0' in out2.getvalue()


# ----------------------------------------------------------------
# create_fake_subscriptions
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeSubscriptions:
    """Behavior checks for ``create_fake_subscriptions`` command branches."""

    def test_pick_status_falls_back_to_active_when_weights_do_not_cover_random_value(self):
        """Helper returns ACTIVE fallback when weighted statuses do not include sampled value."""
        from core_app.management.commands.create_fake_subscriptions import _pick_status

        with patch(
            'core_app.management.commands.create_fake_subscriptions.STATUS_DISTRIBUTION',
            [(Subscription.Status.EXPIRED, 0.10)],
        ), patch(
            'core_app.management.commands.create_fake_subscriptions.random.random',
            return_value=0.95,
        ):
            status_value = _pick_status()

        assert status_value == Subscription.Status.ACTIVE

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
        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=5, validity_days=30)
        customer = User.objects.create_user(
            email='sub_skip@example.com', password='p', role=User.Role.CUSTOMER,
        )
        now = FIXED_NOW
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

    def test_multi_program_assignment(self):
        """Customers can get 1-3 programs assigned."""
        # Create 5 packages and 2 customers
        for i in range(5):
            Package.objects.create(
                title=f'Pkg{i}', is_active=True, sessions_count=10, validity_days=30
            )
        for i in range(2):
            User.objects.create_user(
                email=f'multi_cust{i}@example.com', password='p', role=User.Role.CUSTOMER,
            )

        out = StringIO()
        call_command('create_fake_subscriptions', min_programs=2, max_programs=3, stdout=out)

        # Each customer should have 2-3 subscriptions
        for i in range(2):
            customer = User.objects.get(email=f'multi_cust{i}@example.com')
            sub_count = Subscription.objects.filter(customer=customer).count()
            assert sub_count >= 2, f'Customer {i} has too few subs: {sub_count}'
            assert sub_count <= 3, f'Customer {i} has too many subs: {sub_count}'

    def test_partial_session_usage(self):
        """Active subscriptions should have partial session usage (not all used)."""
        Package.objects.create(
            title='Pkg', is_active=True, sessions_count=20, validity_days=30
        )
        User.objects.create_user(
            email='partial_cust@example.com', password='p', role=User.Role.CUSTOMER,
        )

        out = StringIO()
        call_command('create_fake_subscriptions', min_programs=1, max_programs=1, stdout=out)

        sub = Subscription.objects.filter(customer__email='partial_cust@example.com').first()
        assert sub is not None
        # Active subscriptions should have remaining sessions
        if sub.status == Subscription.Status.ACTIVE:
            assert sub.sessions_remaining > 0

    def test_active_subscription_guarantee(self):
        """Each customer should receive at least one active subscription."""
        for i in range(2):
            Package.objects.create(
                title=f'Pkg{i}', is_active=True, sessions_count=10, validity_days=30
            )
        customers = [
            User.objects.create_user(
                email=f'active_guard{i}@example.com', password='p', role=User.Role.CUSTOMER,
            )
            for i in range(2)
        ]

        out = StringIO()
        call_command('create_fake_subscriptions', min_programs=1, max_programs=1, stdout=out)

        for customer in customers:
            assert Subscription.objects.filter(
                customer=customer,
                status=Subscription.Status.ACTIVE,
            ).exists()

    def test_ensure_inactive_flag(self):
        """Ensure --ensure-inactive assigns at least one inactive subscription when possible."""
        for i in range(3):
            Package.objects.create(
                title=f'PkgInactive{i}', is_active=True, sessions_count=10, validity_days=30
            )
        customers = [
            User.objects.create_user(
                email=f'inactive_guard{i}@example.com', password='p', role=User.Role.CUSTOMER,
            )
            for i in range(2)
        ]

        out = StringIO()
        call_command(
            'create_fake_subscriptions',
            min_programs=2,
            max_programs=2,
            ensure_inactive=True,
            stdout=out,
        )

        for customer in customers:
            assert Subscription.objects.filter(
                customer=customer,
                status=Subscription.Status.ACTIVE,
            ).exists()
            assert Subscription.objects.filter(
                customer=customer,
            ).exclude(status=Subscription.Status.ACTIVE).exists()

    def test_expired_subscription_can_use_full_ratio(self):
        """Expired subscriptions can consume 100% of sessions_total."""
        pkg_active = Package.objects.create(
            title='PkgActive', is_active=True, sessions_count=8, validity_days=30
        )
        pkg_expired = Package.objects.create(
            title='PkgExpired', is_active=True, sessions_count=8, validity_days=30
        )
        customer = User.objects.create_user(
            email='ratio_cust@example.com', password='p', role=User.Role.CUSTOMER,
        )
        now = FIXED_NOW
        Subscription.objects.create(
            customer=customer,
            package=pkg_active,
            sessions_total=8,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_subscriptions.random.random',
            return_value=0.7,
        ), patch(
            'core_app.management.commands.create_fake_subscriptions.random.choice',
            return_value=1.0,
        ):
            call_command('create_fake_subscriptions', min_programs=1, max_programs=1, stdout=out)

        expired_sub = Subscription.objects.filter(customer=customer, package=pkg_expired).first()
        assert expired_sub is not None
        assert expired_sub.status == Subscription.Status.EXPIRED
        assert expired_sub.sessions_used == expired_sub.sessions_total

    def test_unknown_status_uses_partial_usage_fallback_branch(self):
        """Unknown status values use the defensive partial-usage fallback branch."""
        now = FIXED_NOW
        existing_pkg = Package.objects.create(
            title='ExistingPkg',
            is_active=True,
            sessions_count=8,
            validity_days=30,
        )
        new_pkg = Package.objects.create(
            title='NewPkg',
            is_active=True,
            sessions_count=10,
            validity_days=30,
        )
        customer = User.objects.create_user(
            email='sub_unknown_status@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        Subscription.objects.create(
            customer=customer,
            package=existing_pkg,
            sessions_total=8,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_subscriptions._pick_status',
            return_value='mystery_status',
        ), patch(
            'core_app.management.commands.create_fake_subscriptions._pick_usage_ratio',
            return_value=0.5,
        ):
            call_command(
                'create_fake_subscriptions',
                min_programs=1,
                max_programs=1,
                stdout=out,
            )

        created = Subscription.objects.get(customer=customer, package=new_pkg)
        assert created.status == 'mystery_status'
        assert created.sessions_used == 5


# ----------------------------------------------------------------
# create_fake_bookings
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeBookings:
    """Behavior checks for booking generation and backfill command flows."""

    def test_pick_booking_ratio_uses_uniform_when_no_discrete_option_matches(self):
        """Helper falls back to ``random.uniform`` when range excludes discrete ratio options."""
        with patch(
            'core_app.management.commands.create_fake_bookings.random.uniform',
            return_value=0.37,
        ) as mock_uniform:
            ratio = _pick_booking_ratio(0.31, 0.49)

        assert ratio == 0.37
        mock_uniform.assert_called_once_with(0.31, 0.49)

    def test_candidate_at_limit_guard_skips_in_loop(self):
        """Defensive candidate-limit guard skips customers that reached target bookings mid-iteration."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_limit_guard@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        package = Package.objects.create(
            title='LimitGuardPkg',
            is_active=True,
            sessions_count=4,
            validity_days=30,
        )
        Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=4,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
            is_active=True,
            is_blocked=False,
        )

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_bookings.random.shuffle',
            side_effect=_force_limit_before_candidate_scan,
        ):
            call_command('create_fake_bookings', num=1, stdout=out)

        assert Booking.objects.count() == 0
        assert '- created: 0' in out.getvalue()

    def test_overlap_guard_skips_candidate_when_overlap_check_returns_true(self):
        """Candidate is skipped when overlap guard reports conflicting active bookings."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_overlap_guard@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        package = Package.objects.create(
            title='OverlapGuardPkg',
            is_active=True,
            sessions_count=3,
            validity_days=30,
        )
        Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=3,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
            is_active=True,
            is_blocked=False,
        )

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_bookings._has_overlapping_booking',
            return_value=True,
        ):
            call_command('create_fake_bookings', num=1, stdout=out)

        assert Booking.objects.count() == 0
        assert '- created: 0' in out.getvalue()

    def test_locked_slot_race_condition_skips_creation(self):
        """Creation loop skips when slot appears blocked after select-for-update lock step."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_lock_guard@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        package = Package.objects.create(
            title='LockGuardPkg',
            is_active=True,
            sessions_count=3,
            validity_days=30,
        )
        Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=3,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
            is_active=True,
            is_blocked=False,
        )
        locked_slot = AvailabilitySlot.objects.get(pk=slot.pk)
        locked_slot.is_blocked = True

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_bookings.AvailabilitySlot.objects.select_for_update'
        ) as mock_select_for_update:
            mock_select_for_update.return_value.get.return_value = locked_slot
            call_command('create_fake_bookings', num=1, stdout=out)

        assert Booking.objects.count() == 0
        assert '- created: 0' in out.getvalue()

    def test_seeding_skips_active_subscription_with_zero_sessions_total(self):
        """Active seeding skips subscriptions whose ``sessions_total`` yields non-positive seed target."""
        now = FIXED_NOW
        seeded_customer = User.objects.create_user(
            email='bk_seed_positive@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        zero_customer = User.objects.create_user(
            email='bk_seed_zero_total@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        seeded_pkg = Package.objects.create(
            title='SeedPkg',
            is_active=True,
            sessions_count=1,
            validity_days=30,
        )
        zero_pkg = Package.objects.create(
            title='ZeroSeedPkg',
            is_active=True,
            sessions_count=1,
            validity_days=30,
        )
        Subscription.objects.create(
            customer=seeded_customer,
            package=seeded_pkg,
            sessions_total=1,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=2),
            expires_at=now + timedelta(days=20),
        )
        zero_sub = Subscription.objects.create(
            customer=zero_customer,
            package=zero_pkg,
            sessions_total=0,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=2),
            expires_at=now + timedelta(days=20),
        )

        out = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out)

        zero_sub.refresh_from_db()
        assert zero_sub.sessions_used == 0
        assert '- active_seeded: 1' in out.getvalue()

    def test_backfill_skips_subscription_without_valid_past_window(self):
        """Past backfill skips subscriptions when computed window is invalid."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_invalid_window@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        package = Package.objects.create(
            title='InvalidWindowPkg',
            is_active=True,
            sessions_count=6,
            validity_days=30,
            session_duration_minutes=60,
        )
        Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=6,
            sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(hours=2),
            expires_at=now + timedelta(hours=1),
        )

        created = CreateFakeBookingsCommand._backfill_past_bookings(trainers=[])

        assert created == 0
        assert Booking.objects.count() == 0

    def test_no_eligible_subs_warning(self):
        """No active subscriptions → warning."""
        out = StringIO()
        call_command('create_fake_bookings', num=1, stdout=out)
        assert 'No customers with active subscriptions found' in out.getvalue()

    def test_no_available_slots_stops(self):
        """No available slots → loop breaks."""
        now = FIXED_NOW
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
        now = FIXED_NOW
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
        assert Booking.objects.filter(slot=slot).count() == 1
        assert 'created: 0' in output

    def test_partial_booking_limit(self):
        """Bookings per subscription are limited to a percentage of sessions_total."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_limit@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=20, validity_days=30)
        sub = Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=20, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        trainer_user = User.objects.create_user(
            email='bk_trainer@example.com', password='p', role=User.Role.TRAINER,
        )
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Test')

        # Create 20 available slots
        for i in range(20):
            AvailabilitySlot.objects.create(
                starts_at=now + timedelta(hours=2 + i),
                ends_at=now + timedelta(hours=3 + i),
                is_active=True, is_blocked=False,
                trainer=trainer,
            )

        out = StringIO()
        # Limit to 30% of sessions = max 6 bookings
        call_command('create_fake_bookings', num=20, min_booking_ratio=0.30, max_booking_ratio=0.30, stdout=out)

        # Should have created at most 30% of sessions = 6 bookings
        booking_count = Booking.objects.filter(subscription=sub).exclude(status=Booking.Status.CANCELED).count()
        assert booking_count <= 6, f'Expected <=6 bookings, got {booking_count}'

    def test_full_booking_ratio(self):
        """Booking ratio of 100% fills all sessions when enough slots exist."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_full@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=4, validity_days=30)
        sub = Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=4, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        trainer_user = User.objects.create_user(
            email='bk_full_trainer@example.com', password='p', role=User.Role.TRAINER,
        )
        trainer = TrainerProfile.objects.create(user=trainer_user, specialty='Test')

        for i in range(4):
            AvailabilitySlot.objects.create(
                starts_at=now + timedelta(hours=2 + i),
                ends_at=now + timedelta(hours=3 + i),
                is_active=True, is_blocked=False,
                trainer=trainer,
            )

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_bookings._pick_booking_ratio',
            return_value=1.0,
        ), patch(
            'core_app.management.commands.create_fake_bookings.random.random',
            return_value=0.9,
        ):
            call_command(
                'create_fake_bookings',
                num=4, min_booking_ratio=0.2, max_booking_ratio=1.0, stdout=out,
            )

        sub.refresh_from_db()
        booking_count = Booking.objects.filter(
            subscription=sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).count()
        assert booking_count == sub.sessions_total
        assert sub.sessions_used == sub.sessions_total

    def test_past_bookings_backfilled_for_expired_subscriptions(self):
        """Expired subscriptions with sessions_used > 0 get past booking records."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_expired@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(
            title='Pkg', is_active=True, sessions_count=4,
            validity_days=30, session_duration_minutes=60,
        )
        # Active sub (required so the command doesn't bail early)
        Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=4, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        # Expired sub with 3 sessions_used but no bookings
        expired_sub = Subscription.objects.create(
            customer=customer,
            package=Package.objects.create(
                title='ExpPkg', is_active=True, sessions_count=4,
                validity_days=30, session_duration_minutes=60,
            ),
            sessions_total=4, sessions_used=3,
            status=Subscription.Status.EXPIRED,
            starts_at=now - timedelta(days=60),
            expires_at=now - timedelta(days=30),
        )

        out = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out)

        past_bookings = Booking.objects.filter(
            subscription=expired_sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        )
        assert past_bookings.count() == 3
        # All slots should be in the past
        for booking in past_bookings:
            assert booking.slot.starts_at < now
        assert 'past_backfilled: 3' in out.getvalue()

    def test_past_bookings_idempotent_for_already_backfilled(self):
        """Second pass skips subscriptions that already have enough bookings."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_idem@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(
            title='PkgIdem', is_active=True, sessions_count=4,
            validity_days=30, session_duration_minutes=60,
        )
        Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=4, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        expired_sub = Subscription.objects.create(
            customer=customer,
            package=Package.objects.create(
                title='IdemPkg', is_active=True, sessions_count=4,
                validity_days=30, session_duration_minutes=60,
            ),
            sessions_total=4, sessions_used=2,
            status=Subscription.Status.EXPIRED,
            starts_at=now - timedelta(days=60),
            expires_at=now - timedelta(days=30),
        )

        # First run backfills
        out1 = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out1)
        assert Booking.objects.filter(subscription=expired_sub).count() == 2

        # Second run doesn't create duplicates
        out2 = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out2)
        assert Booking.objects.filter(subscription=expired_sub).count() == 2
        assert 'past_backfilled: 0' in out2.getvalue()

    def test_past_bookings_backfilled_for_active_subscriptions(self):
        """Active subscriptions with sessions_used > 0 but no past bookings get backfilled."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_active_past@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(
            title='ActivePkg', is_active=True, sessions_count=8,
            validity_days=90, session_duration_minutes=60,
        )
        active_sub = Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=8, sessions_used=2,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=30),
            expires_at=now + timedelta(days=60),
        )

        out = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out)

        active_sub.refresh_from_db()
        past_bookings = Booking.objects.filter(
            subscription=active_sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            slot__starts_at__lt=now,
        )
        total_active_bookings = Booking.objects.filter(
            subscription=active_sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        )

        # sessions_used=2, no existing active bookings -> 2 past records created
        assert past_bookings.count() == 2
        assert total_active_bookings.count() == 2
        assert active_sub.sessions_used == 2
        for booking in past_bookings:
            assert booking.slot.starts_at < now

    def test_backfill_does_not_exceed_sessions_total_when_future_bookings_exist(self):
        """Backfill skips creation when existing active bookings already hit sessions_total."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_active_future_cap@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(
            title='ActiveFutureCapPkg', is_active=True, sessions_count=1,
            validity_days=90, session_duration_minutes=60,
        )
        active_sub = Subscription.objects.create(
            customer=customer,
            package=pkg,
            sessions_total=1,
            sessions_used=1,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=30),
            expires_at=now + timedelta(days=60),
        )

        future_slot = AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=48),
            ends_at=now + timedelta(hours=49),
            is_active=True,
            is_blocked=True,
        )
        Booking.objects.create(
            customer=customer,
            package=pkg,
            slot=future_slot,
            subscription=active_sub,
            status=Booking.Status.CONFIRMED,
        )

        out = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out)

        active_sub.refresh_from_db()
        total_active_bookings = Booking.objects.filter(
            subscription=active_sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        )
        past_bookings = total_active_bookings.filter(slot__starts_at__lt=now)

        assert total_active_bookings.count() == 1
        assert past_bookings.count() == 0
        assert active_sub.sessions_used == 1

    def test_active_subscriptions_with_zero_usage_get_seeded(self):
        """Active subscriptions with zero usage get seeded to 1-2 used sessions."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_active_seed@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(
            title='ActiveSeedPkg', is_active=True, sessions_count=8,
            validity_days=90, session_duration_minutes=60,
        )
        active_sub = Subscription.objects.create(
            customer=customer,
            package=pkg,
            sessions_total=8,
            sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now - timedelta(days=10),
            expires_at=now + timedelta(days=30),
        )

        out = StringIO()
        call_command('create_fake_bookings', num=0, stdout=out)

        active_sub.refresh_from_db()
        seeded_bookings = Booking.objects.filter(
            subscription=active_sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).count()

        assert active_sub.sessions_used == 2
        assert seeded_bookings == 2
        assert 'active_seeded: 1' in out.getvalue()

    def test_sessions_used_syncs_with_confirmed_bookings(self):
        """sessions_used matches confirmed/pending bookings after command completes."""
        now = FIXED_NOW
        customer = User.objects.create_user(
            email='bk_sync@example.com', password='p', role=User.Role.CUSTOMER,
        )
        pkg = Package.objects.create(title='Pkg', is_active=True, sessions_count=5, validity_days=30)
        sub = Subscription.objects.create(
            customer=customer, package=pkg,
            sessions_total=5, sessions_used=4,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
        AvailabilitySlot.objects.create(
            starts_at=now + timedelta(hours=2),
            ends_at=now + timedelta(hours=3),
            is_active=True, is_blocked=False,
        )

        out = StringIO()
        with patch('core_app.management.commands.create_fake_bookings.random.random', return_value=0.9):
            call_command(
                'create_fake_bookings',
                num=1,
                min_booking_ratio=1.0,
                max_booking_ratio=1.0,
                stdout=out,
            )

        sub.refresh_from_db()
        booking_count = Booking.objects.filter(
            subscription=sub,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).count()
        assert booking_count == sub.sessions_used


# ----------------------------------------------------------------
# create_fake_slots
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeSlots:
    """Behavior checks for slot generation command edge cases."""

    def test_no_trainers_warning(self):
        """Command exits early with warning when no trainer profiles exist."""
        out = StringIO()
        call_command('create_fake_slots', days=1, stdout=out)

        assert 'No trainers found' in out.getvalue()
        assert AvailabilitySlot.objects.count() == 0

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
        with pytest.raises(SystemExit) as exc_info:
            call_command('create_fake_slots', start_hour=18, end_hour=9)
        assert exc_info.value.code != 0
        assert AvailabilitySlot.objects.count() == 0

    def test_slot_minutes_zero_error(self):
        """--slot-minutes <= 0 exits with error (line 34-35)."""
        with pytest.raises(SystemExit) as exc_info:
            call_command('create_fake_slots', slot_minutes=0)
        assert exc_info.value.code != 0
        assert AvailabilitySlot.objects.count() == 0

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
        user = User.objects.create_user(
            email='slot_late@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        # Mock now to be 19:00 (past default end_hour=18)
        import zoneinfo
        tz = zoneinfo.ZoneInfo('America/Bogota')
        late_now = datetime(2025, 7, 10, 19, 0, 0, tzinfo=tz)
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
        user = User.objects.create_user(
            email='slot_past@example.com', password='p', role=User.Role.TRAINER,
        )
        TrainerProfile.objects.create(user=user, specialty='Test')

        import zoneinfo
        tz = zoneinfo.ZoneInfo('America/Bogota')
        # Set now to 14:00 today, with slots from 9 to 18
        mid_day = datetime(2025, 7, 10, 14, 0, 0, tzinfo=tz)
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
    """Behavior checks for trainer fake-data creation idempotency and role updates."""

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
    """Behavior checks for fake site content and FAQ initialization."""

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
    """Behavior checks for fake payment generation preconditions."""

    def test_no_bookings_warning(self):
        """No bookings without payment → warning (lines 22-24)."""
        out = StringIO()
        call_command('create_fake_payments', num=1, stdout=out)
        assert 'No bookings without payment found' in out.getvalue()

    def test_canceled_booking_generates_refunded_payment(self):
        """Canceled bookings produce refunded payment records."""
        customer = User.objects.create_user(
            email='pay_refund@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        package = Package.objects.create(
            title='RefundPkg',
            is_active=True,
            sessions_count=4,
            validity_days=30,
            price=100000,
        )
        slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(hours=2),
            ends_at=FIXED_NOW + timedelta(hours=3),
            is_active=True,
            is_blocked=True,
        )
        booking = Booking.objects.create(
            customer=customer,
            package=package,
            slot=slot,
            status=Booking.Status.CANCELED,
        )

        out = StringIO()
        call_command('create_fake_payments', num=1, stdout=out)

        payment = Payment.objects.get(booking=booking)
        assert payment.status == Payment.Status.REFUNDED


# ----------------------------------------------------------------
# create_fake_notifications
# ----------------------------------------------------------------

@pytest.mark.django_db
class TestCreateFakeNotifications:
    """Behavior checks for fake notification generation safeguards."""

    def test_no_data_warning(self):
        """No bookings/payments → warning (lines 20-22)."""
        out = StringIO()
        call_command('create_fake_notifications', num=1, stdout=out)
        assert 'No bookings/payments found' in out.getvalue()

    def test_payment_without_subscription_is_skipped(self):
        """Payments without subscriptions are skipped for subscription notifications."""
        customer = User.objects.create_user(
            email='notif_skip@example.com', password='p', role=User.Role.CUSTOMER,
        )
        Payment.objects.create(
            customer=customer,
            amount=100000,
            provider=Payment.Provider.WOMPI,
            provider_reference='ref-no-sub',
        )
        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_notifications.random.random',
            side_effect=[0.2, 0.5],
        ):
            call_command('create_fake_notifications', num=1, stdout=out)

        output = out.getvalue()
        assert Notification.objects.count() == 0
        assert '- created: 0' in output
        assert '- failed: 0' in output
        assert '- total: 0' in output

    def test_iteration_skips_when_random_branch_has_no_available_source(self):
        """Iteration is skipped when random branch selects bookings path but no bookings exist."""
        customer = User.objects.create_user(
            email='notif_no_booking_branch@example.com',
            password='p',
            role=User.Role.CUSTOMER,
        )
        Payment.objects.create(
            customer=customer,
            amount=100000,
            provider=Payment.Provider.WOMPI,
            provider_reference='notif-branch-ref',
        )

        out = StringIO()
        with patch(
            'core_app.management.commands.create_fake_notifications.random.random',
            side_effect=[0.50, 0.95],
        ):
            call_command('create_fake_notifications', num=1, stdout=out)

        assert Notification.objects.count() == 0
        assert '- created: 0' in out.getvalue()
