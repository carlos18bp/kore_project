from decimal import Decimal

from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class Payment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        FAILED = 'failed', 'Failed'
        CANCELED = 'canceled', 'Canceled'
        REFUNDED = 'refunded', 'Refunded'

    class Provider(models.TextChoices):
        WOMPI = 'wompi', 'Wompi'
        PAYU = 'payu', 'PayU'
        EPAYCO = 'epayco', 'ePayco'
        PAYPAL = 'paypal', 'PayPal'

    booking = models.ForeignKey(
        'core_app.Booking',
        on_delete=models.PROTECT,
        related_name='payments',
        null=True,
        blank=True,
    )
    subscription = models.ForeignKey(
        'core_app.Subscription',
        on_delete=models.PROTECT,
        related_name='payments',
        null=True,
        blank=True,
    )
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payments')

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='COP')

    provider = models.CharField(max_length=20, choices=Provider.choices, blank=True)
    provider_reference = models.CharField(max_length=255, blank=True, db_index=True)

    metadata = models.JSONField(default=dict, blank=True)

    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Payment #{self.pk} ({self.status})"
