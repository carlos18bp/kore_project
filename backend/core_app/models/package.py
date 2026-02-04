from decimal import Decimal

from django.db import models

from core_app.models.base import TimestampedModel


class Package(TimestampedModel):
    title = models.CharField(max_length=255)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)

    sessions_count = models.PositiveIntegerField(default=1)
    session_duration_minutes = models.PositiveIntegerField(default=60)

    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='COP')

    validity_days = models.PositiveIntegerField(default=30)
    terms_and_conditions = models.TextField(blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ('order', 'id')

    def __str__(self):
        return self.title
