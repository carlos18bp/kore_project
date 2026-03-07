"""Management command for daily slot maintenance (prune + fill).

Two phases in a single idempotent execution:
1. **Prune** — delete past availability slots that have no bookings.
2. **Fill** — generate future slots up to the maintenance window for all
   active trainers (or a specific trainer via ``--trainer-email``).
"""

from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Exists, OuterRef
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, TrainerProfile
from core_app.services.slot_schedule import (
    SLOT_MAINTENANCE_FILL_DAYS,
    generate_slots_for_trainer,
)


class Command(BaseCommand):
    help = (
        "Daily slot maintenance: prune free past slots and fill future window.\n\n"
        "Prune removes slots whose ends_at < now that have zero bookings.\n"
        "Fill generates slots for the next N days (default: 35) per trainer."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--prune-only",
            action="store_true",
            default=False,
            help="Only run the prune phase (skip fill).",
        )
        parser.add_argument(
            "--fill-only",
            action="store_true",
            default=False,
            help="Only run the fill phase (skip prune).",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=SLOT_MAINTENANCE_FILL_DAYS,
            help=f"Number of future days to fill (default: {SLOT_MAINTENANCE_FILL_DAYS}).",
        )
        parser.add_argument(
            "--trainer-email",
            type=str,
            default=None,
            help="Restrict to a single trainer by email (default: all trainers).",
        )
        parser.add_argument(
            "--timezone",
            type=str,
            default=None,
            help=(
                "IANA timezone name for interpreting local times "
                "(e.g. 'America/Bogota'). Defaults to Django's current timezone."
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
        prune_only = options["prune_only"]
        fill_only = options["fill_only"]
        days = int(options["days"])
        trainer_email = options.get("trainer_email")
        tz_name = options.get("timezone")
        slot_minutes = int(options["slot_minutes"])
        slot_step_minutes = int(options["slot_step_minutes"])

        if tz_name:
            try:
                tz = ZoneInfo(tz_name)
            except Exception as exc:  # pragma: no cover
                raise CommandError(f"Invalid timezone '{tz_name}': {exc}") from exc
        else:
            tz = timezone.get_current_timezone()

        # ── Phase 1: Prune ──────────────────────────────────────────────
        if not fill_only:
            pruned = self._prune()
            self.stdout.write(self.style.SUCCESS(f"Prune: deleted {pruned} free past slot(s)."))

        # ── Phase 2: Fill ───────────────────────────────────────────────
        if not prune_only:
            trainers = self._resolve_trainers(trainer_email)
            total_created = 0
            for trainer in trainers:
                created = generate_slots_for_trainer(
                    trainer=trainer,
                    days=days,
                    tz=tz,
                    slot_minutes=slot_minutes,
                    slot_step_minutes=slot_step_minutes,
                )
                total_created += created
                if created:
                    self.stdout.write(
                        f"  Fill: {created} slot(s) created for {trainer.user.email}"
                    )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Fill: {total_created} total slot(s) created for {len(trainers)} trainer(s)."
                )
            )

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _prune():
        """Delete past slots that have no associated bookings."""
        now = timezone.now()
        has_bookings = Booking.objects.filter(slot=OuterRef("pk"))
        past_free_slots = AvailabilitySlot.objects.filter(
            ends_at__lt=now,
        ).exclude(
            Exists(has_bookings),
        )
        count, _ = past_free_slots.delete()
        return count

    @staticmethod
    def _resolve_trainers(email=None):
        """Return trainer queryset, optionally filtered by email."""
        qs = TrainerProfile.objects.select_related("user").all()
        if email:
            qs = qs.filter(user__email__iexact=email.strip().lower())
            if not qs.exists():
                raise CommandError(f"No TrainerProfile found for email '{email}'")
        return list(qs)
