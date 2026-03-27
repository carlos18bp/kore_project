"""Physical evaluation calculation engine for the KÓRE diagnostic system.

Converts raw test results into a 1–5 score using age- and sex-stratified
baremos, then computes composite indices (strength, endurance, mobility,
balance, general).  Optionally generates cross-module alerts from the
client's latest anthropometry and posturometry evaluations.

Scientific basis:
- ACSM (2021). Guidelines for Exercise Testing and Prescription, 11th ed.
- Rikli, R.E. & Jones, C.J. (2001). Senior Fitness Test Manual.
- CSEP (2003). Canadian Physical Activity, Fitness & Lifestyle Approach.
- McGill, S. (2015). Low Back Disorders, 3rd ed.
- Tong, T.K. et al. (2014). JSCR — plank endurance norms.
- ATS (2002). Am J Respir Crit Care Med, 166:111-117 — 6MWT guidelines.
- Enright, P.L. & Sherrill, D.L. (1998). 6MWT reference equations.
- Springer, B.A. et al. (2007). J Geriatr Phys Ther — single-leg stance norms.
- Bohannon, R.W. (2006). Normative single-leg stance values by decade.
- Kendall, F.P. et al. (2005). Muscles: Testing and Function with Posture and Pain.
- Cook, G. (2010). Movement: Functional Movement Systems.
- Heyward, V.H. & Gibson, A.L. (2014). Advanced Fitness Assessment, 7th ed.
"""

# ---------------------------------------------------------------------------
# Age-group helper
# ---------------------------------------------------------------------------

def _age_group(age):
    """Return age-group key: '18_35', '36_50', '51_65', '66_plus'."""
    if age is None:
        age = 30
    if age < 18:
        age = 18
    if age <= 35:
        return '18_35'
    if age <= 50:
        return '36_50'
    if age <= 65:
        return '51_65'
    return '66_plus'


def _sex_key(sex):
    """Normalise sex to 'M' or 'F'. Defaults to 'M' for unknown."""
    if sex and sex.lower() in ('femenino', 'f', 'female'):
        return 'F'
    return 'M'


# ---------------------------------------------------------------------------
# Baremo tables  –  {sex: {age_group: [threshold2, threshold3, threshold4, threshold5]}}
# A value < threshold2 → score 1,  >= threshold2 and < threshold3 → 2, etc.
# For the highest tier: >= threshold5 → 5.
# ---------------------------------------------------------------------------

# NOTE: Thresholds calibrated for an active training population.
# Stricter than general-population norms (ACSM/CSEP) to reflect
# expected performance of individuals in a structured exercise program.

_SQUATS_BAREMO = {
    'M': {
        '18_35': [20, 30, 40, 50],
        '36_50': [16, 26, 36, 46],
        '51_65': [13, 22, 31, 40],
        '66_plus': [10, 18, 26, 34],
    },
    'F': {
        '18_35': [16, 26, 36, 46],
        '36_50': [13, 22, 32, 42],
        '51_65': [10, 18, 28, 36],
        '66_plus': [8, 15, 22, 30],
    },
}

_PUSHUPS_BAREMO = {
    'M': {
        '18_35': [10, 18, 28, 38],
        '36_50': [8, 15, 24, 33],
        '51_65': [6, 12, 20, 28],
        '66_plus': [4, 9, 16, 22],
    },
    'F': {
        '18_35': [6, 13, 21, 30],
        '36_50': [5, 10, 18, 25],
        '51_65': [3, 7, 14, 20],
        '66_plus': [2, 5, 10, 16],
    },
}

_PLANK_BAREMO = {
    'M': {
        '18_35': [30, 55, 80, 110],
        '36_50': [25, 45, 70, 95],
        '51_65': [15, 35, 55, 75],
        '66_plus': [10, 25, 42, 60],
    },
    'F': {
        '18_35': [25, 45, 70, 100],
        '36_50': [20, 40, 60, 85],
        '51_65': [12, 28, 48, 68],
        '66_plus': [8, 20, 38, 55],
    },
}

_WALK_BAREMO = {
    'M': {
        '18_35': [450, 550, 650, 750],
        '36_50': [400, 500, 600, 700],
        '51_65': [350, 450, 550, 650],
        '66_plus': [300, 400, 500, 600],
    },
    'F': {
        '18_35': [400, 500, 600, 700],
        '36_50': [350, 450, 550, 650],
        '51_65': [300, 400, 500, 600],
        '66_plus': [250, 350, 450, 550],
    },
}

# Unipodal – same thresholds for both sexes
_UNIPODAL_BAREMO_BY_AGE = {
    '18_35': [15, 30, 50, 65],
    '36_50': [10, 22, 40, 55],
    '51_65': [7, 15, 28, 42],
    '66_plus': [4, 10, 20, 32],
}


def _score_from_baremo(value, thresholds):
    """Return 1–5 score given a raw value and [t2, t3, t4, t5] thresholds."""
    if value is None:
        return None
    value = float(value)
    t2, t3, t4, t5 = thresholds
    if value < t2:
        return 1
    if value < t3:
        return 2
    if value < t4:
        return 3
    if value < t5:
        return 4
    return 5


# ---------------------------------------------------------------------------
# Individual test scorers
# ---------------------------------------------------------------------------

def score_squats(reps, age, sex):
    sk = _sex_key(sex)
    ag = _age_group(age)
    return _score_from_baremo(reps, _SQUATS_BAREMO[sk][ag])


def score_pushups(reps, age, sex):
    sk = _sex_key(sex)
    ag = _age_group(age)
    return _score_from_baremo(reps, _PUSHUPS_BAREMO[sk][ag])


def score_plank(seconds, age, sex):
    sk = _sex_key(sex)
    ag = _age_group(age)
    return _score_from_baremo(seconds, _PLANK_BAREMO[sk][ag])


def score_walk(meters, age, sex):
    sk = _sex_key(sex)
    ag = _age_group(age)
    return _score_from_baremo(meters, _WALK_BAREMO[sk][ag])


def score_unipodal(seconds, age, _sex=None):
    ag = _age_group(age)
    return _score_from_baremo(seconds, _UNIPODAL_BAREMO_BY_AGE[ag])


# ---------------------------------------------------------------------------
# Index classification
# ---------------------------------------------------------------------------

def classify_index(value):
    """Return (category, color) for a 1–5 index value."""
    if value is None:
        return ('', '')
    v = round(value, 2)
    if v < 2.0:
        return ('Muy bajo', 'red')
    if v < 3.0:
        return ('Bajo', 'yellow')
    if v < 4.0:
        return ('Intermedio', 'green')
    if v <= 4.5:
        return ('Bueno', 'green')
    return ('Muy bueno', 'green')


# ---------------------------------------------------------------------------
# Cross-module alerts
# ---------------------------------------------------------------------------

def generate_cross_module_alerts(anthropometry_ctx=None, posturometry_ctx=None):
    """Generate contextual alerts from the client's other evaluations.

    Parameters are dicts with relevant fields from the latest evaluations.
    Returns dict: {test_key: [alert_string, ...]}.
    """
    alerts = {}
    antro = anthropometry_ctx or {}
    posturo = posturometry_ctx or {}

    # --- Anthropometry alerts ---
    bmi = antro.get('bmi')
    bmi_color = antro.get('bmi_color', '')
    bf_color = antro.get('bf_color', '')
    waist_color = antro.get('waist_risk_color', '')

    if bmi is not None and float(bmi) >= 30:
        msg = (
            'El IMC del cliente indica obesidad '
            f'(IMC {float(bmi):.1f}); considerar adaptaciones de carga '
            'y monitoreo cardiovascular.'
        )
        alerts.setdefault('squats', []).append(msg)
        alerts.setdefault('walk', []).append(msg)
        alerts.setdefault('plank', []).append(msg)

    if bf_color == 'red':
        alerts.setdefault('walk', []).append(
            'Grasa corporal elevada detectada en antropometría; '
            'monitorear tolerancia al esfuerzo aeróbico.'
        )

    if waist_color == 'red':
        alerts.setdefault('plank', []).append(
            'Riesgo abdominal alto detectado en antropometría; '
            'evaluar compensaciones lumbares durante la plancha.'
        )

    # --- Posturometry alerts ---
    lower_color = posturo.get('lower_color', '')
    central_color = posturo.get('central_color', '')
    upper_color = posturo.get('upper_color', '')

    if lower_color in ('red', 'orange'):
        alerts.setdefault('squats', []).append(
            'Desbalances posturales en tren inferior detectados; '
            'evaluar técnica de sentadilla con precaución.'
        )
        alerts.setdefault('unipodal', []).append(
            'Desbalances posturales en tren inferior; '
            'el resultado de equilibrio puede estar afectado.'
        )

    if central_color in ('red', 'orange'):
        alerts.setdefault('plank', []).append(
            'Desbalances centrales detectados en posturometría; '
            'vigilar compensaciones lumbares.'
        )

    if upper_color in ('red', 'orange'):
        alerts.setdefault('pushups', []).append(
            'Desbalances escapulares detectados en posturometría; '
            'adaptar variante de flexión si hay dolor.'
        )

    # Specific findings from posturometry
    findings = posturo.get('findings', {})
    lower_findings_text = ' '.join(findings.get('anterior', []) + findings.get('posterior', []))
    if lower_findings_text and ('varo' in lower_findings_text.lower() or 'valgo' in lower_findings_text.lower()):
        alerts.setdefault('squats', []).append(
            'Hallazgo de rodillas (varo/valgo) en posturometría; '
            'considerar alineación durante sentadillas.'
        )

    return alerts


# ---------------------------------------------------------------------------
# Composite compute_all
# ---------------------------------------------------------------------------

def compute_all(
    age, sex,
    squats_reps=None, pushups_reps=None, plank_seconds=None,
    walk_meters=None, unipodal_seconds=None,
    hip_mobility=None, shoulder_mobility=None, ankle_mobility=None,
    anthropometry_context=None, posturometry_context=None,
):
    """Run all calculations and return a flat dict of results.

    Called from PhysicalEvaluation.save() → _compute_indices().
    """
    # Individual scores
    sq = score_squats(squats_reps, age, sex)
    pu = score_pushups(pushups_reps, age, sex)
    pl = score_plank(plank_seconds, age, sex)
    wk = score_walk(walk_meters, age, sex)
    un = score_unipodal(unipodal_seconds, age)

    # Mobility scores (direct 1–5, clamp)
    def _clamp(v):
        if v is None:
            return None
        return max(1, min(5, int(v)))

    hip = _clamp(hip_mobility)
    sho = _clamp(shoulder_mobility)
    ank = _clamp(ankle_mobility)

    results = {
        'squats_score': sq,
        'pushups_score': pu,
        'plank_score': pl,
        'walk_score': wk,
        'unipodal_score': un,
    }

    # Strength index
    strength_vals = [v for v in [sq, pu, pl] if v is not None]
    strength = round(sum(strength_vals) / len(strength_vals), 2) if strength_vals else None
    cat, col = classify_index(strength)
    results['strength_index'] = strength
    results['strength_category'] = cat
    results['strength_color'] = col

    # Endurance index
    endurance = float(wk) if wk is not None else None
    cat, col = classify_index(endurance)
    results['endurance_index'] = endurance
    results['endurance_category'] = cat
    results['endurance_color'] = col

    # Mobility index
    mob_vals = [v for v in [hip, sho, ank] if v is not None]
    mobility = round(sum(mob_vals) / len(mob_vals), 2) if mob_vals else None
    cat, col = classify_index(mobility)
    results['mobility_index'] = mobility
    results['mobility_category'] = cat
    results['mobility_color'] = col

    # Balance index
    balance = float(un) if un is not None else None
    cat, col = classify_index(balance)
    results['balance_index'] = balance
    results['balance_category'] = cat
    results['balance_color'] = col

    # General index
    general_vals = [v for v in [strength, endurance, mobility, balance] if v is not None]
    general = round(sum(general_vals) / len(general_vals), 2) if general_vals else None
    cat, col = classify_index(general)
    results['general_index'] = general
    results['general_category'] = cat
    results['general_color'] = col

    # Cross-module alerts
    results['cross_module_alerts'] = generate_cross_module_alerts(
        anthropometry_ctx=anthropometry_context,
        posturometry_ctx=posturometry_context,
    )

    return results


# ---------------------------------------------------------------------------
# Default recommendation texts
# ---------------------------------------------------------------------------

_REC_TEXTS = {
    'general': {
        'green': {
            'result': 'Tu condición física general es adecuada. Tu cuerpo responde bien al esfuerzo, mantiene estabilidad y se mueve con libertad.',
            'action': 'Sigue con tu programa. La constancia y la progresión gradual son tu mejor estrategia.',
        },
        'yellow': {
            'result': 'Tu condición física general está por debajo del rango ideal. Hay áreas específicas que necesitan trabajo.',
            'action': 'Tu entrenador ajustará tu programa para fortalecer los componentes más débiles.',
        },
        'red': {
            'result': 'Tu condición física general necesita atención prioritaria.',
            'action': 'El programa se enfocará en mejorar tu base funcional de forma progresiva y segura.',
        },
    },
    'strength': {
        'green': {
            'result': 'Tu fuerza-resistencia es funcional. Puedes sostener esfuerzos musculares con buen control.',
            'action': 'Mantén el entrenamiento de fuerza. La progresión en carga e intensidad es tu próximo paso.',
        },
        'yellow': {
            'result': 'Tu fuerza-resistencia está por debajo del promedio para tu grupo. Hay margen de mejora.',
            'action': 'Incorpora más trabajo de fuerza funcional. Tu entrenador adaptará los ejercicios a tu nivel actual.',
        },
        'red': {
            'result': 'Tu fuerza-resistencia necesita desarrollo prioritario.',
            'action': 'Empezarás con ejercicios básicos de fuerza con cargas adaptadas. El progreso será gradual pero constante.',
        },
    },
    'endurance': {
        'green': {
            'result': 'Tu capacidad aeróbica es buena. Toleras el esfuerzo sostenido de forma adecuada.',
            'action': 'Mantén la actividad cardiovascular regular. Puedes progresar en intensidad o duración.',
        },
        'yellow': {
            'result': 'Tu capacidad aeróbica está por debajo del rango esperado.',
            'action': 'Incorpora más actividad cardiovascular en tu rutina: caminatas, bicicleta o natación.',
        },
        'red': {
            'result': 'Tu capacidad aeróbica necesita mejora significativa.',
            'action': 'Empezarás con actividad cardiovascular de baja intensidad, aumentando gradualmente.',
        },
    },
    'mobility': {
        'green': {
            'result': 'Tu movilidad articular es funcional. Tus rangos de movimiento son adecuados para el entrenamiento.',
            'action': 'Mantén tu rutina de movilidad. Incluir estiramientos dinámicos antes del entrenamiento es ideal.',
        },
        'yellow': {
            'result': 'Algunas zonas articulares presentan limitaciones leves de movilidad.',
            'action': 'Tu programa incluirá ejercicios específicos de movilidad para las zonas limitadas.',
        },
        'red': {
            'result': 'Hay limitaciones importantes de movilidad que pueden afectar tu movimiento.',
            'action': 'La movilidad será una prioridad en tu programa antes de progresar en carga.',
        },
    },
    'balance': {
        'green': {
            'result': 'Tu equilibrio y control neuromuscular son adecuados.',
            'action': 'Sigue trabajando la estabilidad. Ejercicios unilaterales y superficies inestables son buenas opciones.',
        },
        'yellow': {
            'result': 'Tu equilibrio está por debajo del promedio esperado.',
            'action': 'Incorpora ejercicios de equilibrio: apoyo unipodal, tandem stance, ejercicios con ojos cerrados.',
        },
        'red': {
            'result': 'Tu equilibrio necesita atención prioritaria. Puede representar un riesgo de caída.',
            'action': 'Tu programa incluirá trabajo progresivo de equilibrio estático y dinámico.',
        },
    },
}


def generate_default_recommendations(evaluation):
    """Build default recommendations dict based on computed index colors."""
    recs = {}

    def _pick(index_key, color):
        color = color or 'green'
        texts = _REC_TEXTS.get(index_key, {})
        return texts.get(color, texts.get('green', {'result': '', 'action': ''}))

    for key in ('general', 'strength', 'endurance', 'mobility', 'balance'):
        color = getattr(evaluation, f'{key}_color', '') or 'green'
        recs[key] = _pick(key, color)

    return recs
