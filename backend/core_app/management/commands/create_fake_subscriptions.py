"""Management command to create fake subscriptions for existing customers."""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import Package, Subscription, User

STATUS_DISTRIBUTION = [
    (Subscription.Status.ACTIVE, 0.50),
    (Subscription.Status.PAUSED, 0.15),
    (Subscription.Status.EXPIRED, 0.20),
    (Subscription.Status.CANCELED, 0.15),
]


def _pick_status():
    """Pick a random subscription status based on weighted distribution."""
    r = random.random()
    cumulative = 0
    for status_val, weight in STATUS_DISTRIBUTION:
        cumulative += weight
        if r <= cumulative:
            return status_val
    return Subscription.Status.ACTIVE


class Command(BaseCommand):
    """Assign subscriptions to existing customer users.

    Creates subscriptions with varied statuses (active, paused, expired,
    canceled) and realistic sessions_used progress.  Idempotent — skips
    customers that already have any subscription.
    """

    help = 'Create fake subscriptions (customer ↔ package) for existing customers'

    def handle(self, *args, **options):
        customers = list(
            User.objects.filter(role=User.Role.CUSTOMER, is_active=True)
        )
        packages = list(Package.objects.filter(is_active=True))

        if not customers:
            self.stdout.write(self.style.WARNING(
                'No customers found. Run create_fake_users first.'
            ))
            return
        if not packages:
            self.stdout.write(self.style.WARNING(
                'No packages found. Run create_fake_packages first.'
            ))
            return

        created = 0
        now = timezone.now()
        active_threshold = max(1, int(len(customers) * 0.60))

        for i, customer in enumerate(customers):
            if Subscription.objects.filter(customer=customer).exists():
                continue

            pkg = packages[i % len(packages)]
            # Force first 60% of customers to have active subscriptions
            sub_status = (
                Subscription.Status.ACTIVE if i < active_threshold
                else _pick_status()
            )
            sessions_used = random.randint(0, max(0, pkg.sessions_count - 1))

            starts_at = now - timedelta(days=random.randint(0, 15))
            expires_at = starts_at + timedelta(days=pkg.validity_days)

            next_billing_date = None
            paused_at = None

            if sub_status == Subscription.Status.ACTIVE:
                next_billing_date = expires_at.date()
            elif sub_status == Subscription.Status.PAUSED:
                paused_at = now - timedelta(days=random.randint(1, 5))
            elif sub_status == Subscription.Status.EXPIRED:
                starts_at = now - timedelta(days=pkg.validity_days + random.randint(5, 30))
                expires_at = starts_at + timedelta(days=pkg.validity_days)
                sessions_used = pkg.sessions_count

            Subscription.objects.create(
                customer=customer,
                package=pkg,
                sessions_total=pkg.sessions_count,
                sessions_used=sessions_used,
                status=sub_status,
                starts_at=starts_at,
                expires_at=expires_at,
                next_billing_date=next_billing_date,
                paused_at=paused_at,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS('Subscriptions:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Subscription.objects.count()}')
