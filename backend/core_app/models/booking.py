from django.conf import settings
from django.db import models

from core_app.models.availability import AvailabilitySlot
from core_app.models.base import TimestampedModel
from core_app.models.package import Package


class Booking(TimestampedModel):
    """A scheduled training session linking a customer, slot, package, trainer, and subscription.

    The ``slot`` field is a OneToOneField which prevents double-booking the
    same availability window.  ``trainer`` and ``subscription`` are nullable
    for backward compatibility with bookings created before these fields
    existed.

    Attributes:
        customer: The user who booked the session.
        package: The package associated with this booking.
        slot: The reserved availability slot (unique per booking).
        trainer: The trainer assigned to this session (nullable).
        subscription: The customer subscription being consumed (nullable).
        status: Current booking state (pending / confirmed / canceled).
        notes: Free-text notes about the booking.
        canceled_reason: Reason provided when the booking is canceled.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELED = 'canceled', 'Canceled'

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='bookings')
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name='bookings')
    slot = models.OneToOneField(AvailabilitySlot, on_delete=models.PROTECT, related_name='booking')
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        related_name='bookings',
        null=True,
        blank=True,
    )
    subscription = models.ForeignKey(
        'core_app.Subscription',
        on_delete=models.SET_NULL,
        related_name='bookings',
        null=True,
        blank=True,
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    notes = models.TextField(blank=True)
    canceled_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Booking #{self.pk} ({self.customer})"
