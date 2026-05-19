"""WompiEvent model for webhook idempotency.

Wompi retransmits webhook events on a backoff schedule. Without an
idempotency guard, processing the same ``transaction.updated`` event
twice (or worse, a late DECLINED that follows an APPROVED) would corrupt
subscription state — e.g. expiring an active subscription on a stale
DECLINED retransmission.

A row is created at the very start of webhook processing for each unique
``transaction_id``. The unique constraint lets us short-circuit any
subsequent webhook for the same transaction at the database layer.
"""

from django.db import models

from core_app.models.base import TimestampedModel


class WompiEvent(TimestampedModel):
    """A single Wompi webhook event we have already processed."""

    transaction_id = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text='Wompi transaction.id from the webhook payload.',
    )
    status = models.CharField(
        max_length=20,
        help_text='Terminal status observed (APPROVED/DECLINED/VOIDED/ERROR).',
    )
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-processed_at',)

    def __str__(self):
        return f'WompiEvent[{self.transaction_id}]={self.status}'
