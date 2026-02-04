import random

from django.core.management.base import BaseCommand

from core_app.models import Booking, Notification, Payment


class Command(BaseCommand):
    help = 'Create fake notifications for bookings/payments'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=20)

    def handle(self, *args, **options):
        num = int(options['num'])

        bookings = list(Booking.objects.select_related('customer').all())
        payments = list(Payment.objects.select_related('customer').all())

        if not bookings and not payments:
            self.stdout.write(self.style.WARNING('No bookings/payments found.'))
            return

        created = 0
        for _ in range(num):
            use_payment = bool(payments) and random.random() < 0.6

            if use_payment:
                payment = random.choice(payments)
                Notification.objects.create(
                    payment=payment,
                    booking=payment.booking,
                    notification_type=Notification.Type.PAYMENT_CONFIRMED,
                    status=Notification.Status.SENT,
                    sent_to=payment.customer.email,
                    payload={'source': 'fake_data'},
                )
            else:
                booking = random.choice(bookings)
                Notification.objects.create(
                    booking=booking,
                    notification_type=Notification.Type.BOOKING_CONFIRMED,
                    status=Notification.Status.SENT,
                    sent_to=booking.customer.email,
                    payload={'source': 'fake_data'},
                )

            created += 1

        self.stdout.write(self.style.SUCCESS('Notifications:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Notification.objects.count()}')
