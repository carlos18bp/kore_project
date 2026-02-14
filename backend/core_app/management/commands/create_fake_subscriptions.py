"""Management command to create fake subscriptions for existing customers."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import Package, Subscription, User


class Command(BaseCommand):
    """Assign active subscriptions to existing customer users.

    For each active customer, creates one subscription linked to a random
    active package.  Idempotent — skips customers that already have an
    active subscription.
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

        for i, customer in enumerate(customers):
            if Subscription.objects.filter(
                customer=customer, status=Subscription.Status.ACTIVE,
            ).exists():
                continue

            pkg = packages[i % len(packages)]
            Subscription.objects.create(
                customer=customer,
                package=pkg,
                sessions_total=pkg.sessions_count,
                sessions_used=0,
                status=Subscription.Status.ACTIVE,
                starts_at=now,
                expires_at=now + timedelta(days=pkg.validity_days),
            )
            created += 1

        self.stdout.write(self.style.SUCCESS('Subscriptions:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Subscription.objects.count()}')
