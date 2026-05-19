"""Create a deep historical journey for a single spotlight customer.

Produces ~6 months of coherent data (subscriptions + renewals, bookings,
payments, evaluations with progression, notifications) for a specific
customer, replacing any prior data they had from the random fake-data
pipeline.

Respects business rules:
- WEEKLY_SCHEDULE windows (Mon-Fri 05-13/16-21, Sat 06-13).
- 15-min grid, 60-min sessions.
- Trainer travel buffer (±45 min) — no clash with existing trainer bookings.
- MAX_ROLLOVER_SESSIONS=2 cap.
- PAR-Q cooldown (90 days), nutrition cooldown (7 days).
- All evaluations auto-compute their indices on save().
"""

from __future__ import annotations

import random
import uuid
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core_app.models import (
    AnthropometryEvaluation,
    Booking,
    Notification,
    NutritionHabit,
    Package,
    ParqAssessment,
    Payment,
    PhysicalEvaluation,
    PosturometryEvaluation,
    Subscription,
    TrainerProfile,
    User,
)
from core_app.services.slot_schedule import (
    BUSINESS_TZ,
    MAX_ROLLOVER_SESSIONS,
    TRAVEL_BUFFER_MINUTES,
    WEEKLY_SCHEDULE,
)


CANCEL_REASONS = [
    'Cambio de horario laboral.',
    'Reagendé para otro día.',
    'Viaje de último momento.',
    'Asunto familiar imprevisto.',
]

PAST_NOTES = [
    'Sesión enfocada en tren inferior.',
    'Trabajo de movilidad articular y core.',
    'Fuerza funcional + cardio HIIT 20 min.',
    'Rutina de hombros y espalda.',
    'Sentadillas, peso muerto y plancha.',
    'Movilidad cadera + estiramientos largos.',
    '',
]

FUTURE_OBJECTIVES = [
    'Trabajar fuerza explosiva en piernas.',
    'Movilidad torácica y postura.',
    'Capacidad aeróbica progresiva.',
    'Core profundo y estabilidad lumbar.',
]


# Anthropometry progression: 4 evaluations showing realistic improvement
# (weight_kg, height_cm, waist_cm, hip_cm)
ANTHRO_PROGRESSION = [
    (Decimal('78.0'), Decimal('172.0'), Decimal('92.0'), Decimal('104.0')),
    (Decimal('75.5'), Decimal('172.0'), Decimal('88.0'), Decimal('102.0')),
    (Decimal('73.0'), Decimal('172.0'), Decimal('85.0'), Decimal('100.0')),
    (Decimal('71.0'), Decimal('172.0'), Decimal('82.0'), Decimal('99.0')),
]

# Perimeters per evaluation: arms/forearm/wrist/chest/thigh/calf/ankle
# Slightly decreasing fat-related, slightly increasing muscle (calves/forearm)
PERIMETER_PROGRESSION = [
    (32.0, 31.5, 34.0, 33.5, 27.0, 26.5, 17.0, 17.0, 102.0, 60.0, 59.5, 38.0, 37.5, 22.5, 22.5),
    (30.5, 30.0, 33.0, 32.5, 26.5, 26.0, 16.8, 16.8, 98.0, 58.0, 57.5, 38.0, 37.5, 22.5, 22.5),
    (29.5, 29.0, 32.5, 32.0, 26.5, 26.0, 16.5, 16.5, 95.0, 56.5, 56.0, 38.0, 37.5, 22.5, 22.5),
    (28.5, 28.0, 32.0, 31.5, 26.0, 25.5, 16.5, 16.5, 92.0, 55.0, 54.5, 37.5, 37.0, 22.0, 22.0),
]

# Skinfolds per evaluation: shrinking adipose tissue
SKINFOLD_PROGRESSION = [
    (18.0, 18.0, 11.0, 11.0, 18.0, 18.0, 22.0, 22.0, 20.0, 26.0, 24.0, 24.0, 16.0, 16.0),
    (15.5, 15.5, 9.5, 9.5, 15.5, 15.5, 19.0, 19.0, 17.0, 22.0, 21.0, 21.0, 14.0, 14.0),
    (13.5, 13.5, 8.5, 8.5, 13.5, 13.5, 16.0, 16.0, 14.5, 19.0, 19.0, 19.0, 12.5, 12.5),
    (12.0, 12.0, 7.5, 7.5, 11.5, 11.5, 14.0, 14.0, 12.0, 16.0, 17.5, 17.5, 11.5, 11.5),
]

# Physical evaluation progression: improving strength, endurance, mobility
# (squats, pushups, plank_s, walk_m, unipodal_s, hip_mob, shoulder_mob, ankle_mob)
PHYSICAL_PROGRESSION = [
    (18, 8, 45, 480, 20, 3, 3, 3),
    (24, 14, 70, 520, 30, 3, 4, 3),
    (30, 20, 95, 560, 40, 4, 4, 4),
    (36, 26, 120, 600, 50, 4, 5, 4),
]

# Posturometry progression: severity 2 (initial issues) → 1 → 0 (mostly resolved)
POSTURO_PROGRESSION = [
    {'severity': 2, 'normal_segments': 3},
    {'severity': 1, 'normal_segments': 5},
    {'severity': 0, 'normal_segments': 7},
]

# Nutrition progression: 26 weekly entries showing habit improvement
# Each tuple: (meals, water_L, fruit_w, veg_w, protein_freq, ultra_w, sugar_w, breakfast)
def _nutrition_for_week(week_index: int, total_weeks: int) -> tuple:
    """Generate a nutrition tuple with linear progression across total_weeks."""
    progress = week_index / max(total_weeks - 1, 1)
    meals = 3 + round(progress * 2)                       # 3 → 5
    water = Decimal('1.5') + Decimal(str(round(progress * 1.0, 1)))  # 1.5 → 2.5
    fruit = round(4 + progress * 11)                      # 4 → 15
    veg = round(5 + progress * 10)                        # 5 → 15
    protein = 2 + round(progress * 2)                     # 2 → 4
    ultra = round(12 - progress * 8)                      # 12 → 4
    sugar = round(10 - progress * 8)                      # 10 → 2
    breakfast = progress > 0.3                            # False early, True later
    return (meals, water, fruit, veg, protein, ultra, sugar, breakfast)


def _build_posture_view(severity: int, normal_segments: int) -> dict:
    """Build a posture-view JSON dict with the given severity for non-normal segments."""
    all_segments = ['cabeza', 'cuello', 'hombros', 'columna', 'cadera', 'rodillas', 'pies']
    is_normal = severity == 0
    result = {}
    for idx, seg in enumerate(all_segments):
        if idx < normal_segments or is_normal:
            result[seg] = {'is_normal': True, 'severity': 0, 'sub_fields': {}}
        else:
            result[seg] = {'is_normal': False, 'severity': severity, 'sub_fields': {}}
    return result


class Command(BaseCommand):
    help = (
        'Create a deep historical journey (~6 months) for a single spotlight '
        'customer with coherent subscriptions, bookings, payments, and '
        'evaluation progression.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True,
                            help='Customer email (must already exist).')
        parser.add_argument('--months', type=int, default=6,
                            help='Months of history to generate (default: 6).')
        parser.add_argument('--trainer-email', type=str,
                            default='german.franco@kore.com',
                            help='Trainer email to assign as evaluator and session leader.')
        parser.add_argument('--seed', type=int, default=42,
                            help='Random seed for reproducibility.')

    def handle(self, *args, **options):
        random.seed(options['seed'])
        email = options['email']
        months = max(int(options['months']), 1)
        trainer_email = options['trainer_email']

        try:
            customer = User.objects.get(email=email, role=User.Role.CUSTOMER)
        except User.DoesNotExist:
            raise CommandError(
                f"Customer '{email}' not found (must have role=customer). "
                f"Run create_fake_users first."
            )

        try:
            trainer = TrainerProfile.objects.select_related('user').get(
                user__email=trainer_email,
            )
        except TrainerProfile.DoesNotExist:
            raise CommandError(
                f"TrainerProfile for '{trainer_email}' not found. "
                f"Run create_fake_trainers first."
            )

        package_basic = self._find_package(['Básico', 'Basico'])
        package_continuidad = self._find_package(['Continuidad'])
        package_avance = self._find_package(['Avance'])

        if not all([package_basic, package_continuidad, package_avance]):
            raise CommandError(
                'Required packages (Básico, Continuidad, Avance) not found. '
                'Run create_fake_packages first.'
            )

        with transaction.atomic():
            self._reset_customer_data(customer)

            if customer.assigned_trainer_id != trainer.id:
                customer.assigned_trainer = trainer
                customer.save(update_fields=['assigned_trainer'])

            subscriptions = self._create_subscription_timeline(
                customer, trainer, package_basic, package_continuidad,
                package_avance, months,
            )

            sub_payments = self._create_subscription_payments(customer, subscriptions)

            bookings, booking_payments = self._create_bookings(
                customer, trainer, subscriptions,
            )

            self._create_evaluations(customer, trainer)

            notification_count = self._create_notifications(
                customer, subscriptions, sub_payments, bookings, booking_payments,
            )

        self.stdout.write(self.style.SUCCESS('Spotlight customer history:'))
        self.stdout.write(f'- customer: {customer.email}')
        self.stdout.write(f'- trainer: {trainer.user.email}')
        self.stdout.write(f'- subscriptions: {len(subscriptions)} (last: {subscriptions[-1].status})')
        self.stdout.write(f'- bookings: {len(bookings)}')
        self.stdout.write(f'- payments: {len(sub_payments) + len(booking_payments)}')
        self.stdout.write(f'- notifications: {notification_count}')
        self.stdout.write(f'- evaluations: anthro=4, physical=4, posturo=3, parq=2, nutrition=26')

    # ──────────────────────────── helpers ────────────────────────────

    @staticmethod
    def _find_package(title_keywords):
        for kw in title_keywords:
            pkg = (
                Package.objects.filter(title__icontains=kw, is_active=True)
                .order_by('order', 'id')
                .first()
            )
            if pkg:
                return pkg
        return None

    @staticmethod
    def _reset_customer_data(customer):
        """Delete all customer-owned data so the journey starts from a clean slate."""
        Notification.objects.filter(
            booking__customer=customer,
        ).delete()
        Notification.objects.filter(
            payment__customer=customer,
        ).delete()
        Payment.objects.filter(customer=customer).delete()
        Booking.objects.filter(customer=customer).delete()
        Subscription.objects.filter(customer=customer).delete()
        AnthropometryEvaluation.objects.filter(customer=customer).delete()
        PosturometryEvaluation.objects.filter(customer=customer).delete()
        PhysicalEvaluation.objects.filter(customer=customer).delete()
        ParqAssessment.objects.filter(customer=customer).delete()
        NutritionHabit.objects.filter(customer=customer).delete()

    def _create_subscription_timeline(
        self, customer, trainer, package_basic, package_continuidad,
        package_avance, months,
    ):
        """Build 6 cycles ending in an ACTIVE subscription today."""
        cycle_days = 30
        now = timezone.now()
        # Sub N (current) expires +5 days from now, starts today-25.
        # Earlier cycles step back by cycle_days each.
        total_cycles = months  # 1 cycle per month

        plan = []
        # Define each cycle's package/recurring/usage starting from the OLDEST
        for i in range(total_cycles):
            if i == 0:
                pkg = package_basic
                recurring = False
            elif i == total_cycles - 1:
                pkg = package_avance
                recurring = True
            else:
                pkg = package_continuidad
                recurring = True
            plan.append((pkg, recurring))

        subscriptions = []
        rollover_carry = 0

        for idx, (pkg, recurring) in enumerate(plan):
            is_current = idx == total_cycles - 1
            cycles_back = total_cycles - 1 - idx
            # Current sub: starts -25, expires +5 (mostly within cycle, ends slightly future)
            # Older subs: shift by cycle_days each
            expires_at = now + timedelta(days=5) - timedelta(days=cycle_days * cycles_back)
            starts_at = expires_at - timedelta(days=cycle_days)

            rollover = min(rollover_carry, MAX_ROLLOVER_SESSIONS)
            sessions_total = pkg.sessions_count + rollover

            if is_current:
                sessions_used = max(int(sessions_total * 0.45), 1)  # ~45% used so far
                status = Subscription.Status.ACTIVE
                next_billing_date = expires_at.date()
            else:
                # Older subs: use most sessions, leave 0-1 unused for realism
                unused = 1 if recurring else 0
                sessions_used = max(sessions_total - unused, 1)
                status = Subscription.Status.EXPIRED
                next_billing_date = None

            sub = Subscription.objects.create(
                customer=customer,
                package=pkg,
                sessions_total=sessions_total,
                sessions_used=sessions_used,
                status=status,
                starts_at=starts_at,
                expires_at=expires_at,
                payment_source_id='wompi-src-spotlight-stub' if recurring else '',
                payment_method_type='CARD' if recurring else '',
                is_recurring=recurring,
                wompi_transaction_id=f'wompi-tx-{uuid.uuid4().hex[:12]}',
                next_billing_date=next_billing_date,
            )
            subscriptions.append(sub)

            rollover_carry = sessions_total - sessions_used if recurring else 0

        return subscriptions

    def _create_subscription_payments(self, customer, subscriptions):
        """One CONFIRMED payment per subscription (initial purchase / renewal)."""
        payments = []
        for sub in subscriptions:
            ref = f'wompi-sub-{uuid.uuid4().hex[:12]}'
            payment = Payment.objects.create(
                customer=customer,
                subscription=sub,
                status=Payment.Status.CONFIRMED,
                amount=sub.package.price,
                currency=sub.package.currency,
                provider=Payment.Provider.WOMPI,
                provider_reference=ref,
                confirmed_at=sub.starts_at + timedelta(hours=1),
                metadata={'source': 'spotlight_history', 'wompi_reference': ref},
            )
            payments.append(payment)
        return payments

    def _create_bookings(self, customer, trainer, subscriptions):
        """Create bookings for each subscription within its window, respecting schedule and trainer overlap."""
        bookings = []
        booking_payments = []
        now = timezone.now()
        buffer = timedelta(minutes=TRAVEL_BUFFER_MINUTES)

        # Preload trainer's existing booking windows (from random fake data, other customers)
        used_slots = list(
            Booking.objects.filter(
                trainer=trainer,
                status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED),
            ).values_list('starts_at', 'ends_at')
        )

        for sub_idx, sub in enumerate(subscriptions):
            is_current = sub_idx == len(subscriptions) - 1
            is_recurring = sub.is_recurring

            # How many bookings to create for this sub?
            # Sub past: sessions_used confirmed past + ~1 canceled past
            # Sub current: sessions_used past confirmed + 4 future confirmed + 1 future canceled
            confirmed_past = sub.sessions_used
            canceled_past = 1 if is_recurring else 0
            future_confirmed = 4 if is_current else 0
            future_canceled = 1 if is_current else 0

            # Past bookings — distribute uniformly across [starts_at, min(expires_at, now)]
            past_window_start = sub.starts_at
            past_window_end = min(sub.expires_at, now)

            for i in range(confirmed_past):
                slot = self._find_slot_in_window(
                    past_window_start, past_window_end, used_slots, buffer,
                )
                if slot is None:
                    continue
                b = self._create_booking(
                    customer=customer, trainer=trainer, sub=sub,
                    starts_at=slot[0], ends_at=slot[1],
                    status=Booking.Status.CONFIRMED,
                    notes=random.choice(PAST_NOTES),
                )
                bookings.append(b)
                used_slots.append(slot)
                booking_payments.append(self._payment_for_booking(b))

            for _ in range(canceled_past):
                slot = self._find_slot_in_window(
                    past_window_start, past_window_end, used_slots, buffer,
                )
                if slot is None:
                    continue
                b = self._create_booking(
                    customer=customer, trainer=trainer, sub=sub,
                    starts_at=slot[0], ends_at=slot[1],
                    status=Booking.Status.CANCELED,
                    notes='', canceled_reason=random.choice(CANCEL_REASONS),
                )
                bookings.append(b)
                used_slots.append(slot)
                booking_payments.append(self._payment_for_booking(b))

            # Future bookings for the current (active) sub
            future_window_start = now + timedelta(hours=24)
            future_window_end = sub.expires_at + timedelta(days=20)  # extend slightly

            for i in range(future_confirmed):
                slot = self._find_slot_in_window(
                    future_window_start, future_window_end, used_slots, buffer,
                )
                if slot is None:
                    continue
                b = self._create_booking(
                    customer=customer, trainer=trainer, sub=sub,
                    starts_at=slot[0], ends_at=slot[1],
                    status=Booking.Status.CONFIRMED,
                    notes='',
                    session_objective=random.choice(FUTURE_OBJECTIVES),
                )
                bookings.append(b)
                used_slots.append(slot)

            for _ in range(future_canceled):
                slot = self._find_slot_in_window(
                    future_window_start, future_window_end, used_slots, buffer,
                )
                if slot is None:
                    continue
                b = self._create_booking(
                    customer=customer, trainer=trainer, sub=sub,
                    starts_at=slot[0], ends_at=slot[1],
                    status=Booking.Status.CANCELED,
                    notes='', canceled_reason=random.choice(CANCEL_REASONS),
                )
                bookings.append(b)
                used_slots.append(slot)

        return bookings, booking_payments

    @staticmethod
    def _find_slot_in_window(window_start, window_end, used_slots, buffer):
        """Find a 60-min slot in [window_start, window_end] respecting WEEKLY_SCHEDULE
        and not clashing with used_slots (±buffer for trainer travel)."""
        if window_end <= window_start:
            return None
        session = timedelta(minutes=60)

        for _ in range(80):
            total_seconds = int((window_end - window_start).total_seconds())
            if total_seconds <= 0:
                return None
            offset_seconds = random.randint(0, total_seconds - 1)
            candidate_utc = window_start + timedelta(seconds=offset_seconds)
            candidate_local = candidate_utc.astimezone(BUSINESS_TZ)
            weekday = candidate_local.weekday()
            windows = WEEKLY_SCHEDULE.get(weekday, [])
            if not windows:
                continue
            start_hour, end_hour = random.choice(windows)
            minute = random.choice([0, 15, 30, 45])
            hour = random.randint(start_hour, max(end_hour - 1, start_hour))
            candidate_local = datetime.combine(
                candidate_local.date(), time(hour, minute), tzinfo=BUSINESS_TZ,
            )
            ends_local = candidate_local + session
            window_end_local = datetime.combine(
                candidate_local.date(), time(end_hour), tzinfo=BUSINESS_TZ,
            )
            if ends_local > window_end_local:
                continue
            starts_utc = candidate_local.astimezone(dt_timezone.utc)
            ends_utc = ends_local.astimezone(dt_timezone.utc)
            if starts_utc < window_start or ends_utc > window_end:
                continue

            # Check trainer-overlap (±buffer)
            clash = False
            for s, e in used_slots:
                if starts_utc < e + buffer and ends_utc > s - buffer:
                    clash = True
                    break
            if clash:
                continue
            return (starts_utc, ends_utc)
        return None

    @staticmethod
    def _create_booking(*, customer, trainer, sub, starts_at, ends_at,
                        status, notes='', canceled_reason='', session_objective=''):
        return Booking.objects.create(
            customer=customer,
            package=sub.package,
            trainer=trainer,
            subscription=sub,
            starts_at=starts_at,
            ends_at=ends_at,
            status=status,
            notes=notes,
            canceled_reason=canceled_reason,
            session_objective=session_objective,
        )

    @staticmethod
    def _payment_for_booking(booking):
        """Create a payment record matching the booking outcome."""
        if booking.status == Booking.Status.CANCELED:
            pay_status = Payment.Status.REFUNDED
            confirmed_at = None
        else:
            r = random.random()
            if r < 0.85:
                pay_status = Payment.Status.CONFIRMED
                confirmed_at = booking.starts_at - timedelta(hours=1)
            elif r < 0.93:
                pay_status = Payment.Status.PENDING
                confirmed_at = None
            else:
                pay_status = Payment.Status.FAILED
                confirmed_at = None
        ref = f'wompi-{uuid.uuid4().hex[:12]}'
        return Payment.objects.create(
            booking=booking,
            customer=booking.customer,
            subscription=booking.subscription,
            status=pay_status,
            amount=booking.package.price,
            currency=booking.package.currency,
            provider=Payment.Provider.WOMPI,
            provider_reference=ref,
            confirmed_at=confirmed_at,
            metadata={'source': 'spotlight_history', 'wompi_reference': ref},
        )

    def _create_evaluations(self, customer, trainer):
        """4 anthro + 4 physical + 3 posturometry + 2 PARQ + ~26 nutrition,
        chronologically distributed across ~6 months."""
        today = timezone.localdate()

        # 4 anthropometries every 8 weeks (56 days)
        anthro_offsets = [180, 124, 68, 12]  # days ago (oldest first)
        for i, days_ago in enumerate(anthro_offsets):
            profile = ANTHRO_PROGRESSION[i]
            pp = PERIMETER_PROGRESSION[i]
            sp = SKINFOLD_PROGRESSION[i]
            AnthropometryEvaluation.objects.create(
                customer=customer,
                trainer=trainer,
                evaluation_date=today - timedelta(days=days_ago),
                weight_kg=profile[0],
                height_cm=profile[1],
                waist_cm=profile[2],
                hip_cm=profile[3],
                perimeters={
                    'brazo_relajado_d': pp[0],   'brazo_relajado_i': pp[1],
                    'brazo_flexionado_d': pp[2], 'brazo_flexionado_i': pp[3],
                    'antebrazo_d': pp[4],        'antebrazo_i': pp[5],
                    'muneca_d': pp[6],           'muneca_i': pp[7],
                    'pecho': pp[8],
                    'muslo_d': pp[9],            'muslo_i': pp[10],
                    'pantorrilla_d': pp[11],     'pantorrilla_i': pp[12],
                    'tobillo_d': pp[13],         'tobillo_i': pp[14],
                },
                skinfolds={
                    'triceps_d': sp[0],         'triceps_i': sp[1],
                    'biceps_d': sp[2],          'biceps_i': sp[3],
                    'subescapular_d': sp[4],    'subescapular_i': sp[5],
                    'cresta_iliaca_d': sp[6],   'cresta_iliaca_i': sp[7],
                    'supraespinal': sp[8],
                    'abdominal': sp[9],
                    'muslo_d': sp[10],          'muslo_i': sp[11],
                    'pantorrilla_d': sp[12],    'pantorrilla_i': sp[13],
                },
            )

        # 4 physical evaluations on the same dates
        for i, days_ago in enumerate(anthro_offsets):
            p = PHYSICAL_PROGRESSION[i]
            PhysicalEvaluation.objects.create(
                customer=customer,
                trainer=trainer,
                evaluation_date=today - timedelta(days=days_ago),
                squats_reps=p[0],
                pushups_reps=p[1],
                plank_seconds=p[2],
                walk_meters=p[3],
                unipodal_seconds=p[4],
                hip_mobility=p[5],
                shoulder_mobility=p[6],
                ankle_mobility=p[7],
            )

        # 3 posturometries every ~12 weeks
        posturo_offsets = [180, 96, 16]
        for i, days_ago in enumerate(posturo_offsets):
            p = POSTURO_PROGRESSION[i]
            PosturometryEvaluation.objects.create(
                customer=customer,
                trainer=trainer,
                evaluation_date=today - timedelta(days=days_ago),
                anterior_data=_build_posture_view(p['severity'], p['normal_segments']),
                lateral_right_data=_build_posture_view(p['severity'], p['normal_segments']),
                lateral_left_data=_build_posture_view(p['severity'], p['normal_segments']),
                posterior_data=_build_posture_view(p['severity'], p['normal_segments']),
            )

        # 2 PARQ assessments respecting 90-day cooldown (180 + 90 days back)
        parq_offsets = [180, 90]
        parq_records = [
            ParqAssessment(
                customer=customer,
                q1_heart_condition=False,
                q2_chest_pain=False,
                q3_dizziness=False,
                q4_chronic_condition=False,
                q5_prescribed_medication=False,
                q6_bone_joint_problem=False,
                q7_medical_supervision=False,
            ),
            ParqAssessment(
                customer=customer,
                q1_heart_condition=False,
                q2_chest_pain=False,
                q3_dizziness=False,
                q4_chronic_condition=False,
                q5_prescribed_medication=False,
                q6_bone_joint_problem=False,
                q7_medical_supervision=False,
            ),
        ]
        # PARQ has no evaluation_date field; we rely on created_at via direct update
        for record, days_ago in zip(parq_records, parq_offsets):
            record.save()
            # Backdate created_at so the timeline reflects reality
            backdated = timezone.now() - timedelta(days=days_ago)
            ParqAssessment.objects.filter(pk=record.pk).update(
                created_at=backdated, updated_at=backdated,
            )

        # ~26 nutrition habit entries (weekly, Mondays)
        total_weeks = 26
        for week_idx in range(total_weeks):
            days_ago = (total_weeks - 1 - week_idx) * 7
            tup = _nutrition_for_week(week_idx, total_weeks)
            record = NutritionHabit.objects.create(
                customer=customer,
                meals_per_day=tup[0],
                water_liters=tup[1],
                fruit_weekly=tup[2],
                vegetable_weekly=tup[3],
                protein_frequency=tup[4],
                ultraprocessed_weekly=tup[5],
                sugary_drinks_weekly=tup[6],
                eats_breakfast=tup[7],
            )
            backdated = timezone.now() - timedelta(days=days_ago)
            NutritionHabit.objects.filter(pk=record.pk).update(
                created_at=backdated, updated_at=backdated,
            )

    @staticmethod
    def _create_notifications(customer, subscriptions, sub_payments, bookings, booking_payments):
        """Generate notifications tied to the events above (mostly SENT)."""
        count = 0

        # Subscription activations (recurring) + first purchase
        for sub, pay in zip(subscriptions, sub_payments):
            Notification.objects.create(
                payment=pay,
                notification_type=Notification.Type.SUBSCRIPTION_ACTIVATED,
                status=Notification.Status.SENT,
                sent_to=customer.email,
                payload={'source': 'spotlight_history'},
            )
            Notification.objects.create(
                payment=pay,
                notification_type=Notification.Type.PAYMENT_CONFIRMED,
                status=Notification.Status.SENT,
                sent_to=customer.email,
                payload={'source': 'spotlight_history'},
            )
            count += 2

        # First expired sub gets an expiry reminder
        first_expired = next(
            (s for s in subscriptions if s.status == Subscription.Status.EXPIRED),
            None,
        )
        if first_expired:
            Notification.objects.create(
                notification_type=Notification.Type.SUBSCRIPTION_EXPIRY_REMINDER,
                status=Notification.Status.SENT,
                sent_to=customer.email,
                payload={'source': 'spotlight_history', 'subscription_id': first_expired.id},
            )
            count += 1

        # One notification per booking
        for booking in bookings:
            if booking.status == Booking.Status.CANCELED:
                ntype = Notification.Type.BOOKING_CANCELED
            else:
                ntype = Notification.Type.BOOKING_CONFIRMED
            Notification.objects.create(
                booking=booking,
                notification_type=ntype,
                status=Notification.Status.SENT,
                sent_to=customer.email,
                payload={'source': 'spotlight_history'},
            )
            count += 1

        # Receipt emails for booking payments that confirmed
        for pay in booking_payments:
            if pay.status == Payment.Status.CONFIRMED:
                Notification.objects.create(
                    payment=pay,
                    booking=pay.booking,
                    notification_type=Notification.Type.RECEIPT_EMAIL,
                    status=Notification.Status.SENT,
                    sent_to=customer.email,
                    payload={'source': 'spotlight_history'},
                )
                count += 1

        return count
