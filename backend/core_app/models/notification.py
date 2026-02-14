from django.db import models

from core_app.models.base import TimestampedModel


class Notification(TimestampedModel):
    class Type(models.TextChoices):
        BOOKING_CONFIRMED = 'booking_confirmed', 'Booking confirmed'
        BOOKING_CANCELED = 'booking_canceled', 'Booking canceled'
        BOOKING_RESCHEDULED = 'booking_rescheduled', 'Booking rescheduled'
        BOOKING_REMINDER = 'booking_reminder', 'Booking reminder'
        PAYMENT_CONFIRMED = 'payment_confirmed', 'Payment confirmed'
        RECEIPT_EMAIL = 'receipt_email', 'Receipt email'
        SUBSCRIPTION_ACTIVATED = 'subscription_activated', 'Subscription activated'
        SUBSCRIPTION_CANCELED = 'subscription_canceled', 'Subscription canceled'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'

    booking = models.ForeignKey('core_app.Booking', on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    payment = models.ForeignKey('core_app.Payment', on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)

    notification_type = models.CharField(max_length=50, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    sent_to = models.EmailField(blank=True)
    provider_message_id = models.CharField(max_length=255, blank=True)
    payload = models.JSONField(default=dict, blank=True)

    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Notification #{self.pk} ({self.notification_type})"
