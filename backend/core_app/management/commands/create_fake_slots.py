import random
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import AvailabilitySlot, TrainerProfile


class Command(BaseCommand):
    help = 'Create availability slots for a date range'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30)
        parser.add_argument('--start-hour', type=int, default=9)
        parser.add_argument('--end-hour', type=int, default=18)
        parser.add_argument('--slot-minutes', type=int, default=60)
        parser.add_argument('--slot-step-minutes', type=int, default=15)
        parser.add_argument('--timezone', type=str, default=None)

    def handle(self, *args, **options):
        days = int(options['days'])
        start_hour = int(options['start_hour'])
        end_hour = int(options['end_hour'])
        slot_minutes = int(options['slot_minutes'])
        slot_step_minutes = int(options['slot_step_minutes'])

        tz_name = options.get('timezone')
        if tz_name:
            tz = ZoneInfo(tz_name)
        else:
            tz = timezone.get_current_timezone()

        if end_hour <= start_hour:
            raise SystemExit('--end-hour must be greater than --start-hour')
        if slot_minutes <= 0:
            raise SystemExit('--slot-minutes must be > 0')
        if slot_step_minutes <= 0:
            raise SystemExit('--slot-step-minutes must be > 0')

        now = timezone.now().astimezone(tz)
        start_date = now.date()
        if now.time() >= time(hour=end_hour):
            start_date = start_date + timedelta(days=1)

        slot_duration = timedelta(minutes=slot_minutes)
        slot_step = timedelta(minutes=slot_step_minutes)

        trainers = list(TrainerProfile.objects.all())
        if not trainers:
            self.stdout.write(self.style.WARNING('No trainers found. Run create_fake_trainers first.'))
            return

        created = 0
        blocked = 0
        for day_offset in range(days):
            d = start_date + timedelta(days=day_offset)
            current = datetime.combine(d, time(hour=start_hour, minute=0, second=0), tzinfo=tz)
            end_boundary = datetime.combine(d, time(hour=end_hour, minute=0, second=0), tzinfo=tz)

            while current < end_boundary:
                starts_at = current
                ends_at = current + slot_duration

                if ends_at > end_boundary:
                    break

                if ends_at <= now:
                    current = current + slot_step
                    continue

                trainer = trainers[created % len(trainers)] if trainers else None
                is_blocked = random.random() < 0.10
                _, was_created = AvailabilitySlot.objects.get_or_create(
                    starts_at=starts_at,
                    ends_at=ends_at,
                    defaults={
                        'trainer': trainer,
                        'is_active': True,
                        'is_blocked': is_blocked,
                        'blocked_reason': 'Mantenimiento programado' if is_blocked else '',
                    },
                )
                if was_created:
                    created += 1
                    if is_blocked:
                        blocked += 1

                current = current + slot_step

        total = AvailabilitySlot.objects.count()
        self.stdout.write(self.style.SUCCESS('Availability slots:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- blocked: {blocked}')
        self.stdout.write(f'- total: {total}')
