"""Tests for the anthropometry calculator service.

Covers all 10 pure functions: BMI, WHR, WHE, body fat (Deurenberg),
mass composition, waist risk, Jackson-Pollock body fat, classify_body_fat,
asymmetries, compute_all, and generate_default_recommendations.
"""
# quality: disable test_too_short (boundary-value calculator assertions, intentionally concise)

from types import SimpleNamespace

from core_app.services.anthropometry_calculator import (
    calculate_asymmetries,
    calculate_bmi,
    calculate_body_fat,
    calculate_body_fat_jackson_pollock,
    calculate_mass_composition,
    calculate_waist_risk,
    calculate_whe,
    calculate_whr,
    classify_body_fat,
    compute_all,
    generate_default_recommendations,
)

MALE_SKINFOLDS = {
    'triceps_d': 10, 'triceps_i': 12,
    'pecho': 8,
    'subescapular_d': 14, 'subescapular_i': 13,
    'supraespinal': 10,
    'abdominal': 15,
    'muslo_d': 12, 'muslo_i': 14,
    'pantorrilla_d': 8, 'pantorrilla_i': 9,
}

FEMALE_SKINFOLDS = {
    'triceps_d': 15, 'triceps_i': 16,
    'pecho': 10,
    'subescapular_d': 18, 'subescapular_i': 17,
    'supraespinal': 14,
    'abdominal': 20,
    'muslo_d': 18, 'muslo_i': 19,
    'pantorrilla_d': 10, 'pantorrilla_i': 11,
}


# ── calculate_bmi ──


class TestCalculateBmi:
    def test_underweight_returns_yellow(self):
        result = calculate_bmi(50, 180)
        assert result['category'] == 'Bajo peso'
        assert result['color'] == 'yellow'
        assert result['value'] < 18.5

    def test_healthy_weight_returns_green(self):
        result = calculate_bmi(70, 175)
        assert result['category'] == 'Peso saludable'
        assert result['color'] == 'green'
        assert result['value'] == 22.86

    def test_overweight_returns_yellow(self):
        result = calculate_bmi(85, 175)
        assert result['category'] == 'Sobrepeso'
        assert result['color'] == 'yellow'
        assert 25.0 <= result['value'] < 30.0

    def test_obesity_class_1_returns_red(self):
        result = calculate_bmi(100, 175)
        assert result['category'] == 'Obesidad I'
        assert result['color'] == 'red'
        assert 30.0 <= result['value'] < 35.0

    def test_obesity_class_2_returns_red(self):
        result = calculate_bmi(110, 175)
        assert result['category'] == 'Obesidad II'
        assert result['color'] == 'red'
        assert 35.0 <= result['value'] < 40.0

    def test_obesity_class_3_returns_red(self):
        result = calculate_bmi(130, 175)
        assert result['category'] == 'Obesidad III'
        assert result['color'] == 'red'
        assert result['value'] >= 40.0

    def test_result_is_rounded_to_two_decimals(self):
        result = calculate_bmi(70, 175)
        assert result['value'] == round(result['value'], 2)


# ── calculate_whr ──


class TestCalculateWhr:
    def test_male_low_risk(self):
        result = calculate_whr(80, 100, 'masculino')
        assert result['risk'] == 'Bajo'
        assert result['color'] == 'green'

    def test_male_moderate_risk(self):
        result = calculate_whr(95, 100, 'masculino')
        assert result['risk'] == 'Moderado'
        assert result['color'] == 'yellow'

    def test_male_high_risk(self):
        result = calculate_whr(105, 100, 'masculino')
        assert result['risk'] == 'Alto'
        assert result['color'] == 'red'

    def test_female_low_risk(self):
        result = calculate_whr(70, 100, 'femenino')
        assert result['risk'] == 'Bajo'
        assert result['color'] == 'green'

    def test_female_moderate_risk(self):
        result = calculate_whr(82, 100, 'femenino')
        assert result['risk'] == 'Moderado'
        assert result['color'] == 'yellow'

    def test_female_high_risk(self):
        result = calculate_whr(90, 100, 'femenino')
        assert result['risk'] == 'Alto'
        assert result['color'] == 'red'


# ── calculate_whe ──


class TestCalculateWhe:
    def test_healthy(self):
        result = calculate_whe(75, 175)
        assert result['risk'] == 'Saludable'
        assert result['color'] == 'green'

    def test_moderate_risk(self):
        result = calculate_whe(95, 175)
        assert result['risk'] == 'Riesgo moderado'
        assert result['color'] == 'yellow'

    def test_high_risk(self):
        result = calculate_whe(110, 175)
        assert result['risk'] == 'Riesgo alto'
        assert result['color'] == 'red'


# ── calculate_body_fat (Deurenberg) ──


class TestCalculateBodyFat:
    def test_male_very_low(self):
        result = calculate_body_fat(15.0, 18, 'masculino')
        assert result['category'] == 'Muy bajo'
        assert result['color'] == 'yellow'
        assert result['value'] < 8

    def test_male_healthy(self):
        result = calculate_body_fat(22.0, 30, 'masculino')
        assert result['category'] == 'Saludable'
        assert result['color'] == 'green'

    def test_male_elevated(self):
        result = calculate_body_fat(25.0, 35, 'masculino')
        assert result['category'] == 'Elevado'
        assert result['color'] == 'yellow'
        assert 20 < result['value'] <= 25

    def test_male_high(self):
        result = calculate_body_fat(35.0, 50, 'masculino')
        assert result['category'] == 'Alto'
        assert result['color'] == 'red'

    def test_female_very_low(self):
        result = calculate_body_fat(14.0, 15, 'femenino')
        assert result['category'] == 'Muy bajo'
        assert result['color'] == 'yellow'
        assert result['value'] < 15

    def test_female_healthy(self):
        result = calculate_body_fat(22.0, 30, 'femenino')
        assert result['category'] == 'Saludable'
        assert result['color'] == 'green'

    def test_female_elevated(self):
        result = calculate_body_fat(25.0, 40, 'femenino')
        assert result['category'] == 'Elevado'
        assert result['color'] == 'yellow'
        assert 30 < result['value'] <= 35

    def test_female_high(self):
        result = calculate_body_fat(35.0, 60, 'femenino')
        assert result['category'] == 'Alto'
        assert result['color'] == 'red'


# ── calculate_mass_composition ──


class TestCalculateMassComposition:
    def test_normal_composition(self):
        result = calculate_mass_composition(80, 20.0)
        assert result['fat_mass_kg'] == 16.0
        assert result['lean_mass_kg'] == 64.0

    def test_low_fat_composition(self):
        result = calculate_mass_composition(70, 10.0)
        assert result['fat_mass_kg'] == 7.0
        assert result['lean_mass_kg'] == 63.0


# ── calculate_waist_risk ──


class TestCalculateWaistRisk:
    def test_male_low(self):
        result = calculate_waist_risk(85, 'masculino')
        assert result['risk'] == 'Bajo'
        assert result['color'] == 'green'

    def test_male_increased(self):
        result = calculate_waist_risk(98, 'masculino')
        assert result['risk'] == 'Aumentado'
        assert result['color'] == 'yellow'

    def test_male_high(self):
        result = calculate_waist_risk(105, 'masculino')
        assert result['risk'] == 'Alto'
        assert result['color'] == 'red'

    def test_female_low(self):
        result = calculate_waist_risk(70, 'femenino')
        assert result['risk'] == 'Bajo'
        assert result['color'] == 'green'

    def test_female_increased(self):
        result = calculate_waist_risk(84, 'femenino')
        assert result['risk'] == 'Aumentado'
        assert result['color'] == 'yellow'

    def test_female_high(self):
        result = calculate_waist_risk(95, 'femenino')
        assert result['risk'] == 'Alto'
        assert result['color'] == 'red'


# ── calculate_body_fat_jackson_pollock ──


class TestCalculateBodyFatJacksonPollock:
    def test_returns_none_when_insufficient_sites(self):
        skinfolds = {'triceps_d': 10, 'triceps_i': 12}
        result = calculate_body_fat_jackson_pollock(skinfolds, 30, 'masculino')
        assert result is None

    def test_male_with_sufficient_sites(self):
        """Return body fat result when all required male skinfold sites are present."""
        result = calculate_body_fat_jackson_pollock(MALE_SKINFOLDS, 30, 'masculino')
        assert result is not None
        assert 'value' in result
        assert 'category' in result
        assert 'color' in result
        assert 'sum_skinfolds' in result

    def test_female_with_sufficient_sites(self):
        result = calculate_body_fat_jackson_pollock(FEMALE_SKINFOLDS, 30, 'femenino')
        assert result is not None
        assert result['value'] > 0

    def test_extreme_skinfold_values_still_produce_result(self):
        """Very high skinfold sums produce a clamped minimum body fat."""
        skinfolds = {
            'triceps_d': 500, 'triceps_i': 500,
            'pecho': 500,
            'subescapular_d': 500, 'subescapular_i': 500,
            'supraespinal': 500,
            'abdominal': 500,
        }
        result = calculate_body_fat_jackson_pollock(skinfolds, 30, 'masculino')
        if result is not None:
            assert result['value'] >= 1.0

    def test_minimum_pct_is_one(self):
        """Body fat % should be clamped to at least 1.0."""
        skinfolds = {
            'triceps_d': 3, 'triceps_i': 3,
            'pecho': 3,
            'subescapular_d': 3, 'subescapular_i': 3,
            'supraespinal': 3,
            'abdominal': 3,
        }
        result = calculate_body_fat_jackson_pollock(skinfolds, 18, 'masculino')
        if result is not None:
            assert result['value'] >= 1.0

    def test_averages_d_and_i_measurements(self):
        """When both D and I values provided, function averages them."""
        skinfolds = {
            'triceps_d': 10, 'triceps_i': 20,
            'pecho': 10,
            'subescapular_d': 15, 'subescapular_i': 15,
            'supraespinal': 12,
        }
        result = calculate_body_fat_jackson_pollock(skinfolds, 30, 'masculino')
        assert result is not None


# ── classify_body_fat ──


class TestClassifyBodyFat:
    def test_male_very_low(self):
        result = classify_body_fat(5.0, 'masculino')
        assert result['category'] == 'Muy bajo'

    def test_male_healthy(self):
        result = classify_body_fat(15.0, 'masculino')
        assert result['category'] == 'Saludable'

    def test_male_elevated(self):
        result = classify_body_fat(22.0, 'masculino')
        assert result['category'] == 'Elevado'

    def test_male_high(self):
        result = classify_body_fat(30.0, 'masculino')
        assert result['category'] == 'Alto'

    def test_female_very_low(self):
        result = classify_body_fat(10.0, 'femenino')
        assert result['category'] == 'Muy bajo'

    def test_female_healthy(self):
        result = classify_body_fat(25.0, 'femenino')
        assert result['category'] == 'Saludable'

    def test_female_elevated(self):
        result = classify_body_fat(32.0, 'femenino')
        assert result['category'] == 'Elevado'

    def test_female_high(self):
        result = classify_body_fat(40.0, 'femenino')
        assert result['category'] == 'Alto'

    def test_includes_sum_skinfolds_when_provided(self):
        result = classify_body_fat(15.0, 'masculino', sum_sf=95.5)
        assert result['sum_skinfolds'] == 95.5

    def test_excludes_sum_skinfolds_when_none(self):
        result = classify_body_fat(15.0, 'masculino')
        assert 'sum_skinfolds' not in result


# ── calculate_asymmetries ──


class TestCalculateAsymmetries:
    def test_detects_asymmetry_above_10_pct(self):
        measurements = {'brazo_d': 35, 'brazo_i': 28}
        result = calculate_asymmetries(measurements)
        assert 'brazo' in result
        assert result['brazo']['diff_pct'] > 10

    def test_no_asymmetry_within_threshold(self):
        measurements = {'brazo_d': 35, 'brazo_i': 34}
        result = calculate_asymmetries(measurements)
        assert 'brazo' not in result

    def test_skips_none_values(self):
        measurements = {'brazo_d': 35, 'brazo_i': None}
        result = calculate_asymmetries(measurements)
        assert len(result) == 0

    def test_handles_empty_dict(self):
        result = calculate_asymmetries({})
        assert result == {}

    def test_skips_zero_values(self):
        measurements = {'brazo_d': 0, 'brazo_i': 35}
        result = calculate_asymmetries(measurements)
        assert 'brazo' not in result

    def test_multiple_pairs(self):
        measurements = {
            'brazo_d': 40, 'brazo_i': 30,
            'muslo_d': 55, 'muslo_i': 54,
        }
        result = calculate_asymmetries(measurements)
        assert 'brazo' in result
        assert 'muslo' not in result


# ── compute_all ──


class TestComputeAll:
    def test_basic_computation_without_waist(self):
        result = compute_all(
            weight_kg=70, height_cm=175,
            waist_cm=None, hip_cm=None,
            age=30, sex='masculino',
        )
        assert result['bmi'] is not None
        assert result['bmi_category'] != ''
        assert result['waist_hip_ratio'] is None
        assert result['whr_risk'] == ''
        assert result['waist_height_ratio'] is None
        assert result['body_fat_pct'] is not None
        assert result['bf_method'] == 'deurenberg'

    def test_full_computation_with_waist_and_hip(self):
        result = compute_all(
            weight_kg=80, height_cm=180,
            waist_cm=85, hip_cm=100,
            age=35, sex='masculino',
        )
        assert result['waist_hip_ratio'] is not None
        assert result['whr_risk'] != ''
        assert result['waist_height_ratio'] is not None
        assert result['waist_risk'] != ''

    def test_jackson_pollock_method_when_skinfolds_sufficient(self):
        """Use Jackson-Pollock method when all skinfold sites are provided."""
        result = compute_all(
            weight_kg=80, height_cm=180,
            waist_cm=85, hip_cm=100,
            age=30, sex='masculino',
            skinfolds=MALE_SKINFOLDS,
        )
        assert result['bf_method'] == 'jackson_pollock'
        assert result['sum_skinfolds'] is not None

    def test_fallback_to_deurenberg_with_insufficient_skinfolds(self):
        skinfolds = {'triceps_d': 10}
        result = compute_all(
            weight_kg=70, height_cm=175,
            waist_cm=None, hip_cm=None,
            age=30, sex='femenino',
            skinfolds=skinfolds,
        )
        assert result['bf_method'] == 'deurenberg'
        assert result['sum_skinfolds'] is None

    def test_asymmetries_included_in_result(self):
        skinfolds = {'triceps_d': 40, 'triceps_i': 20}
        result = compute_all(
            weight_kg=70, height_cm=175,
            waist_cm=None, hip_cm=None,
            age=30, sex='masculino',
            skinfolds=skinfolds,
        )
        assert 'asymmetries' in result
        assert 'triceps' in result['asymmetries']

    def test_female_computation(self):
        result = compute_all(
            weight_kg=60, height_cm=165,
            waist_cm=70, hip_cm=95,
            age=28, sex='femenino',
        )
        assert result['bmi'] is not None
        assert result['waist_hip_ratio'] is not None


# ── generate_default_recommendations ──


class TestGenerateDefaultRecommendations:
    def test_generates_bmi_recommendation(self):
        ev = SimpleNamespace(
            bmi_color='green', whr_color='', bf_color='green',
            waist_risk_color='',
        )
        recs = generate_default_recommendations(ev)
        assert 'bmi' in recs
        assert 'result' in recs['bmi']
        assert 'action' in recs['bmi']

    def test_generates_whr_when_color_present(self):
        ev = SimpleNamespace(
            bmi_color='green', whr_color='yellow', bf_color='green',
            waist_risk_color='',
        )
        recs = generate_default_recommendations(ev)
        assert 'whr' in recs

    def test_skips_whr_when_color_empty(self):
        ev = SimpleNamespace(
            bmi_color='green', whr_color='', bf_color='green',
            waist_risk_color='',
        )
        recs = generate_default_recommendations(ev)
        assert 'whr' not in recs

    def test_generates_bf_when_color_present(self):
        ev = SimpleNamespace(
            bmi_color='green', whr_color='', bf_color='red',
            waist_risk_color='',
        )
        recs = generate_default_recommendations(ev)
        assert 'bf' in recs

    def test_generates_waist_when_color_present(self):
        ev = SimpleNamespace(
            bmi_color='green', whr_color='', bf_color='green',
            waist_risk_color='yellow',
        )
        recs = generate_default_recommendations(ev)
        assert 'waist' in recs

    def test_always_includes_mass_recommendation(self):
        ev = SimpleNamespace(
            bmi_color='red', whr_color='', bf_color='red',
            waist_risk_color='',
        )
        recs = generate_default_recommendations(ev)
        assert 'mass' in recs

    def test_all_colors_produce_valid_texts(self):
        for color in ('green', 'yellow', 'red'):
            ev = SimpleNamespace(
                bmi_color=color, whr_color=color, bf_color=color,
                waist_risk_color=color,
            )
            recs = generate_default_recommendations(ev)
            assert recs['bmi']['result'] != ''
            assert recs['bmi']['action'] != ''

    def test_none_color_defaults_to_green(self):
        ev = SimpleNamespace(
            bmi_color=None, whr_color='', bf_color=None,
            waist_risk_color='',
        )
        recs = generate_default_recommendations(ev)
        assert 'bmi' in recs
        assert recs['bmi']['result'] != ''
