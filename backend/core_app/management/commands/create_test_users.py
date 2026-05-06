"""Create one trainer and one customer with complete fake data.

Creates:
  - Trainer: trainer@kore.com (with TrainerProfile)
  - Customer: test@kore.com (with CustomerProfile, all 5 evaluations,
    a published 28-day program with daily logs, weight/mood entries,
    3 packages, active subscription, availability slots, bookings, payments)

Idempotent — deletes existing test data before re-creating.
"""

import random
from datetime import date, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import (
    AnthropometryEvaluation,
    Booking,
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
from core_app.models.availability import AvailabilitySlot
from core_app.models.customer_profile import CustomerProfile
from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
)
from core_app.models.mood_entry import MoodEntry
from core_app.models.weight_entry import WeightEntry
from core_app.services.program_generator import generate_monthly_program
from core_app.services.slot_schedule import generate_slots_for_trainer

TRAINER_EMAIL = 'trainer@kore.com'
CUSTOMER_EMAIL = 'test@kore.com'
PASSWORD = 'ogthsv25'


class Command(BaseCommand):
    help = 'Create a trainer + customer with complete fake evaluation and training data'

    def add_arguments(self, parser):
        parser.add_argument('--password', type=str, default=PASSWORD)

    def handle(self, *args, **options):
        password = options['password']
        random.seed(42)

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Creating test users with full fake data...'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        trainer_profile = self._create_trainer(password)
        customer = self._create_customer(password)
        self._create_evaluations(customer, trainer_profile)
        packages = self._create_packages()
        self._create_slots(trainer_profile)
        subscription = self._create_subscription(customer, packages[1])
        self._create_bookings(customer, trainer_profile, packages[1], subscription)
        self._create_program(customer)
        self._create_tracking_entries(customer)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Done! Test users ready:'))
        self.stdout.write(f'  Trainer:  {TRAINER_EMAIL} / {password}')
        self.stdout.write(f'  Customer: {CUSTOMER_EMAIL} / {password}')
        self.stdout.write(self.style.SUCCESS('=' * 60))

    def _create_trainer(self, password):
        User.objects.filter(email=TRAINER_EMAIL).delete()

        user = User.objects.create_user(
            email=TRAINER_EMAIL,
            password=password,
            first_name='Carlos',
            last_name='Mendoza',
            role=User.Role.TRAINER,
        )
        profile = TrainerProfile.objects.create(
            user=user,
            specialty='Entrenamiento funcional y rehabilitación',
            bio=(
                'Entrenador certificado con 8 años de experiencia en '
                'entrenamiento funcional, corrección postural y '
                'readaptación deportiva.'
            ),
            location='KÓRE Studio — Calle 93 #11-26, Bogotá',
            session_duration_minutes=60,
        )
        self.stdout.write(f'  Trainer created: {user.email}')
        return profile

    def _create_customer(self, password):
        User.objects.filter(email=CUSTOMER_EMAIL).delete()

        user = User.objects.create_user(
            email=CUSTOMER_EMAIL,
            password=password,
            first_name='Alejandra',
            last_name='Ríos Castaño',
            phone='+573001234567',
            role=User.Role.CUSTOMER,
        )

        profile = CustomerProfile.objects.filter(user=user).first()
        if not profile:
            profile = CustomerProfile(user=user)

        profile.sex = CustomerProfile.Sex.FEMENINO
        profile.date_of_birth = date(1992, 7, 15)
        profile.eps = 'Sura EPS'
        profile.id_type = CustomerProfile.IdType.CC
        profile.id_number = '1032456789'
        profile.id_expedition_date = date(2010, 3, 20)
        profile.address = 'Cra 15 #85-42, Apto 302'
        profile.city = 'Bogotá'
        profile.primary_goal = CustomerProfile.Goal.FAT_LOSS
        profile.save()

        self.stdout.write(f'  Customer created: {user.email} (profile complete)')
        return user

    def _create_evaluations(self, customer, trainer_profile):
        today = timezone.localdate()

        # -- Anthropometry (2 evaluations: 60 days ago + today) ----------------
        AnthropometryEvaluation.objects.filter(customer=customer).delete()

        AnthropometryEvaluation.objects.create(
            customer=customer,
            trainer=trainer_profile,
            evaluation_date=today - timedelta(days=60),
            weight_kg=Decimal('72.5'),
            height_cm=Decimal('165.0'),
            waist_cm=Decimal('82.0'),
            hip_cm=Decimal('98.0'),
            perimeters={
                'brazo_relajado_d': 28.5, 'brazo_relajado_i': 28.0,
                'brazo_flexionado_d': 30.0, 'brazo_flexionado_i': 29.5,
                'antebrazo_d': 24.0, 'antebrazo_i': 23.5,
                'pecho': 92.0, 'cintura': 82.0, 'gluteos': 98.0,
                'muslo_d': 56.0, 'muslo_i': 55.5,
                'pantorrilla_d': 36.0, 'pantorrilla_i': 35.5,
            },
            skinfolds={
                'triceps_d': 18.0, 'triceps_i': 17.5,
                'subescapular_d': 14.0, 'subescapular_i': 13.5,
                'supraespinal': 16.0, 'abdominal': 22.0,
                'muslo_d': 24.0, 'muslo_i': 23.5,
                'pantorrilla_d': 14.0, 'pantorrilla_i': 13.5,
            },
        )

        AnthropometryEvaluation.objects.create(
            customer=customer,
            trainer=trainer_profile,
            evaluation_date=today,
            weight_kg=Decimal('69.8'),
            height_cm=Decimal('165.0'),
            waist_cm=Decimal('78.0'),
            hip_cm=Decimal('96.0'),
            perimeters={
                'brazo_relajado_d': 28.0, 'brazo_relajado_i': 27.5,
                'brazo_flexionado_d': 30.5, 'brazo_flexionado_i': 30.0,
                'antebrazo_d': 24.0, 'antebrazo_i': 23.5,
                'pecho': 90.0, 'cintura': 78.0, 'gluteos': 96.0,
                'muslo_d': 55.0, 'muslo_i': 54.5,
                'pantorrilla_d': 36.0, 'pantorrilla_i': 35.5,
            },
            skinfolds={
                'triceps_d': 16.0, 'triceps_i': 15.5,
                'subescapular_d': 12.0, 'subescapular_i': 11.5,
                'supraespinal': 14.0, 'abdominal': 19.0,
                'muslo_d': 21.0, 'muslo_i': 20.5,
                'pantorrilla_d': 12.0, 'pantorrilla_i': 11.5,
            },
        )
        self.stdout.write('  Anthropometry evaluations: 2 created')

        # -- Posturometry (1 evaluation) ---------------------------------------
        PosturometryEvaluation.objects.filter(customer=customer).delete()

        PosturometryEvaluation.objects.create(
            customer=customer,
            trainer=trainer_profile,
            evaluation_date=today - timedelta(days=55),
            anterior_data={
                'cabeza': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'cuello': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'hombros': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'elevacion': 'derecho_mas_alto',
                }},
                'claviculas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'altura_tetillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'pliegue_inguinal': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'rodillas': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'alineacion': 'valgo_leve',
                }},
                'pie': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
            },
            lateral_right_data={
                'cabeza': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'posicion': 'adelantada',
                }},
                'escapulas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'columna_vertebral': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'cifosis': 'aumentada_leve',
                }},
                'codos_angulo': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'abdomen_prominente': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'cadera': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'rodillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'pies': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
            },
            lateral_left_data={
                'cabeza': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'posicion': 'adelantada',
                }},
                'escapulas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'columna_vertebral': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'cifosis': 'aumentada_leve',
                }},
                'codos_angulo': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'abdomen_prominente': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'cadera': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'rodillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'pies': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
            },
            posterior_data={
                'cabeza': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'hombros': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'elevacion': 'derecho_mas_alto',
                }},
                'escapulas': {'is_normal': False, 'severity': 1, 'sub_fields': {
                    'aleteo': 'leve_bilateral',
                }},
                'codos_flexionados': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'espacios_brazo_tronco': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'columna_vertebral': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'pliegues_laterales': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'altura_cresta_inguinales': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'gluteos': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'pliegues_popliteos': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'rodillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
                'pies': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
            },
            anterior_observations='Hombro derecho ligeramente elevado, valgo leve en rodillas.',
            lateral_right_observations='Cabeza adelantada, leve aumento de cifosis torácica.',
            lateral_left_observations='Igual patrón lateral que el derecho.',
            posterior_observations='Aleteo escapular leve bilateral, hombro derecho elevado.',
        )
        self.stdout.write('  Posturometry evaluation: 1 created')

        # -- Physical Evaluation -----------------------------------------------
        PhysicalEvaluation.objects.filter(customer=customer).delete()

        PhysicalEvaluation.objects.create(
            customer=customer,
            trainer=trainer_profile,
            evaluation_date=today - timedelta(days=50),
            squats_reps=28,
            pushups_reps=15,
            plank_seconds=65,
            walk_meters=520,
            unipodal_seconds=30,
            hip_mobility=3,
            shoulder_mobility=3,
            ankle_mobility=3,
            walk_effort_perception=6,
            walk_heart_rate=145,
            squats_notes='Buena técnica, leve valgo en las últimas reps.',
            pushups_notes='Desde rodillas, buen control del core.',
        )
        self.stdout.write('  Physical evaluation: 1 created')

        # -- Nutrition Habit ---------------------------------------------------
        NutritionHabit.objects.filter(customer=customer).delete()

        NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=3,
            water_liters=Decimal('1.8'),
            fruit_weekly=8,
            vegetable_weekly=10,
            protein_frequency=3,
            ultraprocessed_weekly=5,
            sugary_drinks_weekly=3,
            eats_breakfast=True,
            notes='Come bien entre semana, fin de semana suele comer más procesados.',
        )
        self.stdout.write('  Nutrition habit: 1 created')

        # -- PAR-Q+ Assessment -------------------------------------------------
        ParqAssessment.objects.filter(customer=customer).delete()

        ParqAssessment.objects.create(
            customer=customer,
            q1_heart_condition=False,
            q2_chest_pain=False,
            q3_dizziness=False,
            q4_chronic_condition=False,
            q5_prescribed_medication=False,
            q6_bone_joint_problem=True,
            q7_medical_supervision=False,
            additional_notes='Dolor leve en rodilla derecha al subir escaleras, resuelto hace 6 meses.',
        )
        self.stdout.write('  PAR-Q+ assessment: 1 created (low risk)')

    def _create_packages(self):
        pkg_basic, _ = Package.objects.update_or_create(
            title='Plan Básico',
            defaults=dict(
                short_description='4 sesiones personalizadas al mes',
                description='Ideal para quienes inician su proceso de entrenamiento.',
                category='personalizado',
                sessions_count=4,
                session_duration_minutes=60,
                price=Decimal('280000.00'),
                currency='COP',
                validity_days=30,
                is_active=True,
                order=1,
            ),
        )
        pkg_standard, _ = Package.objects.update_or_create(
            title='Plan Estándar',
            defaults=dict(
                short_description='8 sesiones personalizadas al mes',
                description='Entrenamiento consistente con seguimiento semanal.',
                category='personalizado',
                sessions_count=8,
                session_duration_minutes=60,
                price=Decimal('480000.00'),
                currency='COP',
                validity_days=30,
                is_active=True,
                order=2,
            ),
        )
        pkg_premium, _ = Package.objects.update_or_create(
            title='Plan Premium',
            defaults=dict(
                short_description='12 sesiones personalizadas al mes',
                description='Máxima frecuencia para resultados acelerados.',
                category='personalizado',
                sessions_count=12,
                session_duration_minutes=60,
                price=Decimal('650000.00'),
                currency='COP',
                validity_days=30,
                is_active=True,
                order=3,
            ),
        )
        self.stdout.write('  Packages: 3 upserted (Básico, Estándar, Premium)')
        return [pkg_basic, pkg_standard, pkg_premium]

    def _create_slots(self, trainer_profile):
        AvailabilitySlot.objects.filter(trainer=trainer_profile).delete()
        bogota_tz = ZoneInfo('America/Bogota')
        count = generate_slots_for_trainer(trainer_profile, days=35, tz=bogota_tz)
        self.stdout.write(f'  Availability slots: {count} created (35 days)')

    def _create_subscription(self, customer, package):
        Subscription.objects.filter(customer=customer).delete()

        now = timezone.now()
        sub = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=package.sessions_count,
            sessions_used=3,
            status='active',
            starts_at=now - timedelta(days=15),
            expires_at=now + timedelta(days=15),
            is_recurring=True,
            next_billing_date=(timezone.localdate() + timedelta(days=15)),
            wompi_transaction_id='fake_txn_test_001',
            payment_source_id='fake_src_test_001',
            payment_method_type='CARD',
        )
        Payment.objects.create(
            customer=customer,
            subscription=sub,
            status='confirmed',
            amount=package.price,
            currency='COP',
            provider='wompi',
            provider_reference='fake_wompi_ref_001',
            confirmed_at=now - timedelta(days=15),
        )
        self.stdout.write(
            f'  Subscription: active ({sub.sessions_remaining} sessions remaining)'
        )
        return sub

    def _create_bookings(self, customer, trainer_profile, package, subscription):
        Booking.objects.filter(customer=customer).delete()

        now = timezone.now()
        bogota_tz = ZoneInfo('America/Bogota')

        past_slots = AvailabilitySlot.objects.filter(
            trainer=trainer_profile,
            is_active=True,
            is_blocked=False,
            starts_at__lt=now,
        ).order_by('-starts_at')[:3]

        bookings_created = 0
        for slot in past_slots:
            slot.is_blocked = True
            slot.save(update_fields=['is_blocked'])
            Booking.objects.create(
                customer=customer,
                package=package,
                slot=slot,
                trainer=trainer_profile,
                subscription=subscription,
                status='confirmed',
            )
            bookings_created += 1

        future_slots = AvailabilitySlot.objects.filter(
            trainer=trainer_profile,
            is_active=True,
            is_blocked=False,
            starts_at__gt=now + timedelta(hours=16),
            starts_at__lt=now + timedelta(days=14),
        ).order_by('starts_at')[:2]

        for slot in future_slots:
            slot.is_blocked = True
            slot.save(update_fields=['is_blocked'])
            Booking.objects.create(
                customer=customer,
                package=package,
                slot=slot,
                trainer=trainer_profile,
                subscription=subscription,
                status='confirmed',
            )
            bookings_created += 1

        self.stdout.write(
            f'  Bookings: {bookings_created} created '
            f'({len(past_slots)} past, {len(future_slots)} upcoming)'
        )

    def _create_program(self, customer):
        MonthlyProgram.objects.filter(customer=customer).delete()
        DailyLog.objects.filter(customer=customer).delete()

        today = timezone.localdate()
        start_date = today - timedelta(days=14)

        program = generate_monthly_program(customer.pk, start_date=start_date)

        program.status = MonthlyProgram.Status.PUBLISHED
        program.approved_at = timezone.now() - timedelta(days=14)
        program.trainer_notes = (
            'Programa enfocado en pérdida de grasa con corrección postural. '
            'Progresión conservadora las primeras 2 semanas.'
        )
        program.save()

        days_so_far = program.days.filter(date__lte=today).select_related()
        logs_created = 0

        for day in days_so_far:
            exercises = day.exercises.all()
            if not exercises.exists():
                continue

            log = DailyLog.objects.create(
                customer=customer,
                program=program,
                date=day.date,
                is_closed=(day.date < today),
                closed_at=timezone.now() if day.date < today else None,
            )

            for pe in exercises:
                if random.random() < 0.85:
                    status = ExerciseLog.Status.COMPLETED
                elif random.random() < 0.5:
                    status = ExerciseLog.Status.SKIPPED
                else:
                    status = ExerciseLog.Status.NOT_DONE

                ExerciseLog.objects.create(
                    daily_log=log,
                    program_exercise=pe,
                    status=status,
                )
            logs_created += 1

        total_days = program.days.count()
        total_exercises = sum(d.exercises.count() for d in program.days.all())
        self.stdout.write(
            f'  Monthly program: 1 created (published, {total_days} days, '
            f'{total_exercises} exercises, {logs_created} daily logs)'
        )

    def _create_tracking_entries(self, customer):
        WeightEntry.objects.filter(user=customer).delete()
        MoodEntry.objects.filter(user=customer).delete()

        today = timezone.localdate()
        base_weight = Decimal('72.5')

        for i in range(60, -1, -1):
            entry_date = today - timedelta(days=i)
            if i % 3 != 0:
                continue
            drift = Decimal(str(round(-0.045 * (60 - i) + random.uniform(-0.3, 0.3), 1)))
            WeightEntry.objects.create(
                user=customer,
                weight_kg=base_weight + drift,
                date=entry_date,
            )

        weight_count = WeightEntry.objects.filter(user=customer).count()
        self.stdout.write(f'  Weight entries: {weight_count} created (60 days)')

        for i in range(30, -1, -1):
            entry_date = today - timedelta(days=i)
            base_mood = 6 + (30 - i) * 0.05
            score = max(1, min(10, round(base_mood + random.uniform(-1.5, 1.5))))
            MoodEntry.objects.create(
                user=customer,
                score=score,
                date=entry_date,
            )

        mood_count = MoodEntry.objects.filter(user=customer).count()
        self.stdout.write(f'  Mood entries: {mood_count} created (30 days)')
