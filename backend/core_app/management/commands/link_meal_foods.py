"""
Link MealSuggestion records to their base Food ingredients via the M2M relation.

Uses exact (case-insensitive) name lookups so only verified DB matches are used.
Run with --dry-run to preview without committing changes.

Run: python manage.py link_meal_foods [--dry-run]
"""
from django.core.management.base import BaseCommand

from core_app.models import MealSuggestion
from core_app.models.food import Food

# Keys are exact MealSuggestion.title values.
# Values are lists of exact Food.name values (verified against the DB).
MEAL_FOOD_MAP = {
    # ── DESAYUNO ────────────────────────────────────────────────────────────────
    'Arepa con huevo y aguacate': [
        'Huevo, de gallina, entero, crudo',
        'Aguacate, crudo',
    ],
    'Calentado paisa': [
        'Arroz, tipo 1, cocido',
        'Frijol, carioca, cocido',
        'Huevo, de gallina, entero, crudo',
    ],
    'Changua con huevo': [
        'Huevo, de gallina, entero, crudo',
        'Leche, de vaca, integral',
        'Cebolla, cruda',
    ],
    'Avena con leche y banano': [
        'Avena, hojuelas, cruda',
        'Leche, de vaca, integral',
        'Banano, Manzana, cruda',
    ],
    'Tostadas integrales con queso y tomate': [
        'Tomate, con semilla, crudo',
    ],
    'Huevos pericos con arepa': [
        'Huevo, de gallina, entero, crudo',
        'Tomate, con semilla, crudo',
        'Cebolla, cruda',
    ],
    'Yogur natural con granola y fresas': [
        'Yogur, natural',
        'Fresa, crudo',
    ],
    'Caldo de costilla con papa': [
        'Papa, baroa, cocida',
    ],
    'Smoothie de mango con avena': [
        'Mango, Tommy Atkins, cruda',
        'Avena, hojuelas, cruda',
        'Leche, de vaca, integral',
    ],
    'Claras de huevo con espinaca y arepa pequeña': [
        'Huevo, de gallina, entero, crudo',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Frutas frescas con yogur griego': [
        'Yogur, natural',
        'Papaya, Formosa, crudo',
        'Mango, Tommy Atkins, cruda',
    ],
    'Avena con proteína y frutos rojos': [
        'Avena, hojuelas, cruda',
        'Fresa, crudo',
    ],
    'Tostadas de yuca con aguacate y huevo': [
        'Huevo, de gallina, entero, crudo',
        'Aguacate, crudo',
    ],
    'Huevos revueltos con 3 proteínas': [
        'Huevo, de gallina, entero, crudo',
    ],
    'Batido de leche con banano y maní': [
        'Leche, de vaca, integral',
        'Banano, Manzana, cruda',
        'Maní, tostado, salado',
    ],
    'Omelet de vegetales con arepa': [
        'Huevo, de gallina, entero, crudo',
        'Espinaca, Nova Zelândia, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Tostadas con aguacate y huevo pochado': [
        'Aguacate, crudo',
        'Huevo, de gallina, entero, crudo',
    ],

    # ── MEDIA MAÑANA ────────────────────────────────────────────────────────────
    'Banano con maní': [
        'Banano, Manzana, cruda',
        'Maní, tostado, salado',
    ],
    'Yogur griego con papaya': [
        'Yogur, natural',
        'Papaya, Formosa, crudo',
    ],
    'Frutos secos y semillas': [
        'Maní, tostado, salado',
    ],
    'Batido de mora con leche': [
        'Leche, de vaca, integral',
    ],
    'Ensalada de frutas tropicales': [
        'Mango, Tommy Atkins, cruda',
        'Papaya, Formosa, crudo',
        'Fresa, crudo',
    ],
    'Huevo cocido solo': [
        'Huevo, de gallina, entero, cocido/10minutos',
    ],
    'Granola con leche y pitahaya': [
        'Leche, de vaca, integral',
        'Avena, hojuelas, cruda',
    ],

    # ── ALMUERZO ────────────────────────────────────────────────────────────────
    'Sancocho de pollo con arroz': [
        'Pollo, Pechuga, con piel, asado',
        'Arroz, tipo 1, cocido',
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Arroz con pollo y ensalada': [
        'Pollo, Pechuga, con piel, asado',
        'Arroz, tipo 1, cocido',
        'Tomate, con semilla, crudo',
    ],
    'Frijoles con arroz y carne': [
        'Frijol, carioca, cocido',
        'Arroz, tipo 1, cocido',
        'Aguacate, crudo',
    ],
    'Sopa de lentejas con pollo': [
        'Lenteja, cocida',
        'Pollo, Pechuga, sin piel, cocido',
        'Zanahoria, cruda',
    ],
    'Pechugas de pollo a la plancha con arroz integral': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Arroz, integral, cocido',
        'Brócoli, cocido',
    ],
    'Cazuela de mariscos con arroz': [
        'Arroz, tipo 1, cocido',
        'Leche, de coco',
    ],
    'Arroz con atún y vegetales': [
        'Arroz, tipo 1, cocido',
        'Atún, conserva en Aceite vegetal',
        'Tomate, con semilla, crudo',
        'Pepino, crudo',
    ],
    'Ensalada de pollo con aguacate': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Aguacate, crudo',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Tilapia al vapor con ensalada': [
        'Pepino, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de verduras con pollo': [
        'Pollo, Pechuga, sin piel, cocido',
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Wrap de lechuga con pollo y vegetales': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Zanahoria, cruda',
        'Pepino, crudo',
        'Yogur, natural',
    ],
    'Quinua con verduras y huevo': [
        'Huevo, de gallina, entero, crudo',
        'Zanahoria, cruda',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Arroz integral con carne molida y frijoles': [
        'Arroz, integral, cocido',
        'Frijol, carioca, cocido',
    ],
    'Pasta integral con pollo y brócoli': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Brócoli, cocido',
        'Tomate, con semilla, crudo',
    ],
    'Ensalada de garbanzo con atún': [
        'Garbanzo, crudo',
        'Atún, conserva en Aceite vegetal',
        'Tomate, con semilla, crudo',
        'Pepino, crudo',
    ],
    'Bowl de arroz integral con salmón y aguacate': [
        'Arroz, integral, cocido',
        'Salmón, filete, con piel, fresco,  a la plancha',
        'Aguacate, crudo',
    ],
    'Pechuga rellena con espinaca y queso': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Estofado de res con papa y zanahoria': [
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Carne asada con arroz y lentejas': [
        'Arroz, tipo 1, cocido',
        'Lenteja, cocida',
        'Aguacate, crudo',
    ],

    # ── MERIENDA ────────────────────────────────────────────────────────────────
    'Maní con banano': [
        'Maní, tostado, salado',
        'Banano, Manzana, cruda',
    ],
    'Avena con leche y canela': [
        'Avena, hojuelas, cruda',
        'Leche, de vaca, integral',
    ],
    'Yogur natural con mango': [
        'Yogur, natural',
        'Mango, Tommy Atkins, cruda',
    ],
    'Pitahaya con yogur griego': [
        'Yogur, natural',
    ],
    'Zanahoria con hummus': [
        'Zanahoria, cruda',
        'Garbanzo, crudo',
    ],
    'Shake de proteína con avena': [
        'Avena, hojuelas, cruda',
        'Leche, de vaca, integral',
    ],

    # ── DESAYUNO (continuación) ─────────────────────────────────────────────────
    'Arepa con quesillo y hogao': [
        'Tomate, con semilla, crudo',
        'Cebolla, cruda',
    ],
    'Arepa rellena de pollo y queso': [
        'Pollo, Pechuga, sin piel, cocido',
    ],
    'Calentado con proteína extra': [
        'Arroz, tipo 1, cocido',
        'Frijol, carioca, cocido',
        'Pollo, Pechuga, sin piel, a la plancha',
    ],
    'Tamal tolimense': [
        'Pollo, Pechuga, con piel, asado',
        'Zanahoria, cruda',
    ],
    'Colada de maíz con leche': [
        'Leche, de vaca, integral',
    ],
    'Huevos tibios con tostadas y zumo de naranja': [
        'Huevo, de gallina, entero, cocido/10minutos',
    ],
    'Cereal integral con leche y fruta': [
        'Leche, de vaca, integral',
        'Banano, Manzana, cruda',
        'Avena, hojuelas, cruda',
    ],
    'Obleas con arequipe y frutas': [
        'Papaya, Formosa, crudo',
        'Fresa, crudo',
    ],
    'Peto de maíz': [
        'Leche, de vaca, integral',
    ],
    'Salpicón de frutas con leche': [
        'Leche, de vaca, integral',
        'Papaya, Formosa, crudo',
        'Mango, Tommy Atkins, cruda',
        'Fresa, crudo',
    ],
    'Avena con chontaduro': [
        'Avena, hojuelas, cruda',
        'Leche, de vaca, integral',
    ],
    'Arepa boyacense con papa y chicharrón': [
        'Papa, baroa, cocida',
    ],
    'Bowl proteico de desayuno': [
        'Yogur, natural',
        'Avena, hojuelas, cruda',
        'Maní, tostado, salado',
        'Fresa, crudo',
    ],

    # ── MEDIA MAÑANA (continuación) ─────────────────────────────────────────────
    'Mango y maracuyá frescos': [
        'Mango, Tommy Atkins, cruda',
    ],
    'Arepa pequeña con queso': [
        'Cebolla, cruda',
    ],
    'Fruta de temporada': [
        'Mango, Tommy Atkins, cruda',
    ],
    'Barra de avena y miel casera': [
        'Avena, hojuelas, cruda',
    ],
    'Proteína con agua y fruta': [
        'Banano, Manzana, cruda',
    ],
    'Tostada integral con mermelada sin azúcar': [
        'Fresa, crudo',
    ],
    'Tostadas de arroz con mantequilla de maní': [
        'Maní, tostado, salado',
    ],
    'Queso campesino con papayuela': [
        'Papaya, Formosa, crudo',
    ],
    'Guanábana con leche de coco': [
        'Leche, de coco',
    ],
    'Galletas de avena caseras con café': [
        'Avena, hojuelas, cruda',
    ],

    # ── ALMUERZO (continuación) ─────────────────────────────────────────────────
    'Bandeja paisa moderada': [
        'Frijol, carioca, cocido',
        'Arroz, tipo 1, cocido',
        'Huevo, de gallina, entero, crudo',
    ],
    'Sopa de papa con costilla': [
        'Papa, baroa, cocida',
    ],
    'Ajiaco bogotano': [
        'Pollo, Pechuga, con piel, asado',
        'Papa, baroa, cocida',
    ],
    'Sudado de pollo con papa': [
        'Pollo, Pechuga, con piel, asado',
        'Papa, baroa, cocida',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de arveja con carne': [
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Pollo entero al horno con papa y ensalada': [
        'Pollo, Pechuga, con piel, asado',
        'Papa, baroa, cocida',
        'Tomate, con semilla, crudo',
    ],
    'Mojarra frita con arroz y patacones': [
        'Arroz, tipo 1, cocido',
        'Banano, de la terra, cruda',
    ],
    'Carne en bisté con papas criollas': [
        'Papa, baroa, cocida',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de mondongo con arroz': [
        'Arroz, tipo 1, cocido',
        'Papa, baroa, cocida',
        'Garbanzo, crudo',
    ],
    'Pollo al ajillo con arroz y aguacate': [
        'Pollo, Pechuga, con piel, asado',
        'Arroz, tipo 1, cocido',
        'Aguacate, crudo',
    ],
    'Sopa de arveja con cerdo': [
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Arroz con camarón y coco': [
        'Arroz, tipo 1, cocido',
        'Leche, de coco',
    ],
    'Pepitoria de cuy': [
        'Papa, baroa, cocida',
        'Maní, tostado, salado',
    ],
    'Cocido boyacense': [
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Tilapia a la plancha con yuca y ensalada': [
        'Tomate, con semilla, crudo',
        'Pepino, crudo',
    ],
    'Lentejas con chorizo y arroz': [
        'Lenteja, cocida',
        'Arroz, tipo 1, cocido',
    ],
    'Wrap de pollo con vegetales asados': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de frijol antiqueño': [
        'Frijol, carioca, cocido',
        'Papa, baroa, cocida',
    ],
    'Ceviche de camarón con patacones': [
        'Tomate, con semilla, crudo',
        'Cebolla, cruda',
    ],
    'Arroz con coles de bruselas y pollo': [
        'Arroz, integral, cocido',
        'Pollo, Pechuga, con piel, asado',
    ],
    'Sopa de champiñones con papa': [
        'Papa, baroa, cocida',
        'Cebolla, cruda',
    ],
    'Sopa de yuca con pollo': [
        'Pollo, Pechuga, sin piel, cocido',
        'Zanahoria, cruda',
    ],

    # ── MERIENDA (continuación) ─────────────────────────────────────────────────
    'Proteína con leche o agua': [
        'Leche, de vaca, integral',
    ],
    'Uchuvas y almendras': [
        'Almendra Natural',
    ],
    'Batido de frutas sin azúcar': [
        'Fresa, crudo',
        'Leche, de vaca, integral',
    ],
    'Tostadas con hummus de garbanzo': [
        'Garbanzo, crudo',
    ],
    'Fruta de temporada con sal y limón': [
        'Mango, Tommy Atkins, cruda',
    ],
    'Avena fría con cacao sin azúcar': [
        'Avena, hojuelas, cruda',
        'Leche, de vaca, integral',
    ],
    'Mini arepa con hogao': [
        'Tomate, con semilla, crudo',
        'Cebolla, cruda',
    ],
    'Mango biche con sal y limón': [
        'Mango, Tommy Atkins, cruda',
    ],
    'Plátano en leche': [
        'Leche, de vaca, integral',
        'Banano, de la terra, cruda',
    ],

    # ── CENA (continuación) ─────────────────────────────────────────────────────
    'Sopa de fideo con pollo': [
        'Pollo, Pechuga, sin piel, cocido',
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Plátano maduro con queso': [
        'Banano, de la terra, cruda',
    ],
    'Empanadas de pipián horneadas': [
        'Papa, baroa, cocida',
        'Maní, tostado, salado',
    ],
    'Arroz con carne y plátano maduro': [
        'Arroz, tipo 1, cocido',
        'Banano, de la terra, cruda',
    ],
    'Pollo horneado con papa y ensalada': [
        'Pollo, Pechuga, con piel, asado',
        'Papa, baroa, cocida',
        'Tomate, con semilla, crudo',
    ],
    'Shake nocturno de proteína con maní': [
        'Leche, de vaca, integral',
        'Maní, tostado, salado',
    ],
    'Mazamorra de leche': [
        'Leche, de vaca, integral',
    ],
    'Arepas con hogao y aguacate': [
        'Aguacate, crudo',
        'Tomate, con semilla, crudo',
        'Cebolla, cruda',
    ],
    'Caldo de costilla liviano': [
        'Papa, baroa, cocida',
    ],
    'Sopa de crema de espárragos': [
        'Leche, de vaca, integral',
    ],
    'Sancocho ligero de pollo': [
        'Pollo, Pechuga, sin piel, cocido',
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Bowl de carne molida con papas y ensalada': [
        'Papa, baroa, cocida',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Plátano verde con queso y hogao': [
        'Tomate, con semilla, crudo',
        'Cebolla, cruda',
    ],
    'Sopa de tortilla de maíz': [
        'Pollo, Pechuga, con piel, asado',
        'Aguacate, crudo',
    ],
    'Carne desmechada con yuca y ensalada': [
        'Pepino, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Arroz de leche con canela': [
        'Leche, de vaca, integral',
    ],
    'Sopa de cebolla con queso': [
        'Cebolla, cruda',
    ],

    # ── CENA ────────────────────────────────────────────────────────────────────
    'Caldo de pollo con verduras': [
        'Pollo, Pechuga, sin piel, cocido',
        'Papa, baroa, cocida',
        'Zanahoria, cruda',
    ],
    'Ensalada de atún con aguacate': [
        'Atún, conserva en Aceite vegetal',
        'Aguacate, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de quinua con vegetales': [
        'Zanahoria, cruda',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Pollo a la plancha con ensalada nocturna': [
        'Pollo, Pechuga, sin piel, a la plancha',
        'Aguacate, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Crema de ahuyama': [
        'Leche, de coco',
    ],
    'Huevos cocidos con ensalada': [
        'Huevo, de gallina, entero, cocido/10minutos',
        'Pepino, crudo',
        'Zanahoria, cruda',
    ],
    'Caldo de verduras sin grasa': [
        'Zanahoria, cruda',
        'Espinaca, Nova Zelândia, crudo',
    ],
    'Pescado al vapor con brócoli': [
        'Brócoli, cocido',
    ],
    'Ensalada proteica nocturna': [
        'Atún, conserva en Aceite vegetal',
        'Huevo, de gallina, entero, cocido/10minutos',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de espinaca con huevo': [
        'Espinaca, Nova Zelândia, crudo',
        'Huevo, de gallina, entero, crudo',
    ],
    'Pasta con atún y tomate': [
        'Atún, conserva en Aceite vegetal',
        'Tomate, con semilla, crudo',
    ],
    'Revuelto de huevo con champiñones': [
        'Huevo, de gallina, entero, crudo',
        'Espinaca, Nova Zelândia, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Ensalada de repollo morado con atún': [
        'Atún, conserva en Aceite vegetal',
        'Zanahoria, cruda',
    ],
    'Pechuga de pavo con ensalada tibia': [
        'Espinaca, Nova Zelândia, crudo',
        'Tomate, con semilla, crudo',
    ],
    'Sopa de pasta con pollo y zanahoria': [
        'Pollo, Pechuga, sin piel, cocido',
        'Zanahoria, cruda',
        'Papa, baroa, cocida',
    ],
    'Crema de zanahoria y jengibre': [
        'Zanahoria, cruda',
        'Leche, de coco',
    ],
}


class Command(BaseCommand):
    help = 'Link MealSuggestion records to their base Food ingredients (M2M).'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview without saving')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        mode = '[DRY RUN] ' if dry_run else ''

        linked = 0
        skipped_suggestion = []
        missing_foods = []

        for title, food_names in MEAL_FOOD_MAP.items():
            try:
                suggestion = MealSuggestion.objects.get(title=title)
            except MealSuggestion.DoesNotExist:
                skipped_suggestion.append(title)
                continue

            foods = []
            for name in food_names:
                try:
                    foods.append(Food.objects.get(name__iexact=name))
                except Food.DoesNotExist:
                    missing_foods.append(f'{title!r} → {name!r}')

            if not dry_run:
                suggestion.foods.set(foods)
            linked += 1
            self.stdout.write(f'{mode}  {title}: {len(foods)} alimento(s)')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'{mode}Sugerencias vinculadas: {linked}'))

        if skipped_suggestion:
            self.stdout.write(self.style.WARNING(f'Sugerencias no encontradas ({len(skipped_suggestion)}):'))
            for t in skipped_suggestion:
                self.stdout.write(f'  - {t}')

        if missing_foods:
            self.stdout.write(self.style.WARNING(f'Alimentos no encontrados ({len(missing_foods)}):'))
            for m in missing_foods:
                self.stdout.write(f'  - {m}')
