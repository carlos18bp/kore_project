"""Expire subscriptions based on their expiration date and release bookings."""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core_app.models import Subscription
from core_app.services.subscription_cleanup import cancel_future_bookings


class Command(BaseCommand):
    """Expire subscriptions whose expiry date has passed."""

    help = 'Expire subscriptions whose expires_at is in the past.'

    def handle(self, *args, **options):
        """Mark expired subscriptions as expired and release future bookings.

        Iterates over active subscriptions whose ``expires_at`` is in the past,
        marks them expired, clears next billing date, sets sessions to fully used,
        and cancels any future bookings while unblocking their slots.
        """
        now = timezone.now()
        expired_qs = Subscription.objects.filter(
            status=Subscription.Status.ACTIVE,
            expires_at__lte=now,
        ).select_related('customer', 'package')

        processed = 0
        bookings_canceled = 0

        for sub in expired_qs:
            with transaction.atomic():
                locked_sub = Subscription.objects.select_for_update().get(pk=sub.pk)
                if locked_sub.status != Subscription.Status.ACTIVE or locked_sub.expires_at > now:
                    continue

                locked_sub.status = Subscription.Status.EXPIRED
                locked_sub.next_billing_date = None
                locked_sub.sessions_used = locked_sub.sessions_total
                locked_sub.save(
                    update_fields=[
                        'status',
                        'next_billing_date',
                        'sessions_used',
                        'updated_at',
                    ]
                )

                bookings_canceled += cancel_future_bookings(locked_sub, now=now)
                processed += 1

        self.stdout.write(self.style.SUCCESS('Expired subscriptions:'))
        self.stdout.write(f'- processed: {processed}')
        self.stdout.write(f'- bookings_canceled: {bookings_canceled}')
