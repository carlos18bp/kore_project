from django.db import models

from core_app.models.base import TimestampedModel


class SubscriptionRenewal(TimestampedModel):
    """Append-only history of a subscription's billing periods.

    One row per period the membership has gone through: the initial purchase,
    each manual or automatic renewal, and each plan change. Nothing in the
    app reads this table except the renewal-history timeline endpoint — it is
    purely a record so the UI can show "renewed from X to Y" without inferring
    it from scattered Subscription rows or Payment metadata.
    """

    class Kind(models.TextChoices):
        INITIAL = 'initial', 'Initial purchase'
        MANUAL = 'manual', 'Manual renewal'
        AUTOMATIC = 'automatic', 'Automatic renewal'
        PLAN_CHANGE = 'plan_change', 'Plan change'

    subscription = models.ForeignKey(
        'core_app.Subscription',
        on_delete=models.CASCADE,
        related_name='renewals',
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    sessions_granted = models.PositiveIntegerField()
    payment = models.ForeignKey(
        'core_app.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='renewal_records',
    )
    package = models.ForeignKey(
        'core_app.Package',
        on_delete=models.PROTECT,
        related_name='renewal_records',
    )
    actor_email = models.CharField(max_length=255, blank=True, default='')
    note = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ('-period_start',)

    def __str__(self):
        return f'Renewal #{self.pk} — sub {self.subscription_id} ({self.kind})'
