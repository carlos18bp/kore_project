from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel

CURRENT_TERMS_VERSION = 'v1.0'


class TermsAcceptance(TimestampedModel):
    """Records a user's explicit acceptance of terms and conditions.

    Captures IP address, user-agent, and timestamp as legally verifiable
    evidence of consent.  A new record is required whenever the terms
    version changes.

    Attributes:
        user: The authenticated user who accepted.
        terms_version: Version string of the accepted terms document.
        ip_address: Client IP at the moment of acceptance.
        user_agent: Full User-Agent header string.
        accepted_at: Explicit timestamp of acceptance.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='terms_acceptances',
    )
    terms_version = models.CharField(
        max_length=20,
        default=CURRENT_TERMS_VERSION,
        help_text='Version of the terms document that was accepted.',
    )
    ip_address = models.GenericIPAddressField(
        help_text='Client IP address at the time of acceptance.',
    )
    user_agent = models.TextField(
        blank=True,
        default='',
        help_text='Browser User-Agent string at the time of acceptance.',
    )
    accepted_at = models.DateTimeField(
        help_text='Exact timestamp when the user clicked accept.',
    )

    class Meta:
        ordering = ('-accepted_at',)
        unique_together = ('user', 'terms_version')

    def __str__(self):
        return (
            f"TermsAcceptance #{self.pk} — {self.user.email} "
            f"({self.terms_version})"
        )
