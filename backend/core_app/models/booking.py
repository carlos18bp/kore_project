from django.conf import settings
from django.db import models

from core_app.models.availability import AvailabilitySlot
from core_app.models.base import TimestampedModel
from core_app.models.package import Package


class Booking(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELED = 'canceled', 'Canceled'

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='bookings')
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name='bookings')
    slot = models.OneToOneField(AvailabilitySlot, on_delete=models.PROTECT, related_name='booking')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    notes = models.TextField(blank=True)
    canceled_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Booking #{self.pk} ({self.customer})"
