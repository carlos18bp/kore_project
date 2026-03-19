"""Tests for the KORE general index calculator."""
# quality: disable test_too_short (boundary-value calculator assertions, intentionally concise)

from types import SimpleNamespace

import pytest

from core_app.services.kore_index_calculator import (
    classify_kore_index,
    compute_kore_index,
    normalize_anthropometry,
    normalize_metabolic_risk,
    normalize_mood,
    normalize_nutrition,
    normalize_physical,
    normalize_posturometry,
)


class TestNormalizeAnthropometry:
    def test_green_scores(self):
        ev = SimpleNamespace(bmi_color='green', bf_color='green')
        assert normalize_anthropometry(ev) == 85.0

    def test_mixed_colors(self):
        ev = SimpleNamespace(bmi_color='green', bf_color='red')
        assert normalize_anthropometry(ev) == 52.5

    def test_none_eval(self):
        assert normalize_anthropometry(None) is None

    def test_empty_colors(self):
        ev = SimpleNamespace(bmi_color='', bf_color='')
        assert normalize_anthropometry(ev) is None


class TestNormalizeMetabolicRisk:
    def test_all_green(self):
        ev = SimpleNamespace(waist_risk_color='green', whr_color='green', whe_color='green')
        assert normalize_metabolic_risk(ev) == 85.0

    def test_mixed(self):
        ev = SimpleNamespace(waist_risk_color='red', whr_color='yellow', whe_color='green')
        result = normalize_metabolic_risk(ev)
        assert result == round((20 + 60 + 85) / 3, 1)

    def test_none(self):
        assert normalize_metabolic_risk(None) is None


class TestNormalizePosturometry:
    def test_perfect(self):
        ev = SimpleNamespace(global_index=0.0)
        assert normalize_posturometry(ev) == 100.0

    def test_moderate(self):
        ev = SimpleNamespace(global_index=1.0)
        assert normalize_posturometry(ev) == 50.0

    def test_severe(self):
        ev = SimpleNamespace(global_index=2.0)
        assert normalize_posturometry(ev) == 0.0

    def test_none(self):
        assert normalize_posturometry(None) is None

    def test_none_index(self):
        ev = SimpleNamespace(global_index=None)
        assert normalize_posturometry(ev) is None


class TestNormalizePhysical:
    def test_max(self):
        ev = SimpleNamespace(general_index=5.0)
        assert normalize_physical(ev) == 100.0

    def test_min(self):
        ev = SimpleNamespace(general_index=1.0)
        assert normalize_physical(ev) == 0.0

    def test_mid(self):
        ev = SimpleNamespace(general_index=3.0)
        assert normalize_physical(ev) == 50.0

    def test_none(self):
        assert normalize_physical(None) is None


class TestNormalizeMood:
    def test_max(self):
        assert normalize_mood(10) == 100.0

    def test_min(self):
        assert normalize_mood(1) == 0.0

    def test_mid(self):
        assert normalize_mood(5) == pytest.approx(44.4, abs=0.1)

    def test_none(self):
        assert normalize_mood(None) is None


class TestNormalizeNutrition:
    def test_perfect(self):
        assert normalize_nutrition(10) == 100.0

    def test_zero(self):
        assert normalize_nutrition(0) == 0.0

    def test_mid(self):
        assert normalize_nutrition(6.5) == 65.0

    def test_none(self):
        assert normalize_nutrition(None) is None


class TestClassifyKoreIndex:
    def test_critical(self):
        cat, col, msg = classify_kore_index(25)
        assert cat == 'Estado critico'  or 'critico' in cat.lower() or cat == 'Estado cr\u00edtico'
        assert col == 'red'

    def test_intervention(self):
        cat, col, msg = classify_kore_index(50)
        assert col == 'orange'

    def test_in_progress(self):
        cat, col, msg = classify_kore_index(65)
        assert col == 'yellow'

    def test_good(self):
        cat, col, msg = classify_kore_index(80)
        assert col == 'green'

    def test_optimal(self):
        cat, col, msg = classify_kore_index(95)
        assert col == 'green'
        assert 'favorable' in msg.lower() or 'ptimo' in msg.lower()

    def test_none(self):
        cat, col, msg = classify_kore_index(None)
        assert cat == ''


class TestComputeKoreIndex:
    def test_all_modules_perfect(self):
        """Verify KÓRE index ≥ 90 and green color when all six modules have perfect scores."""
        anthro = SimpleNamespace(
            bmi_color='green', bf_color='green',
            waist_risk_color='green', whr_color='green', whe_color='green',
        )
        posturo = SimpleNamespace(global_index=0.0)
        physical = SimpleNamespace(general_index=5.0)
        result = compute_kore_index(
            anthro_eval=anthro,
            posturo_eval=posturo,
            physical_eval=physical,
            mood_score=10,
            nutrition_habit_score=10,
        )
        assert result['kore_score'] is not None
        assert result['kore_score'] >= 90
        assert result['kore_color'] == 'green'
        assert result['modules_available'] == 6

    def test_no_data(self):
        result = compute_kore_index()
        assert result['kore_score'] is None
        assert result['modules_available'] == 0

    def test_partial_data(self):
        anthro = SimpleNamespace(
            bmi_color='yellow', bf_color='yellow',
            waist_risk_color='yellow', whr_color='yellow', whe_color='yellow',
        )
        result = compute_kore_index(anthro_eval=anthro)
        assert result['kore_score'] is not None
        assert result['modules_available'] == 2
        assert result['components']['anthropometry'] == 60.0

    def test_weights_renormalize(self):
        physical = SimpleNamespace(general_index=3.0)
        result = compute_kore_index(physical_eval=physical)
        assert result['kore_score'] == 50.0
        assert result['modules_available'] == 1
