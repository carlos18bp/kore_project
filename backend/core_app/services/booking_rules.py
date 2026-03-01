"""Booking scheduling business-rule helpers.

Centralizes trainer travel-buffer checks shared by create/reschedule validations
and availability listing filters.
"""

from datetime import timedelta

from django.db.models import Q

from core_app.models import Booking

TRAVEL_BUFFER_MINUTES = 45
ACTIVE_BOOKING_STATUSES = (
    Booking.Status.PENDING,
    Booking.Status.CONFIRMED,
)


def resolve_effective_trainer_id(slot, trainer=None):
    """Resolve the trainer id used for travel-buffer validations.

    Prefers the trainer attached to the slot. Falls back to an explicit
    booking trainer when the slot has no trainer assigned.

    Args:
        slot: AvailabilitySlot instance.
        trainer: Optional TrainerProfile instance.

    Returns:
        int | None: Trainer primary key or ``None`` when unavailable.
    """
    if slot.trainer_id:
        return slot.trainer_id
    if trainer:
        return trainer.pk
    return None


def has_trainer_travel_buffer_conflict(slot, trainer=None, exclude_booking_id=None):
    """Return whether *slot* conflicts with active bookings for the same trainer.

    A conflict exists when the candidate slot intersects the existing booking
    window expanded by ±45 minutes.

    Args:
        slot: Candidate AvailabilitySlot.
        trainer: Optional TrainerProfile fallback when ``slot.trainer`` is null.
        exclude_booking_id: Optional booking id to exclude from checks.

    Returns:
        bool: ``True`` when a trainer-buffer conflict exists.
    """
    trainer_id = resolve_effective_trainer_id(slot, trainer=trainer)
    if not trainer_id:
        return False

    buffer_delta = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    conflicts = Booking.objects.filter(
        status__in=ACTIVE_BOOKING_STATUSES,
        slot__starts_at__lt=slot.ends_at + buffer_delta,
        slot__ends_at__gt=slot.starts_at - buffer_delta,
    ).filter(
        Q(slot__trainer_id=trainer_id) | Q(trainer_id=trainer_id),
    )

    if exclude_booking_id is not None:
        conflicts = conflicts.exclude(pk=exclude_booking_id)

    return conflicts.exists()


def build_trainer_buffer_slot_conflict_q(bookings):
    """Build a ``Q`` object to exclude slots blocked by trainer travel buffer.

    Args:
        bookings: Iterable of Booking instances with ``slot`` selected.

    Returns:
        Q: Disjunction of slot conflict predicates.
    """
    buffer_delta = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    conflict_q = Q()

    for booking in bookings:
        trainer_id = booking.slot.trainer_id or booking.trainer_id
        if not trainer_id:
            continue

        conflict_q |= Q(
            trainer_id=trainer_id,
            starts_at__lt=booking.slot.ends_at + buffer_delta,
            ends_at__gt=booking.slot.starts_at - buffer_delta,
        )

    return conflict_q
