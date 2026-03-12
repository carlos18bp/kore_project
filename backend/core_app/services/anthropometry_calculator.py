"""Pure calculation functions for the KÓRE anthropometry module.

Each function receives raw measurements and returns a dict with:
- value: the computed numeric result
- category/risk: human-readable label
- color: 'green', 'yellow', or 'red'
"""

from decimal import Decimal


def calculate_bmi(weight_kg, height_cm):
    """IMC = peso / estatura²  (estatura in meters)."""
    height_m = Decimal(str(height_cm)) / 100
    bmi = Decimal(str(weight_kg)) / (height_m ** 2)
    bmi = round(bmi, 2)

    if bmi < Decimal('18.5'):
        return {'value': float(bmi), 'category': 'Bajo peso', 'color': 'yellow'}
    elif bmi < Decimal('25.0'):
        return {'value': float(bmi), 'category': 'Peso saludable', 'color': 'green'}
    elif bmi < Decimal('30.0'):
        return {'value': float(bmi), 'category': 'Sobrepeso', 'color': 'yellow'}
    elif bmi < Decimal('35.0'):
        return {'value': float(bmi), 'category': 'Obesidad I', 'color': 'red'}
    elif bmi < Decimal('40.0'):
        return {'value': float(bmi), 'category': 'Obesidad II', 'color': 'red'}
    else:
        return {'value': float(bmi), 'category': 'Obesidad III', 'color': 'red'}


def calculate_whr(waist_cm, hip_cm, sex):
    """ICC = cintura / cadera."""
    whr = round(Decimal(str(waist_cm)) / Decimal(str(hip_cm)), 2)
    whr_f = float(whr)

    if sex == 'masculino':
        if whr_f < 0.90:
            return {'value': whr_f, 'risk': 'Bajo', 'color': 'green'}
        elif whr_f < 1.00:
            return {'value': whr_f, 'risk': 'Moderado', 'color': 'yellow'}
        else:
            return {'value': whr_f, 'risk': 'Alto', 'color': 'red'}
    else:
        if whr_f < 0.80:
            return {'value': whr_f, 'risk': 'Bajo', 'color': 'green'}
        elif whr_f < 0.85:
            return {'value': whr_f, 'risk': 'Moderado', 'color': 'yellow'}
        else:
            return {'value': whr_f, 'risk': 'Alto', 'color': 'red'}


def calculate_whe(waist_cm, height_cm):
    """ICE = cintura / estatura."""
    whe = round(Decimal(str(waist_cm)) / Decimal(str(height_cm)), 2)
    whe_f = float(whe)

    if whe_f < 0.50:
        return {'value': whe_f, 'risk': 'Saludable', 'color': 'green'}
    elif whe_f < 0.60:
        return {'value': whe_f, 'risk': 'Riesgo moderado', 'color': 'yellow'}
    else:
        return {'value': whe_f, 'risk': 'Riesgo alto', 'color': 'red'}


def calculate_body_fat(bmi_value, age, sex):
    """Deurenberg formula: %grasa = (1.20 × IMC) + (0.23 × edad) − (10.8 × sexo) − 5.4
    sexo: 1 for male, 0 for female.
    """
    sex_factor = 1 if sex == 'masculino' else 0
    pct = (1.20 * bmi_value) + (0.23 * age) - (10.8 * sex_factor) - 5.4
    pct = round(pct, 1)

    if sex == 'masculino':
        if pct < 8:
            return {'value': pct, 'category': 'Muy bajo', 'color': 'yellow'}
        elif pct <= 20:
            return {'value': pct, 'category': 'Saludable', 'color': 'green'}
        elif pct <= 25:
            return {'value': pct, 'category': 'Elevado', 'color': 'yellow'}
        else:
            return {'value': pct, 'category': 'Alto', 'color': 'red'}
    else:
        if pct < 15:
            return {'value': pct, 'category': 'Muy bajo', 'color': 'yellow'}
        elif pct <= 30:
            return {'value': pct, 'category': 'Saludable', 'color': 'green'}
        elif pct <= 35:
            return {'value': pct, 'category': 'Elevado', 'color': 'yellow'}
        else:
            return {'value': pct, 'category': 'Alto', 'color': 'red'}


def calculate_mass_composition(weight_kg, body_fat_pct):
    """Fat mass and lean mass from weight and body fat percentage."""
    fat_mass = round(weight_kg * (body_fat_pct / 100), 1)
    lean_mass = round(weight_kg - fat_mass, 1)
    return {'fat_mass_kg': fat_mass, 'lean_mass_kg': lean_mass}


def calculate_waist_risk(waist_cm, sex):
    """Abdominal risk based on waist circumference alone."""
    w = float(waist_cm)
    if sex == 'masculino':
        if w < 94:
            return {'risk': 'Bajo', 'color': 'green'}
        elif w < 102:
            return {'risk': 'Aumentado', 'color': 'yellow'}
        else:
            return {'risk': 'Alto', 'color': 'red'}
    else:
        if w < 80:
            return {'risk': 'Bajo', 'color': 'green'}
        elif w < 88:
            return {'risk': 'Aumentado', 'color': 'yellow'}
        else:
            return {'risk': 'Alto', 'color': 'red'}


def calculate_body_fat_jackson_pollock(skinfolds, age, sex):
    """Jackson-Pollock 7-site skinfold formula.

    Sites: triceps, pecho, subescapular, supraespinal, abdominal, muslo, pantorrilla.
    Uses the average of D/I when both are present.
    Returns None if insufficient data (needs at least 4 of 7 sites).
    """
    def avg(key):
        d = skinfolds.get(f'{key}_d')
        i = skinfolds.get(f'{key}_i')
        single = skinfolds.get(key)
        vals = [v for v in [d, i, single] if v is not None]
        return sum(float(v) for v in vals) / len(vals) if vals else None

    sites = {
        'triceps': avg('triceps'),
        'pecho': skinfolds.get('pecho') if skinfolds.get('pecho') is not None else None,
        'subescapular': avg('subescapular'),
        'supraespinal': float(skinfolds['supraespinal']) if skinfolds.get('supraespinal') is not None else None,
        'abdominal': float(skinfolds['abdominal']) if skinfolds.get('abdominal') is not None else None,
        'muslo': avg('muslo'),
        'pantorrilla': avg('pantorrilla'),
    }

    available = {k: v for k, v in sites.items() if v is not None}
    if len(available) < 4:
        return None

    s = sum(available.values())

    if sex == 'masculino':
        density = 1.112 - 0.00043499 * s + 0.00000055 * (s ** 2) - 0.00028826 * age
    else:
        density = 1.097 - 0.00046971 * s + 0.00000056 * (s ** 2) - 0.00012828 * age

    if density <= 0:
        return None

    pct = round((495 / density) - 450, 1)
    pct = max(pct, 1.0)

    return classify_body_fat(pct, sex, s)


def classify_body_fat(pct, sex, sum_sf=None):
    """Classify body fat % and return result dict."""
    if sex == 'masculino':
        if pct < 8:
            result = {'value': pct, 'category': 'Muy bajo', 'color': 'yellow'}
        elif pct <= 20:
            result = {'value': pct, 'category': 'Saludable', 'color': 'green'}
        elif pct <= 25:
            result = {'value': pct, 'category': 'Elevado', 'color': 'yellow'}
        else:
            result = {'value': pct, 'category': 'Alto', 'color': 'red'}
    else:
        if pct < 15:
            result = {'value': pct, 'category': 'Muy bajo', 'color': 'yellow'}
        elif pct <= 30:
            result = {'value': pct, 'category': 'Saludable', 'color': 'green'}
        elif pct <= 35:
            result = {'value': pct, 'category': 'Elevado', 'color': 'yellow'}
        else:
            result = {'value': pct, 'category': 'Alto', 'color': 'red'}
    if sum_sf is not None:
        result['sum_skinfolds'] = round(sum_sf, 1)
    return result


def calculate_asymmetries(measurements):
    """Detect bilateral asymmetries >10% between D and I measurements.

    Works for both perimeters and skinfolds dicts.
    Returns dict of detected asymmetries: {field: {d, i, diff_pct}}.
    """
    pairs = {}
    for key, val in measurements.items():
        if val is None:
            continue
        if key.endswith('_d'):
            base = key[:-2]
            pairs.setdefault(base, {})['d'] = float(val)
        elif key.endswith('_i'):
            base = key[:-2]
            pairs.setdefault(base, {})['i'] = float(val)

    asymmetries = {}
    for base, sides in pairs.items():
        if 'd' in sides and 'i' in sides and sides['d'] > 0 and sides['i'] > 0:
            avg_val = (sides['d'] + sides['i']) / 2
            diff_pct = abs(sides['d'] - sides['i']) / avg_val * 100
            if diff_pct > 10:
                asymmetries[base] = {
                    'd': sides['d'],
                    'i': sides['i'],
                    'diff_pct': round(diff_pct, 1),
                }
    return asymmetries


def compute_all(weight_kg, height_cm, waist_cm, hip_cm, age, sex, skinfolds=None):
    """Run all calculations and return a flat dict of results.

    ``waist_cm`` and ``hip_cm`` may be *None*; waist-dependent indices
    will simply be left empty.
    """
    skinfolds = skinfolds or {}

    bmi = calculate_bmi(weight_kg, height_cm)

    # Waist-dependent indices — only when data is present
    has_waist = waist_cm is not None
    has_hip = hip_cm is not None

    whr = calculate_whr(waist_cm, hip_cm, sex) if has_waist and has_hip else None
    whe = calculate_whe(waist_cm, height_cm) if has_waist else None
    waist_r = calculate_waist_risk(waist_cm, sex) if has_waist else None

    # Try Jackson-Pollock first (more accurate), fall back to Deurenberg
    jp = calculate_body_fat_jackson_pollock(skinfolds, age, sex) if skinfolds else None
    if jp:
        bf_value = jp['value']
        bf_category = jp['category']
        bf_color = jp['color']
        bf_method = 'jackson_pollock'
        sum_sf = jp.get('sum_skinfolds')
    else:
        deurenberg = calculate_body_fat(bmi['value'], age, sex)
        bf_value = deurenberg['value']
        bf_category = deurenberg['category']
        bf_color = deurenberg['color']
        bf_method = 'deurenberg'
        sum_sf = None

    mass = calculate_mass_composition(float(weight_kg), bf_value)

    # Asymmetries from all bilateral measurements
    all_bilateral = {}
    all_bilateral.update(skinfolds)
    asymmetries = calculate_asymmetries(all_bilateral)

    return {
        'bmi': bmi['value'],
        'bmi_category': bmi['category'],
        'bmi_color': bmi['color'],
        'waist_hip_ratio': whr['value'] if whr else None,
        'whr_risk': whr['risk'] if whr else '',
        'whr_color': whr['color'] if whr else '',
        'waist_height_ratio': whe['value'] if whe else None,
        'whe_risk': whe['risk'] if whe else '',
        'whe_color': whe['color'] if whe else '',
        'body_fat_pct': bf_value,
        'bf_category': bf_category,
        'bf_color': bf_color,
        'bf_method': bf_method,
        'fat_mass_kg': mass['fat_mass_kg'],
        'lean_mass_kg': mass['lean_mass_kg'],
        'waist_risk': waist_r['risk'] if waist_r else '',
        'waist_risk_color': waist_r['color'] if waist_r else '',
        'sum_skinfolds': sum_sf,
        'asymmetries': asymmetries,
    }


# ── Default recommendation texts ──

_REC_TEXTS = {
    'bmi': {
        'green': {
            'result': 'Tu peso está dentro del rango saludable. La relación entre peso y estatura es adecuada.',
            'action': 'Mantén tus hábitos actuales de alimentación y ejercicio. La constancia es tu mejor aliada.',
        },
        'yellow': {
            'result': 'Tu peso está ligeramente por encima del rango ideal. Muchas personas con buena masa muscular caen aquí.',
            'action': 'Enfócate en tu composición corporal: no se trata solo de peso, sino de cuánto es músculo y cuánto es grasa.',
        },
        'red': {
            'result': 'Tu peso está en un rango que puede representar un riesgo para tu salud.',
            'action': 'Combina tu entrenamiento con una alimentación consciente. Los cambios pequeños y sostenidos generan los mejores resultados.',
        },
    },
    'whr': {
        'green': {
            'result': 'Tu grasa se distribuye de forma saludable. Buen indicador cardiovascular.',
            'action': 'Sigue con tu rutina. Los entrenamientos que combinan fuerza y cardio ayudan a mantener esta distribución.',
        },
        'yellow': {
            'result': 'Hay una acumulación moderada de grasa en la zona abdominal.',
            'action': 'Ejercicios cardiovasculares y de core pueden ayudar a reducir la grasa abdominal.',
        },
        'red': {
            'result': 'La distribución de grasa indica concentración abdominal significativa.',
            'action': 'Prioriza actividad cardiovascular regular y ejercicios de fuerza.',
        },
    },
    'bf': {
        'green': {
            'result': 'Tu porcentaje de grasa está en un rango saludable. Buena composición corporal.',
            'action': 'Para mantener o mejorar, combina entrenamientos de fuerza con alimentación balanceada.',
        },
        'yellow': {
            'result': 'Tu grasa corporal está un poco por encima del rango ideal.',
            'action': 'Enfócate en entrenamientos de fuerza combinados con actividad cardiovascular.',
        },
        'red': {
            'result': 'Tu porcentaje de grasa está elevado.',
            'action': 'Prioriza la pérdida de grasa manteniendo tu masa muscular. Hábitos sostenibles son más efectivos que dietas extremas.',
        },
    },
    'waist': {
        'green': {
            'result': 'Tu cintura está en un rango seguro. La grasa abdominal no representa un riesgo adicional.',
            'action': 'Mantén tu nivel de actividad física.',
        },
        'yellow': {
            'result': 'Tu cintura está en una zona de atención. Reducir unos centímetros mejoraría tu perfil de salud.',
            'action': 'Incorpora más movimiento en tu día a día además de tus sesiones.',
        },
        'red': {
            'result': 'Tu cintura indica acumulación de grasa abdominal que puede afectar tu salud.',
            'action': 'Cuida tu alimentación — especialmente azúcares y alcohol — además de tu entrenamiento.',
        },
    },
    'mass': {
        'green': {
            'result': 'Tu masa libre de grasa se mantiene o crece mientras reduces grasa. Recomposición corporal en marcha.',
            'action': 'Sigue así. El entrenamiento de fuerza es tu mejor herramienta.',
        },
        'yellow': {
            'result': 'Estás en un proceso de cambio. Vigila que tu masa libre de grasa no baje demasiado.',
            'action': 'Asegúrate de consumir suficiente proteína y no recortar calorías excesivamente.',
        },
        'red': {
            'result': 'Es importante ganar masa muscular y reducir grasa.',
            'action': 'Prioriza el entrenamiento de fuerza y una ingesta adecuada de proteína.',
        },
    },
}


def generate_default_recommendations(evaluation):
    """Build a default recommendations dict based on computed index colors."""
    recs = {}

    def _pick(index_key, color):
        color = color or 'green'
        texts = _REC_TEXTS.get(index_key, {}).get(color, _REC_TEXTS.get(index_key, {}).get('green', {}))
        return texts if texts else {'result': '', 'action': ''}

    recs['bmi'] = _pick('bmi', evaluation.bmi_color)
    if evaluation.whr_color:
        recs['whr'] = _pick('whr', evaluation.whr_color)
    if evaluation.bf_color:
        recs['bf'] = _pick('bf', evaluation.bf_color)
    if evaluation.waist_risk_color:
        recs['waist'] = _pick('waist', evaluation.waist_risk_color)
    recs['mass'] = _pick('mass', evaluation.bf_color)

    return recs
