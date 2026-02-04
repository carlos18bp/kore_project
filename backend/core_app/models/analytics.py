from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class AnalyticsEvent(TimestampedModel):
    class Type(models.TextChoices):
        WHATSAPP_CLICK = 'whatsapp_click', 'WhatsApp click'
        PACKAGE_VIEW = 'package_view', 'Package view'
        BOOKING_CREATED = 'booking_created', 'Booking created'
        PAYMENT_CONFIRMED = 'payment_confirmed', 'Payment confirmed'

    event_type = models.CharField(max_length=50, choices=Type.choices, db_index=True)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='analytics_events')
    session_id = models.CharField(max_length=128, blank=True, db_index=True)

    path = models.CharField(max_length=500, blank=True)
    referrer = models.CharField(max_length=500, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"{self.event_type} #{self.pk}"
