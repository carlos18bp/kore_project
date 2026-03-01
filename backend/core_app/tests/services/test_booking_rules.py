"""Tests for booking scheduling business-rule helpers."""

from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, TrainerProfile, User
from core_app.services.booking_rules import (
    build_trainer_buffer_slot_conflict_q,
    has_trainer_travel_buffer_conflict,
    resolve_effective_trainer_id,
)

FIXED_NOW = timezone.make_aware(datetime(2025, 1, 20, 9, 0, 0), timezone.get_current_timezone())


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze ``timezone.now`` for deterministic buffer-window checks."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


def _make_customer(email: str):
    return User.objects.create_user(email=email, password='p', role=User.Role.CUSTOMER)


def _make_trainer(email: str):
    user = User.objects.create_user(email=email, password='p', role=User.Role.TRAINER)
    return TrainerProfile.objects.create(user=user, specialty='Strength')


@pytest.mark.django_db
def test_resolve_effective_trainer_id_prefers_slot_trainer():
    """Slot trainer takes precedence over fallback trainer argument."""
    slot_trainer = _make_trainer('slot-trainer@example.com')
    fallback_trainer = _make_trainer('fallback-trainer@example.com')

    slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=1),
        ends_at=FIXED_NOW + timedelta(hours=2),
        trainer=slot_trainer,
    )

    assert resolve_effective_trainer_id(slot, trainer=fallback_trainer) == slot_trainer.pk


@pytest.mark.django_db
def test_has_trainer_travel_buffer_conflict_detects_within_45_minutes():
    """A new slot starting 30 minutes after another booking ends must conflict."""
    trainer = _make_trainer('buffer-trainer@example.com')
    customer = _make_customer('buffer-customer@example.com')
    package = Package.objects.create(title='Buffer Package')

    existing_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=2),
        ends_at=FIXED_NOW + timedelta(hours=3),
        trainer=trainer,
    )
    Booking.objects.create(
        customer=customer,
        package=package,
        slot=existing_slot,
        trainer=trainer,
        status=Booking.Status.CONFIRMED,
    )

    candidate_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=3, minutes=30),
        ends_at=FIXED_NOW + timedelta(hours=4, minutes=30),
        trainer=trainer,
    )

    assert has_trainer_travel_buffer_conflict(candidate_slot) is True


@pytest.mark.django_db
def test_has_trainer_travel_buffer_conflict_allows_exact_45_min_boundary_and_exclusion():
    """Exactly 45-minute separation is allowed, and exclusion omits self-conflicts."""
    trainer = _make_trainer('boundary-trainer@example.com')
    customer = _make_customer('boundary-customer@example.com')
    package = Package.objects.create(title='Boundary Package')

    existing_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=2),
        ends_at=FIXED_NOW + timedelta(hours=3),
        trainer=trainer,
    )
    existing_booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=existing_slot,
        trainer=trainer,
        status=Booking.Status.PENDING,
    )

    boundary_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=3, minutes=45),
        ends_at=FIXED_NOW + timedelta(hours=4, minutes=45),
        trainer=trainer,
    )
    assert has_trainer_travel_buffer_conflict(boundary_slot) is False

    assert has_trainer_travel_buffer_conflict(existing_slot) is True
    assert has_trainer_travel_buffer_conflict(existing_slot, exclude_booking_id=existing_booking.pk) is False


@pytest.mark.django_db
def test_build_trainer_buffer_slot_conflict_q_excludes_conflicting_slots_only():
    """Generated ``Q`` excludes slots in the trainer buffer window but keeps boundary slots."""
    trainer = _make_trainer('q-trainer@example.com')
    other_trainer = _make_trainer('q-other-trainer@example.com')
    customer = _make_customer('q-customer@example.com')
    package = Package.objects.create(title='Q Package')

    booked_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=2),
        ends_at=FIXED_NOW + timedelta(hours=3),
        trainer=trainer,
        is_blocked=True,
    )
    booking = Booking.objects.create(
        customer=customer,
        package=package,
        slot=booked_slot,
        trainer=trainer,
        status=Booking.Status.CONFIRMED,
    )

    conflict_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=3, minutes=30),
        ends_at=FIXED_NOW + timedelta(hours=4, minutes=30),
        trainer=trainer,
    )
    boundary_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=3, minutes=45),
        ends_at=FIXED_NOW + timedelta(hours=4, minutes=45),
        trainer=trainer,
    )
    other_trainer_slot = AvailabilitySlot.objects.create(
        starts_at=FIXED_NOW + timedelta(hours=3, minutes=15),
        ends_at=FIXED_NOW + timedelta(hours=4, minutes=15),
        trainer=other_trainer,
    )

    conflict_q = build_trainer_buffer_slot_conflict_q(
        Booking.objects.filter(pk=booking.pk).select_related('slot')
    )
    available_ids = set(AvailabilitySlot.objects.exclude(conflict_q).values_list('id', flat=True))

    assert conflict_slot.id not in available_ids
    assert boundary_slot.id in available_ids
    assert other_trainer_slot.id in available_ids
