from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core_app.models import AvailabilitySlot, TrainerProfile


class Command(BaseCommand):
    help = "Create weekday availability slots for a specific trainer email.\n\n" \
           "Generates slots Monday to Friday in two windows: 05:00\x1313:00 and 16:00\x1320:00,\n" \
           "using 60-minute sessions with 15-minute start increments by default."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            required=True,
            help="Trainer user email (User.email linked to TrainerProfile)",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days starting today to generate availability for (default: 30)",
        )
        parser.add_argument(
            "--timezone",
            type=str,
            default=None,
            help=(
                "IANA timezone name for interpreting local times (e.g. 'America/Bogota'). "
                "Defaults to Django's current timezone."
            ),
        )
        parser.add_argument(
            "--slot-minutes",
            type=int,
            default=60,
            help="Session duration in minutes (default: 60).",
        )
        parser.add_argument(
            "--slot-step-minutes",
            type=int,
            default=15,
            help="Start-time increment in minutes between slots (default: 15).",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        days = int(options["days"])
        tz_name = options.get("timezone")
        slot_minutes = int(options["slot_minutes"])
        slot_step_minutes = int(options["slot_step_minutes"])

        if days <= 0:
            raise CommandError("--days must be > 0")
        if slot_minutes <= 0:
            raise CommandError("--slot-minutes must be > 0")
        if slot_step_minutes <= 0:
            raise CommandError("--slot-step-minutes must be > 0")

        if tz_name:
            try:
                tz = ZoneInfo(tz_name)
            except Exception as exc:  # pragma: no cover - defensive
                raise CommandError(f"Invalid timezone '{tz_name}': {exc}") from exc
        else:
            tz = timezone.get_current_timezone()

        try:
            trainer = (
                TrainerProfile.objects.select_related("user")
                .get(user__email__iexact=email)
            )
        except TrainerProfile.DoesNotExist:
            raise CommandError(f"No TrainerProfile found for email '{email}'")

        slot_duration = timedelta(minutes=slot_minutes)
        slot_step = timedelta(minutes=slot_step_minutes)

        now = timezone.now().astimezone(tz)
        start_date = now.date()

        created = 0
        windows = [
            (5, 13),   # 05:0001:00
            (16, 20),  # 16:0020:00
        ]

        for day_offset in range(days):
            current_date = start_date + timedelta(days=day_offset)

            # Monday=0, Sunday=6 -> only MondayFriday
            if current_date.weekday() >= 5:
                continue

            for start_hour, end_hour in windows:
                day_start = datetime.combine(
                    current_date,
                    time(hour=start_hour, minute=0, second=0),
                    tzinfo=tz,
                )
                day_end = datetime.combine(
                    current_date,
                    time(hour=end_hour, minute=0, second=0),
                    tzinfo=tz,
                )

                current_start = day_start
                while current_start < day_end:
                    starts_at = current_start
                    ends_at = current_start + slot_duration

                    if ends_at > day_end:
                        break

                    # Skip slots that would end in the past relative to "now"
                    if ends_at <= now:
                        current_start = current_start + slot_step
                        continue

                    # UniqueConstraint is on (starts_at, ends_at), so we match
                    # existing behavior from create_fake_slots and only use
                    # trainer/defaults on creation.
                    _, was_created = AvailabilitySlot.objects.get_or_create(
                        starts_at=starts_at,
                        ends_at=ends_at,
                        defaults={
                            "trainer": trainer,
                            "is_active": True,
                            "is_blocked": False,
                            "blocked_reason": "",
                        },
                    )
                    if was_created:
                        created += 1

                    current_start = current_start + slot_step

        total_for_trainer = AvailabilitySlot.objects.filter(trainer=trainer).count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Availability slots for trainer {trainer.user.email}:"
            )
        )
        self.stdout.write(f"- created: {created}")
        self.stdout.write(f"- total for trainer: {total_for_trainer}")
