import random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core_app.models import AvailabilitySlot, Booking, Package, User


class Command(BaseCommand):
    help = 'Create fake bookings using available slots'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=20)

    def handle(self, *args, **options):
        num = int(options['num'])

        customers = list(User.objects.filter(role=User.Role.CUSTOMER, is_active=True))
        packages = list(Package.objects.filter(is_active=True))

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

            with transaction.atomic():
                locked_slot = AvailabilitySlot.objects.select_for_update().get(pk=slot.pk)
                if locked_slot.is_blocked or hasattr(locked_slot, 'booking'):
                    continue

                locked_slot.is_blocked = True
                locked_slot.save(update_fields=['is_blocked'])

                Booking.objects.create(
                    customer=customer,
                    package=package,
                    slot=locked_slot,
                    status=Booking.Status.CONFIRMED,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS('Bookings:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Booking.objects.count()}')
