"""Management command to create fake bookings linked to trainers and subscriptions."""

import random

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

NOTES_POOL = [
    'Enfocarse en tren superior y core.',
    'Revisar postura en sentadilla.',
    'Sesión de movilidad articular.',
    'Trabajo de fuerza funcional.',
    '',
    '',
]


class Command(BaseCommand):
    """Create fake bookings using available slots.

    Links each booking to an available trainer and to the customer's
    active subscription (if one exists).  Decrements ``sessions_used`` on
    the subscription accordingly.  Creates a mix of confirmed (~75%),
    canceled (~15%), and pending (~10%) bookings.
    """

    help = 'Create fake bookings using available slots'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=40)

    def handle(self, *args, **options):
        num = int(options['num'])

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

        created = 0
        canceled_count = 0

        for _ in range(num):
            slot = (
                AvailabilitySlot.objects.filter(
                    is_active=True,
                    is_blocked=False,
                    ends_at__gt=timezone.now(),
                    booking__isnull=True,
                )
                .order_by('starts_at')
                .first()
            )

            if not slot:
                break

            sub = random.choice(eligible_subs)
            customer = sub.customer
            package = sub.package
            subscription = sub
            trainer = trainers[created % len(trainers)] if trainers else None

            # Pick status: ~75% confirmed, ~15% canceled, ~10% pending
            r = random.random()
            if r < 0.15:
                status = Booking.Status.CANCELED
            elif r < 0.25:
                status = Booking.Status.PENDING
            else:
                status = Booking.Status.CONFIRMED

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

                Booking.objects.create(**booking_kwargs)
                created += 1

        self.stdout.write(self.style.SUCCESS('Bookings:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- canceled: {canceled_count}')
        self.stdout.write(f'- total: {Booking.objects.count()}')
