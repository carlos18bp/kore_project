from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core_app.models import AvailabilitySlot, TrainerProfile
from core_app.services.slot_schedule import generate_slots_for_trainer


class Command(BaseCommand):
    help = "Create availability slots for a specific trainer email.\n\n" \
           "Generates slots Mon-Fri 05:00-13:00 & 16:00-21:00, Sat 06:00-13:00,\n" \
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

        created = generate_slots_for_trainer(
            trainer=trainer,
            days=days,
            tz=tz,
            slot_minutes=slot_minutes,
            slot_step_minutes=slot_step_minutes,
        )

        total_for_trainer = AvailabilitySlot.objects.filter(trainer=trainer).count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Availability slots for trainer {trainer.user.email}:"
            )
        )
        self.stdout.write(f"- created: {created}")
        self.stdout.write(f"- total for trainer: {total_for_trainer}")
