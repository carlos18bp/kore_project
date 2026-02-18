import random

from django.core.management.base import BaseCommand

from core_app.models import Booking, Notification, Payment

BOOKING_TYPES = [
    Notification.Type.BOOKING_CONFIRMED,
    Notification.Type.BOOKING_CANCELED,
    Notification.Type.BOOKING_RESCHEDULED,
    Notification.Type.BOOKING_REMINDER,
]

PAYMENT_TYPES = [
    Notification.Type.PAYMENT_CONFIRMED,
    Notification.Type.RECEIPT_EMAIL,
]

SUBSCRIPTION_TYPES = [
    Notification.Type.SUBSCRIPTION_ACTIVATED,
    Notification.Type.SUBSCRIPTION_CANCELED,
    Notification.Type.SUBSCRIPTION_EXPIRY_REMINDER,
]

ERROR_MESSAGES = [
    'SMTP connection refused.',
    'Recipient mailbox full.',
    'Template rendering error: missing variable.',
]


class Command(BaseCommand):
    help = 'Create fake notifications for bookings/payments'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=30)

    def handle(self, *args, **options):
        num = int(options['num'])

        bookings = list(Booking.objects.select_related('customer').all())
        payments = list(Payment.objects.select_related('customer').all())

        if not bookings and not payments:
            self.stdout.write(self.style.WARNING('No bookings/payments found.'))
            return

        created = 0
        failed = 0
        for _ in range(num):
            # 10% chance of failed notification
            is_failed = random.random() < 0.10
            notif_status = Notification.Status.FAILED if is_failed else Notification.Status.SENT
            error_message = random.choice(ERROR_MESSAGES) if is_failed else ''

            r = random.random()
            if r < 0.4 and payments:
                # Payment notifications - linked to payment and optionally booking
                payment = random.choice(payments)
                Notification.objects.create(
                    payment=payment,
                    booking=payment.booking,
                    notification_type=random.choice(PAYMENT_TYPES),
                    status=notif_status,
                    sent_to=payment.customer.email,
                    error_message=error_message,
                    payload={'source': 'fake_data'},
                )
            elif r < 0.6 and payments:
                # Subscription notifications - linked to payment (subscription context)
                payment = random.choice(payments)
                if payment.subscription:
                    Notification.objects.create(
                        payment=payment,
                        notification_type=random.choice(SUBSCRIPTION_TYPES),
                        status=notif_status,
                        sent_to=payment.customer.email,
                        error_message=error_message,
                        payload={'source': 'fake_data'},
                    )
                else:
                    continue
            elif bookings:
                booking = random.choice(bookings)
                Notification.objects.create(
                    booking=booking,
                    notification_type=random.choice(BOOKING_TYPES),
                    status=notif_status,
                    sent_to=booking.customer.email,
                    error_message=error_message,
                    payload={'source': 'fake_data'},
                )
            else:
                continue

            created += 1
            if is_failed:
                failed += 1

        self.stdout.write(self.style.SUCCESS('Notifications:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- failed: {failed}')
        self.stdout.write(f'- total: {Notification.objects.count()}')
