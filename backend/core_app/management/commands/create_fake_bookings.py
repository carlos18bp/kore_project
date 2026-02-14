"""Management command to create fake bookings linked to trainers and subscriptions."""

import random

from django.core.management.base import BaseCommand
from django.db import models as db_models, transaction
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot,
    Booking,
    Package,
    Subscription,
    TrainerProfile,
    User,
)


class Command(BaseCommand):
    """Create fake bookings using available slots.

    Links each booking to the first available trainer and to the customer's
    active subscription (if one exists).  Decrements ``sessions_used`` on
    the subscription accordingly.
    """

    help = 'Create fake bookings using available slots'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=20)

    def handle(self, *args, **options):
        num = int(options['num'])

        customers = list(User.objects.filter(role=User.Role.CUSTOMER, is_active=True))
        packages = list(Package.objects.filter(is_active=True))
        trainer = TrainerProfile.objects.first()

        if not customers:
            self.stdout.write(self.style.WARNING('No customers found. Run create_fake_users first.'))
            return
        if not packages:
            self.stdout.write(self.style.WARNING('No packages found. Run create_fake_packages first.'))
            return

        created = 0

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

            customer = random.choice(customers)
            package = random.choice(packages)

            # Find an active subscription for this customer (prefer matching package)
            subscription = (
                Subscription.objects.filter(
                    customer=customer,
                    status=Subscription.Status.ACTIVE,
                )
                .filter(
                    db_models.Q(package=package)
                    | db_models.Q(sessions_used__lt=db_models.F('sessions_total'))
                )
                .first()
            )

            with transaction.atomic():
                locked_slot = AvailabilitySlot.objects.select_for_update().get(pk=slot.pk)
                if locked_slot.is_blocked or Booking.objects.filter(slot=locked_slot).exists():
                    continue

                locked_slot.is_blocked = True
                locked_slot.save(update_fields=['is_blocked'])

                booking_kwargs = {
                    'customer': customer,
                    'package': package,
                    'slot': locked_slot,
                    'trainer': trainer,
                    'status': Booking.Status.CONFIRMED,
                }

                if subscription and subscription.sessions_remaining > 0:
                    booking_kwargs['subscription'] = subscription
                    Subscription.objects.filter(pk=subscription.pk).update(
                        sessions_used=db_models.F('sessions_used') + 1,
                    )

                Booking.objects.create(**booking_kwargs)
                created += 1

        self.stdout.write(self.style.SUCCESS('Bookings:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Booking.objects.count()}')
