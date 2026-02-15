"""PaymentIntent model for tracking pending Wompi payment attempts.

Stores the state of a payment attempt before it is confirmed by a Wompi
webhook event.  Once the webhook arrives with APPROVED status, the
corresponding Payment and Subscription records are created.
"""

from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class PaymentIntent(TimestampedModel):
    """Represents a pending payment attempt via Wompi tokenization.

    Created when the user initiates a purchase from the checkout page.
    The backend tokenizes the card, creates a payment source and a Wompi
    transaction, then stores the intent here.  The webhook handler later
    resolves the intent into a Payment + Subscription on success.

    Attributes:
        customer: The user who initiated the purchase.
        package: The package being purchased.
        reference: Unique Wompi transaction reference.
        wompi_transaction_id: Transaction ID returned by Wompi.
        payment_source_id: Reusable payment source ID for recurring charges.
        status: Current resolution state of the intent.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        FAILED = 'failed', 'Failed'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='payment_intents',
    )
    package = models.ForeignKey(
        'core_app.Package',
        on_delete=models.PROTECT,
        related_name='payment_intents',
    )

    reference = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text='Unique Wompi payment reference.',
    )
    wompi_transaction_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text='Wompi transaction ID returned on creation.',
    )
    payment_source_id = models.CharField(
        max_length=255,
        blank=True,
        help_text='Wompi payment source ID for recurring charges.',
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Amount in the package currency (not cents).',
    )
    currency = models.CharField(max_length=10, default='COP')

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return (
            f"PaymentIntent #{self.pk} — {self.reference} "
            f"({self.status})"
        )
