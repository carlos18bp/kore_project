import secrets

from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class SubscriptionGuest(TimestampedModel):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REVOKED = 'revoked'

    STATUS = [
        (STATUS_PENDING, 'Pendiente'),
        (STATUS_ACCEPTED, 'Aceptado'),
        (STATUS_REVOKED, 'Revocado'),
    ]

    subscription = models.OneToOneField(
        'core_app.Subscription',
        on_delete=models.PROTECT,
        related_name='guest_link',
    )
    guest = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='guest_subscriptions',
    )
    invited_email = models.EmailField(db_index=True)
    token = models.CharField(max_length=255, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS, default=STATUS_PENDING)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"GuestLink #{self.pk} — {self.invited_email} ({self.status})"

    @staticmethod
    def generate_token():
        return secrets.token_urlsafe(32)
