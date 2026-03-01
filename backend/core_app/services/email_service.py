"""Email service for the KÓRE scheduling system.

Follows the gym_project pattern: renders a content template, injects it into
a base layout via ``{{content_html|safe}}``, and sends the result as an HTML
email with optional attachments (e.g. .ics calendar invites).
"""

import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string

from core_app.models import Notification
from core_app.services.ics_generator import generate_ics

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Generic sender
# ------------------------------------------------------------------

def send_template_email(template_name, subject, to_emails, context=None, attachments=None):
    """Render an HTML email from templates and send it.

    Loads ``emails/<template_name>/<template_name>.html`` as the content
    template, renders it with *context*, then injects the result into the
    base layout at ``emails/layout/layout.html``.

    Args:
        template_name: Name used to locate the content template
            (``emails/<name>/<name>.html``).
        subject: Email subject line.
        to_emails: List of recipient email addresses.
        context: Optional dict passed to the template engine.
        attachments: Optional list of ``(filename, content_bytes, mime_type)``
            tuples to attach to the email.

    Returns:
        bool: ``True`` if the email was sent successfully, ``False`` otherwise.
    """
    context = context or {}

    content_html = render_to_string(
        f'emails/{template_name}/{template_name}.html',
        context,
    )

    full_html = render_to_string(
        'emails/layout/layout.html',
        {'content_html': content_html},
    )

    email = EmailMessage(
        subject=subject,
        body=full_html,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to_emails,
    )
    email.content_subtype = 'html'

    if attachments:
        for filename, content, mime_type in attachments:
            email.attach(filename, content, mime_type)

    try:
        email.send(fail_silently=False)
        return True
    except Exception:
        logger.exception('Failed to send email "%s" to %s', subject, to_emails)
        return False


# ------------------------------------------------------------------
# Booking-specific senders
# ------------------------------------------------------------------

def send_booking_confirmation(booking):
    """Send a booking confirmation email with an .ics attachment.

    Creates a ``Notification`` record to track delivery status.

    Args:
        booking: A ``Booking`` instance with related slot, trainer, and
            customer pre-loaded.

    Returns:
        Notification: The created notification instance.
    """
    ics_bytes = generate_ics(booking)
    context = _build_booking_context(booking)
    recipient_emails = _build_booking_confirmation_recipients(booking)

    success = send_template_email(
        template_name='booking_confirmation',
        subject='Tu sesión ha sido agendada — KÓRE',
        to_emails=recipient_emails,
        context=context,
        attachments=[('session.ics', ics_bytes, 'text/calendar')],
    )

    return _create_notification(
        booking=booking,
        notification_type=Notification.Type.BOOKING_CONFIRMED,
        success=success,
    )


def send_booking_cancellation(booking):
    """Send a booking cancellation email.

    Args:
        booking: The canceled ``Booking`` instance.

    Returns:
        Notification: The created notification instance.
    """
    context = _build_booking_context(booking)

    success = send_template_email(
        template_name='booking_cancellation',
        subject='Tu sesión ha sido cancelada — KÓRE',
        to_emails=[booking.customer.email],
        context=context,
    )

    return _create_notification(
        booking=booking,
        notification_type=Notification.Type.BOOKING_CANCELED,
        success=success,
    )


def send_booking_reschedule(old_booking, new_booking):
    """Send a reschedule email with an .ics for the new session.

    Args:
        old_booking: The original (now canceled) ``Booking`` instance.
        new_booking: The newly created ``Booking`` instance.

    Returns:
        Notification: The created notification instance tied to *new_booking*.
    """
    ics_bytes = generate_ics(new_booking)
    context = _build_booking_context(new_booking)
    context['old_slot_start'] = old_booking.slot.starts_at
    context['old_slot_end'] = old_booking.slot.ends_at

    success = send_template_email(
        template_name='booking_reschedule',
        subject='Tu sesión ha sido reprogramada — KÓRE',
        to_emails=[new_booking.customer.email],
        context=context,
        attachments=[('session.ics', ics_bytes, 'text/calendar')],
    )

    return _create_notification(
        booking=new_booking,
        notification_type=Notification.Type.BOOKING_RESCHEDULED,
        success=success,
    )


# ------------------------------------------------------------------
# Payment receipt sender
# ------------------------------------------------------------------

def send_payment_receipt(payment):
    """Send a payment receipt email.

    Creates a ``Notification`` record of type RECEIPT_EMAIL to track delivery.

    Args:
        payment: A ``Payment`` instance with related subscription and customer.

    Returns:
        Notification: The created notification instance, or None if payment
            has no customer or subscription.
    """
    if not payment.customer:
        logger.warning('Cannot send receipt: payment %s has no customer', payment.pk)
        return None

    subscription = payment.subscription
    package = subscription.package if subscription else None

    customer = payment.customer
    customer_name = f'{customer.first_name} {customer.last_name}'.strip() or customer.email

    context = {
        'customer_name': customer_name,
        'customer_email': customer.email,
        'reference': payment.provider_reference or f'PAY-{payment.pk}',
        'package_title': package.title if package else 'Suscripción KÓRE',
        'amount': f'{int(payment.amount):,}'.replace(',', '.'),
        'currency': payment.currency,
        'sessions_count': package.sessions_count if package else '-',
        'validity_days': package.validity_days if package else '-',
        'payment_date': payment.created_at,
        'payment_id': payment.pk,
    }

    success = send_template_email(
        template_name='payment_receipt',
        subject='Comprobante de pago — KÓRE',
        to_emails=[customer.email],
        context=context,
    )

    return _create_payment_notification(
        payment=payment,
        notification_type=Notification.Type.RECEIPT_EMAIL,
        success=success,
    )


def send_subscription_expiry_reminder(subscription):
    """Send a subscription expiry reminder email.

    Creates a ``Notification`` record of type SUBSCRIPTION_EXPIRY_REMINDER to
    track delivery status.

    Args:
        subscription: Subscription instance that is nearing expiry.

    Returns:
        Notification: The created notification instance, or None if the
            subscription has no customer.
    """
    customer = subscription.customer
    if not customer:
        logger.warning('Cannot send expiry reminder: subscription %s has no customer', subscription.pk)
        return None

    package = subscription.package
    customer_name = f'{customer.first_name} {customer.last_name}'.strip() or customer.email

    context = {
        'customer_name': customer_name,
        'customer_email': customer.email,
        'package_title': package.title if package else 'Suscripción KÓRE',
        'expires_at': subscription.expires_at,
        'validity_days': package.validity_days if package else '-',
    }

    success = send_template_email(
        template_name='subscription_expiry_reminder',
        subject='Tu suscripción está por vencer — KÓRE',
        to_emails=[customer.email],
        context=context,
    )

    return Notification.objects.create(
        notification_type=Notification.Type.SUBSCRIPTION_EXPIRY_REMINDER,
        status=Notification.Status.SENT if success else Notification.Status.FAILED,
        sent_to=customer.email,
        payload={
            'subscription_id': subscription.pk,
            'package_id': package.pk if package else None,
            'expires_at': subscription.expires_at.isoformat() if subscription.expires_at else None,
        },
    )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _build_booking_context(booking):
    """Build the template context dict from a booking instance.

    Args:
        booking: A ``Booking`` instance with related objects loaded.

    Returns:
        dict: Context variables for the email templates.
    """
    trainer = booking.trainer
    trainer_name = ''
    location = ''
    if trainer:
        trainer_name = f'{trainer.user.first_name} {trainer.user.last_name}'
        location = trainer.location or ''

    return {
        'customer_name': f'{booking.customer.first_name} {booking.customer.last_name}',
        'customer_email': booking.customer.email,
        'trainer_name': trainer_name,
        'location': location,
        'package_title': booking.package.title if booking.package else '',
        'slot_start': booking.slot.starts_at,
        'slot_end': booking.slot.ends_at,
        'booking_id': booking.pk,
    }


def _build_booking_confirmation_recipients(booking):
    """Return deduplicated recipient emails for booking confirmation.

    Includes the customer and, when available, the trainer user email.

    Args:
        booking: Booking instance.

    Returns:
        list[str]: Recipient emails preserving first-seen order.
    """
    recipients = [booking.customer.email]

    trainer = booking.trainer
    trainer_email = trainer.user.email if trainer and trainer.user else ''
    if trainer_email:
        recipients.append(trainer_email)

    deduplicated = []
    seen = set()
    for email in recipients:
        normalized = email.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduplicated.append(email)

    return deduplicated


def _create_notification(booking, notification_type, success):
    """Create a Notification record for a sent (or failed) email.

    Args:
        booking: The related ``Booking`` instance.
        notification_type: One of ``Notification.Type`` choices.
        success: Whether the email was delivered successfully.

    Returns:
        Notification: The persisted notification instance.
    """
    return Notification.objects.create(
        booking=booking,
        notification_type=notification_type,
        status=Notification.Status.SENT if success else Notification.Status.FAILED,
        sent_to=booking.customer.email,
    )


def _create_payment_notification(payment, notification_type, success):
    """Create a Notification record for a payment-related email.

    Args:
        payment: The related ``Payment`` instance.
        notification_type: One of ``Notification.Type`` choices.
        success: Whether the email was delivered successfully.

    Returns:
        Notification: The persisted notification instance.
    """
    return Notification.objects.create(
        payment=payment,
        notification_type=notification_type,
        status=Notification.Status.SENT if success else Notification.Status.FAILED,
        sent_to=payment.customer.email,
    )
