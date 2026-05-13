"""Date helpers for subscription billing in the Colombia timezone.

The billing logic uses ``America/Bogota`` (COT, UTC-5, no DST) for any
calendar-day decision (next_billing_date, "is this subscription due today").
Without this, a customer who pays at 11:00 PM COT — which is 4:00 AM UTC the
next day — would see their renewal scheduled "a day early" and the daily
billing task would pick them up before their actual local date arrives.

Use ``bogota_today()`` whenever you need a calendar date for billing.
Continue to use ``django.utils.timezone.now()`` for stored timestamps:
those are saved in UTC and compared correctly.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

BOGOTA_TZ = ZoneInfo('America/Bogota')


def bogota_now() -> datetime:
    """Return the current datetime localized to America/Bogota."""
    return timezone.now().astimezone(BOGOTA_TZ)


def bogota_today() -> date:
    """Return today's calendar date in America/Bogota."""
    return bogota_now().date()
