"""Create fake diagnostic evaluations for development and testing.

Populates the 5 diagnostic models (Anthropometry, Posturometry, Physical
Evaluation, Nutrition Habit, PAR-Q+) with medically realistic values for
each customer in the database, respecting cooldowns and dependency order.

Indices auto-compute on save() — never set them manually here.
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import (
    AnthropometryEvaluation,
    NutritionHabit,
    ParqAssessment,
    PhysicalEvaluation,
    PosturometryEvaluation,
    TrainerProfile,
    User,
)


# Realistic distributions
# Each tuple: (weight_kg, height_cm, waist_cm, hip_cm) — covers normal to obesity I
PERIMETER_PROFILES = [
    # (brazo_rel_d, brazo_rel_i, brazo_flex_d, brazo_flex_i, antebrazo_d, antebrazo_i,
    #  muneca_d, muneca_i, pecho, muslo_d, muslo_i, pantorrilla_d, pantorrilla_i, tobillo_d, tobillo_i)
    (26.0, 25.5, 28.0, 27.5, 23.0, 22.5, 14.5, 14.5, 86.0,  52.0, 51.5, 34.0, 33.5, 20.5, 20.5),  # 0 normal
    (30.0, 29.5, 32.0, 31.5, 26.0, 25.5, 16.5, 16.5, 96.0,  58.0, 57.5, 38.0, 37.5, 22.0, 22.0),  # 1 overweight
    (24.0, 23.5, 26.0, 25.5, 21.0, 20.5, 14.0, 14.0, 82.0,  49.0, 48.5, 33.0, 32.5, 19.5, 19.5),  # 2 normal
    (34.0, 33.5, 37.0, 36.5, 28.0, 27.5, 18.0, 18.0, 108.0, 64.0, 63.5, 42.0, 41.5, 24.0, 24.0),  # 3 obesity I
    (32.0, 31.5, 34.0, 33.5, 27.0, 26.5, 17.0, 17.0, 100.0, 60.0, 59.5, 39.0, 38.5, 22.5, 22.5),  # 4 overweight
    (23.0, 22.5, 25.0, 24.5, 20.5, 20.0, 13.5, 13.5, 80.0,  48.0, 47.5, 32.0, 31.5, 19.0, 19.0),  # 5 normal
    (38.0, 37.5, 42.0, 41.5, 30.0, 29.5, 19.5, 19.5, 120.0, 70.0, 69.5, 46.0, 45.5, 26.0, 26.0),  # 6 obesity II
    (28.0, 27.5, 30.5, 30.0, 24.0, 23.5, 15.5, 15.5, 92.0,  54.0, 53.5, 36.0, 35.5, 21.0, 21.0),  # 7 normal
]

SKINFOLD_PROFILES = [
    # (triceps_d, triceps_i, biceps_d, biceps_i, subescapular_d, subescapular_i,
    #  cresta_iliaca_d, cresta_iliaca_i, supraespinal, abdominal, muslo_d, muslo_i, pantorrilla_d, pantorrilla_i)
    (14.0, 14.0,  8.0,  8.0, 11.0, 11.0, 14.0, 14.0, 12.0, 16.0, 20.0, 20.0, 12.0, 12.0),  # 0 normal
    (16.0, 16.0,  9.0,  9.0, 16.0, 16.0, 18.0, 18.0, 16.0, 22.0, 22.0, 22.0, 14.0, 14.0),  # 1 overweight
    (12.0, 12.0,  7.0,  7.0, 10.0, 10.0, 12.0, 12.0, 10.0, 14.0, 18.0, 18.0, 11.0, 11.0),  # 2 normal
    (22.0, 22.0, 14.0, 14.0, 22.0, 22.0, 26.0, 26.0, 24.0, 32.0, 28.0, 28.0, 18.0, 18.0),  # 3 obesity I
    (18.0, 18.0, 11.0, 11.0, 18.0, 18.0, 20.0, 20.0, 18.0, 24.0, 24.0, 24.0, 15.0, 15.0),  # 4 overweight
    (11.0, 11.0,  6.0,  6.0,  9.0,  9.0, 11.0, 11.0,  9.0, 12.0, 17.0, 17.0, 10.0, 10.0),  # 5 normal
    (28.0, 28.0, 18.0, 18.0, 28.0, 28.0, 32.0, 32.0, 30.0, 40.0, 34.0, 34.0, 22.0, 22.0),  # 6 obesity II
    (13.0, 13.0,  7.5,  7.5, 14.0, 14.0, 16.0, 16.0, 14.0, 18.0, 20.0, 20.0, 12.0, 12.0),  # 7 normal
]

ANTHRO_PROFILES = [
    (Decimal('62.0'), Decimal('168.0'), Decimal('72.0'), Decimal('92.0')),   # normal
    (Decimal('75.5'), Decimal('175.0'), Decimal('85.0'), Decimal('98.0')),   # overweight
    (Decimal('58.0'), Decimal('162.0'), Decimal('68.0'), Decimal('88.0')),   # normal
    (Decimal('92.0'), Decimal('178.0'), Decimal('98.0'), Decimal('108.0')),  # obesity I
    (Decimal('80.0'), Decimal('180.0'), Decimal('88.0'), Decimal('100.0')),  # overweight
    (Decimal('55.0'), Decimal('160.0'), Decimal('66.0'), Decimal('86.0')),   # normal
    (Decimal('105.0'), Decimal('182.0'), Decimal('108.0'), Decimal('116.0')),  # obesity II (alert)
    (Decimal('68.0'), Decimal('170.0'), Decimal('76.0'), Decimal('94.0')),   # normal
]

# Physical test profiles: (squats, pushups, plank_s, walk_m, unipodal_s, hip_mob, shoulder_mob, ankle_mob)
PHYSICAL_PROFILES = [
    (35, 25, 90, 580, 45, 4, 4, 4),   # high fitness
    (22, 12, 50, 480, 25, 3, 3, 3),   # average fitness
    (15, 6, 30, 400, 15, 2, 3, 2),    # low fitness
    (40, 35, 120, 620, 60, 5, 5, 4),  # excellent
    (28, 18, 70, 520, 30, 3, 4, 3),   # average
    (10, 4, 20, 350, 10, 2, 2, 2),    # very low
    (32, 22, 80, 560, 40, 4, 4, 4),   # high
    (20, 10, 45, 460, 20, 3, 3, 3),   # average
]

# Nutrition profiles: (meals, water_liters, fruit_w, veg_w, protein_freq, ultra_w, sugary_w, breakfast)
NUTRITION_PROFILES = [
    (4, Decimal('2.5'), 14, 14, 4, 2, 1, True),    # excellent
    (3, Decimal('2.0'), 7, 10, 3, 5, 3, True),     # good
    (3, Decimal('1.5'), 5, 5, 2, 8, 5, False),     # average
    (5, Decimal('3.0'), 21, 21, 5, 1, 0, True),    # excellent
    (3, Decimal('1.0'), 3, 4, 2, 12, 8, False),    # poor (alert)
    (4, Decimal('2.0'), 10, 12, 3, 4, 2, True),    # good
    (2, Decimal('1.2'), 2, 3, 2, 14, 10, False),   # poor (alert)
    (4, Decimal('2.5'), 14, 14, 4, 3, 1, True),    # very good
]

# PARQ profiles: distribution 70% low risk, 25% medium, 5% high
# (q1, q2, q3, q4, q5, q6, q7)
PARQ_PROFILES = [
    (False, False, False, False, False, False, False),  # 0 yes — low
    (False, False, False, False, False, False, False),  # 0 yes — low
    (False, False, False, False, False, False, False),  # 0 yes — low
    (False, False, False, True, False, False, False),   # 1 yes — low
    (False, False, False, False, True, False, False),   # 1 yes — low
    (False, False, False, True, True, False, False),    # 2 yes — medium
    (False, False, False, True, True, True, False),     # 3 yes — medium
    (True, False, False, True, True, False, True),      # 4 yes — high
]


class Command(BaseCommand):
    help = (
        'Create fake diagnostic evaluations (anthropometry, posturometry, '
        'physical, nutrition, PAR-Q+) for all customers'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--per-customer', type=int, default=1,
            help='Number of evaluations per module per customer (default: 1).',
        )
        parser.add_argument('--skip-anthro', action='store_true', default=False)
        parser.add_argument('--skip-posturo', action='store_true', default=False)
        parser.add_argument('--skip-physical', action='store_true', default=False)
        parser.add_argument('--skip-nutrition', action='store_true', default=False)
        parser.add_argument('--skip-parq', action='store_true', default=False)
        parser.add_argument(
            '--seed', type=int, default=None,
            help='Random seed for reproducible distributions.',
        )
        parser.add_argument(
            '--reset', action='store_true', default=False,
            help='Delete all existing diagnostics for customers before creating new ones.',
        )

    def handle(self, *args, **options):
        seed = options.get('seed')
        if seed is not None:
            random.seed(seed)

        per_customer = max(int(options['per_customer']), 1)
        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        if not customers:
            self.stdout.write(self.style.WARNING('No customers found. Run create_fake_users first.'))
            return

        trainers = list(TrainerProfile.objects.all())
        if not trainers:
            self.stdout.write(self.style.WARNING(
                'No trainer profile found — diagnostics will be created without trainer.'
            ))
        trainer = trainers[0] if trainers else None

        if options['reset']:
            customer_ids = [c.pk for c in customers]
            AnthropometryEvaluation.objects.filter(customer_id__in=customer_ids).delete()
            PosturometryEvaluation.objects.filter(customer_id__in=customer_ids).delete()
            PhysicalEvaluation.objects.filter(customer_id__in=customer_ids).delete()
            NutritionHabit.objects.filter(customer_id__in=customer_ids).delete()
            ParqAssessment.objects.filter(customer_id__in=customer_ids).delete()
            self.stdout.write(self.style.WARNING('Existing diagnostics deleted.'))

        counts = {'anthro': 0, 'posturo': 0, 'physical': 0, 'nutrition': 0, 'parq': 0}
        today = timezone.localdate()

        for customer in customers:
            for i in range(per_customer):
                # Stagger dates so multiple evaluations don't share the same day
                offset_days = i * 30  # 30-day spacing between evaluations of same customer
                # Distribute across all trainers so every trainer has data to view
                trainer = trainers[(customer.pk + i) % len(trainers)] if trainers else None

                if not options['skip_anthro']:
                    profile = ANTHRO_PROFILES[(customer.pk + i) % len(ANTHRO_PROFILES)]
                    p_idx = (customer.pk + i) % len(PERIMETER_PROFILES)
                    pp = PERIMETER_PROFILES[p_idx]
                    sp = SKINFOLD_PROFILES[p_idx]
                    AnthropometryEvaluation.objects.create(
                        customer=customer,
                        trainer=trainer,
                        evaluation_date=today - timedelta(days=offset_days),
                        weight_kg=profile[0],
                        height_cm=profile[1],
                        waist_cm=profile[2],
                        hip_cm=profile[3],
                        perimeters={
                            'brazo_relajado_d': pp[0],  'brazo_relajado_i': pp[1],
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
                    counts['anthro'] += 1

                if not options['skip_posturo']:
                    PosturometryEvaluation.objects.create(
                        customer=customer,
                        trainer=trainer,
                        evaluation_date=today - timedelta(days=offset_days),
                        anterior_data=_build_posture_view((customer.pk + i) % 8),
                        lateral_right_data=_build_posture_view((customer.pk + i + 1) % 8),
                        lateral_left_data=_build_posture_view((customer.pk + i + 2) % 8),
                        posterior_data=_build_posture_view((customer.pk + i + 3) % 8),
                    )
                    counts['posturo'] += 1

                if not options['skip_physical']:
                    profile = PHYSICAL_PROFILES[(customer.pk + i) % len(PHYSICAL_PROFILES)]
                    PhysicalEvaluation.objects.create(
                        customer=customer,
                        trainer=trainer,
                        evaluation_date=today - timedelta(days=offset_days),
                        squats_reps=profile[0],
                        pushups_reps=profile[1],
                        plank_seconds=profile[2],
                        walk_meters=profile[3],
                        unipodal_seconds=profile[4],
                        hip_mobility=profile[5],
                        shoulder_mobility=profile[6],
                        ankle_mobility=profile[7],
                    )
                    counts['physical'] += 1

                # Nutrition cooldown: 7 days. Stagger by 8 days to be safe.
                if not options['skip_nutrition']:
                    profile = NUTRITION_PROFILES[(customer.pk + i) % len(NUTRITION_PROFILES)]
                    NutritionHabit.objects.create(
                        customer=customer,
                        meals_per_day=profile[0],
                        water_liters=profile[1],
                        fruit_weekly=profile[2],
                        vegetable_weekly=profile[3],
                        protein_frequency=profile[4],
                        ultraprocessed_weekly=profile[5],
                        sugary_drinks_weekly=profile[6],
                        eats_breakfast=profile[7],
                    )
                    counts['nutrition'] += 1

                # PARQ cooldown: 90 days. Only create one per customer regardless of per_customer
                if not options['skip_parq'] and i == 0:
                    profile = PARQ_PROFILES[customer.pk % len(PARQ_PROFILES)]
                    ParqAssessment.objects.create(
                        customer=customer,
                        q1_heart_condition=profile[0],
                        q2_chest_pain=profile[1],
                        q3_dizziness=profile[2],
                        q4_chronic_condition=profile[3],
                        q5_prescribed_medication=profile[4],
                        q6_bone_joint_problem=profile[5],
                        q7_medical_supervision=profile[6],
                    )
                    counts['parq'] += 1

        self.stdout.write(self.style.SUCCESS('Diagnostics:'))
        self.stdout.write(f"- anthropometry_created: {counts['anthro']}")
        self.stdout.write(f"- posturometry_created: {counts['posturo']}")
        self.stdout.write(f"- physical_evaluations_created: {counts['physical']}")
        self.stdout.write(f"- nutrition_habits_created: {counts['nutrition']}")
        self.stdout.write(f"- parq_assessments_created: {counts['parq']}")
        self.stdout.write(f"- total_customers_processed: {len(customers)}")


def _build_posture_view(profile_index):
    """Build a JSON observation dict for a single posture view.

    Index 0-3: mostly normal observations.
    Index 4-7: progressively more findings (severity 1-2).
    """
    severity = max(0, profile_index - 3)
    is_normal = severity == 0
    return {
        'cabeza': {'is_normal': is_normal, 'severity': severity, 'sub_fields': {}},
        'cuello': {'is_normal': is_normal, 'severity': severity, 'sub_fields': {}},
        'hombros': {'is_normal': is_normal, 'severity': severity, 'sub_fields': {}},
        'columna': {'is_normal': is_normal, 'severity': severity, 'sub_fields': {}},
        'cadera': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'rodillas': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
        'pies': {'is_normal': True, 'severity': 0, 'sub_fields': {}},
    }
