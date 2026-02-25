"""Huey tasks for recurring billing and subscription reminders.

Provides periodic tasks that:
- Charge recurring subscriptions due for billing.
- Email reminders for non-recurring subscriptions that are close to expiring.

Both tasks are scheduled to run daily at 08:00 (TIME_ZONE).
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone
from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from core_app.models import Notification, Payment, Subscription
from core_app.services.email_service import (
    send_payment_receipt,
    send_subscription_expiry_reminder,
)
from core_app.services.wompi_service import create_transaction, generate_reference

logger = logging.getLogger(__name__)


@db_periodic_task(crontab(minute=0, hour=8))
def process_recurring_billing():
    """Find active subscriptions due today and charge them.

    For each subscription whose next_billing_date <= today, is marked
    as recurring, and has a valid payment_source_id:
    1. Create a Wompi transaction using the saved payment source.
    2. Create a Payment record.
    3. Advance the next_billing_date by the package validity period.
    4. Reset session counters for the new billing cycle.
    5. Create a notification for the customer.

    Returns:
        dict: Summary with 'processed', 'succeeded', and 'failed' counts.
    """
    today = timezone.now().date()
    due_subscriptions = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        next_billing_date__lte=today,
        is_recurring=True,
    ).exclude(
        payment_source_id='',
    ).select_related('customer', 'package')

    processed = 0
    succeeded = 0
    failed = 0

    for sub in due_subscriptions:
        processed += 1
        try:
            _bill_subscription(sub)
            succeeded += 1
        except Exception:
            failed += 1
            logger.exception(
                'Failed to bill subscription %s for customer %s',
                sub.id,
                sub.customer.email,
            )

    summary = {'processed': processed, 'succeeded': succeeded, 'failed': failed}
    logger.info('Recurring billing completed: %s', summary)
    return summary


def _bill_subscription(sub):
    """Execute a single recurring billing charge for a subscription.

    Args:
        sub: Subscription instance with related customer and package.

    Raises:
        WompiError: If the Wompi transaction creation fails.
    """
    package = sub.package
    amount_in_cents = int(Decimal(str(package.price)) * 100)
    reference = generate_reference()

    txn_data = create_transaction(
        amount_in_cents=amount_in_cents,
        currency=package.currency,
        customer_email=sub.customer.email,
        reference=reference,
        payment_source_id=int(sub.payment_source_id),
        recurrent=True,
    )

    txn_status = txn_data.get('status', 'PENDING')

    with db_transaction.atomic():
        payment = Payment.objects.create(
            customer=sub.customer,
            subscription=sub,
            amount=package.price,
            currency=package.currency,
            provider=Payment.Provider.WOMPI,
            provider_reference=reference,
            status=(
                Payment.Status.CONFIRMED
                if txn_status == 'APPROVED'
                else Payment.Status.PENDING
            ),
        )

        if txn_status == 'APPROVED':
            sub.next_billing_date = sub.next_billing_date + timedelta(
                days=package.validity_days
            )
            sub.sessions_used = 0
            sub.sessions_total = package.sessions_count
            sub.expires_at = timezone.now() + timedelta(days=package.validity_days)
            sub.save(
                update_fields=[
                    'next_billing_date',
                    'sessions_used',
                    'sessions_total',
                    'expires_at',
                ]
            )

            Notification.objects.create(
                notification_type=Notification.Type.PAYMENT_CONFIRMED,
                sent_to=sub.customer.email,
                payment=payment,
                payload={
                    'subscription_id': sub.id,
                    'payment_id': payment.id,
                    'amount': str(package.price),
                    'currency': package.currency,
                    'reference': reference,
                },
            )

            send_payment_receipt(payment)

    logger.info(
        'Billed subscription %s: txn=%s status=%s',
        sub.id,
        txn_data.get('id'),
        txn_status,
    )


@db_periodic_task(crontab(minute=0, hour=8))
def send_expiring_subscription_reminders():
    """Send expiry reminders for non-recurring subscriptions.

    Finds active, non-recurring subscriptions that expire within the next
    7 days and have not yet received an email reminder, sends the reminder,
    and records the send timestamp.

    Returns:
        dict: Summary with 'processed' and 'sent' counts.
    """
    now = timezone.now()
    cutoff = now + timedelta(days=7)
    subscriptions = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        is_recurring=False,
        expiry_email_sent_at__isnull=True,
        expires_at__gte=now,
        expires_at__lte=cutoff,
    ).select_related('customer', 'package')

    processed = 0
    sent = 0

    for subscription in subscriptions:
        processed += 1
        notification = send_subscription_expiry_reminder(subscription)
        if notification and notification.status == Notification.Status.SENT:
            subscription.expiry_email_sent_at = timezone.now()
            subscription.save(update_fields=['expiry_email_sent_at', 'updated_at'])
            sent += 1

    summary = {'processed': processed, 'sent': sent}
    logger.info('Expiry reminders completed: %s', summary)
    return summary
