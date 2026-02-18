"""Management command to create fake bookings linked to trainers and subscriptions."""

import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import models as db_models, transaction
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Subscription,
    TrainerProfile,
)

CANCEL_REASONS = [
    'No puedo asistir por motivos personales.',
    'Cambio de horario laboral.',
    'Reagendé para otro día.',
    'Viaje de último momento.',
]

BOOKING_RATIO_OPTIONS = (0.2, 0.5, 1.0)


def _pick_booking_ratio(min_ratio, max_ratio):
    """Pick a booking ratio from discrete targets or fallback to a range."""
    if min_ratio == max_ratio:
        return min_ratio
    ratio_options = [ratio for ratio in BOOKING_RATIO_OPTIONS if min_ratio <= ratio <= max_ratio]
    if ratio_options:
        return random.choice(ratio_options)
    return random.uniform(min_ratio, max_ratio)

NOTES_POOL = [
    'Enfocarse en tren superior y core.',
    'Revisar postura en sentadilla.',
    'Sesión de movilidad articular.',
    'Trabajo de fuerza funcional.',
    '',
    '',
]


def _has_overlapping_booking(customer, slot):
    """Check if customer has an active booking that overlaps with the given slot."""
    return Booking.objects.filter(
        customer=customer,
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        slot__starts_at__lt=slot.ends_at,
        slot__ends_at__gt=slot.starts_at,
    ).exists()


class Command(BaseCommand):
    """Create fake bookings using available slots.

    Links each booking to an available trainer and to the customer's
    active subscription (if one exists).  Decrements ``sessions_used`` on
    the subscription accordingly.  Creates a mix of confirmed (~85%) and
    canceled (~15%) bookings.

    Business rules enforced:
    - Anti-overlap: No two active bookings for the same customer in overlapping slots.
    - Sessions remaining: Only uses subscriptions with available sessions.
    - Chronological order: New bookings must start after the last active session in the same subscription.
    - Partial booking: Limits bookings per subscription to 20%, 50%, or 100% of sessions_total.
    - Pool refresh: Removes subscriptions that hit their booking limit.
    """

    help = 'Create fake bookings using available slots'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=40)
        parser.add_argument('--min-booking-ratio', type=float, default=0.20)
        parser.add_argument('--max-booking-ratio', type=float, default=1.0)

    def handle(self, *args, **options):
        num = int(options['num'])
        min_ratio = options['min_booking_ratio']
        max_ratio = options['max_booking_ratio']

        active_statuses = [Booking.Status.PENDING, Booking.Status.CONFIRMED]

        active_sub_ids = list(
            Subscription.objects.filter(status=Subscription.Status.ACTIVE).values_list('id', flat=True)
        )
        if active_sub_ids:
            Subscription.objects.filter(pk__in=active_sub_ids).update(sessions_used=0)
            usage_counts = (
                Booking.objects.filter(
                    subscription_id__in=active_sub_ids,
                    status__in=active_statuses,
                )
                .values('subscription_id')
                .annotate(total=db_models.Count('id'))
            )
            for usage in usage_counts:
                Subscription.objects.filter(pk=usage['subscription_id']).update(
                    sessions_used=usage['total'],
                )

        # Only consider customers with an active subscription that has remaining sessions
        eligible_subs = list(
            Subscription.objects.filter(
                status=Subscription.Status.ACTIVE,
                sessions_used__lt=db_models.F('sessions_total'),
            ).select_related('customer', 'package')
        )
        trainers = list(TrainerProfile.objects.all())

        if not eligible_subs:
            self.stdout.write(self.style.WARNING(
                'No customers with active subscriptions found. '
                'Run create_fake_users, create_fake_packages, and create_fake_subscriptions first.'
            ))
            return

        # Calculate max bookings per subscription (20/50/100% of sessions_total)
        sub_booking_limits = {}
        sub_booking_counts = {}
        for sub in eligible_subs:
            ratio = _pick_booking_ratio(min_ratio, max_ratio)
            target_bookings = min(sub.sessions_total, math.ceil(sub.sessions_total * ratio))
            # Count existing bookings for this subscription
            existing = Booking.objects.filter(
                subscription=sub,
                status__in=active_statuses,
            ).count()
            sub_booking_limits[sub.pk] = max(existing, target_bookings)
            sub_booking_counts[sub.pk] = existing

        last_booking_ends = {
            sub.pk: Booking.objects.filter(
                subscription=sub,
                status__in=active_statuses,
            ).select_related('slot').order_by('-slot__ends_at').values_list('slot__ends_at', flat=True).first()
            for sub in eligible_subs
        }

        # Remove subs that already hit their limit
        eligible_subs = [
            s for s in eligible_subs
            if sub_booking_counts[s.pk] < sub_booking_limits[s.pk]
        ]

        created = 0
        canceled_count = 0

        now = timezone.now()
        for _ in range(num):
            slot = None
            sub = None

            # Find a subscription whose customer doesn't have an overlapping booking
            # and hasn't hit the booking limit. Pick the first valid slot for that subscription.
            random.shuffle(eligible_subs)
            for candidate in eligible_subs:
                if sub_booking_counts.get(candidate.pk, 0) >= sub_booking_limits.get(candidate.pk, 0):
                    continue
                last_end = last_booking_ends.get(candidate.pk)
                slot_qs = AvailabilitySlot.objects.filter(
                    is_active=True,
                    is_blocked=False,
                    ends_at__gt=now,
                ).exclude(
                    bookings__status__in=active_statuses,
                ).order_by('starts_at')
                if last_end:
                    slot_qs = slot_qs.filter(starts_at__gte=last_end)
                candidate_slot = slot_qs.first()
                if not candidate_slot:
                    continue
                if _has_overlapping_booking(candidate.customer, candidate_slot):
                    continue
                sub = candidate
                slot = candidate_slot
                break

            if not sub or not slot:
                # All eligible customers have overlapping bookings, hit limit, or no valid slot
                continue

            customer = sub.customer
            package = sub.package
            subscription = sub
            trainer = random.choice(trainers) if trainers else None

            # Pick status: ~85% confirmed, ~15% canceled (PENDING not used in real flow)
            status = Booking.Status.CANCELED if random.random() < 0.15 else Booking.Status.CONFIRMED

            with transaction.atomic():
                locked_slot = AvailabilitySlot.objects.select_for_update().get(pk=slot.pk)
                if locked_slot.is_blocked or Booking.objects.filter(slot=locked_slot).exists():
                    continue

                if status != Booking.Status.CANCELED:
                    locked_slot.is_blocked = True
                    locked_slot.save(update_fields=['is_blocked', 'updated_at'])

                booking_kwargs = {
                    'customer': customer,
                    'package': package,
                    'slot': locked_slot,
                    'trainer': trainer,
                    'status': status,
                    'notes': random.choice(NOTES_POOL),
                }

                if status == Booking.Status.CANCELED:
                    booking_kwargs['canceled_reason'] = random.choice(CANCEL_REASONS)
                    canceled_count += 1

                if subscription and status != Booking.Status.CANCELED:
                    # Re-check remaining sessions under lock
                    sub_fresh = Subscription.objects.select_for_update().get(pk=subscription.pk)
                    if sub_fresh.sessions_remaining > 0:
                        booking_kwargs['subscription'] = subscription
                        Subscription.objects.filter(pk=subscription.pk).update(
                            sessions_used=db_models.F('sessions_used') + 1,
                        )
                        subscription.refresh_from_db()
                        # Track booking count
                        sub_booking_counts[subscription.pk] = sub_booking_counts.get(subscription.pk, 0) + 1
                        last_booking_ends[subscription.pk] = locked_slot.ends_at

                Booking.objects.create(**booking_kwargs)
                created += 1

                # Remove subscriptions that hit their booking limit or exhausted sessions
                if subscription and status != Booking.Status.CANCELED:
                    if (subscription.sessions_remaining <= 0 or
                            sub_booking_counts.get(subscription.pk, 0) >= sub_booking_limits.get(subscription.pk, 0)):
                        eligible_subs = [s for s in eligible_subs if s.pk != subscription.pk]

            # Exit loop if no more eligible subscriptions
            if not eligible_subs:
                break

        if active_sub_ids:
            Subscription.objects.filter(pk__in=active_sub_ids).update(sessions_used=0)
            usage_counts = (
                Booking.objects.filter(
                    subscription_id__in=active_sub_ids,
                    status__in=active_statuses,
                )
                .values('subscription_id')
                .annotate(total=db_models.Count('id'))
            )
            for usage in usage_counts:
                Subscription.objects.filter(pk=usage['subscription_id']).update(
                    sessions_used=usage['total'],
                )

        # Ensure active subscriptions are not left at 0 usage in seeded fake data.
        # This provides a more realistic baseline (at least 1-2 used sessions)
        # before creating past backfill records.
        active_zero_usage = list(
            Subscription.objects.filter(
                status=Subscription.Status.ACTIVE,
                starts_at__lt=now,
                sessions_used=0,
            ).values('id', 'sessions_total')
        )
        seeded_active_subscriptions = 0
        for sub_data in active_zero_usage:
            target_used = 2 if sub_data['sessions_total'] > 2 else 1
            target_used = min(target_used, sub_data['sessions_total'])
            if target_used <= 0:
                continue
            Subscription.objects.filter(pk=sub_data['id']).update(sessions_used=target_used)
            seeded_active_subscriptions += 1

        # --- Second pass: backfill past bookings for used sessions ---
        past_created = self._backfill_past_bookings(trainers)

        # --- Final sync: re-count sessions_used for ALL subs that have bookings ---
        # The backfill may have created new confirmed bookings, so sessions_used
        # must be re-synced to match the actual non-canceled booking count.
        all_sub_ids = list(
            Subscription.objects.values_list('id', flat=True)
        )
        if all_sub_ids:
            Subscription.objects.filter(pk__in=all_sub_ids).update(sessions_used=0)
            final_counts = (
                Booking.objects.filter(
                    subscription_id__in=all_sub_ids,
                    status__in=active_statuses,
                )
                .values('subscription_id')
                .annotate(total=db_models.Count('id'))
            )
            for usage in final_counts:
                Subscription.objects.filter(pk=usage['subscription_id']).update(
                    sessions_used=usage['total'],
                )

        self.stdout.write(self.style.SUCCESS('Bookings:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- canceled: {canceled_count}')
        self.stdout.write(f'- active_seeded: {seeded_active_subscriptions}')
        self.stdout.write(f'- past_backfilled: {past_created}')
        self.stdout.write(f'- total: {Booking.objects.count()}')

    # ------------------------------------------------------------------
    # Backfill past bookings for used sessions
    # ------------------------------------------------------------------

    @staticmethod
    def _backfill_past_bookings(trainers):
        """Create past booking records for subscriptions with used sessions.

        Any subscription (active, expired, or canceled) may have
        ``sessions_used > 0`` without corresponding past booking rows.
        This method counts only **past** bookings (slot before *now*) and
        creates the missing ones so the frontend can display session history.

        Returns:
            int: Number of past bookings created.
        """
        now = timezone.now()
        subs_with_usage = list(
            Subscription.objects.filter(
                sessions_used__gt=0,
            ).select_related('customer', 'package')
        )

        past_created = 0
        for sub in subs_with_usage:
            # Skip subs that started after now — no past window available
            if sub.starts_at >= now:
                continue

            # Count only bookings whose slot is in the past
            existing_past = Booking.objects.filter(
                subscription=sub,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
                slot__starts_at__lt=now,
            ).count()
            needed = sub.sessions_used - existing_past
            if needed <= 0:
                continue

            # Place past slots within the subscription window, before now
            slot_duration = timedelta(minutes=sub.package.session_duration_minutes or 60)
            window_start = sub.starts_at + timedelta(days=1)
            window_end = min(sub.expires_at, now) - slot_duration
            if window_end <= window_start:
                continue  # No valid past window — skip

            total_seconds = max(int((window_end - window_start).total_seconds()), 1)
            interval = max(total_seconds // max(needed, 1), int(slot_duration.total_seconds()) + 60)

            for i in range(needed):
                slot_start = window_start + timedelta(seconds=interval * i)
                slot_end = slot_start + slot_duration

                trainer = random.choice(trainers) if trainers else None
                # Use get_or_create to handle unique constraint on (starts_at, ends_at)
                slot, _ = AvailabilitySlot.objects.get_or_create(
                    starts_at=slot_start,
                    ends_at=slot_end,
                    defaults={
                        'trainer': trainer,
                        'is_active': True,
                        'is_blocked': True,
                    },
                )
                Booking.objects.create(
                    customer=sub.customer,
                    package=sub.package,
                    slot=slot,
                    trainer=trainer,
                    subscription=sub,
                    status=Booking.Status.CONFIRMED,
                    notes=random.choice(NOTES_POOL),
                )
                past_created += 1

        return past_created
