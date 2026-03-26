# -*- coding: utf-8 -*-
"""Nutrition habits score calculator for the KÓRE diagnostic engine.

Computes a composite Habit Score (0–10) from 8 dietary habit variables
reported by the client. Each favorable habit contributes points; partial
credit is awarded for intermediate values.

Classification:
  0–4   → Hábitos por mejorar (red)
  5–7   → Hábitos intermedios (yellow)
  8–10  → Hábitos favorables (green)

Scientific basis:
- OMS (2020). Healthy diet fact sheet. WHO.
- Monteiro CA et al. (2019). Ultra-processed foods, diet quality, and
  health using the NOVA classification system. Public Health Nutr, 22(1).
- ISSN (2017). Position stand: protein and exercise. JISSN, 14:20.
- EFSA (2010). Scientific Opinion on dietary reference values for water.
  EFSA Journal, 8(3):1459.
- Cahill LE et al. (2013). Prospective study of breakfast eating and
  incident coronary heart disease in a cohort of male US health
  professionals. Circulation, 128(4):337-343.
- AHA (2020). Dietary sugars intake and cardiovascular health. Circulation.
- ACSM (2021). Guidelines for Exercise Testing and Prescription, 11th ed.
"""


# ---------------------------------------------------------------------------
# Individual habit scorers (each returns 0 to its max points)
# ---------------------------------------------------------------------------

def _score_meals(meals_per_day):
    """Score meal regularity (max 1 pt).

    ≥3 meals/day = 1.0; 2 = 0.5; ≤1 = 0.
    """
    if meals_per_day is None:
        return 0.0
    if meals_per_day >= 3:
        return 1.0
    if meals_per_day == 2:
        return 0.5
    return 0.0


def _score_water(water_liters):
    """Score hydration (max 1.5 pts).

    ≥2L = 1.5; 1.5–1.99 = 1.0; 1.0–1.49 = 0.5; <1 = 0.
    EFSA (2010): adequate intake 2L women / 2.5L men; 2L used as threshold.
    """
    if water_liters is None:
        return 0.0
    w = float(water_liters)
    if w >= 2.0:
        return 1.5
    if w >= 1.5:
        return 1.0
    if w >= 1.0:
        return 0.5
    return 0.0


def _score_fruit(fruit_weekly):
    """Score fruit intake (max 1 pt).

    ≥5 times/week = 1.0; 3–4 = 0.5; <3 = 0.
    OMS: ≥400g fruits+vegetables daily.
    """
    if fruit_weekly is None:
        return 0.0
    if fruit_weekly >= 5:
        return 1.0
    if fruit_weekly >= 3:
        return 0.5
    return 0.0


def _score_vegetable(vegetable_weekly):
    """Score vegetable intake (max 1 pt).

    ≥5 times/week = 1.0; 3–4 = 0.5; <3 = 0.
    """
    if vegetable_weekly is None:
        return 0.0
    if vegetable_weekly >= 5:
        return 1.0
    if vegetable_weekly >= 3:
        return 0.5
    return 0.0


def _score_protein(protein_frequency):
    """Score protein frequency (max 1.5 pts).

    Scale 1–5: 5 = 1.5; 4 = 1.0; 3 = 0.5; ≤2 = 0.
    ISSN (2017): regular protein intake supports recovery & composition.
    """
    if protein_frequency is None:
        return 0.0
    if protein_frequency >= 5:
        return 1.5
    if protein_frequency >= 4:
        return 1.0
    if protein_frequency >= 3:
        return 0.5
    return 0.0


def _score_ultraprocessed(ultraprocessed_weekly):
    """Score ultraprocessed food avoidance (max 1.5 pts).

    ≤3/week = 1.5; 4–6 = 1.0; 7–10 = 0.5; >10 = 0.
    Monteiro et al. (2019): NOVA classification — excess caloric risk.
    """
    if ultraprocessed_weekly is None:
        return 0.0
    if ultraprocessed_weekly <= 3:
        return 1.5
    if ultraprocessed_weekly <= 6:
        return 1.0
    if ultraprocessed_weekly <= 10:
        return 0.5
    return 0.0


def _score_sugary_drinks(sugary_drinks_weekly):
    """Score sugary drink avoidance (max 1 pt).

    ≤2/week = 1.0; 3–5 = 0.5; >5 = 0.
    AHA (2020): limit added sugars for cardiovascular health.
    """
    if sugary_drinks_weekly is None:
        return 0.0
    if sugary_drinks_weekly <= 2:
        return 1.0
    if sugary_drinks_weekly <= 5:
        return 0.5
    return 0.0


def _score_breakfast(eats_breakfast):
    """Score breakfast regularity (max 1.5 pts).

    True = 1.5; False = 0.
    Cahill et al. (2013): breakfast eating and coronary heart disease.
    """
    if eats_breakfast is None:
        return 0.0
    return 1.5 if eats_breakfast else 0.0


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_score(score):
    """Return (category, color) for a 0–10 habit score."""
    if score is None:
        return ('', '')
    s = round(float(score), 2)
    if s <= 4:
        return ('Hábitos por mejorar', 'red')
    if s <= 7:
        return ('Hábitos intermedios', 'yellow')
    return ('Hábitos favorables', 'green')


# ---------------------------------------------------------------------------
# Composite compute_all
# ---------------------------------------------------------------------------

def compute_all(
    meals_per_day=None,
    water_liters=None,
    fruit_weekly=None,
    vegetable_weekly=None,
    protein_frequency=None,
    ultraprocessed_weekly=None,
    sugary_drinks_weekly=None,
    eats_breakfast=None,
):
    """Run all calculations and return a flat dict of results.

    Called from NutritionHabit.save() → _compute_score().
    """
    components = [
        _score_meals(meals_per_day),
        _score_water(water_liters),
        _score_fruit(fruit_weekly),
        _score_vegetable(vegetable_weekly),
        _score_protein(protein_frequency),
        _score_ultraprocessed(ultraprocessed_weekly),
        _score_sugary_drinks(sugary_drinks_weekly),
        _score_breakfast(eats_breakfast),
    ]

    total = round(sum(components), 2)
    category, color = classify_score(total)

    return {
        'habit_score': total,
        'habit_category': category,
        'habit_color': color,
    }


# ---------------------------------------------------------------------------
# Default recommendation texts
# ---------------------------------------------------------------------------

RECOMMENDATION_TEXTS = {
    'red': {
        'result': 'Tus hábitos alimentarios actuales necesitan atención. Se detectan áreas importantes de mejora en hidratación, calidad de alimentos o regularidad.',
        'action': 'Comienza con cambios pequeños: incluye una fruta al día, reduce bebidas azucaradas y procura desayunar. Tu entrenador puede guiarte en la transición.',
    },
    'yellow': {
        'result': 'Tienes una base alimentaria intermedia. Algunos hábitos son positivos, pero hay espacio para mejorar.',
        'action': 'Enfócate en aumentar frutas, verduras y proteína de calidad. Reduce ultraprocesados y mantén la hidratación por encima de 2 litros diarios.',
    },
    'green': {
        'result': 'Tu base alimentaria es favorable. Tus hábitos apoyan la recuperación, la energía y la composición corporal.',
        'action': 'Mantén la consistencia. Estos hábitos favorecen tu proceso KÓRE. Sigue ajustando según las recomendaciones de tu entrenador.',
    },
}


def generate_default_recommendation(color):
    """Return default recommendation dict for the given color."""
    return RECOMMENDATION_TEXTS.get(color, RECOMMENDATION_TEXTS['red'])
