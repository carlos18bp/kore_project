"""Apply a subscription's monthly renewal after an approved recurring charge.

Shared by the recurring billing task (synchronous ``APPROVED``) and the Wompi
webhook (asynchronous ``PENDING`` -> ``APPROVED`` reconciliation) so both paths
advance the billing cycle identically and exactly once.
"""

import logging
from datetime import timedelta

from django.utils import timezone

from core_app.models import Notification, SubscriptionRenewal
from core_app.services.email_service import send_payment_receipt
from core_app.services.renewal_history_service import record_renewal
from core_app.services.slot_schedule import MAX_ROLLOVER_SESSIONS

logger = logging.getLogger(__name__)


def apply_recurring_renewal(subscription, payment):
    """Advance a subscription one billing cycle for an approved recurring charge.

    Applies any scheduled plan change (``pending_package``), rolls over remaining
    sessions (capped at ``MAX_ROLLOVER_SESSIONS``), extends the period, advances
    ``next_billing_date``, records the renewal plus a ``PAYMENT_CONFIRMED``
    notification, and sends the receipt.

    Idempotent: a no-op when a ``SubscriptionRenewal`` already references this
    payment, so the synchronous task path and a later (or duplicated) webhook
    cannot double-apply the same charge.

    Args:
        subscription: The Subscription being renewed.
        payment: The CONFIRMED recurring Payment that funded this cycle.
    """
    if SubscriptionRenewal.objects.filter(payment=payment).exists():
        return

    # A scheduled plan change (downgrade / lateral) takes effect on renewal.
    package = subscription.pending_package or subscription.package
    leftover = max(subscription.sessions_total - subscription.sessions_used, 0)
    rollover = min(leftover, MAX_ROLLOVER_SESSIONS)
    new_period_start = timezone.now()
    new_period_end = new_period_start + timedelta(days=package.validity_days)

    base_billing = subscription.next_billing_date or new_period_start.date()
    subscription.next_billing_date = base_billing + timedelta(days=package.validity_days)
    subscription.package = package
    subscription.pending_package = None
    subscription.sessions_total = package.sessions_count + rollover
    subscription.sessions_used = 0
    subscription.expires_at = new_period_end
    subscription.save(update_fields=[
        'next_billing_date',
        'package',
        'pending_package',
        'sessions_total',
        'sessions_used',
        'expires_at',
        'updated_at',
    ])

    record_renewal(
        subscription=subscription,
        kind=SubscriptionRenewal.Kind.AUTOMATIC,
        period_start=new_period_start,
        period_end=new_period_end,
        sessions_granted=subscription.sessions_total,
        package=package,
        payment=payment,
    )

    Notification.objects.create(
        notification_type=Notification.Type.PAYMENT_CONFIRMED,
        sent_to=subscription.customer.email,
        payment=payment,
        payload={
            'subscription_id': subscription.id,
            'payment_id': payment.id,
            'amount': str(payment.amount),
            'currency': package.currency,
            'reference': payment.provider_reference,
        },
    )

    send_payment_receipt(payment)
    logger.info(
        'Applied recurring renewal for subscription %s (payment %s, package %s)',
        subscription.id, payment.id, package.id,
    )
