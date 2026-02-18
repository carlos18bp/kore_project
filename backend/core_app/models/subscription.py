from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class Subscription(TimestampedModel):
    """Represents a customer's purchased package (program).

    Tracks how many sessions the customer has used out of the total purchased,
    the validity period, and the current status.  A single customer can have
    multiple subscriptions (one per purchased package).

    Attributes:
        customer: The user who purchased the package.
        package: The package (program) that was purchased.
        sessions_total: Total number of sessions included.
        sessions_used: Number of sessions already consumed.
        status: Current lifecycle state (active / expired / canceled).
        starts_at: When the subscription becomes valid.
        expires_at: When the subscription expires.
        payment_method_type: Wompi payment method used for the initial charge.
        is_recurring: Whether the subscription can be auto-renewed.
        expiry_email_sent_at: Timestamp when the expiry email reminder was sent.
        expiry_ui_sent_at: Timestamp when the expiry UI reminder was shown.
    """

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        EXPIRED = 'expired', 'Expired'
        CANCELED = 'canceled', 'Canceled'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='subscriptions',
    )
    package = models.ForeignKey(
        'core_app.Package',
        on_delete=models.PROTECT,
        related_name='subscriptions',
    )

    sessions_total = models.PositiveIntegerField()
    sessions_used = models.PositiveIntegerField(default=0)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    starts_at = models.DateTimeField()
    expires_at = models.DateTimeField()

    payment_source_id = models.CharField(
        max_length=255,
        blank=True,
        help_text='Wompi payment source ID for recurring charges.',
    )
    payment_method_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Wompi payment method type for the initial charge.',
    )
    is_recurring = models.BooleanField(
        default=True,
        help_text='Whether the subscription should be auto-renewed.',
    )
    wompi_transaction_id = models.CharField(
        max_length=255,
        blank=True,
        help_text='Wompi transaction ID for the initial payment.',
    )
    next_billing_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date of the next automatic recurring charge.',
    )
    expiry_email_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when the expiry email reminder was sent.',
    )
    expiry_ui_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when the expiry UI reminder was shown.',
    )

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return (
            f"Subscription #{self.pk} — {self.customer.email} "
            f"({self.package.title})"
        )

    @property
    def sessions_remaining(self):
        """Return the number of sessions still available.

        Returns:
            int: ``sessions_total - sessions_used``, floored at 0.
        """
        return max(self.sessions_total - self.sessions_used, 0)
