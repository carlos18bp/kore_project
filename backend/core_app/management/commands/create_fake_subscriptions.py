"""Management command to create fake subscriptions for existing customers."""

import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import Package, Subscription, User

STATUS_DISTRIBUTION = [
    (Subscription.Status.ACTIVE, 0.50),
    (Subscription.Status.EXPIRED, 0.25),
    (Subscription.Status.CANCELED, 0.25),
]
SESSION_USAGE_RATIOS = (0.2, 0.5, 1.0)
PARTIAL_USAGE_RATIOS = (0.2, 0.5)
INACTIVE_STATUSES = (
    Subscription.Status.EXPIRED,
    Subscription.Status.CANCELED,
)


def _pick_status():
    """Pick a random subscription status based on weighted distribution."""
    r = random.random()
    cumulative = 0
    for status_val, weight in STATUS_DISTRIBUTION:
        cumulative += weight
        if r <= cumulative:
            return status_val
    return Subscription.Status.ACTIVE


def _pick_usage_ratio(ratios):
    """Pick a random usage ratio from the allowed set."""
    return random.choice(ratios)


def _pick_inactive_status():
    """Pick a random inactive subscription status."""
    return random.choice(INACTIVE_STATUSES)


def _calculate_sessions_used(total, ratio, require_remaining=False):
    """Calculate sessions_used based on ratio, optionally requiring remaining sessions."""
    sessions_used = math.ceil(total * ratio)
    if require_remaining:
        sessions_used = min(sessions_used, max(total - 1, 0))
    return min(sessions_used, total)


class Command(BaseCommand):
    """Assign subscriptions to existing customer users.

    Creates 1–3 subscriptions per customer with varied statuses (active,
    expired, canceled) and realistic sessions_used progress (partial usage).
    Idempotent — skips creating subscriptions for packages the customer already has.

    Business rules enforced:
    - EXPIRED/CANCELED subscriptions use 20%, 50%, or 100% of sessions_total
    - ACTIVE subscriptions have sessions_remaining > 0 (partial usage only)
    - Each customer gets 1–3 different packages randomly assigned.
    - Each customer has at least one active subscription.
    - Optional ``--ensure-inactive`` forces at least one inactive subscription when possible.
    """

    help = 'Create fake subscriptions (customer ↔ package) for existing customers'

    def add_arguments(self, parser):
        parser.add_argument('--min-programs', type=int, default=1)
        parser.add_argument('--max-programs', type=int, default=3)
        parser.add_argument(
            '--ensure-inactive',
            action='store_true',
            help='Ensure each customer has at least one inactive subscription when possible.',
        )

    def handle(self, *args, **options):
        min_programs = options['min_programs']
        max_programs = options['max_programs']
        ensure_inactive = options['ensure_inactive']

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
            # Get packages already assigned to this customer
            existing_pkg_ids = set(
                Subscription.objects.filter(customer=customer).values_list('package_id', flat=True)
            )
            available_packages = [p for p in packages if p.id not in existing_pkg_ids]

            if not available_packages:
                continue

            # Assign 1-3 programs randomly (limited by available packages)
            num_programs = random.randint(min_programs, min(max_programs, len(available_packages)))
            selected_packages = random.sample(available_packages, num_programs)

            has_active = Subscription.objects.filter(
                customer=customer,
                status=Subscription.Status.ACTIVE,
            ).exists()
            has_inactive = False
            if ensure_inactive:
                has_inactive = Subscription.objects.filter(
                    customer=customer,
                ).exclude(status=Subscription.Status.ACTIVE).exists()

            force_inactive = (
                ensure_inactive
                and not has_inactive
                and (has_active or num_programs > 1)
            )
            inactive_assigned = False

            for j, pkg in enumerate(selected_packages):
                # Ensure at least one active subscription per customer
                if j == 0 and not has_active:
                    sub_status = Subscription.Status.ACTIVE
                elif force_inactive and not inactive_assigned:
                    sub_status = _pick_inactive_status()
                    inactive_assigned = True
                else:
                    sub_status = _pick_status()

                starts_at = now - timedelta(days=random.randint(0, 15))
                expires_at = starts_at + timedelta(days=pkg.validity_days)

                next_billing_date = None
                if sub_status == Subscription.Status.ACTIVE:
                    next_billing_date = expires_at.date()
                    usage_ratio = _pick_usage_ratio(PARTIAL_USAGE_RATIOS)
                    sessions_used = _calculate_sessions_used(
                        pkg.sessions_count,
                        usage_ratio,
                        require_remaining=True,
                    )
                elif sub_status == Subscription.Status.EXPIRED:
                    starts_at = now - timedelta(days=pkg.validity_days + random.randint(5, 30))
                    expires_at = starts_at + timedelta(days=pkg.validity_days)
                    usage_ratio = _pick_usage_ratio(SESSION_USAGE_RATIOS)
                    sessions_used = _calculate_sessions_used(
                        pkg.sessions_count,
                        usage_ratio,
                    )
                elif sub_status == Subscription.Status.CANCELED:
                    usage_ratio = _pick_usage_ratio(SESSION_USAGE_RATIOS)
                    sessions_used = _calculate_sessions_used(
                        pkg.sessions_count,
                        usage_ratio,
                    )
                else:
                    usage_ratio = _pick_usage_ratio(PARTIAL_USAGE_RATIOS)
                    sessions_used = _calculate_sessions_used(
                        pkg.sessions_count,
                        usage_ratio,
                    )

                Subscription.objects.create(
                    customer=customer,
                    package=pkg,
                    sessions_total=pkg.sessions_count,
                    sessions_used=sessions_used,
                    status=sub_status,
                    starts_at=starts_at,
                    expires_at=expires_at,
                    next_billing_date=next_billing_date,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS('Subscriptions:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Subscription.objects.count()}')
