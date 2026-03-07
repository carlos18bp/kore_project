from django.conf import settings
from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class WeightEntry(TimestampedModel):
    """Daily weight log for a user.

    Each user can record one weight per day. Creating or updating an entry
    also syncs *current_weight_kg* on the related CustomerProfile.
    The full history is persisted for trainer review and progress charts
    (implemented later).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='weight_entries',
    )
    weight_kg = models.DecimalField(
        max_digits=5, decimal_places=1,
        help_text='Peso en kilogramos.',
    )
    date = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ('-date',)
        unique_together = ('user', 'date')
        verbose_name_plural = 'weight entries'

    def __str__(self):
        return f"{self.user.email} — {self.weight_kg} kg ({self.date})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self._sync_profile_weight()

    def _sync_profile_weight(self):
        """Update customer profile with the latest weight."""
        profile = getattr(self.user, 'customer_profile', None)
        if profile is not None:
            profile.current_weight_kg = self.weight_kg
            profile.save(update_fields=['current_weight_kg', 'updated_at'])
