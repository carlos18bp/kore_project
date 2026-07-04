"""Create fake weekly nutrition plans for development and testing.

Populates the nutrition-plan domain that ``create_fake_data`` omits:
WeeklyNutritionPlan / WeeklyPlanDay / WeeklyPlanMeal (via the real
``nutrition_plan_generator`` service) plus NutritionWeekNote.

Depends on the MealSuggestion catalog (run ``seed_meal_suggestions`` first)
and on a trainer to own each plan.  Re-running is safe: customers that
already own a plan are skipped unless ``--reset`` is passed.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import (
    MealSuggestion,
    NutritionWeekNote,
    TrainerProfile,
    User,
    WeeklyNutritionPlan,
)
from core_app.services.nutrition_plan_generator import generate_weekly_plan

# Realistic weekly nutrition coaching notes (weeks 1-4 of a cycle).
WEEK_NOTES = [
    'Arrancamos ordenando horarios de comida y porciones.',
    'Sumamos proteína en el desayuno y más vegetales al almuerzo.',
    'Reducimos ultraprocesados y bebidas azucaradas esta semana.',
    'Consolidamos hábitos: hidratación constante y desayuno diario.',
]

PLAN_LENGTH_DAYS = 28


class Command(BaseCommand):
    help = 'Create fake weekly nutrition plans (with week notes) for all customers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--per-customer', type=int, default=1,
            help='Number of consecutive 28-day nutrition plans per customer (default: 1).',
        )
        parser.add_argument(
            '--seed', type=int, default=None,
            help='Random seed (kept for interface parity; generation is deterministic).',
        )
        parser.add_argument(
            '--reset', action='store_true', default=False,
            help='Delete existing nutrition plans/week notes for customers first.',
        )

    def handle(self, *args, **options):
        per_customer = max(int(options['per_customer']), 1)
        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        if not customers:
            self.stdout.write(self.style.WARNING('No customers found. Run create_fake_users first.'))
            return

        if not MealSuggestion.objects.filter(is_active=True).exists():
            self.stdout.write(self.style.WARNING(
                'No active meal suggestions found. Run seed_meal_suggestions first.'
            ))
            return

        default_trainer = TrainerProfile.objects.first()
        if default_trainer is None:
            self.stdout.write(self.style.WARNING(
                'No trainer profile found. Run create_fake_trainers first.'
            ))
            return

        if options['reset']:
            customer_ids = [c.pk for c in customers]
            WeeklyNutritionPlan.objects.filter(customer_id__in=customer_ids).delete()
            NutritionWeekNote.objects.filter(customer_id__in=customer_ids).delete()
            self.stdout.write(self.style.WARNING('Existing nutrition plans and week notes deleted.'))

        counts = {'plans': 0, 'week_notes': 0}
        now = timezone.now()
        today = timezone.localdate()
        current_monday = today - timedelta(days=today.weekday())

        for customer in customers:
            if WeeklyNutritionPlan.objects.filter(customer=customer).exists():
                continue

            trainer = self._resolve_trainer(customer, default_trainer)

            for cycle_index in range(per_customer):
                cycle_number = cycle_index + 1
                cycles_from_newest = per_customer - 1 - cycle_index
                week_start = current_monday - timedelta(days=PLAN_LENGTH_DAYS * cycles_from_newest)

                plan = generate_weekly_plan(customer, trainer, week_start=week_start)
                plan.status = WeeklyNutritionPlan.Status.PUBLISHED
                plan.approved_at = now
                plan.save(update_fields=['status', 'approved_at'])
                counts['plans'] += 1

                for week_number in range(1, 5):
                    _, created = NutritionWeekNote.objects.get_or_create(
                        customer=customer,
                        cycle_number=cycle_number,
                        week_number=week_number,
                        defaults={
                            'cycle_start': week_start,
                            'notes': WEEK_NOTES[week_number - 1],
                        },
                    )
                    if created:
                        counts['week_notes'] += 1

        self.stdout.write(self.style.SUCCESS('Weekly nutrition plans:'))
        self.stdout.write(f"- plans_created: {counts['plans']}")
        self.stdout.write(f"- week_notes_created: {counts['week_notes']}")
        self.stdout.write(f"- total_customers_processed: {len(customers)}")

    @staticmethod
    def _resolve_trainer(customer, default_trainer):
        """Prefer the customer's assigned trainer, else the default trainer."""
        if customer.assigned_trainer_id:
            return customer.assigned_trainer
        return default_trainer
