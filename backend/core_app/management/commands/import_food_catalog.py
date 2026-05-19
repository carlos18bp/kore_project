"""
Import food catalog from two CSV sources:
  - TACO Brasil (translated to Spanish): taco_alimentos_es.csv
  - Open Food Facts Colombia: off_colombia.csv

Run: python manage.py import_food_catalog [--data-dir data/nutrition]
"""
import csv
import os
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand

from core_app.models import Food

DEFAULT_DATA_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'data', 'nutrition'
)

# Map TACO categories (ES) → Food.Category
TACO_CATEGORY_MAP = {
    'Cereales y derivados': Food.Category.CARB,
    'Frutas y derivados': Food.Category.FRUIT,
    'Verduras, hortalizas y derivados': Food.Category.VEGETABLE,
    'Legumbres y derivados': Food.Category.CARB,
    'Carnes y derivados': Food.Category.PROTEIN,
    'Pescados y mariscos': Food.Category.PROTEIN,
    'Huevos y derivados': Food.Category.PROTEIN,
    'Lácteos y derivados': Food.Category.DAIRY,
    'Grasas y aceites': Food.Category.HEALTHY_FAT,
    'Nueces y semillas': Food.Category.HEALTHY_FAT,
    'Bebidas (alcohólicas y no alcohólicas)': Food.Category.BEVERAGE,
    'Alimentos preparados': Food.Category.SNACK,
    'Productos azucarados': Food.Category.SNACK,
    'Misceláneos': Food.Category.SNACK,
    'Otros alimentos industrializados': Food.Category.SNACK,
}

# Map Open Food Facts food_groups_tags → Food.Category (keyword matching)
OFF_GROUP_KEYWORDS = [
    ('carnes', Food.Category.PROTEIN),
    ('pescado', Food.Category.PROTEIN),
    ('huevo', Food.Category.PROTEIN),
    ('legumbre', Food.Category.PROTEIN),
    ('lacteo', Food.Category.DAIRY),
    ('leche', Food.Category.DAIRY),
    ('queso', Food.Category.DAIRY),
    ('yogur', Food.Category.DAIRY),
    ('fruta', Food.Category.FRUIT),
    ('verdura', Food.Category.VEGETABLE),
    ('hortaliza', Food.Category.VEGETABLE),
    ('cereal', Food.Category.CARB),
    ('pan', Food.Category.CARB),
    ('pasta', Food.Category.CARB),
    ('arroz', Food.Category.CARB),
    ('grasa', Food.Category.HEALTHY_FAT),
    ('aceite', Food.Category.HEALTHY_FAT),
    ('fruto-seco', Food.Category.HEALTHY_FAT),
    ('bebida', Food.Category.BEVERAGE),
    ('agua', Food.Category.BEVERAGE),
]


def _decimal(value: str) -> Decimal | None:
    if not value or value.strip() in ('', 'NA', 'Tr', 'null', 'unknown'):
        return None
    try:
        return Decimal(value.strip().replace(',', '.'))
    except InvalidOperation:
        return None


def _off_category(food_groups: str) -> str:
    groups_lower = food_groups.lower()
    for keyword, cat in OFF_GROUP_KEYWORDS:
        if keyword in groups_lower:
            return cat
    return Food.Category.SNACK


def _nutri_score(raw: str) -> str:
    val = raw.strip().upper()
    return val if val in ('A', 'B', 'C', 'D', 'E') else ''


class Command(BaseCommand):
    help = 'Import food catalog from TACO Brasil (ES) and Open Food Facts Colombia CSVs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--data-dir',
            default=DEFAULT_DATA_DIR,
            help='Directory containing taco_alimentos_es.csv and off_colombia.csv (default: backend/data/nutrition)',
        )
        parser.add_argument('--dry-run', action='store_true', help='Preview counts without saving')

    def handle(self, *args, **options):
        data_dir = options['data_dir']
        dry_run = options['dry_run']

        taco_path = os.path.join(data_dir, 'taco_alimentos_es.csv')
        off_path = os.path.join(data_dir, 'off_colombia.csv')

        taco_created, taco_updated = self._import_taco(taco_path, dry_run)
        off_created, off_updated = self._import_off(off_path, dry_run)

        self.stdout.write(self.style.SUCCESS(
            f'\nTACO: {taco_created} created, {taco_updated} updated\n'
            f'Open Food Facts: {off_created} created, {off_updated} updated\n'
            f'Total: {taco_created + off_created} created, {taco_updated + off_updated} updated'
        ))

    def _import_taco(self, path: str, dry_run: bool) -> tuple[int, int]:
        if not os.path.exists(path):
            self.stdout.write(self.style.WARNING(f'TACO file not found: {path}'))
            return 0, 0

        created = updated = 0
        with open(path, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get('nombre', '').strip()
                if not name:
                    continue

                category = TACO_CATEGORY_MAP.get(row.get('categoria', ''), Food.Category.SNACK)
                defaults = {
                    'category': category,
                    'calories_per_100g': _decimal(row.get('calorias_kcal', '')),
                    'protein_per_100g': _decimal(row.get('proteinas_g', '')),
                    'carbs_per_100g': _decimal(row.get('carbohidratos_g', '')),
                    'fat_per_100g': _decimal(row.get('grasas_g', '')),
                    'fiber_per_100g': _decimal(row.get('fibra_g', '')),
                    'source': Food.Source.TACO,
                    'is_active': True,
                }
                if not dry_run:
                    _, was_created = Food.objects.update_or_create(
                        name=name, source=Food.Source.TACO, defaults=defaults,
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1
                else:
                    created += 1

        return created, updated

    def _import_off(self, path: str, dry_run: bool) -> tuple[int, int]:
        if not os.path.exists(path):
            self.stdout.write(self.style.WARNING(f'OFF file not found: {path}'))
            return 0, 0

        created = updated = 0
        with open(path, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Prefer Spanish name, fall back to generic product_name
                name = (row.get('product_name_es') or row.get('product_name') or '').strip()
                if not name:
                    continue

                nova_raw = row.get('nova_group', '').strip()
                nova = int(nova_raw) if nova_raw.isdigit() and nova_raw in ('1', '2', '3', '4') else None

                category = _off_category(row.get('food_groups_tags', ''))
                defaults = {
                    'category': category,
                    'calories_per_100g': _decimal(row.get('energy-kcal_100g', '')),
                    'protein_per_100g': _decimal(row.get('proteins_100g', '')),
                    'carbs_per_100g': _decimal(row.get('carbohydrates_100g', '')),
                    'fat_per_100g': _decimal(row.get('fat_100g', '')),
                    'fiber_per_100g': _decimal(row.get('fiber_100g', '')),
                    'nova_group': nova,
                    'nutri_score': _nutri_score(row.get('nutrition_grades', '')),
                    'source': Food.Source.OPENFOODFACTS,
                    'is_active': True,
                }
                if not dry_run:
                    _, was_created = Food.objects.update_or_create(
                        name=name, source=Food.Source.OPENFOODFACTS, defaults=defaults,
                    )
                    if was_created:
                        created += 1
                    else:
                        updated += 1
                else:
                    created += 1

        return created, updated
