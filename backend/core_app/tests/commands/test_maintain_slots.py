"""Tests for the maintain_slots management command (prune + fill)."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.core.management import call_command

from core_app.models import AvailabilitySlot, Booking, Package, TrainerProfile, User

FIXED_NOW = datetime(2026, 3, 4, 12, 0, tzinfo=dt_timezone.utc)  # Wednesday


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='maintain-trainer@kore.com', password='p', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, specialty='General')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='maintain-customer@kore.com', password='p', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(title='TestPkg', is_active=True)


# ── Prune phase ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPrunePhase:
    def test_deletes_free_past_slots(self, trainer):
        """Past slots with no bookings are deleted."""
        past_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW - timedelta(days=5),
            ends_at=FIXED_NOW - timedelta(days=5, hours=-1),
            trainer=trainer,
        )
        call_command('maintain_slots', prune_only=True)
        assert not AvailabilitySlot.objects.filter(pk=past_slot.pk).exists()

    def test_preserves_past_slots_with_active_booking(self, trainer, customer, package):
        """Past slots with active bookings are kept for traceability."""
        past_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW - timedelta(days=3),
            ends_at=FIXED_NOW - timedelta(days=3, hours=-1),
            trainer=trainer,
            is_blocked=True,
        )
        Booking.objects.create(
            customer=customer,
            package=package,
            slot=past_slot,
            trainer=trainer,
            status=Booking.Status.CONFIRMED,
        )
        call_command('maintain_slots', prune_only=True)
        assert AvailabilitySlot.objects.filter(pk=past_slot.pk).exists()

    def test_preserves_past_slots_with_canceled_booking(self, trainer, customer, package):
        """Past slots with canceled bookings are also kept."""
        past_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW - timedelta(days=2),
            ends_at=FIXED_NOW - timedelta(days=2, hours=-1),
            trainer=trainer,
        )
        Booking.objects.create(
            customer=customer,
            package=package,
            slot=past_slot,
            trainer=trainer,
            status=Booking.Status.CANCELED,
        )
        call_command('maintain_slots', prune_only=True)
        assert AvailabilitySlot.objects.filter(pk=past_slot.pk).exists()

    def test_does_not_delete_future_slots(self, trainer):
        """Future slots are never pruned."""
        future_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW + timedelta(days=1),
            ends_at=FIXED_NOW + timedelta(days=1, hours=1),
            trainer=trainer,
        )
        call_command('maintain_slots', prune_only=True)
        assert AvailabilitySlot.objects.filter(pk=future_slot.pk).exists()


# ── Fill phase ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFillPhase:
    def test_creates_future_slots(self, trainer):
        """Fill phase creates slots for the trainer."""
        assert AvailabilitySlot.objects.filter(trainer=trainer).count() == 0
        call_command('maintain_slots', fill_only=True, days=3)
        assert AvailabilitySlot.objects.filter(trainer=trainer).count() > 0

    def test_includes_saturday_slots(self, trainer):
        """Fill phase generates Saturday 06:00-13:00 slots."""
        # FIXED_NOW is Wed 2026-03-04. Saturday is 2026-03-07 (offset=3).
        call_command('maintain_slots', fill_only=True, days=4)
        from zoneinfo import ZoneInfo
        tz = ZoneInfo('UTC')
        saturday = datetime(2026, 3, 7, tzinfo=tz).date()
        sat_slots = AvailabilitySlot.objects.filter(
            trainer=trainer,
            starts_at__date=saturday,
        )
        assert sat_slots.count() > 0

    def test_idempotent_on_second_run(self, trainer):
        """Running fill twice does not duplicate slots."""
        call_command('maintain_slots', fill_only=True, days=3)
        count_after_first = AvailabilitySlot.objects.filter(trainer=trainer).count()
        call_command('maintain_slots', fill_only=True, days=3)
        count_after_second = AvailabilitySlot.objects.filter(trainer=trainer).count()
        assert count_after_first == count_after_second


# ── Combined ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCombinedExecution:
    def test_prune_and_fill_in_single_run(self, trainer):
        """Single invocation prunes old free slots and fills future ones."""
        past_slot = AvailabilitySlot.objects.create(
            starts_at=FIXED_NOW - timedelta(days=10),
            ends_at=FIXED_NOW - timedelta(days=10, hours=-1),
            trainer=trainer,
        )
        call_command('maintain_slots', days=3)
        assert not AvailabilitySlot.objects.filter(pk=past_slot.pk).exists()
        assert AvailabilitySlot.objects.filter(
            trainer=trainer, ends_at__gt=FIXED_NOW,
        ).count() > 0
