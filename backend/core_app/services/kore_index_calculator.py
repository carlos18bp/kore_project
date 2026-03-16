"""KÓRE General Index calculator.

Computes a single composite score (0–100) that summarizes the client's
overall state across all diagnostic modules, using weighted contributions.

Module weights:
  Antropometría       20%  — body composition (BMI + body fat)
  Riesgo metabólico   15%  — waist, WHR, waist-height ratio
  Postura             20%  — postural alignment (global index)
  Condición física    20%  — functional capacity (general index)
  Bienestar           10%  — mood / adherence (latest mood score)
  Nutrición           15%  — dietary habits (habit score)

Classification (0–100):
  0–39   Estado crítico          red
  40–59  Requiere intervención   orange
  60–74  En progreso             yellow
  75–89  Buen estado funcional   green
  90–100 Estado óptimo           green
"""

# ---------------------------------------------------------------------------
# Color-to-score normalizers (map traffic-light colors → 0-100)
# ---------------------------------------------------------------------------

_COLOR_SCORE = {
    'green': 85,
    'yellow': 60,
    'orange': 40,
    'red': 20,
}


def _color_to_score(color):
    """Convert a traffic-light color to a 0–100 score."""
    if not color:
        return None
    return _COLOR_SCORE.get(color.lower())


# ---------------------------------------------------------------------------
# Per-module normalizers (each returns 0–100 or None if no data)
# ---------------------------------------------------------------------------

def normalize_anthropometry(evaluation):
    """Normalize anthropometry to 0–100.

    Uses BMI color and body fat color as the two main composition indicators.
    Average of available color scores.
    """
    if evaluation is None:
        return None
    scores = []
    for color in [evaluation.bmi_color, evaluation.bf_color]:
        s = _color_to_score(color)
        if s is not None:
            scores.append(s)
    return round(sum(scores) / len(scores), 1) if scores else None


def normalize_metabolic_risk(evaluation):
    """Normalize metabolic risk to 0–100.

    Uses waist risk, WHR, and waist-height ratio colors.
    Average of available color scores.
    """
    if evaluation is None:
        return None
    scores = []
    for color in [evaluation.waist_risk_color, evaluation.whr_color, evaluation.whe_color]:
        s = _color_to_score(color)
        if s is not None:
            scores.append(s)
    return round(sum(scores) / len(scores), 1) if scores else None


def normalize_posturometry(evaluation):
    """Normalize posturometry global index to 0–100.

    Posturometry scale: 0 (perfect) to 2+ (severe).
    Classification: 0–0.50 green, 0.51–1.20 yellow, 1.21–2.00 orange, >2.00 red.
    We invert: lower index = better score.
    """
    if evaluation is None or evaluation.global_index is None:
        return None
    idx = float(evaluation.global_index)
    # Linear mapping: 0 → 100, 2.0 → 0 (clamped)
    score = max(0, min(100, round((1.0 - idx / 2.0) * 100, 1)))
    return score


def normalize_physical(evaluation):
    """Normalize physical evaluation general index to 0–100.

    Physical scale: 1–5 (1=very low, 5=excellent).
    Linear mapping: 1 → 0, 5 → 100.
    """
    if evaluation is None or evaluation.general_index is None:
        return None
    idx = float(evaluation.general_index)
    score = max(0, min(100, round((idx - 1.0) / 4.0 * 100, 1)))
    return score


def normalize_mood(mood_score):
    """Normalize mood score (1–10) to 0–100."""
    if mood_score is None:
        return None
    return max(0, min(100, round((mood_score - 1) / 9.0 * 100, 1)))


def normalize_nutrition(habit_score):
    """Normalize nutrition habit score (0–10) to 0–100."""
    if habit_score is None:
        return None
    return max(0, min(100, round(float(habit_score) / 10.0 * 100, 1)))


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_kore_index(score):
    """Return (category, color, message) for a 0–100 KÓRE index."""
    if score is None:
        return ('', '', '')
    s = round(float(score), 1)
    if s < 40:
        return (
            'Estado crítico',
            'red',
            'Tu cuerpo requiere intervención prioritaria y una ruta muy guiada.',
        )
    if s < 60:
        return (
            'Requiere intervención',
            'orange',
            'Hay varias áreas por mejorar y el proceso debe ser progresivo.',
        )
    if s < 75:
        return (
            'En progreso',
            'yellow',
            'Ya hay una base y el cuerpo puede seguir mejorando con constancia.',
        )
    if s < 90:
        return (
            'Buen estado funcional',
            'green',
            'Tienes una buena base y se puede optimizar rendimiento y salud.',
        )
    return (
        'Estado óptimo',
        'green',
        'Tu estado funcional es muy favorable.',
    )


# ---------------------------------------------------------------------------
# Composite computation
# ---------------------------------------------------------------------------

WEIGHTS = {
    'anthropometry': 0.20,
    'metabolic_risk': 0.15,
    'posturometry': 0.20,
    'physical': 0.20,
    'mood': 0.10,
    'nutrition': 0.15,
}


def compute_kore_index(
    anthro_eval=None,
    posturo_eval=None,
    physical_eval=None,
    mood_score=None,
    nutrition_habit_score=None,
):
    """Compute the KÓRE general index from the latest evaluations.

    Only modules with available data contribute to the score.
    Their weights are re-normalized proportionally.

    Returns dict with:
      kore_score, kore_category, kore_color, kore_message,
      components (dict of module → normalized score),
      modules_available (int), modules_total (int).
    """
    components = {}
    weighted_parts = {}

    # Anthropometry (composition)
    anthro_score = normalize_anthropometry(anthro_eval)
    if anthro_score is not None:
        components['anthropometry'] = anthro_score
        weighted_parts['anthropometry'] = anthro_score * WEIGHTS['anthropometry']

    # Metabolic risk (from same anthro eval)
    metabolic_score = normalize_metabolic_risk(anthro_eval)
    if metabolic_score is not None:
        components['metabolic_risk'] = metabolic_score
        weighted_parts['metabolic_risk'] = metabolic_score * WEIGHTS['metabolic_risk']

    # Posturometry
    posturo_score = normalize_posturometry(posturo_eval)
    if posturo_score is not None:
        components['posturometry'] = posturo_score
        weighted_parts['posturometry'] = posturo_score * WEIGHTS['posturometry']

    # Physical condition
    physical_score = normalize_physical(physical_eval)
    if physical_score is not None:
        components['physical'] = physical_score
        weighted_parts['physical'] = physical_score * WEIGHTS['physical']

    # Mood / wellbeing
    mood_normalized = normalize_mood(mood_score)
    if mood_normalized is not None:
        components['mood'] = mood_normalized
        weighted_parts['mood'] = mood_normalized * WEIGHTS['mood']

    # Nutrition
    nutrition_normalized = normalize_nutrition(nutrition_habit_score)
    if nutrition_normalized is not None:
        components['nutrition'] = nutrition_normalized
        weighted_parts['nutrition'] = nutrition_normalized * WEIGHTS['nutrition']

    modules_available = len(weighted_parts)
    modules_total = len(WEIGHTS)

    if modules_available == 0:
        return {
            'kore_score': None,
            'kore_category': '',
            'kore_color': '',
            'kore_message': '',
            'components': components,
            'modules_available': 0,
            'modules_total': modules_total,
        }

    # Re-normalize weights proportionally for available modules
    total_weight = sum(WEIGHTS[k] for k in weighted_parts)
    kore_score = round(sum(weighted_parts.values()) / total_weight, 1)

    category, color, message = classify_kore_index(kore_score)

    return {
        'kore_score': kore_score,
        'kore_category': category,
        'kore_color': color,
        'kore_message': message,
        'components': components,
        'modules_available': modules_available,
        'modules_total': modules_total,
    }
