"""
Seed Colombian meal suggestions from a CSV file.
Idempotent — re-running updates existing records without duplicating.

Run: python manage.py seed_meal_suggestions [--csv data/nutrition/meal_suggestions_co.csv]
"""
import csv
import os

from django.core.management.base import BaseCommand

from core_app.models import MealSuggestion
from core_app.models.food import Food

VALID_GOAL_TAGS = {'general_health', 'fat_loss', 'muscle_gain'}
VALID_MEAL_BLOCKS = {c[0] for c in MealSuggestion.MealBlock.choices}

DEFAULT_CSV = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'nutrition', 'meal_suggestions_co.csv')


class Command(BaseCommand):
    help = 'Seed Colombian meal suggestions from CSV into MealSuggestion table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv',
            default=DEFAULT_CSV,
            help='Path to CSV file (default: data/nutrition/meal_suggestions_co.csv relative to backend/)',
        )

    def handle(self, *args, **options):
        csv_path = options['csv']
        if not os.path.isabs(csv_path):
            csv_path = os.path.join(
                os.path.dirname(__file__), '..', '..', '..', csv_path
            )
        csv_path = os.path.normpath(csv_path)

        if not os.path.exists(csv_path):
            self.stderr.write(self.style.ERROR(f'CSV not found: {csv_path}'))
            return

        created = 0
        updated = 0
        total_rows = 0
        missing_foods = []
        seen_keys = {}

        with open(csv_path, encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        for row in rows:
            total_rows += 1
            title = row['title'].strip()
            meal_block = row['meal_block'].strip()

            key = (title, meal_block)
            if key in seen_keys:
                self.stderr.write(
                    self.style.WARNING(
                        f'Duplicate title+meal_block at row {total_rows}: "{title}" / {meal_block} — last wins'
                    )
                )
            seen_keys[key] = total_rows

            goal_tags_raw = row.get('goal_tags', '').strip()
            goal_tags = [t.strip() for t in goal_tags_raw.split('|') if t.strip()] if goal_tags_raw else []

            foods_raw = row.get('foods', '').strip()
            food_names = [n.strip() for n in foods_raw.split('|') if n.strip()] if foods_raw else []

            obj, was_created = MealSuggestion.objects.update_or_create(
                title=title,
                meal_block=meal_block,
                defaults={
                    'description': row.get('description', '').strip(),
                    'calories_estimate': int(row['calories_estimate']),
                    'goal_tags': goal_tags,
                    'fitness_level_min': int(row['fitness_level_min']),
                    'fitness_level_max': int(row['fitness_level_max']),
                    'nova_max': int(row['nova_max']),
                },
            )

            if was_created:
                created += 1
            else:
                updated += 1

            resolved_foods = []
            for name in food_names:
                food = Food.objects.filter(name__iexact=name).first()
                if food:
                    resolved_foods.append(food)
                else:
                    missing_foods.append(f'"{title}" -> "{name}"')

            obj.foods.set(resolved_foods)

        self.stdout.write(self.style.SUCCESS(
            f'Meal suggestions: {created} created, {updated} updated — total_rows={total_rows}'
        ))

        if missing_foods:
            self.stderr.write(self.style.WARNING(
                f'Missing foods ({len(missing_foods)} total). First 20:'
            ))
            for entry in missing_foods[:20]:
                self.stderr.write(f'  {entry}')
