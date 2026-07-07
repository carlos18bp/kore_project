from django.db import models

from core_app.models.base import TimestampedModel


class NutritionProduct(TimestampedModel):
    """Admin-configured monthly price for the nutrition add-on (single active row)."""

    name = models.CharField(max_length=120, default='Nutrición')
    price_cop = models.PositiveIntegerField(help_text='Monthly price in whole COP.')
    is_active = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return f'{self.name} — {self.price_cop} COP/mes'
