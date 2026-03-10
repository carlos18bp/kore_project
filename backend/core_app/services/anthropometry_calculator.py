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


def compute_all(weight_kg, height_cm, waist_cm, hip_cm, age, sex):
    """Run all calculations and return a flat dict of results."""
    bmi = calculate_bmi(weight_kg, height_cm)
    whr = calculate_whr(waist_cm, hip_cm, sex)
    whe = calculate_whe(waist_cm, height_cm)
    bf = calculate_body_fat(bmi['value'], age, sex)
    mass = calculate_mass_composition(float(weight_kg), bf['value'])
    waist_r = calculate_waist_risk(waist_cm, sex)

    return {
        'bmi': bmi['value'],
        'bmi_category': bmi['category'],
        'bmi_color': bmi['color'],
        'waist_hip_ratio': whr['value'],
        'whr_risk': whr['risk'],
        'whr_color': whr['color'],
        'waist_height_ratio': whe['value'],
        'whe_risk': whe['risk'],
        'whe_color': whe['color'],
        'body_fat_pct': bf['value'],
        'bf_category': bf['category'],
        'bf_color': bf['color'],
        'fat_mass_kg': mass['fat_mass_kg'],
        'lean_mass_kg': mass['lean_mass_kg'],
        'waist_risk': waist_r['risk'],
        'waist_risk_color': waist_r['color'],
    }
