from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class StoreItem(TimestampedModel):
    """A redeemable catalog item. Unlimited (no stock)."""

    class ItemType(models.TextChoices):
        SERVICIO = 'servicio', 'Servicio'
        PRODUCTO = 'producto', 'Producto físico'
        SESION = 'sesion_adicional', 'Sesión adicional'
        DESCUENTO = 'descuento', 'Descuento'

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='store_items/', null=True, blank=True)
    price_credits = models.PositiveIntegerField()
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.SERVICIO)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('-is_active', 'price_credits', 'name')

    def __str__(self):
        return f'{self.name} ({self.price_credits} cr)'


class RedemptionRequest(TimestampedModel):
    """A client's redemption of a StoreItem. Credits are spent immediately;
    the trainer fulfills or rejects (reject → refund)."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        FULFILLED = 'fulfilled', 'Entregado'
        REJECTED = 'rejected', 'Rechazado'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='redemptions',
    )
    item = models.ForeignKey(StoreItem, on_delete=models.PROTECT, related_name='redemptions')
    credits_spent = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    trainer_note = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.customer} → {self.item.name} ({self.status})'
