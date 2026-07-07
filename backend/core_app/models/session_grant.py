from django.conf import settings
from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class SessionGrant(TimestampedModel):
    """Bookable sessions granted outside the plan, redeemed with credits.

    Deliberately NOT a Subscription — a user has a single subscription; bonus
    sessions are tracked here with their own 30-day expiry.
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='session_grants',
    )
    sessions_total = models.PositiveIntegerField()
    sessions_used = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)
    source_redemption = models.ForeignKey(
        'core_app.RedemptionRequest', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='session_grants',
    )

    class Meta:
        ordering = ('expires_at',)

    @property
    def sessions_remaining(self):
        return max(self.sessions_total - self.sessions_used, 0)

    def is_active(self, now=None):
        now = now or timezone.now()
        return self.sessions_remaining > 0 and now < self.expires_at

    def __str__(self):
        return f'{self.customer} — {self.sessions_remaining}/{self.sessions_total} (exp {self.expires_at:%Y-%m-%d})'
