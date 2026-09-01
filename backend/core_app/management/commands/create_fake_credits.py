"""Create fake credit-economy data for development and QA staging.

Populates the Fase 2 domain that ``create_fake_data`` previously omitted:
CreditSettings (materialized via the real ``credit_engine.get_settings``),
the CreditPackage / StoreItem / NutritionProduct catalogs, per-customer
CreditWallet + CreditTransaction ledgers, attendance outcomes on past
bookings, SessionRating rows, RedemptionRequest flows (including the
auto-fulfilled "sesión adicional" grant, mirroring ``store_views``) and
approved CreditPurchase top-ups (mirroring the Wompi webhook).

Every wallet mutation goes through ``credit_engine`` (``award`` / ``spend`` /
``record_attendance`` / ``refund_redemption``) so balances stay consistent
with the confirmed ledger by construction. Streak fields are the one
exception: in production they derive from daily logs, so this command sets
plausible presentation values directly for QA.

Deterministic by design: which customer gets attendance/ratings/purchases/
redemptions follows index rules, not randomness; ``--seed`` only varies
flavor (scores, comments, item choice). Re-running is safe: ledger writes
are idempotent per reference (``uq_credit_tx_reference``), catalogs use
``get_or_create`` and redemptions are capped at one per customer.

Run after ``create_fake_bookings`` (attendance and ratings need past
confirmed bookings).
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import User
from core_app.models.booking import Booking
from core_app.models.credit import CreditTransaction
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.models.nutrition_product import NutritionProduct
from core_app.models.session_grant import SessionGrant
from core_app.models.session_rating import SessionRating
from core_app.models.store import RedemptionRequest, StoreItem
from core_app.services import credit_engine

CREDIT_PACKAGES = [
    {'name': 'Paquete Inicio', 'credits': 50, 'price_cop': 45000},
    {'name': 'Paquete Impulso', 'credits': 120, 'price_cop': 95000},
    {'name': 'Paquete Pro', 'credits': 300, 'price_cop': 210000},
]

STORE_ITEMS = [
    {
        'name': 'Sesión de recuperación asistida',
        'description': 'Sesión de estiramiento y liberación miofascial guiada por tu trainer.',
        'price_credits': 80,
        'item_type': StoreItem.ItemType.SERVICIO,
    },
    {
        'name': 'Asesoría nutricional express',
        'description': 'Revisión de 30 minutos de tu plan de alimentación con ajustes prácticos.',
        'price_credits': 60,
        'item_type': StoreItem.ItemType.SERVICIO,
    },
    {
        'name': 'Camiseta KÓRE',
        'description': 'Camiseta oficial de entrenamiento KÓRE (talla a elección).',
        'price_credits': 120,
        'item_type': StoreItem.ItemType.PRODUCTO,
    },
    {
        'name': 'Shaker KÓRE',
        'description': 'Vaso mezclador oficial de 700 ml.',
        'price_credits': 70,
        'item_type': StoreItem.ItemType.PRODUCTO,
    },
    {
        'name': 'Sesión adicional',
        'description': 'Una sesión extra de entrenamiento fuera de tu plan, válida por 30 días.',
        'price_credits': 150,
        'item_type': StoreItem.ItemType.SESION,
        'sessions_granted': 1,
    },
]

DAILY_ACTIONS = {
    CreditTransaction.Action.CHECKIN: 'Check-in diario completado',
    CreditTransaction.Action.WORKOUT_DAY: 'Completaste tu entrenamiento del día',
    CreditTransaction.Action.MEAL_PHOTO: 'Registraste una comida con foto',
    CreditTransaction.Action.WATER_GOAL: 'Cumpliste tu meta de hidratación',
}

RATING_COMMENTS = [
    'Excelente sesión, terminé con mucha energía.',
    'Buen ritmo, aunque quedé bastante cansado.',
    'Me gustó el enfoque en técnica.',
    '',
]


class Command(BaseCommand):
    help = 'Create fake credit-economy data (wallets, ledger, store, ratings, top-ups)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=7,
            help='Days of daily-action ledger history per customer (default: 7).',
        )
        parser.add_argument(
            '--seed', type=int, default=None,
            help='Random seed for reproducible flavor (scores, comments, item choice).',
        )

    def handle(self, *args, **options):
        rng = random.Random(options['seed'])
        days = max(1, options['days'])
        now = timezone.now()
        today = timezone.localdate()

        settings_obj = credit_engine.get_settings()
        self.stdout.write(f'Credit settings ready (difficulty: {settings_obj.difficulty})')

        packages = self._seed_catalogs()

        customers = list(
            User.objects.filter(role=User.Role.CUSTOMER, email__endswith='@kore.com')
            .order_by('id')
        )
        if not customers:
            self.stdout.write(self.style.WARNING(
                'No fake customers (@kore.com) found — seeded catalogs only.'
            ))
            return

        trainer_user = (
            User.objects.filter(role=User.Role.TRAINER).order_by('id').first()
        )

        awards = self._seed_daily_actions(customers, days, today, rng)
        attended, no_shows = self._seed_attendance(customers, now)
        ratings = self._seed_ratings(customers, rng)
        purchases = self._seed_purchases(customers, packages, rng)
        redemptions, grants, rejected = self._seed_redemptions(customers, trainer_user, rng)
        streaks = self._seed_streaks(customers, today, rng)

        self.stdout.write(self.style.SUCCESS('Fake credit-economy data created:'))
        self.stdout.write(f'- customers with wallet activity: {len(customers)}')
        self.stdout.write(f'- daily-action ledger entries: {awards}')
        self.stdout.write(f'- attendance recorded: {attended} attended / {no_shows} no-show')
        self.stdout.write(f'- session ratings: {ratings}')
        self.stdout.write(f'- approved credit purchases: {purchases}')
        self.stdout.write(f'- redemptions: {redemptions} (session grants: {grants}, rejected+refunded: {rejected})')
        self.stdout.write(f'- streak presentation-state set for: {streaks} customers')

    def _seed_catalogs(self):
        packages = []
        for spec in CREDIT_PACKAGES:
            pkg, _ = CreditPackage.objects.get_or_create(
                name=spec['name'],
                defaults={'credits': spec['credits'], 'price_cop': spec['price_cop']},
            )
            packages.append(pkg)

        for spec in STORE_ITEMS:
            StoreItem.objects.get_or_create(
                name=spec['name'],
                defaults={
                    'description': spec['description'],
                    'price_credits': spec['price_credits'],
                    'item_type': spec['item_type'],
                    'sessions_granted': spec.get('sessions_granted', 1),
                },
            )

        NutritionProduct.objects.get_or_create(
            name='Nutrición', defaults={'price_cop': 60000},
        )
        self.stdout.write(
            f'Catalogs ready: {CreditPackage.objects.count()} credit packages, '
            f'{StoreItem.objects.count()} store items, '
            f'{NutritionProduct.objects.count()} nutrition products'
        )
        return packages

    def _seed_daily_actions(self, customers, days, today, rng):
        created = 0
        for customer in customers:
            for offset in range(days):
                day = today - timedelta(days=offset)
                for action, description in DAILY_ACTIONS.items():
                    # Flavor-only randomness: skip ~1/4 of entries so histories differ.
                    if rng.random() < 0.25:
                        continue
                    tx = credit_engine.award(
                        customer, action, 'fake_seed',
                        f'{action}-{day.isoformat()}', description,
                    )
                    if tx is not None:
                        created += 1
        return created

    def _seed_attendance(self, customers, now):
        attended = no_shows = 0
        for customer in customers:
            past = list(
                Booking.objects.filter(
                    customer=customer,
                    status=Booking.Status.CONFIRMED,
                    attendance_status=Booking.AttendanceStatus.UNSET,
                    starts_at__lt=now,
                ).order_by('starts_at')[:4]
            )
            for index, booking in enumerate(past):
                # Deterministic rule: every 4th past booking is a no-show.
                is_attended = index % 4 != 3
                credit_engine.record_attendance(booking, attended=is_attended)
                if is_attended:
                    attended += 1
                else:
                    no_shows += 1
        return attended, no_shows

    def _seed_ratings(self, customers, rng):
        created = 0
        for customer in customers:
            rateable = Booking.objects.filter(
                customer=customer,
                attendance_status=Booking.AttendanceStatus.ATTENDED,
            ).order_by('-starts_at')[:2]
            for booking in rateable:
                _, was_created = SessionRating.objects.get_or_create(
                    booking=booking,
                    rater_role=SessionRating.RaterRole.CUSTOMER,
                    defaults={
                        'score': rng.randint(3, 5),
                        'comment': rng.choice(RATING_COMMENTS),
                    },
                )
                if was_created:
                    created += 1
                    credit_engine.award(
                        booking.customer,
                        CreditTransaction.Action.SESSION_RATED,
                        'booking', booking.pk, 'Calificaste tu sesión',
                    )
        return created

    def _seed_purchases(self, customers, packages, rng):
        created = 0
        for customer in customers[:3]:
            package = rng.choice(packages)
            purchase, was_created = CreditPurchase.objects.get_or_create(
                reference=f'FAKE-TOPUP-{customer.pk}',
                defaults={
                    'customer': customer,
                    'credit_package': package,
                    'credits': package.credits,
                    'amount_cop': package.price_cop,
                    'wompi_transaction_id': f'fake-wompi-{customer.pk}',
                    'status': CreditPurchase.Status.APPROVED,
                    'resolved_at': timezone.now(),
                },
            )
            if was_created:
                created += 1
                credit_engine.award(
                    customer, CreditTransaction.Action.PURCHASE,
                    'credit_purchase', purchase.pk,
                    f'Compra de {purchase.credits} créditos ({package.name})',
                    amount=purchase.credits,
                )
        return created

    def _seed_redemptions(self, customers, trainer_user, rng):
        """One redemption per even-indexed customer that can afford an item.

        Mirrors ``store_views.RedemptionView.post``: create the request, spend
        through the engine (rollback if insufficient), auto-fulfill session
        items with a SessionGrant. The first non-session redemption is
        fulfilled by the trainer and the second is rejected (refund) so QA
        sees every status.
        """
        created = grants = rejected = 0
        pending_requests = []
        for index, customer in enumerate(customers):
            if index % 2 == 1:
                continue
            if RedemptionRequest.objects.filter(customer=customer).exists():
                continue
            wallet = credit_engine.get_wallet(customer)
            affordable = [
                item for item in StoreItem.objects.filter(is_active=True)
                if item.price_credits <= wallet.balance
            ]
            if not affordable:
                continue
            item = rng.choice(affordable)
            request = RedemptionRequest.objects.create(
                customer=customer, item=item, credits_spent=item.price_credits,
            )
            tx = credit_engine.spend(
                customer, item.price_credits, 'redemption_request', request.pk,
                f'Canje: {item.name}',
            )
            if tx is None:
                request.delete()
                continue
            created += 1
            if item.item_type == StoreItem.ItemType.SESION:
                SessionGrant.objects.create(
                    customer=customer,
                    sessions_total=item.sessions_granted,
                    expires_at=timezone.now() + timedelta(days=30),
                    source_redemption=request,
                )
                request.status = RedemptionRequest.Status.FULFILLED
                request.resolved_at = timezone.now()
                request.save(update_fields=['status', 'resolved_at', 'updated_at'])
                grants += 1
            else:
                pending_requests.append(request)

        if pending_requests and trainer_user is not None:
            fulfilled = pending_requests[0]
            fulfilled.status = RedemptionRequest.Status.FULFILLED
            fulfilled.trainer_note = 'Entregado en recepción.'
            fulfilled.resolved_by = trainer_user
            fulfilled.resolved_at = timezone.now()
            fulfilled.save(update_fields=[
                'status', 'trainer_note', 'resolved_by', 'resolved_at', 'updated_at',
            ])
            if len(pending_requests) > 1:
                if credit_engine.refund_redemption(
                    pending_requests[1], trainer_user,
                    'Sin disponibilidad este mes — créditos devueltos.',
                ):
                    rejected += 1
        return created, grants, rejected

    def _seed_streaks(self, customers, today, rng):
        updated = 0
        for index, customer in enumerate(customers):
            if index % 3 != 0:
                continue
            wallet = credit_engine.get_wallet(customer)
            wallet.current_streak = rng.randint(2, 9)
            wallet.longest_streak = max(wallet.current_streak, rng.randint(9, 15))
            wallet.last_active_date = today
            wallet.save(update_fields=[
                'current_streak', 'longest_streak', 'last_active_date', 'updated_at',
            ])
            updated += 1
        return updated
