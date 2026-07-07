from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel
from core_app.models.package import Package


class Booking(TimestampedModel):
    """A scheduled training session linking a customer, package, trainer, and subscription.

    ``starts_at`` and ``ends_at`` own the session time window; there is no
    separate availability-slot object.

    Attributes:
        customer: The user who booked the session.
        package: The package associated with this booking.
        trainer: The trainer assigned to this session (nullable for legacy rows).
        subscription: The customer subscription being consumed (nullable).
        starts_at: Session start time (UTC).
        ends_at: Session end time (UTC).
        status: Current booking state (pending / confirmed / canceled).
        notes: Free-text notes about the booking.
        canceled_reason: Reason provided when the booking is canceled.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELED = 'canceled', 'Canceled'

    class AttendanceStatus(models.TextChoices):
        UNSET = 'unset', 'Unset'
        ATTENDED = 'attended', 'Attended'
        NO_SHOW = 'no_show', 'No Show'

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='bookings')
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name='bookings')
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
    session_grant = models.ForeignKey(
        'core_app.SessionGrant',
        on_delete=models.SET_NULL,
        related_name='bookings',
        null=True,
        blank=True,
    )

    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(db_index=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    notes = models.TextField(blank=True)
    canceled_reason = models.CharField(max_length=255, blank=True)
    attendance_status = models.CharField(
        max_length=10,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.UNSET,
        db_index=True,
    )
    attendance_confirmed_at = models.DateTimeField(null=True, blank=True)
    session_objective = models.TextField(blank=True)
    session_notes_for_customer = models.TextField(blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Booking #{self.pk} ({self.customer})"
