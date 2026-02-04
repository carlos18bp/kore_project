from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class AvailabilitySlot(TimestampedModel):
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(db_index=True)

    is_active = models.BooleanField(default=True, db_index=True)
    is_blocked = models.BooleanField(default=False, db_index=True)
    blocked_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ('starts_at',)
        constraints = [
            models.CheckConstraint(check=models.Q(ends_at__gt=models.F('starts_at')), name='slot_ends_after_starts'),
            models.UniqueConstraint(fields=('starts_at', 'ends_at'), name='unique_slot_window'),
        ]

    def __str__(self):
        return f"{self.starts_at.isoformat()} - {self.ends_at.isoformat()}"

    @property
    def is_past(self):
        return self.ends_at <= timezone.now()
