"""Create fake tracking and ancillary records for development and testing.

Populates several smaller domains that ``create_fake_data`` omits so the
customer dashboards, trainer views, billing history and webhook idempotency
surfaces have realistic data:

- MoodEntry / WeightEntry (daily/weekly self-tracking per customer).
- CustomerProfile enrichment (demographics + goal for auto-created profiles).
- TrainerUnavailability (blocked days per trainer).
- SubscriptionRenewal (initial billing-period record per subscription).
- TermsAcceptance (one acceptance per user of the current terms version).
- WompiEvent (processed-webhook idempotency rows).

Re-running is safe thanks to get_or_create on the unique keys.
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import (
    CustomerProfile,
    MoodEntry,
    Subscription,
    SubscriptionRenewal,
    TermsAcceptance,
    TrainerProfile,
    TrainerUnavailability,
    User,
    WeightEntry,
    WompiEvent,
)
from core_app.models.terms_acceptance import CURRENT_TERMS_VERSION

MOOD_NOTES = [
    'Con buena energía hoy.',
    'Un poco cansado pero motivado.',
    'Sentí una molestia leve en la rodilla.',
    'Día tranquilo, dormí bien.',
    'Algo de dolor de espalda después de trabajar.',
    'Muy contento con el progreso.',
    '',
]

UNAVAILABILITY_REASONS = [
    'Día personal.',
    'Capacitación externa.',
    'Feriado.',
]

WOMPI_STATUSES = ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR']

CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena']
SEXES = [CustomerProfile.Sex.MASCULINO, CustomerProfile.Sex.FEMENINO]
GOALS = [
    CustomerProfile.Goal.FAT_LOSS,
    CustomerProfile.Goal.MUSCLE_GAIN,
    CustomerProfile.Goal.GENERAL_HEALTH,
    CustomerProfile.Goal.SPORTS_PERFORMANCE,
]


class Command(BaseCommand):
    help = 'Create fake tracking data (mood, weight, profiles, renewals, terms, webhooks)'

    def add_arguments(self, parser):
        parser.add_argument('--mood-days', type=int, default=30,
                            help='Recent days of mood entries per customer (default: 30).')
        parser.add_argument('--weight-weeks', type=int, default=8,
                            help='Weekly weight entries per customer (default: 8).')
        parser.add_argument('--unavailability', type=int, default=2,
                            help='Blocked future days per trainer (default: 2).')
        parser.add_argument('--wompi-events', type=int, default=5,
                            help='Number of Wompi webhook events to create (default: 5).')
        parser.add_argument('--seed', type=int, default=None,
                            help='Random seed for reproducible tracking data.')
        parser.add_argument('--reset', action='store_true', default=False,
                            help='Delete existing tracking rows before creating new ones.')

    def handle(self, *args, **options):
        seed = options.get('seed')
        if seed is not None:
            random.seed(seed)

        mood_days = max(int(options['mood_days']), 1)
        weight_weeks = max(int(options['weight_weeks']), 1)
        unavailability = max(int(options['unavailability']), 0)
        wompi_events = max(int(options['wompi_events']), 0)

        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        trainers = list(TrainerProfile.objects.all())
        subscriptions = list(Subscription.objects.select_related('package').all())
        users = list(User.objects.filter(role__in=[User.Role.CUSTOMER, User.Role.TRAINER]))

        if options['reset']:
            self._reset(customers, trainers)

        counts = {
            'mood_entries': 0, 'weight_entries': 0, 'profiles_enriched': 0,
            'unavailabilities': 0, 'renewals': 0, 'terms': 0, 'wompi_events': 0,
        }
        today = timezone.localdate()
        now = timezone.now()

        for customer in customers:
            counts['mood_entries'] += self._create_mood(customer, today, mood_days)
            counts['weight_entries'] += self._create_weight(customer, today, weight_weeks)
            counts['profiles_enriched'] += self._enrich_profile(customer)

        for trainer in trainers:
            counts['unavailabilities'] += self._create_unavailability(trainer, today, unavailability)

        for subscription in subscriptions:
            counts['renewals'] += self._create_renewal(subscription)

        for user in users:
            counts['terms'] += self._create_terms(user, now)

        counts['wompi_events'] += self._create_wompi_events(wompi_events)

        self.stdout.write(self.style.SUCCESS('Tracking data:'))
        self.stdout.write(f"- mood_entries_created: {counts['mood_entries']}")
        self.stdout.write(f"- weight_entries_created: {counts['weight_entries']}")
        self.stdout.write(f"- profiles_enriched: {counts['profiles_enriched']}")
        self.stdout.write(f"- unavailabilities_created: {counts['unavailabilities']}")
        self.stdout.write(f"- subscription_renewals_created: {counts['renewals']}")
        self.stdout.write(f"- terms_acceptances_created: {counts['terms']}")
        self.stdout.write(f"- wompi_events_created: {counts['wompi_events']}")

    # ──────────────────────────── helpers ────────────────────────────

    @staticmethod
    def _reset(customers, trainers):
        customer_ids = [c.pk for c in customers]
        trainer_ids = [t.pk for t in trainers]
        MoodEntry.objects.filter(user_id__in=customer_ids).delete()
        WeightEntry.objects.filter(user_id__in=customer_ids).delete()
        TrainerUnavailability.objects.filter(trainer_id__in=trainer_ids).delete()
        SubscriptionRenewal.objects.all().delete()
        TermsAcceptance.objects.filter(terms_version=CURRENT_TERMS_VERSION).delete()
        WompiEvent.objects.filter(transaction_id__startswith='wompi-fake-').delete()

    def _create_mood(self, customer, today, mood_days):
        created = 0
        for offset in range(mood_days):
            entry_date = today - timedelta(days=mood_days - 1 - offset)
            _, was_created = MoodEntry.objects.get_or_create(
                user=customer,
                date=entry_date,
                defaults={
                    'score': random.randint(4, 10),
                    'notes': random.choice(MOOD_NOTES),
                },
            )
            if was_created:
                created += 1
        return created

    def _create_weight(self, customer, today, weight_weeks):
        created = 0
        base_weight = Decimal(str(random.randint(55, 95)))
        for week in range(weight_weeks):
            entry_date = today - timedelta(days=7 * (weight_weeks - 1 - week))
            # Small downward trend with noise (kept within a realistic band).
            drift = Decimal(str(round(random.uniform(-1.5, 0.5), 1)))
            weight = base_weight + drift * week
            _, was_created = WeightEntry.objects.get_or_create(
                user=customer,
                date=entry_date,
                defaults={'weight_kg': weight.quantize(Decimal('0.1'))},
            )
            if was_created:
                created += 1
        return created

    def _enrich_profile(self, customer):
        profile = CustomerProfile.objects.filter(user=customer).first()
        if profile is None:
            return 0
        if profile.profile_completed:
            return 0
        profile.sex = profile.sex or random.choice(SEXES)
        profile.city = profile.city or random.choice(CITIES)
        profile.primary_goal = profile.primary_goal or random.choice(GOALS)
        if profile.date_of_birth is None:
            year = random.randint(1975, 2004)
            profile.date_of_birth = date(year, random.randint(1, 12), random.randint(1, 28))
        if not profile.id_type:
            profile.id_type = CustomerProfile.IdType.CC
            profile.id_number = str(random.randint(1_000_000_000, 1_099_999_999))
        profile.save()
        return 1

    def _create_unavailability(self, trainer, today, unavailability):
        created = 0
        for i in range(unavailability):
            blocked_date = today + timedelta(days=7 * (i + 1))
            _, was_created = TrainerUnavailability.objects.get_or_create(
                trainer=trainer,
                date=blocked_date,
                defaults={'reason': random.choice(UNAVAILABILITY_REASONS)},
            )
            if was_created:
                created += 1
        return created

    def _create_renewal(self, subscription):
        _, was_created = SubscriptionRenewal.objects.get_or_create(
            subscription=subscription,
            kind=SubscriptionRenewal.Kind.INITIAL,
            defaults={
                'period_start': subscription.starts_at,
                'period_end': subscription.expires_at,
                'sessions_granted': subscription.sessions_total,
                'package': subscription.package,
                'note': 'Compra inicial (fake data).',
            },
        )
        return 1 if was_created else 0

    def _create_terms(self, user, now):
        _, was_created = TermsAcceptance.objects.get_or_create(
            user=user,
            terms_version=CURRENT_TERMS_VERSION,
            defaults={
                'ip_address': '127.0.0.1',
                'user_agent': 'FakeDataSeeder/1.0',
                'accepted_at': now,
            },
        )
        return 1 if was_created else 0

    def _create_wompi_events(self, wompi_events):
        created = 0
        for i in range(wompi_events):
            _, was_created = WompiEvent.objects.get_or_create(
                transaction_id=f'wompi-fake-{i:04d}',
                defaults={'status': random.choice(WOMPI_STATUSES)},
            )
            if was_created:
                created += 1
        return created
