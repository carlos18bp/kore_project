"""ICS (iCalendar) file generator for booking events.

Produces RFC 5545-compliant VCALENDAR/VEVENT payloads that can be
attached to confirmation and reschedule emails so the recipient's
calendar app can import the session automatically.
"""

from email.utils import parseaddr
from datetime import datetime, timezone as dt_tz
from uuid import uuid4
import pytz

from django.conf import settings

# Timezone for display in ICS
BOGOTA_TZ = pytz.timezone('America/Bogota')


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

    customer_name = f'{customer.first_name} {customer.last_name}'.strip() or customer.email
    summary = 'Entrenamiento KÓRE'
    description = f'Sesión de entrenamiento con KÓRE para {customer_name}.'
    location = ''
    organizer_name, organizer_email = _resolve_default_organizer()

    if trainer:
        trainer_name = f'{trainer.user.first_name} {trainer.user.last_name}'.strip() or trainer.user.email
        summary = f'Entrenamiento KÓRE — {trainer_name}'
        description = (
            f'Sesión de entrenamiento con {trainer_name} '
            f'para {customer_name}.'
        )
        location = trainer.location or ''

    attendees = [(customer_name, customer.email)]
    if trainer and trainer.user.email:
        trainer_name = f'{trainer.user.first_name} {trainer.user.last_name}'.strip() or trainer.user.email
        attendees.append((trainer_name, trainer.user.email))

    attendee_lines = []
    seen_attendees = set()
    for attendee_name, attendee_email in attendees:
        normalized_email = attendee_email.strip().lower()
        if normalized_email in seen_attendees:
            continue
        seen_attendees.add(normalized_email)
        attendee_lines.append(f'ATTENDEE;CN={attendee_name};RSVP=TRUE:mailto:{attendee_email}')

    # Use UTC format for maximum compatibility with Yahoo/Apple Calendar
    dtstart_utc = _format_dt_utc(slot.starts_at)
    dtend_utc = _format_dt_utc(slot.ends_at)
    dtstamp = _format_dt_utc(datetime.now(dt_tz.utc))
    uid = f'{uuid4()}@korehealths.com'

    # Add human-readable time zone info to description
    bogota_start = slot.starts_at.astimezone(BOGOTA_TZ)
    bogota_end = slot.ends_at.astimezone(BOGOTA_TZ)
    time_info = (
        f'{bogota_start.strftime("%A %d de %B de %Y, %I:%M %p")} - '
        f'{bogota_end.strftime("%I:%M %p")} (hora de Colombia, America/Bogota / UTC-5)'
    )
    description_with_tz = f'{description}\n\n{time_info}'

    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//KÓRE//Booking//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        f'UID:{uid}',
        f'DTSTAMP:{dtstamp}',
        f'DTSTART:{dtstart_utc}',
        f'DTEND:{dtend_utc}',
        f'SUMMARY:{summary}',
        f'DESCRIPTION:{description_with_tz}',
        f'LOCATION:{location}',
        f'ORGANIZER;CN={organizer_name}:mailto:{organizer_email}',
        *attendee_lines,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
        'END:VCALENDAR',
    ]

    return '\r\n'.join(lines).encode('utf-8')


def _format_dt_utc(dt):
    """Format a datetime to iCalendar UTC format (``YYYYMMDDTHHMMSSZ``).

    Args:
        dt: A ``datetime`` instance (naive assumed UTC, or aware).

    Returns:
        str: Formatted datetime string in UTC.
    """
    if dt.tzinfo is not None and dt.tzinfo.utcoffset(dt) is not None:
        # Convert aware datetime to UTC
        utc_dt = dt.astimezone(dt_tz.utc)
    else:
        # Naive datetime assumed to be UTC
        utc_dt = dt.replace(tzinfo=dt_tz.utc)
    return utc_dt.strftime('%Y%m%dT%H%M%SZ')


def _format_dt_bogota(dt):
    """Format a datetime to iCalendar local format for Bogotá timezone.

    Converts UTC datetime to America/Bogota and formats as ``YYYYMMDDTHHMMSS``.

    Args:
        dt: A ``datetime`` instance (aware, typically UTC).

    Returns:
        str: Formatted datetime string in Bogotá local time.
    """
    if dt.tzinfo is not None:
        bogota_dt = dt.astimezone(BOGOTA_TZ)
    else:
        bogota_dt = BOGOTA_TZ.localize(dt)
    return bogota_dt.strftime('%Y%m%dT%H%M%S')


def _resolve_default_organizer():
    """Resolve organizer name/email from configured DEFAULT_FROM_EMAIL.

    Returns:
        tuple[str, str]: Organizer display name and organizer email.
    """
    parsed_name, parsed_email = parseaddr(getattr(settings, 'DEFAULT_FROM_EMAIL', ''))
    normalized_email = parsed_email.strip()
    organizer_name = parsed_name.strip() or 'KÓRE'
    organizer_email = normalized_email if '@' in normalized_email else 'noreply@korehealths.com'
    return organizer_name, organizer_email
