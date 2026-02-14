import random
import uuid

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import Booking, Payment, Subscription


class Command(BaseCommand):
    help = 'Create fake payments for bookings and subscriptions'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=40)

    def handle(self, *args, **options):
        num = int(options['num'])

        bookings_without_payment = list(
            Booking.objects.select_related('customer', 'package', 'subscription')
            .exclude(payments__isnull=False)
        )
        if not bookings_without_payment:
            self.stdout.write(self.style.WARNING('No bookings without payment found. Run create_fake_bookings first.'))
            return

        random.shuffle(bookings_without_payment)
        to_create = bookings_without_payment[:num]

        created = 0
        for booking in to_create:
            # Status distribution: 70% confirmed, 10% pending, 10% failed, 10% refunded
            r = random.random()
            if r < 0.70:
                pay_status = Payment.Status.CONFIRMED
            elif r < 0.80:
                pay_status = Payment.Status.PENDING
            elif r < 0.90:
                pay_status = Payment.Status.FAILED
            else:
                pay_status = Payment.Status.CANCELED

            confirmed_at = timezone.now() if pay_status == Payment.Status.CONFIRMED else None
            ref = f'wompi-{uuid.uuid4().hex[:12]}'

            Payment.objects.create(
                booking=booking,
                customer=booking.customer,
                subscription=booking.subscription,
                status=pay_status,
                amount=booking.package.price,
                currency=booking.package.currency,
                provider=Payment.Provider.WOMPI,
                provider_reference=ref,
                confirmed_at=confirmed_at,
                metadata={'source': 'fake_data', 'wompi_reference': ref},
            )
            created += 1

        # Also create payments for subscriptions without any payment
        subs_without_payment = list(
            Subscription.objects.select_related('customer', 'package')
            .exclude(payments__isnull=False)
        )
        sub_created = 0
        for sub in subs_without_payment:
            ref = f'wompi-sub-{uuid.uuid4().hex[:12]}'
            Payment.objects.create(
                customer=sub.customer,
                subscription=sub,
                status=Payment.Status.CONFIRMED,
                amount=sub.package.price,
                currency=sub.package.currency,
                provider=Payment.Provider.WOMPI,
                provider_reference=ref,
                confirmed_at=timezone.now(),
                metadata={'source': 'fake_data', 'wompi_reference': ref},
            )
            sub_created += 1

        self.stdout.write(self.style.SUCCESS('Payments:'))
        self.stdout.write(f'- booking_payments_created: {created}')
        self.stdout.write(f'- subscription_payments_created: {sub_created}')
        self.stdout.write(f'- total: {Payment.objects.count()}')
