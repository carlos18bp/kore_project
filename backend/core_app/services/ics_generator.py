"""ICS (iCalendar) file generator for booking events.

Produces RFC 5545-compliant VCALENDAR/VEVENT payloads that can be
attached to confirmation and reschedule emails so the recipient's
calendar app can import the session automatically.
"""

from datetime import datetime, timezone as dt_tz
from uuid import uuid4


def generate_ics(booking):
    """Generate an iCalendar (.ics) byte payload for a booking.

    The resulting bytes represent a VCALENDAR with a single VEVENT
    containing the session's start/end times, location, summary, and
    organizer.

    Args:
        booking: A ``Booking`` instance with related ``slot`` and
            optionally ``trainer`` (with nested ``user``) populated.

    Returns:
        bytes: UTF-8 encoded iCalendar content ready to be used as an
        email attachment.
    """
    slot = booking.slot
    trainer = booking.trainer
    customer = booking.customer

    summary = 'Entrenamiento KÓRE'
    description = f'Sesión de entrenamiento con KÓRE para {customer.first_name} {customer.last_name}.'
    location = ''
    organizer_name = 'KÓRE'
    organizer_email = 'noreply@korehealths.com'

    if trainer:
        trainer_name = f'{trainer.user.first_name} {trainer.user.last_name}'
        summary = f'Entrenamiento KÓRE — {trainer_name}'
        description = (
            f'Sesión de entrenamiento con {trainer_name} '
            f'para {customer.first_name} {customer.last_name}.'
        )
        location = trainer.location or ''
        organizer_name = trainer_name
        organizer_email = trainer.user.email

    dtstart = _format_dt(slot.starts_at)
    dtend = _format_dt(slot.ends_at)
    dtstamp = _format_dt(datetime.now(dt_tz.utc))
    uid = f'{uuid4()}@korehealths.com'

    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//KÓRE//Booking//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        f'UID:{uid}',
        f'DTSTAMP:{dtstamp}',
        f'DTSTART:{dtstart}',
        f'DTEND:{dtend}',
        f'SUMMARY:{summary}',
        f'DESCRIPTION:{description}',
        f'LOCATION:{location}',
        f'ORGANIZER;CN={organizer_name}:mailto:{organizer_email}',
        f'ATTENDEE;CN={customer.first_name} {customer.last_name}:mailto:{customer.email}',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
    ]

    return '\r\n'.join(lines).encode('utf-8')


def _format_dt(dt):
    """Format a datetime to iCalendar UTC format (``YYYYMMDDTHHMMSSZ``).

    Args:
        dt: A ``datetime`` instance (naive assumed UTC, or aware).

    Returns:
        str: Formatted datetime string.
    """
    return dt.strftime('%Y%m%dT%H%M%SZ')
