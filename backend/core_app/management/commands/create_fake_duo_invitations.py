"""Create deterministic fake host/guest pair sharing a Pareja (duo) subscription.

Produces credentials that mirror the production duo flow:
    host@kore.com   — owner of an active semi_personalizado subscription
    guest@kore.com  — accepted guest linked to the host subscription

Both accounts share the password set via ``--password`` (default ``password``),
matching the convention used by ``create_fake_users``.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core_app.models import Package, Subscription, SubscriptionGuest, User


class Command(BaseCommand):
    help = (
        'Create a deterministic Pareja (duo) host/guest pair for manual testing. '
        'Creates host@kore.com (with an active semi_personalizado subscription) '
        'and guest@kore.com (linked as accepted guest).'
    )

    def add_arguments(self, parser):
        parser.add_argument('--host-email', type=str, default='host@kore.com')
        parser.add_argument('--guest-email', type=str, default='guest@kore.com')
        parser.add_argument('--password', type=str, default='password')

    def handle(self, *args, **options):
        host_email = options['host_email']
        guest_email = options['guest_email']
        password = options['password']

        package = (
            Package.objects.filter(
                category=Package.Category.SEMI_PERSONALIZADO,
                is_active=True,
            )
            .order_by('order', 'id')
            .first()
        )
        if not package:
            self.stdout.write(self.style.WARNING(
                'No active semi_personalizado package found. '
                'Run create_fake_packages first.'
            ))
            return

        with transaction.atomic():
            host, host_created = User.objects.get_or_create(
                email=host_email,
                defaults={
                    'first_name': 'Host',
                    'last_name': 'Pareja',
                    'phone': '+573000000001',
                    'role': User.Role.CUSTOMER,
                },
            )
            host.set_password(password)
            host.save(update_fields=['password'])

            guest, guest_created = User.objects.get_or_create(
                email=guest_email,
                defaults={
                    'first_name': 'Guest',
                    'last_name': 'Pareja',
                    'phone': '+573000000002',
                    'role': User.Role.CUSTOMER,
                },
            )
            guest.set_password(password)
            guest.save(update_fields=['password'])

            now = timezone.now()
            subscription = (
                Subscription.objects
                .filter(
                    customer=host,
                    package=package,
                    status=Subscription.Status.ACTIVE,
                )
                .first()
            )
            sub_created = False
            if not subscription:
                starts_at = now - timedelta(days=2)
                expires_at = starts_at + timedelta(days=package.validity_days)
                subscription = Subscription.objects.create(
                    customer=host,
                    package=package,
                    sessions_total=package.sessions_count,
                    sessions_used=0,
                    status=Subscription.Status.ACTIVE,
                    starts_at=starts_at,
                    expires_at=expires_at,
                    next_billing_date=expires_at.date(),
                )
                sub_created = True

            guest_link, link_created = SubscriptionGuest.objects.get_or_create(
                subscription=subscription,
                defaults={
                    'guest': guest,
                    'invited_email': guest_email,
                    'token': SubscriptionGuest.generate_token(),
                    'status': SubscriptionGuest.STATUS_ACCEPTED,
                    'accepted_at': now,
                },
            )
            if not link_created:
                guest_link.guest = guest
                guest_link.invited_email = guest_email
                guest_link.status = SubscriptionGuest.STATUS_ACCEPTED
                guest_link.accepted_at = guest_link.accepted_at or now
                guest_link.save(update_fields=[
                    'guest', 'invited_email', 'status', 'accepted_at', 'updated_at',
                ])

        self.stdout.write(self.style.SUCCESS('Duo invitation:'))
        self.stdout.write(f'- host: {host.email} (created={host_created})')
        self.stdout.write(f'- guest: {guest.email} (created={guest_created})')
        self.stdout.write(f'- package: {package.title} [{package.category}]')
        self.stdout.write(
            f'- subscription #{subscription.id} (created={sub_created}, '
            f'sessions_total={subscription.sessions_total})'
        )
        self.stdout.write(
            f'- guest_link #{guest_link.id} status={guest_link.status} '
            f'(created={link_created})'
        )
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Login as host  → {host.email} / {password}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'Login as guest → {guest.email} / {password}'
        ))
