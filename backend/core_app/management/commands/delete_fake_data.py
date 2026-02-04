from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from core_app.models import (
    AnalyticsEvent,
    AvailabilitySlot,
    Booking,
    FAQItem,
    Notification,
    Package,
    Payment,
    SiteSettings,
    User,
)


class Command(BaseCommand):
    help = 'Delete fake data for KÓRE (requires --confirm flag)'

    PROTECTED_EMAILS = {
        'admin@kore.com',
        'admin@example.com',
        'admin@gmail.com',
    }

    def add_arguments(self, parser):
        parser.add_argument('--confirm', action='store_true', default=False)
        parser.add_argument('--keep-users', action='store_true', default=False)

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(self.style.WARNING('=' * 70))
            self.stdout.write(self.style.WARNING('DANGER: This will DELETE fake/test data!'))
            self.stdout.write(self.style.WARNING('=' * 70))
            self.stdout.write('')
            self.stdout.write('Protected records that will NOT be deleted:')
            self.stdout.write('  - Superusers (is_superuser=True)')
            self.stdout.write(f"  - Users with protected emails: {', '.join(sorted(self.PROTECTED_EMAILS))}")
            self.stdout.write('')
            self.stdout.write(self.style.ERROR('Run with --confirm to proceed:'))
            self.stdout.write(self.style.ERROR('  python manage.py delete_fake_data --confirm'))
            self.stdout.write('')
            return

        keep_users = bool(options['keep_users'])
        deleted_summary = []

        with transaction.atomic():
            deleted_summary.append(f"notifications: {Notification.objects.all().delete()[0]}")
            deleted_summary.append(f"payments: {Payment.objects.all().delete()[0]}")
            deleted_summary.append(f"bookings: {Booking.objects.all().delete()[0]}")

            deleted_summary.append(f"availability_slots: {AvailabilitySlot.objects.all().delete()[0]}")

            deleted_summary.append(f"analytics_events: {AnalyticsEvent.objects.all().delete()[0]}")
            deleted_summary.append(f"faqs: {FAQItem.objects.all().delete()[0]}")
            deleted_summary.append(f"packages: {Package.objects.all().delete()[0]}")
            deleted_summary.append(f"site_settings: {SiteSettings.objects.all().delete()[0]}")

            if not keep_users:
                deleted_users = (
                    User.objects.filter(email__endswith='@kore.com')
                    .exclude(email__in=self.PROTECTED_EMAILS)
                    .exclude(is_superuser=True)
                    .delete()
                )
                deleted_summary.append(f"users: {deleted_users[0]}")

        self.stdout.write(self.style.SUCCESS('Fake data deleted.'))
        self.stdout.write(self.style.SUCCESS('Summary:'))
        for item in deleted_summary:
            self.stdout.write(f'- {item}')
