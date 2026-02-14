import random

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import Booking, Payment


class Command(BaseCommand):
    help = 'Create fake payments for bookings'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=20)

    def handle(self, *args, **options):
        num = int(options['num'])

        bookings_without_payment = list(
            Booking.objects.select_related('customer', 'package')
            .exclude(payments__isnull=False)
        )
        if not bookings_without_payment:
            self.stdout.write(self.style.WARNING('No bookings without payment found. Run create_fake_bookings first.'))
            return

        random.shuffle(bookings_without_payment)
        to_create = bookings_without_payment[:num]

        created = 0
        for booking in to_create:
            pay_status = Payment.Status.CONFIRMED if random.random() < 0.8 else Payment.Status.PENDING
            confirmed_at = timezone.now() if pay_status == Payment.Status.CONFIRMED else None

            Payment.objects.create(
                booking=booking,
                customer=booking.customer,
                status=pay_status,
                amount=booking.package.price,
                currency=booking.package.currency,
                provider=Payment.Provider.WOMPI,
                provider_reference=f'FAKE-{booking.pk}',
                confirmed_at=confirmed_at,
                metadata={'source': 'fake_data'},
            )
            created += 1

        self.stdout.write(self.style.SUCCESS('Payments:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Payment.objects.count()}')
