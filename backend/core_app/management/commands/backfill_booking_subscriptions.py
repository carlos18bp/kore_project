"""Backfill legacy bookings missing subscription references."""

from django.core.management.base import BaseCommand

from core_app.models import Booking, Subscription


class Command(BaseCommand):
    """Attach matching subscriptions to legacy bookings with null subscription."""

    help = (
        'Backfill Booking.subscription for legacy bookings. Matches on customer, '
        'package, and slot start time within the subscription window.'
    )

    def add_arguments(self, parser):
        """Define optional command arguments."""
        parser.add_argument('--dry-run', action='store_true', default=False)
        parser.add_argument('--limit', type=int, default=None)
        parser.add_argument('--customer-id', type=int, default=None)
        parser.add_argument('--package-id', type=int, default=None)

    def handle(self, *args, **options):
        """Run the backfill with optional scoping and dry-run output."""
        dry_run = bool(options['dry_run'])
        limit = options.get('limit')
        customer_id = options.get('customer_id')
        package_id = options.get('package_id')

        filters = {'subscription__isnull': True}
        if customer_id:
            filters['customer_id'] = customer_id
        if package_id:
            filters['package_id'] = package_id

        bookings_qs = Booking.objects.select_related('customer', 'package', 'slot').filter(**filters).order_by('id')
        if limit:
            bookings_qs = bookings_qs[:limit]

        total = 0
        updated = 0
        skipped_no_match = 0
        skipped_ambiguous = 0

        for booking in bookings_qs:
            total += 1
            if not booking.slot_id:
                skipped_no_match += 1
                continue

            matches = list(
                Subscription.objects.filter(
                    customer=booking.customer,
                    package=booking.package,
                    starts_at__lte=booking.slot.starts_at,
                    expires_at__gte=booking.slot.starts_at,
                ).order_by('starts_at').values_list('id', flat=True)[:2]
            )

            if len(matches) == 1:
                if not dry_run:
                    booking.subscription_id = matches[0]
                    booking.save(update_fields=['subscription', 'updated_at'])
                updated += 1
            elif len(matches) == 0:
                skipped_no_match += 1
            else:
                skipped_ambiguous += 1

        self.stdout.write(self.style.SUCCESS('Backfill booking subscriptions complete.'))
        self.stdout.write(f'- scanned: {total}')
        self.stdout.write(f'- updated: {updated}')
        self.stdout.write(f'- skipped (no match): {skipped_no_match}')
        self.stdout.write(f'- skipped (ambiguous): {skipped_ambiguous}')
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry-run: no changes were saved.'))
