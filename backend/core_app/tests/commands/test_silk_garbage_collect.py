"""Tests for the silk_garbage_collect management command."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command


def _make_queryset_mock(count=0):
    qs = MagicMock()
    qs.count.return_value = count
    qs.delete.return_value = (count, {})
    return qs


@pytest.mark.django_db
def test_silk_not_installed_writes_error_to_stderr():
    """Writes an error to stderr and exits cleanly when silk is not installed."""
    err = StringIO()
    with patch.dict('sys.modules', {'silk': None, 'silk.models': None}):
        call_command('silk_garbage_collect', stderr=err)

    assert 'not installed or not enabled' in err.getvalue()


@pytest.mark.django_db
@patch('silk.models.Request')
def test_dry_run_shows_count_without_deleting(mock_request):
    """Shows record count and DRY RUN warning without performing any deletion."""
    mock_qs = _make_queryset_mock(count=42)
    mock_request.objects.filter.return_value = mock_qs

    out = StringIO()
    call_command('silk_garbage_collect', '--dry-run', stdout=out)

    output = out.getvalue()
    assert 'Requests to delete: 42' in output
    assert 'DRY RUN' in output
    mock_qs.delete.assert_not_called()


@pytest.mark.django_db
@patch('silk.models.Request')
def test_deletes_old_requests_and_reports_count(mock_request):
    """Deletes old silk records and reports the deleted count as a success message."""
    mock_qs = _make_queryset_mock(count=15)
    mock_request.objects.filter.return_value = mock_qs

    out = StringIO()
    call_command('silk_garbage_collect', stdout=out)

    mock_qs.delete.assert_called_once()
    assert 'Deleted 15 records' in out.getvalue()


@pytest.mark.django_db
@patch('core_app.management.commands.silk_garbage_collect.timezone')
@patch('silk.models.Request')
def test_custom_days_uses_correct_cutoff(mock_request, mock_tz):
    """Filters silk records using the cutoff computed from the --days argument."""
    mock_qs = _make_queryset_mock(count=5)
    mock_request.objects.filter.return_value = mock_qs

    freeze_at = datetime(2026, 1, 15, 12, 0, 0, tzinfo=dt_timezone.utc)
    mock_tz.now.return_value = freeze_at
    out = StringIO()
    call_command('silk_garbage_collect', '--days=30', stdout=out)

    expected_cutoff = freeze_at - timedelta(days=30)
    mock_request.objects.filter.assert_called_once_with(start_time__lt=expected_cutoff)
    assert 'Deleted 5 records' in out.getvalue()


@pytest.mark.django_db
@patch('silk.models.Request')
def test_no_old_records_reports_zero_without_error(mock_request):
    """Reports zero records when nothing matches the retention cutoff."""
    mock_qs = _make_queryset_mock(count=0)
    mock_request.objects.filter.return_value = mock_qs

    out = StringIO()
    call_command('silk_garbage_collect', stdout=out)

    output = out.getvalue()
    assert 'Requests to delete: 0' in output
    assert 'Deleted 0 records' in output
    mock_qs.delete.assert_called_once()
