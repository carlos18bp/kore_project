from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import AvailabilitySlot


class Command(BaseCommand):
    help = 'Create availability slots for a date range'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=14)
        parser.add_argument('--start-hour', type=int, default=9)
        parser.add_argument('--end-hour', type=int, default=18)
        parser.add_argument('--slot-minutes', type=int, default=60)
        parser.add_argument('--timezone', type=str, default=None)

    def handle(self, *args, **options):
        days = int(options['days'])
        start_hour = int(options['start_hour'])
        end_hour = int(options['end_hour'])
        slot_minutes = int(options['slot_minutes'])

        tz_name = options.get('timezone')
        if tz_name:
            tz = ZoneInfo(tz_name)
        else:
            tz = timezone.get_current_timezone()

        if end_hour <= start_hour:
            raise SystemExit('--end-hour must be greater than --start-hour')
        if slot_minutes <= 0:
            raise SystemExit('--slot-minutes must be > 0')

        now = timezone.now().astimezone(tz)
        start_date = now.date()
        if now.time() >= time(hour=end_hour):
            start_date = start_date + timedelta(days=1)

        created = 0
        for day_offset in range(days):
            d = start_date + timedelta(days=day_offset)
            current = datetime.combine(d, time(hour=start_hour, minute=0, second=0), tzinfo=tz)
            end_boundary = datetime.combine(d, time(hour=end_hour, minute=0, second=0), tzinfo=tz)

            while current < end_boundary:
                starts_at = current
                ends_at = current + timedelta(minutes=slot_minutes)

                if ends_at > end_boundary:
                    break

                if ends_at <= now:
                    current = ends_at
                    continue

                _, was_created = AvailabilitySlot.objects.get_or_create(
                    starts_at=starts_at,
                    ends_at=ends_at,
                    defaults={
                        'is_active': True,
                        'is_blocked': False,
                        'blocked_reason': '',
                    },
                )
                if was_created:
                    created += 1

                current = ends_at

        total = AvailabilitySlot.objects.count()
        self.stdout.write(self.style.SUCCESS('Availability slots:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {total}')
