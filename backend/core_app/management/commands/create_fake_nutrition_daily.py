"""Create fake daily nutrition tracking for development and testing.

Populates the daily-nutrition domain that ``create_fake_data`` omits:
NutritionDailyLog / MealEntry / WaterGlassLog for each customer across a
recent window of days.

MealEntry rows link to a MealSuggestion when the catalog is seeded
(``seed_meal_suggestions``); otherwise they are created without a suggestion.
Re-running is safe thanks to get_or_create on the unique keys.
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import (
    MealEntry,
    MealSuggestion,
    NutritionDailyLog,
    User,
    WaterGlassLog,
)

MEAL_BLOCKS = [
    MealEntry.MealBlock.BREAKFAST,
    MealEntry.MealBlock.MID_MORNING,
    MealEntry.MealBlock.LUNCH,
    MealEntry.MealBlock.SNACK,
    MealEntry.MealBlock.DINNER,
]

# Weighted meal-completion distribution (most meals logged as completed).
STATUS_CHOICES = [
    (MealEntry.Status.COMPLETED, 65),
    (MealEntry.Status.SKIPPED, 20),
    (MealEntry.Status.NOT_DONE, 15),
]

MIN_GLASSES = 3
MAX_GLASSES = 8


class Command(BaseCommand):
    help = 'Create fake daily nutrition logs (meals + water) for all customers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=14,
            help='Number of recent days to log per customer (default: 14).',
        )
        parser.add_argument(
            '--seed', type=int, default=None,
            help='Random seed for reproducible logs.',
        )
        parser.add_argument(
            '--reset', action='store_true', default=False,
            help='Delete existing nutrition daily logs for customers first.',
        )

    def handle(self, *args, **options):
        seed = options.get('seed')
        if seed is not None:
            random.seed(seed)

        days = max(int(options['days']), 1)
        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        if not customers:
            self.stdout.write(self.style.WARNING('No customers found. Run create_fake_users first.'))
            return

        if options['reset']:
            customer_ids = [c.pk for c in customers]
            NutritionDailyLog.objects.filter(customer_id__in=customer_ids).delete()
            self.stdout.write(self.style.WARNING('Existing nutrition daily logs deleted.'))

        suggestions_by_block = self._suggestions_by_block()

        counts = {'daily_logs': 0, 'meal_entries': 0, 'water_glasses': 0}
        today = timezone.localdate()
        now = timezone.now()

        statuses = [s for s, _ in STATUS_CHOICES]
        weights = [w for _, w in STATUS_CHOICES]

        for customer in customers:
            for offset in range(days):
                log_date = today - timedelta(days=days - 1 - offset)
                is_past = log_date < today
                daily_log, created = NutritionDailyLog.objects.get_or_create(
                    customer=customer,
                    date=log_date,
                    defaults={
                        'is_closed': is_past,
                        'closed_at': now if is_past else None,
                    },
                )
                if created:
                    counts['daily_logs'] += 1

                for block in MEAL_BLOCKS:
                    status = random.choices(statuses, weights=weights, k=1)[0]
                    block_suggestions = suggestions_by_block.get(block, [])
                    suggestion = random.choice(block_suggestions) if block_suggestions else None
                    _, meal_created = MealEntry.objects.get_or_create(
                        daily_log=daily_log,
                        meal_block=block,
                        defaults={'status': status, 'suggestion': suggestion},
                    )
                    if meal_created:
                        counts['meal_entries'] += 1

                if daily_log.water_glasses.count() == 0:
                    glasses = random.randint(MIN_GLASSES, MAX_GLASSES)
                    WaterGlassLog.objects.bulk_create([
                        WaterGlassLog(daily_log=daily_log) for _ in range(glasses)
                    ])
                    counts['water_glasses'] += glasses

        self.stdout.write(self.style.SUCCESS('Daily nutrition tracking:'))
        self.stdout.write(f"- daily_logs_created: {counts['daily_logs']}")
        self.stdout.write(f"- meal_entries_created: {counts['meal_entries']}")
        self.stdout.write(f"- water_glasses_created: {counts['water_glasses']}")
        self.stdout.write(f"- total_customers_processed: {len(customers)}")

    @staticmethod
    def _suggestions_by_block():
        """Group active meal suggestions by meal_block for quick random selection."""
        by_block = {block: [] for block in MEAL_BLOCKS}
        for suggestion in MealSuggestion.objects.filter(is_active=True):
            by_block.setdefault(suggestion.meal_block, []).append(suggestion)
        return by_block
