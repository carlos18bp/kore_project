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
from huey.contrib.djhuey import db_periodic_task, db_task

from core_app.models import Notification, Payment, Subscription, SubscriptionRenewal
from core_app.services.billing_calendar import bogota_today
from core_app.services.renewal_history_service import record_renewal
from core_app.services.email_service import (
    send_payment_receipt,
    send_subscription_expiry_reminder,
)
from core_app.services.slot_schedule import MAX_ROLLOVER_SESSIONS
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
    # Use Bogota local date so subscriptions are considered "due" only when
    # the calendar day has actually arrived for the customer (not UTC).
    today = bogota_today()
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
            if sub.billing_failed_at:
                sub.billing_failed_at = None
                sub.save(update_fields=['billing_failed_at', 'updated_at'])
        except Exception:
            failed += 1
            sub.billing_failed_at = timezone.now()
            sub.save(update_fields=['billing_failed_at', 'updated_at'])
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
            leftover = max(sub.sessions_total - sub.sessions_used, 0)
            rollover = min(leftover, MAX_ROLLOVER_SESSIONS)
            new_period_start = timezone.now()
            new_period_end = new_period_start + timedelta(days=package.validity_days)
            sub.next_billing_date = sub.next_billing_date + timedelta(
                days=package.validity_days
            )
            sub.sessions_total = package.sessions_count + rollover
            sub.sessions_used = 0
            sub.expires_at = new_period_end
            sub.save(
                update_fields=[
                    'next_billing_date',
                    'sessions_used',
                    'sessions_total',
                    'expires_at',
                ]
            )

            record_renewal(
                subscription=sub,
                kind=SubscriptionRenewal.Kind.AUTOMATIC,
                period_start=new_period_start,
                period_end=new_period_end,
                sessions_granted=sub.sessions_total,
                package=package,
                payment=payment,
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


@db_periodic_task(crontab(minute='*/15'))
def auto_complete_past_bookings():
    """Mark pending bookings as confirmed once their slot has ended.

    Runs every 15 minutes to catch sessions that just finished.

    Returns:
        dict: Summary with 'completed' count.
    """
    from core_app.models import Booking
    now = timezone.now()
    past_pending_bookings = Booking.objects.filter(
        status=Booking.Status.PENDING,
        ends_at__lte=now,
    )
    completed = past_pending_bookings.update(status=Booking.Status.CONFIRMED)
    if completed:
        logger.info('Auto-completed %d past pending bookings', completed)
    return {'completed': completed}


@db_periodic_task(crontab(minute=0, hour=9, day_of_week='1'))
def send_nutrition_reminders():
    """Send weekly nutrition habit reminders to active clients.

    Runs Monday 9am. Targets customers with active subscriptions whose
    last NutritionHabit entry is older than 7 days (or never submitted).

    Returns:
        dict: Summary with 'processed' and 'sent' counts.
    """
    from core_app.models.nutrition_habit import NutritionHabit
    from core_app.services.email_service import send_template_email

    now = timezone.now()
    cutoff = now - timedelta(days=7)

    active_customers = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
    ).values_list('customer_id', flat=True).distinct()

    from core_app.models import User
    customers = User.objects.filter(
        id__in=active_customers,
        role=User.Role.CUSTOMER,
    )

    processed = 0
    sent = 0

    for customer in customers:
        latest = NutritionHabit.objects.filter(
            customer=customer,
        ).order_by('-created_at').first()

        if latest and latest.created_at > cutoff:
            continue

        processed += 1
        customer_name = f'{customer.first_name} {customer.last_name}'.strip() or customer.email

        success = send_template_email(
            template_name='nutrition_reminder',
            subject='Es hora de registrar tus hábitos alimentarios — KÓRE',
            to_emails=[customer.email],
            context={'customer_name': customer_name},
        )

        Notification.objects.create(
            notification_type=Notification.Type.NUTRITION_REMINDER,
            status=Notification.Status.SENT if success else Notification.Status.FAILED,
            sent_to=customer.email,
            payload={'customer_id': customer.id},
        )

        if success:
            sent += 1

    summary = {'processed': processed, 'sent': sent}
    logger.info('Nutrition reminders completed: %s', summary)
    return summary


@db_periodic_task(crontab(minute=0, hour=9, day='1'))
def send_parq_reminders():
    """Send quarterly PAR-Q reminders to active clients.

    Runs on the 1st of each month at 9am. Targets customers with active
    subscriptions whose last ParqAssessment is older than 90 days (or never).

    Returns:
        dict: Summary with 'processed' and 'sent' counts.
    """
    from core_app.models.parq_assessment import ParqAssessment
    from core_app.services.email_service import send_template_email

    now = timezone.now()
    cutoff = now - timedelta(days=90)

    active_customers = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
    ).values_list('customer_id', flat=True).distinct()

    from core_app.models import User
    customers = User.objects.filter(
        id__in=active_customers,
        role=User.Role.CUSTOMER,
    )

    processed = 0
    sent = 0

    for customer in customers:
        latest = ParqAssessment.objects.filter(
            customer=customer,
        ).order_by('-created_at').first()

        if latest and latest.created_at > cutoff:
            continue

        processed += 1
        customer_name = f'{customer.first_name} {customer.last_name}'.strip() or customer.email

        success = send_template_email(
            template_name='parq_reminder',
            subject='Actualiza tu cuestionario PAR-Q — KÓRE',
            to_emails=[customer.email],
            context={'customer_name': customer_name},
        )

        Notification.objects.create(
            notification_type=Notification.Type.PARQ_REMINDER,
            status=Notification.Status.SENT if success else Notification.Status.FAILED,
            sent_to=customer.email,
            payload={'customer_id': customer.id},
        )

        if success:
            sent += 1

    summary = {'processed': processed, 'sent': sent}
    logger.info('PAR-Q reminders completed: %s', summary)
    return summary



@db_periodic_task(crontab(minute=55, hour=23))
def close_daily_logs():
    """At 23:55 daily: close all open DailyLogs and mark unchecked exercises as not_done.

    Also creates and immediately closes DailyLogs for customers who never opened the app
    today, so their history is complete even if they were absent.

    After close the log is immutable — the customer cannot update exercise statuses.
    """
    from core_app.models.monthly_program import DailyLog, ExerciseLog, MonthlyProgram, ProgramDay

    today = timezone.localdate()
    now = timezone.now()

    # Phase 1: close existing open logs
    open_logs = list(DailyLog.objects.filter(is_closed=False, date=today))
    for log in open_logs:
        log.is_closed = True
        log.closed_at = now
        log.save(update_fields=['is_closed', 'closed_at'])

    # Phase 2: create + close logs for customers who never opened the app today
    existing_customer_ids = DailyLog.objects.filter(date=today).values_list('customer_id', flat=True)
    program_days_without_log = (
        ProgramDay.objects.filter(
            date=today,
            program__status=MonthlyProgram.Status.PUBLISHED,
            program__is_paused=False,
        )
        .exclude(program__customer_id__in=existing_customer_ids)
        .select_related('program')
        .prefetch_related('exercises')
    )

    created = 0
    for program_day in program_days_without_log:
        log = DailyLog.objects.create(
            customer=program_day.program.customer,
            program=program_day.program,
            date=today,
            is_closed=True,
            closed_at=now,
        )
        # Only create logs for exercises with a youtube_url — exercises without a
        # reference video are skipped from the daily flow so they don't penalize
        # adherence (matches TodayProgramView behaviour).
        ExerciseLog.objects.bulk_create([
            ExerciseLog(
                daily_log=log,
                program_exercise=pe,
                status=ExerciseLog.Status.NOT_DONE,
            )
            for pe in program_day.exercises.exclude(exercise__youtube_url='')
        ])
        created += 1

    total_closed = len(open_logs) + created
    logger.info('close_daily_logs: closed %d existing + created %d absent logs', len(open_logs), created)

    # Phase 3: close open NutritionDailyLogs
    from core_app.models.nutrition_daily_log import NutritionDailyLog, MealEntry
    from core_app.services.meal_suggestion_service import get_daily_suggestions

    open_nutrition = list(NutritionDailyLog.objects.filter(is_closed=False, date=today))
    for nlog in open_nutrition:
        nlog.is_closed = True
        nlog.closed_at = now
        nlog.save(update_fields=['is_closed', 'closed_at'])

    # Phase 4: create + close NutritionDailyLogs for absent customers with active programs
    existing_nutrition_ids = NutritionDailyLog.objects.filter(date=today).values_list('customer_id', flat=True)
    customers_without_nutrition = (
        MonthlyProgram.objects
        .filter(
            status=MonthlyProgram.Status.PUBLISHED,
            start_date__lte=today,
            end_date__gte=today,
            is_paused=False,
        )
        .exclude(customer_id__in=existing_nutrition_ids)
        .select_related('customer')
        .values_list('customer', flat=True)
        .distinct()
    )

    nutrition_created = 0
    meal_blocks = [b for b, _ in MealEntry.MealBlock.choices]
    from core_app.models import User
    for customer_id in customers_without_nutrition:
        try:
            customer = User.objects.get(pk=customer_id)
        except User.DoesNotExist:
            continue
        suggestions = get_daily_suggestions(customer, today)
        nlog = NutritionDailyLog.objects.create(
            customer=customer,
            date=today,
            is_closed=True,
            closed_at=now,
        )
        MealEntry.objects.bulk_create([
            MealEntry(
                daily_log=nlog,
                meal_block=block,
                suggestion=suggestions.get(block),
                status=MealEntry.Status.NOT_DONE,
            )
            for block in meal_blocks
        ])
        nutrition_created += 1

    logger.info(
        'close_daily_logs: nutrition — closed %d existing + created %d absent',
        len(open_nutrition), nutrition_created,
    )
    return {
        'exercise_closed': len(open_logs),
        'exercise_created_absent': created,
        'nutrition_closed': len(open_nutrition),
        'nutrition_created_absent': nutrition_created,
    }


@db_periodic_task(crontab(minute=0, hour=0))
def complete_finished_programs():
    """Mark published MonthlyPrograms whose end_date has passed as completed.

    Runs daily at midnight (TIME_ZONE). Programs with end_date < today and
    status=published are transitioned to status=completed.
    """
    from django.utils.timezone import localdate
    from core_app.models.monthly_program import MonthlyProgram

    today = localdate()
    finished = MonthlyProgram.objects.filter(
        status=MonthlyProgram.Status.PUBLISHED,
        end_date__lt=today,
    )
    count = finished.update(status=MonthlyProgram.Status.COMPLETED)
    logger.info('complete_finished_programs: marked %d programs as completed', count)
    return {'completed': count}


@db_periodic_task(crontab(minute=0, hour=6))
def compute_daily_alerts():
    """At 06:00 daily: compute behavioral and clinical risk scores for all active clients.

    Runs after close_daily_logs (23:55) so all DailyLog records for the previous
    day are complete and reliable.
    """
    from django.utils.timezone import localdate
    from core_app.models.monthly_program import MonthlyProgram
    from core_app.services.risk_score_service import recompute_risk_score

    today = localdate()
    processed = 0
    errors = 0

    active_programs = (
        MonthlyProgram.objects
        .filter(status=MonthlyProgram.Status.PUBLISHED)
        .select_related('customer', 'trainer')
        .distinct()
    )

    for program in active_programs:
        if program.trainer is None:
            continue
        try:
            recompute_risk_score(program.customer, today=today)
            processed += 1
        except Exception as exc:
            logger.exception(
                'compute_daily_alerts: error processing customer %s: %s',
                program.customer.pk, exc,
            )
            errors += 1

    logger.info('compute_daily_alerts: processed=%d errors=%d', processed, errors)
    return {'processed': processed, 'errors': errors}


@db_task()
def recompute_risk_score_task(customer_id):
    """Reactively recompute one customer's risk score off the request path.

    Enqueued (via transaction.on_commit) by the post_save signal handlers on the
    evaluation models. The behavioral/clinical signal engines run several ORM
    queries over the customer's program history; running them inline in the
    request blocked the HTTP response and made evaluation saves appear to hang.
    Doing it in the background lets the trainer's save return immediately while
    the stored ClientRiskScore is refreshed moments later.

    Returns:
        bool: True if a score was written, False if skipped (no active program).
    """
    from core_app.models import User
    from core_app.services.risk_score_service import recompute_risk_score

    try:
        customer = User.objects.get(pk=customer_id)
    except User.DoesNotExist:
        return False
    return recompute_risk_score(customer)
