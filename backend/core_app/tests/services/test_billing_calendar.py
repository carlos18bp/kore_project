"""Tests for the Bogota timezone billing date helpers."""

from datetime import date, datetime, timezone as dt_timezone
from unittest.mock import patch

from core_app.services.billing_calendar import BOGOTA_TZ, bogota_now, bogota_today


def _fake_utc(year, month, day, hour, minute):
    return datetime(year, month, day, hour, minute, tzinfo=dt_timezone.utc)


class TestBogotaCalendar:
    """The helper must return Colombian (UTC-5) wall-clock dates."""

    @patch('core_app.services.billing_calendar.timezone.now')
    def test_bogota_now_converts_to_bogota_timezone(self, mock_now):
        """An instant late at night UTC is still the same day in Bogota."""
        mock_now.return_value = _fake_utc(2026, 5, 13, 4, 30)  # 04:30 UTC = 23:30 COT prev day
        result = bogota_now()
        assert result.tzinfo == BOGOTA_TZ
        assert result.year == 2026
        assert result.month == 5
        assert result.day == 12  # still May 12 in Bogota
        assert result.hour == 23
        assert result.minute == 30

    @patch('core_app.services.billing_calendar.timezone.now')
    def test_bogota_today_is_local_date_not_utc_date(self, mock_now):
        """A timestamp that is "tomorrow" in UTC stays "today" in Bogota."""
        # 02:00 UTC on May 14 is 21:00 COT on May 13.
        mock_now.return_value = _fake_utc(2026, 5, 14, 2, 0)
        assert bogota_today() == date(2026, 5, 13)

    @patch('core_app.services.billing_calendar.timezone.now')
    def test_bogota_today_matches_utc_during_daytime(self, mock_now):
        """During Bogota daytime hours the date matches UTC."""
        mock_now.return_value = _fake_utc(2026, 5, 13, 15, 0)  # 10:00 COT
        assert bogota_today() == date(2026, 5, 13)
