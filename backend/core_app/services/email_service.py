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

    success = send_template_email(
        template_name='booking_confirmation',
        subject='Tu sesión ha sido agendada — KÓRE',
        to_emails=[booking.customer.email],
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
