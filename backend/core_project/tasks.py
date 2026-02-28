"""Operational periodic tasks for core_project.

Infrastructure tasks scheduled via Huey:
- Automated database and media backups (every 20 days).
- Silk profiling data garbage collection (daily).
- Weekly slow-query and N+1 detection report.
- Monthly cleanup of old Silk report files (>6 months).

Business-domain tasks live in ``core_app.tasks``.
"""

import logging
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from huey import crontab
from huey.contrib.djhuey import db_periodic_task

logger = logging.getLogger('backups')


# ---------------------------------------------------------------------------
# Backup task — runs on days 1 and 21 of each month at 03:00 UTC
# ---------------------------------------------------------------------------
@db_periodic_task(crontab(day='1,21', hour='3', minute='0'))
def scheduled_backup():
    """Automated backup of database and media files.

    Storage: configured via ``BACKUP_STORAGE_PATH`` env var.
    Retention: ~90 days (5 backups at 20-day intervals).
    """
    from django.core.management import call_command

    timestamp = timezone.now().strftime('%Y-%m-%d_%H%M%S')

    logger.info('=== Starting scheduled backup %s ===', timestamp)

    try:
        output = StringIO()
        logger.info('Running database backup...')
        call_command('dbbackup', stdout=output)
        logger.info(output.getvalue())

        output = StringIO()
        logger.info('Running media backup...')
        call_command('mediabackup', stdout=output)
        logger.info(output.getvalue())

        output = StringIO()
        logger.info('Cleaning old backups...')
        call_command('dbbackup', '--clean', stdout=output)
        call_command('mediabackup', '--clean', stdout=output)
        logger.info(output.getvalue())

        logger.info('=== Backup completed successfully ===')
        return True

    except Exception:
        logger.exception('Backup failed')
        raise


# ---------------------------------------------------------------------------
# Silk garbage collection — daily at 04:00 UTC
# ---------------------------------------------------------------------------
@db_periodic_task(crontab(hour='4', minute='0'))
def silk_garbage_collection():
    """Daily cleanup of Silk profiling data older than 7 days.

    Only runs when Silk is enabled (``ENABLE_SILK=true``).
    """
    if not getattr(settings, 'ENABLE_SILK', False):
        return

    from django.core.management import call_command

    logger_silk = logging.getLogger('silk_monitor')
    logger_silk.info('Running Silk garbage collection...')
    output = StringIO()
    call_command('silk_garbage_collect', '--days=7', stdout=output)
    logger_silk.info(output.getvalue())


# ---------------------------------------------------------------------------
# Weekly slow-query report — Mondays at 08:00 UTC
# ---------------------------------------------------------------------------
@db_periodic_task(crontab(day_of_week='1', hour='8', minute='0'))
def weekly_slow_queries_report():
    """Weekly report of slow queries and potential N+1 patterns.

    Output is written to ``backend/logs/silk-reports/silk-report-YYYY-MM-DD.log``.
    Only runs when Silk is enabled (``ENABLE_SILK=true``).
    """
    if not getattr(settings, 'ENABLE_SILK', False):
        return

    from django.db.models import Count
    from django.utils import timezone

    logger_silk = logging.getLogger('silk_monitor')

    try:
        from silk.models import Request, SQLQuery
    except (ImportError, RuntimeError):
        logger_silk.warning('django-silk is not installed or not enabled; skipping report.')
        return

    week_ago = timezone.now() - timedelta(days=7)
    threshold_ms = getattr(settings, 'SLOW_QUERY_THRESHOLD_MS', 500)
    n_plus_one_threshold = getattr(settings, 'N_PLUS_ONE_THRESHOLD', 10)

    slow_queries = SQLQuery.objects.filter(
        request__start_time__gte=week_ago,
        time_taken__gte=threshold_ms,
    ).select_related('request').order_by('-time_taken')[:50]

    n_plus_one_suspects = Request.objects.filter(
        start_time__gte=week_ago,
    ).annotate(
        query_count=Count('queries'),
    ).filter(
        query_count__gte=n_plus_one_threshold,
    ).order_by('-query_count')[:20]

    report_lines = [
        '=' * 60,
        f'WEEKLY QUERY REPORT - {timezone.now().strftime("%Y-%m-%d")}',
        '=' * 60,
        '',
        f'## SLOW QUERIES (>{threshold_ms}ms)',
        '-' * 40,
    ]

    if slow_queries:
        for sq in slow_queries:
            report_lines.append(
                f'[{sq.time_taken:.0f}ms] {sq.request.path} - '
                f'{sq.query[:100]}...'
            )
    else:
        report_lines.append('No slow queries found this week')

    report_lines.extend([
        '',
        f'## POTENTIAL N+1 (>{n_plus_one_threshold} queries/request)',
        '-' * 40,
    ])

    if n_plus_one_suspects:
        for req in n_plus_one_suspects:
            report_lines.append(
                f'[{req.query_count} queries] {req.path}'
            )
    else:
        report_lines.append('No N+1 patterns detected this week')

    report_lines.extend(['', '=' * 60])
    report = '\n'.join(report_lines)

    reports_dir = Path(settings.BASE_DIR) / 'logs' / 'silk-reports'
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_date = timezone.now().strftime('%Y-%m-%d')
    log_path = reports_dir / f'silk-report-{report_date}.log'

    with open(log_path, 'w') as f:
        f.write(report + '\n')

    logger_silk.info(
        'Weekly report generated. Slow queries: %d, N+1 suspects: %d',
        slow_queries.count(),
        n_plus_one_suspects.count(),
    )

    return report


# ---------------------------------------------------------------------------
# Monthly Silk report cleanup — 1st of each month at 05:00 UTC
# ---------------------------------------------------------------------------
@db_periodic_task(crontab(day='1', hour='5', minute='0'))
def silk_reports_cleanup():
    """Monthly cleanup of Silk report files older than 6 months.

    Deletes ``silk-report-*.log`` files from ``backend/logs/silk-reports/``
    when they are older than 180 days.
    Only runs when Silk is enabled (``ENABLE_SILK=true``).
    """
    if not getattr(settings, 'ENABLE_SILK', False):
        return

    from datetime import datetime

    logger_silk = logging.getLogger('silk_monitor')
    reports_dir = Path(settings.BASE_DIR) / 'logs' / 'silk-reports'

    if not reports_dir.exists():
        return

    cutoff = timezone.now().date() - timedelta(days=180)
    deleted = 0

    for report_file in reports_dir.glob('silk-report-*.log'):
        # Extract date from filename: silk-report-YYYY-MM-DD.log
        try:
            date_str = report_file.stem.replace('silk-report-', '')
            file_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            continue

        if file_date < cutoff:
            report_file.unlink()
            deleted += 1

    logger_silk.info('Silk reports cleanup: deleted %d file(s) older than %s.', deleted, cutoff)
