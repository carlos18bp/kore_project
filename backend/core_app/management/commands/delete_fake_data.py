from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from core_app.models import (
    AnalyticsEvent,
    Booking,
    ContactMessage,
    FAQCategory,
    FAQItem,
    Notification,
    Package,
    Payment,
    PaymentIntent,
    SiteSettings,
    Subscription,
    SubscriptionGuest,
    SubscriptionRenewal,
    TrainerProfile,
    TrainerUnavailability,
    User,
    WompiEvent,
)
from core_app.models.credit import CreditSettings, CreditTransaction, CreditWallet
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.models.nutrition_product import NutritionProduct
from core_app.models.nutrition_upgrade import NutritionUpgrade
from core_app.models.session_grant import SessionGrant
from core_app.models.session_rating import SessionRating
from core_app.models.store import RedemptionRequest, StoreItem


class Command(BaseCommand):
    help = (
        'Delete ALL data for KÓRE except protected users (requires --confirm flag). '
        'WARNING: This deletes every record in notifications, payments, bookings, '
        'slots, analytics, FAQs, packages, and site settings — not just fake data.'
    )

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
            deleted_summary.append(f"payment_intents: {PaymentIntent.objects.all().delete()[0]}")

            # Credit economy / store / ratings. Order matters:
            # RedemptionRequest has a PROTECT FK to StoreItem and CreditPurchase
            # has a PROTECT FK to CreditPackage, so children go first.
            deleted_summary.append(f"session_ratings: {SessionRating.objects.all().delete()[0]}")
            deleted_summary.append(f"session_grants: {SessionGrant.objects.all().delete()[0]}")
            deleted_summary.append(f"redemption_requests: {RedemptionRequest.objects.all().delete()[0]}")
            deleted_summary.append(f"store_items: {StoreItem.objects.all().delete()[0]}")
            deleted_summary.append(f"credit_purchases: {CreditPurchase.objects.all().delete()[0]}")
            deleted_summary.append(f"credit_packages: {CreditPackage.objects.all().delete()[0]}")
            deleted_summary.append(f"credit_transactions: {CreditTransaction.objects.all().delete()[0]}")
            deleted_summary.append(f"credit_wallets: {CreditWallet.objects.all().delete()[0]}")
            deleted_summary.append(f"credit_settings: {CreditSettings.objects.all().delete()[0]}")

            deleted_summary.append(f"bookings: {Booking.objects.all().delete()[0]}")
            deleted_summary.append(f"subscription_guests: {SubscriptionGuest.objects.all().delete()[0]}")
            # NutritionUpgrade has a PROTECT FK to Subscription and
            # SubscriptionRenewal has a PROTECT FK to Package, so both must be
            # removed before subscriptions/packages are deleted.
            deleted_summary.append(f"nutrition_upgrades: {NutritionUpgrade.objects.all().delete()[0]}")
            deleted_summary.append(f"nutrition_products: {NutritionProduct.objects.all().delete()[0]}")
            deleted_summary.append(f"subscription_renewals: {SubscriptionRenewal.objects.all().delete()[0]}")
            deleted_summary.append(f"subscriptions: {Subscription.objects.all().delete()[0]}")

            # Rows whose FK does not chain to a deleted @kore.com user need
            # explicit cleanup: TrainerUnavailability (FK -> TrainerProfile) and
            # WompiEvent (no FK at all).
            deleted_summary.append(f"trainer_unavailability: {TrainerUnavailability.objects.all().delete()[0]}")
            deleted_summary.append(f"wompi_events: {WompiEvent.objects.all().delete()[0]}")

            deleted_summary.append(f"trainer_profiles: {TrainerProfile.objects.all().delete()[0]}")

            deleted_summary.append(f"analytics_events: {AnalyticsEvent.objects.all().delete()[0]}")
            deleted_summary.append(f"contact_messages: {ContactMessage.objects.all().delete()[0]}")
            deleted_summary.append(f"faqs: {FAQItem.objects.all().delete()[0]}")
            deleted_summary.append(f"faq_categories: {FAQCategory.objects.all().delete()[0]}")
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
