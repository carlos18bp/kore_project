from django.db import models

from core_app.models.base import TimestampedModel


class CreditPackage(TimestampedModel):
    """An admin-configured bundle of credits purchasable with money."""

    name = models.CharField(max_length=120)
    credits = models.PositiveIntegerField()
    price_cop = models.PositiveIntegerField(help_text='Whole COP (no cents).')
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('price_cop',)

    def __str__(self):
        return f'{self.name} — {self.credits} cr / {self.price_cop} COP'
