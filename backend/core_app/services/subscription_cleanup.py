"""Helpers to release resources tied to subscriptions."""

from typing import Optional

from django.db import transaction
from django.utils import timezone

from core_app.models import Booking, Subscription

CANCEL_REASON = 'Suscripcion expirada.'


def cancel_future_bookings(subscription: Subscription, *, now: Optional[timezone.datetime] = None) -> int:
    """Cancel upcoming bookings for a subscription.

    Args:
        subscription: Subscription instance to clean up.
        now: Optional timezone-aware datetime used as the cutoff for future bookings.

    Returns:
        int: Number of bookings that were canceled.
    """
    if now is None:
        now = timezone.now()

    canceled = 0
    with transaction.atomic():
        bookings = (
            Booking.objects.select_for_update()
            .filter(
                subscription=subscription,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
                starts_at__gte=now,
            )
        )

        for booking in bookings:
            booking.status = Booking.Status.CANCELED
            booking.canceled_reason = CANCEL_REASON
            booking.save(update_fields=['status', 'canceled_reason', 'updated_at'])
            canceled += 1

    return canceled
