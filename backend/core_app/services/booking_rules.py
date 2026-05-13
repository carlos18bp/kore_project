"""Booking scheduling business-rule helpers (trainer travel-buffer check)."""

from datetime import timedelta

from django.db.models import Q

from core_app.models import Booking
from core_app.services.slot_schedule import TRAVEL_BUFFER_MINUTES

ACTIVE_BOOKING_STATUSES = (Booking.Status.PENDING, Booking.Status.CONFIRMED)


def has_trainer_travel_buffer_conflict(trainer, starts_at, ends_at, *, exclude_booking_id=None):
    """Return True if [starts_at, ends_at] is within ±TRAVEL_BUFFER_MINUTES of
    any active booking for *trainer*."""
    if trainer is None:
        return False
    buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)
    qs = Booking.objects.filter(
        trainer=trainer,
        status__in=ACTIVE_BOOKING_STATUSES,
        starts_at__lt=ends_at + buffer,
        ends_at__gt=starts_at - buffer,
    )
    if exclude_booking_id is not None:
        qs = qs.exclude(pk=exclude_booking_id)
    return qs.exists()


def build_trainer_buffer_slot_conflict_q(bookings):
    """Build a Q object to exclude AvailabilitySlots blocked by trainer travel buffer.

    Used by AvailabilitySlotViewSet until that viewset is removed.
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
