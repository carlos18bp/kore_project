from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class NutritionUpgrade(TimestampedModel):
    """A one-time, prorated Wompi charge that adds nutrition to a subscription."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        DECLINED = 'declined', 'Declined'

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='nutrition_upgrades')
    subscription = models.ForeignKey('core_app.Subscription', on_delete=models.PROTECT, related_name='nutrition_upgrades')
    amount_cop = models.PositiveIntegerField()
    reference = models.CharField(max_length=64, unique=True, db_index=True)
    wompi_transaction_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.customer} — nutrición ({self.status})'
