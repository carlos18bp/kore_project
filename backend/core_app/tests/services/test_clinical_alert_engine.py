"""Tests for the clinical alert engine (pure functions only)."""

import pytest
from datetime import date

from core_app.services.clinical_alert_engine import (
    EVAL_THRESHOLDS,
    detect_anthropometry_critical,
    detect_expired_evaluations,
    detect_nutritional_deficit,
    detect_nutrition_habits_specific,
    detect_parq_high_risk,
    detect_physical_low_fitness,
    detect_postural_exercise_conflict,
    detect_posturometry_multiple_alterations,
)


def _all_recent(today, override_module=None, override_date=None):
    """Helper: build a full 5-module dict with a very recent date, optionally overriding one."""
    recent = date.fromordinal(today.toordinal() - 5)  # 5 days ago -> never expired
    base = {m: recent for m in ('anthropometry', 'posturometry', 'physical', 'parq', 'nutrition')}
    if override_module is not None:
        base[override_module] = override_date
    return base


class TestDetectExpiredEvaluations:
    def test_none_date_returns_medio_signal(self):
        today = date(2026, 5, 5)
        last_eval_dates = _all_recent(today, 'anthropometry', None)
        signals = detect_expired_evaluations(last_eval_dates, today)
        expired = [s for s in signals if s['type'] == 'expired_anthropometry']
        assert len(expired) == 1
        assert expired[0]['severity'] == 'medio'
        assert expired[0]['last_eval_date'] is None

    def test_recent_eval_returns_no_signal(self):
        today = date(2026, 5, 5)
        last_eval_dates = _all_recent(today)
        signals = detect_expired_evaluations(last_eval_dates, today)
        assert signals == []

    def test_just_past_threshold_returns_medio(self):
        today = date(2026, 5, 5)
        threshold = EVAL_THRESHOLDS['anthropometry']  # 60
        expired = date.fromordinal(today.toordinal() - threshold - 5)
        last_eval_dates = _all_recent(today, 'anthropometry', expired)
        signals = detect_expired_evaluations(last_eval_dates, today)
        anthro = [s for s in signals if s['type'] == 'expired_anthropometry']
        assert len(anthro) == 1
        assert anthro[0]['severity'] == 'medio'

    def test_past_double_threshold_returns_alto(self):
        today = date(2026, 5, 5)
        threshold = EVAL_THRESHOLDS['anthropometry']  # 60
        very_old = date.fromordinal(today.toordinal() - threshold * 2 - 10)
        last_eval_dates = _all_recent(today, 'anthropometry', very_old)
        signals = detect_expired_evaluations(last_eval_dates, today)
        anthro = [s for s in signals if s['type'] == 'expired_anthropometry']
        assert len(anthro) == 1
        assert anthro[0]['severity'] == 'alto'

    def test_multiple_modules_aggregated(self):
        today = date(2026, 5, 5)
        last_eval_dates = {
            'anthropometry': None,
            'posturometry': date(2026, 3, 1),  # expired (65 days)
            'physical': date(2026, 4, 30),     # recent
            'parq': None,
            'nutrition': date(2025, 1, 1),     # very old
        }
        signals = detect_expired_evaluations(last_eval_dates, today)
        types_found = [s['type'] for s in signals]
        assert 'expired_anthropometry' in types_found
        assert 'expired_parq' in types_found
        assert 'expired_nutrition' in types_found
        assert 'expired_physical' not in types_found

    def test_signal_includes_last_eval_date(self):
        today = date(2026, 5, 5)
        last = date(2026, 1, 1)
        last_eval_dates = _all_recent(today, 'anthropometry', last)
        signals = detect_expired_evaluations(last_eval_dates, today)
        expired = [s for s in signals if s['type'] == 'expired_anthropometry']
        assert len(expired) == 1
        assert expired[0]['last_eval_date'] == last.isoformat()

    def test_parq_threshold_is_90_days(self):
        today = date(2026, 5, 5)
        # 61 days ago: expired for anthropometry (60d), not parq (90d)
        last = date.fromordinal(today.toordinal() - 61)
        anthro_signals = detect_expired_evaluations(
            _all_recent(today, 'anthropometry', last), today
        )
        parq_signals = detect_expired_evaluations(
            _all_recent(today, 'parq', last), today
        )
        anthro_expired = [s for s in anthro_signals if s['type'] == 'expired_anthropometry']
        parq_expired = [s for s in parq_signals if s['type'] == 'expired_parq']
        assert len(anthro_expired) == 1
        assert len(parq_expired) == 0

    def test_empty_dict_returns_signals_for_all_modules(self):
        today = date(2026, 5, 5)
        signals = detect_expired_evaluations({}, today)
        # All 5 modules have no date -> one 'medio' signal each
        assert len(signals) == len(EVAL_THRESHOLDS)
        assert all(s['severity'] == 'medio' for s in signals)


class TestDetectPosturalExerciseConflict:
    def test_no_risky_segments_returns_none(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['hombros_escapulares'],
            exercise_names=['squat', 'sentadilla'],
        )
        assert result is None

    def test_risky_segment_but_no_high_load_exercise_returns_none(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['columna_lumbar'],
            exercise_names=['curl de biceps', 'extension de triceps'],
        )
        assert result is None

    def test_risky_segment_and_high_load_returns_signal(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['columna_lumbar'],
            exercise_names=['Sentadilla con barra'],
        )
        assert result is not None
        assert result['type'] == 'postural_exercise_conflict'
        assert result['severity'] == 'medio'
        assert 'columna_lumbar' in result['detail']

    def test_empty_findings_returns_none(self):
        result = detect_postural_exercise_conflict(
            postural_findings=[],
            exercise_names=['squat', 'deadlift'],
        )
        assert result is None

    def test_empty_exercises_returns_none(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['columna_vertebral'],
            exercise_names=[],
        )
        assert result is None

    def test_case_insensitive_exercise_matching(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['rodillas'],
            exercise_names=['SQUAT PROFUNDO'],
        )
        assert result is not None

    def test_multiple_risky_segments_detected(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['columna_vertebral', 'rodillas'],
            exercise_names=['Peso muerto convencional'],
        )
        assert result is not None
        assert 'columna_vertebral' in result['detail']

    def test_overhead_press_triggers_hombros_conflict(self):
        result = detect_postural_exercise_conflict(
            postural_findings=['hombros'],
            exercise_names=['Overhead press'],
        )
        assert result is not None


class TestDetectNutritionalDeficit:
    def test_none_score_returns_none(self):
        assert detect_nutritional_deficit(None, None) is None

    def test_high_score_returns_none(self):
        assert detect_nutritional_deficit(8.0, 7.0) is None

    def test_score_exactly_4_returns_none(self):
        # 4.0 is not < 4.0
        assert detect_nutritional_deficit(4.0, 3.0) is None

    def test_score_below_2_5_returns_medio(self):
        result = detect_nutritional_deficit(2.0, None)
        assert result is not None
        assert result['type'] == 'nutritional_deficit'
        assert result['severity'] == 'medio'

    def test_score_between_2_5_and_4_improving_returns_none(self):
        # 3.5 with previous 2.5 -> improving -> no signal
        result = detect_nutritional_deficit(3.5, 2.5)
        assert result is None

    def test_score_between_2_5_and_4_not_improving_returns_bajo(self):
        result = detect_nutritional_deficit(3.5, 4.0)
        assert result is not None
        assert result['severity'] == 'bajo'

    def test_score_between_2_5_and_4_no_previous_returns_bajo(self):
        result = detect_nutritional_deficit(3.5, None)
        assert result is not None
        assert result['severity'] == 'bajo'

    def test_signal_includes_module_nutrition(self):
        result = detect_nutritional_deficit(2.0, None)
        assert result['module'] == 'nutrition'

    def test_critical_label_in_detail_for_below_2_5(self):
        result = detect_nutritional_deficit(2.0, None)
        assert 'critico' in result['label'].lower() or '2.0' in result['label']


# ---- New tests for previously-uncovered pure functions ----

class TestDetectAnthropometryCritical:
    _check_date = date(2026, 4, 1)

    def _call(self, bmi=24.0, bmi_category='Normal', bf_color='verde',
              waist_risk_color='verde', whr_color='verde', whe_color='verde',
              check_date=None):
        return detect_anthropometry_critical(
            bmi=bmi,
            bmi_category=bmi_category,
            bf_color=bf_color,
            waist_risk_color=waist_risk_color,
            whr_color=whr_color,
            whe_color=whe_color,
            eval_date=check_date if check_date is not None else self._check_date,
        )

    def test_bmi_gte_30_returns_obesity_signal(self):
        signals = self._call(bmi=31.0, bmi_category='Obesidad I')
        types = [s['type'] for s in signals]
        assert 'anthropometry_obesity' in types

    def test_bmi_gte_35_returns_alto_severity(self):
        signals = self._call(bmi=36.0, bmi_category='Obesidad II')
        obesity = [s for s in signals if s['type'] == 'anthropometry_obesity']
        assert obesity[0]['severity'] == 'alto'

    def test_bmi_between_30_and_35_returns_medio_severity(self):
        signals = self._call(bmi=32.0, bmi_category='Obesidad I')
        obesity = [s for s in signals if s['type'] == 'anthropometry_obesity']
        assert obesity[0]['severity'] == 'medio'

    def test_bmi_none_does_not_produce_obesity_signal(self):
        signals = self._call(bmi=None)
        types = [s['type'] for s in signals]
        assert 'anthropometry_obesity' not in types

    def test_bmi_lt_30_no_obesity_signal(self):
        signals = self._call(bmi=24.5)
        types = [s['type'] for s in signals]
        assert 'anthropometry_obesity' not in types

    def test_critical_body_fat_color_rojo_produces_signal(self):
        signals = self._call(bf_color='rojo')
        types = [s['type'] for s in signals]
        assert 'anthropometry_body_fat_critical' in types

    def test_normal_body_fat_no_bf_signal(self):
        signals = self._call(bf_color='verde')
        types = [s['type'] for s in signals]
        assert 'anthropometry_body_fat_critical' not in types

    def test_waist_risk_color_rojo_produces_signal(self):
        signals = self._call(waist_risk_color='rojo')
        types = [s['type'] for s in signals]
        assert 'anthropometry_waist_risk' in types

    def test_whr_color_rojo_produces_waist_signal(self):
        signals = self._call(whr_color='rojo')
        types = [s['type'] for s in signals]
        assert 'anthropometry_waist_risk' in types

    def test_whe_color_rojo_produces_waist_signal(self):
        signals = self._call(whe_color='rojo')
        types = [s['type'] for s in signals]
        assert 'anthropometry_waist_risk' in types

    def test_all_normal_returns_empty_list(self):
        signals = self._call()
        assert signals == []

    def test_check_date_included_in_obesity_signal(self):
        signals = self._call(bmi=31.0, bmi_category='Obesidad I')
        obesity = [s for s in signals if s['type'] == 'anthropometry_obesity']
        assert obesity[0]['last_eval_date'] == self._check_date.isoformat()

    def test_none_check_date_sets_last_eval_date_none(self):
        signals = detect_anthropometry_critical(
            bmi=31.0, bmi_category='Obesidad I',
            bf_color='verde', waist_risk_color='verde',
            whr_color='verde', whe_color='verde',
            eval_date=None,
        )
        obesity = [s for s in signals if s['type'] == 'anthropometry_obesity']
        assert obesity[0]['last_eval_date'] is None

    def test_multiple_signals_returned_together(self):
        """BMI obesity + critical BF + waist risk can all fire at once."""
        signals = self._call(
            bmi=36.0, bmi_category='Obesidad II',
            bf_color='rojo', waist_risk_color='rojo',
        )
        types = [s['type'] for s in signals]
        assert 'anthropometry_obesity' in types
        assert 'anthropometry_body_fat_critical' in types
        assert 'anthropometry_waist_risk' in types


class TestDetectPosturometryMultipleAlterations:
    _check_date = date(2026, 4, 1)

    def _make_scores(self, altered_count, total=6):
        """Build segment_scores dict with `altered_count` altered segments (score < 3)."""
        scores = {}
        for i in range(total):
            name = f'segment_{i}'
            scores[name] = {'score': 1 if i < altered_count else 3}
        return scores

    def test_three_altered_segments_returns_signal(self):
        scores = self._make_scores(3)
        result = detect_posturometry_multiple_alterations(scores, {}, self._check_date)
        assert result is not None
        assert result['type'] == 'posturometry_multiple_alterations'

    def test_two_altered_segments_returns_none(self):
        scores = self._make_scores(2)
        result = detect_posturometry_multiple_alterations(scores, {}, self._check_date)
        assert result is None

    def test_five_altered_segments_returns_alto_severity(self):
        scores = self._make_scores(5)
        result = detect_posturometry_multiple_alterations(scores, {}, self._check_date)
        assert result is not None
        assert result['severity'] == 'alto'

    def test_three_altered_segments_returns_medio_severity(self):
        scores = self._make_scores(3)
        result = detect_posturometry_multiple_alterations(scores, {}, self._check_date)
        assert result['severity'] == 'medio'

    def test_empty_scores_and_findings_returns_none(self):
        result = detect_posturometry_multiple_alterations({}, {}, self._check_date)
        assert result is None

    def test_falls_back_to_findings_when_scores_empty(self):
        """When segment_scores is empty, findings dict is used as fallback."""
        findings = {
            'anterior': ['segment_a', 'segment_b', 'segment_c'],
        }
        result = detect_posturometry_multiple_alterations({}, findings, self._check_date)
        assert result is not None

    def test_findings_with_dict_items(self):
        """Findings with dict items (segment key) also count."""
        findings = {
            'lateral': [
                {'segment': 'columna_vertebral'},
                {'segment': 'rodillas'},
                {'segment': 'hombros'},
            ],
        }
        result = detect_posturometry_multiple_alterations({}, findings, self._check_date)
        assert result is not None

    def test_check_date_in_signal(self):
        scores = self._make_scores(3)
        result = detect_posturometry_multiple_alterations(scores, {}, self._check_date)
        assert result['last_eval_date'] == self._check_date.isoformat()

    def test_none_check_date_sets_none(self):
        scores = self._make_scores(3)
        result = detect_posturometry_multiple_alterations(scores, {}, None)
        assert result['last_eval_date'] is None


class TestDetectPhysicalLowFitness:
    _check_date = date(2026, 4, 1)

    def test_none_general_index_returns_none(self):
        assert detect_physical_low_fitness(None, '', self._check_date) is None

    def test_index_above_1_5_returns_none(self):
        assert detect_physical_low_fitness(2.0, 'Normal', self._check_date) is None

    def test_index_exactly_1_5_returns_signal(self):
        result = detect_physical_low_fitness(1.5, 'Muy bajo', self._check_date)
        assert result is not None
        assert result['type'] == 'physical_low_fitness'

    def test_index_below_1_5_returns_signal(self):
        result = detect_physical_low_fitness(1.2, 'Muy bajo', self._check_date)
        assert result is not None

    def test_index_lte_1_0_returns_alto_severity(self):
        result = detect_physical_low_fitness(0.8, 'Critico', self._check_date)
        assert result['severity'] == 'alto'

    def test_index_between_1_0_and_1_5_returns_medio_severity(self):
        result = detect_physical_low_fitness(1.3, 'Muy bajo', self._check_date)
        assert result['severity'] == 'medio'

    def test_signal_includes_module_physical(self):
        result = detect_physical_low_fitness(1.0, 'Muy bajo', self._check_date)
        assert result['module'] == 'physical'

    def test_check_date_included_in_signal(self):
        result = detect_physical_low_fitness(1.0, 'Muy bajo', self._check_date)
        assert result['last_eval_date'] == self._check_date.isoformat()

    def test_none_check_date_sets_none_last_eval(self):
        result = detect_physical_low_fitness(1.0, 'Muy bajo', None)
        assert result['last_eval_date'] is None

    def test_general_category_in_label(self):
        result = detect_physical_low_fitness(1.0, 'Muy bajo', self._check_date)
        assert 'Muy bajo' in result['label']


class TestDetectParqHighRisk:
    _check_date = date(2026, 4, 1)

    def _call(self, yes_count=0, q1=False, q2=False, q3=False, q7=False, classification=''):
        return detect_parq_high_risk(
            yes_count=yes_count,
            q1_heart=q1,
            q2_chest=q2,
            q3_dizziness=q3,
            q7_medical_supervision=q7,
            risk_classification=classification,
            eval_date=self._check_date,
        )

    def test_yes_count_zero_returns_none(self):
        assert self._call(yes_count=0) is None

    def test_yes_count_2_no_critical_returns_none(self):
        assert self._call(yes_count=2) is None

    def test_yes_count_gte_3_returns_signal(self):
        result = self._call(yes_count=3)
        assert result is not None
        assert result['type'] == 'parq_high_risk'

    def test_yes_count_gte_3_returns_alto_severity(self):
        result = self._call(yes_count=3)
        assert result['severity'] == 'alto'

    def test_q1_heart_critical_returns_signal(self):
        result = self._call(yes_count=1, q1=True)
        assert result is not None

    def test_q1_alone_returns_medio_severity(self):
        # Only q1 is critical but severity logic: q1 alone -> medio (not q2/q3/q7)
        result = self._call(yes_count=1, q1=True)
        assert result['severity'] == 'medio'

    def test_q2_chest_critical_returns_signal(self):
        result = self._call(yes_count=1, q2=True)
        assert result is not None

    def test_q2_chest_returns_alto_severity(self):
        result = self._call(yes_count=1, q2=True)
        assert result['severity'] == 'alto'

    def test_q3_dizziness_returns_signal(self):
        result = self._call(yes_count=1, q3=True)
        assert result is not None

    def test_q7_medical_supervision_returns_signal(self):
        result = self._call(yes_count=1, q7=True)
        assert result is not None

    def test_risk_classification_in_detail(self):
        result = self._call(yes_count=3, classification='Alto riesgo')
        assert 'Alto riesgo' in result['detail']

    def test_signal_module_is_parq(self):
        result = self._call(yes_count=3)
        assert result['module'] == 'parq'

    def test_check_date_in_signal(self):
        result = self._call(yes_count=3)
        assert result['last_eval_date'] == self._check_date.isoformat()

    def test_none_check_date_handled(self):
        result = detect_parq_high_risk(
            yes_count=3,
            q1_heart=False,
            q2_chest=False,
            q3_dizziness=False,
            q7_medical_supervision=False,
            risk_classification='',
            eval_date=None,
        )
        assert result['last_eval_date'] is None


class TestDetectNutritionHabitsSpecific:
    _check_date = date(2026, 4, 1)

    def _call(self, ultraprocessed=None, water=None, breakfast=None, sugary=None):
        return detect_nutrition_habits_specific(
            ultraprocessed_weekly=ultraprocessed,
            water_liters=water,
            eats_breakfast=breakfast,
            sugary_drinks_weekly=sugary,
            eval_date=self._check_date,
        )

    def test_all_none_returns_empty_list(self):
        assert self._call() == []

    def test_all_normal_returns_empty_list(self):
        result = self._call(ultraprocessed=5, water=2.0, breakfast=True, sugary=3)
        assert result == []

    def test_ultraprocessed_gt_7_returns_signal(self):
        result = self._call(ultraprocessed=8)
        types = [s['type'] for s in result]
        assert 'nutrition_ultraprocessed_high' in types

    def test_ultraprocessed_gt_14_returns_alto_severity(self):
        result = self._call(ultraprocessed=15)
        signal = next(s for s in result if s['type'] == 'nutrition_ultraprocessed_high')
        assert signal['severity'] == 'alto'

    def test_ultraprocessed_between_8_and_14_returns_medio_severity(self):
        result = self._call(ultraprocessed=10)
        signal = next(s for s in result if s['type'] == 'nutrition_ultraprocessed_high')
        assert signal['severity'] == 'medio'

    def test_ultraprocessed_exactly_7_no_signal(self):
        result = self._call(ultraprocessed=7)
        types = [s['type'] for s in result]
        assert 'nutrition_ultraprocessed_high' not in types

    def test_water_lt_1_returns_signal(self):
        result = self._call(water=0.5)
        types = [s['type'] for s in result]
        assert 'nutrition_low_water' in types

    def test_water_exactly_1_no_signal(self):
        result = self._call(water=1.0)
        types = [s['type'] for s in result]
        assert 'nutrition_low_water' not in types

    def test_water_none_no_signal(self):
        result = self._call(water=None)
        types = [s['type'] for s in result]
        assert 'nutrition_low_water' not in types

    def test_skips_breakfast_false_returns_signal(self):
        result = self._call(breakfast=False)
        types = [s['type'] for s in result]
        assert 'nutrition_skips_breakfast' in types

    def test_eats_breakfast_true_no_signal(self):
        result = self._call(breakfast=True)
        types = [s['type'] for s in result]
        assert 'nutrition_skips_breakfast' not in types

    def test_eats_breakfast_none_no_signal(self):
        result = self._call(breakfast=None)
        types = [s['type'] for s in result]
        assert 'nutrition_skips_breakfast' not in types

    def test_sugary_drinks_gt_7_returns_signal(self):
        result = self._call(sugary=8)
        types = [s['type'] for s in result]
        assert 'nutrition_sugary_drinks_high' in types

    def test_sugary_drinks_exactly_7_no_signal(self):
        result = self._call(sugary=7)
        types = [s['type'] for s in result]
        assert 'nutrition_sugary_drinks_high' not in types

    def test_sugary_drinks_none_no_signal(self):
        result = self._call(sugary=None)
        types = [s['type'] for s in result]
        assert 'nutrition_sugary_drinks_high' not in types

    def test_multiple_signals_all_bad(self):
        result = self._call(ultraprocessed=10, water=0.5, breakfast=False, sugary=10)
        assert len(result) == 4

    def test_check_date_in_signals(self):
        result = self._call(ultraprocessed=10)
        assert result[0]['last_eval_date'] == self._check_date.isoformat()

    def test_none_check_date_sets_none(self):
        result = detect_nutrition_habits_specific(
            ultraprocessed_weekly=10,
            water_liters=None,
            eats_breakfast=None,
            sugary_drinks_weekly=None,
            eval_date=None,
        )
        assert result[0]['last_eval_date'] is None


class TestDetectNutritionalDeficitAdditional:
    """Additional edge cases not covered by TestDetectNutritionalDeficit."""

    def test_habit_score_exactly_2_5_triggers_warning_not_critical(self):
        # 2.5 is NOT < 2.5, so goes to the 2.5-4.0 range without improvement
        result = detect_nutritional_deficit(2.5, None)
        assert result is not None
        assert result['severity'] == 'bajo'

    def test_habit_score_exactly_4_0_returns_none(self):
        assert detect_nutritional_deficit(4.0, None) is None

    def test_improving_score_in_range_returns_none(self):
        # 3.0 with previous 2.0 -> improving -> no signal
        assert detect_nutritional_deficit(3.0, 2.0) is None

    def test_regressing_score_returns_signal(self):
        # 3.0 with previous 4.0 -> not improving -> signal
        result = detect_nutritional_deficit(3.0, 4.0)
        assert result is not None

    def test_score_above_4_always_none_regardless_of_previous(self):
        assert detect_nutritional_deficit(5.0, 3.0) is None


# ---- ORM orchestrator tests ----

@pytest.mark.django_db
class TestComputeClinicalSignals:
    def test_customer_with_no_evaluations_returns_list(self):
        """No evaluations -> expired signals returned, no exception raised."""
        from datetime import date
        from core_app.models import User
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_no_evals@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        # With no evaluations, we expect expired signals for all 5 modules
        assert len(result) > 0
        types = [s['type'] for s in result]
        assert any(t.startswith('expired_') for t in types)

    def test_customer_with_anthro_evaluation_returns_list(self):
        """Customer with anthropometry evaluation -> function returns list without exception."""
        from datetime import date
        from core_app.models import User
        from core_app.models.anthropometry import AnthropometryEvaluation
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_with_anthro@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        # Create an anthropometry evaluation to exercise the anthro branch
        AnthropometryEvaluation.objects.create(
            customer=customer,
            evaluation_date=today,
            weight_kg=75,
            height_cm=170,
            bmi=25.99,
            bmi_category='Normal',
            bf_color='verde',
            waist_risk_color='verde',
            whr_color='verde',
            whe_color='verde',
        )

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        # anthropometry signal should NOT include obesity (bmi < 30)
        anthro_obesity = [s for s in result if s['type'] == 'anthropometry_obesity']
        assert anthro_obesity == []

    def test_customer_with_posturometry_evaluation_exercises_postural_branch(self):
        """Customer with PosturometryEvaluation exercises both multiple-alterations and findings branches."""
        from datetime import date
        from core_app.models import User
        from core_app.models.posturometry import PosturometryEvaluation
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_with_posturo@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        # Evaluation with enough altered segments to trigger the signal
        PosturometryEvaluation.objects.create(
            customer=customer,
            evaluation_date=today,
            segment_scores={
                'seg1': {'score': 1},
                'seg2': {'score': 1},
                'seg3': {'score': 1},
            },
            findings={},
        )

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        types = [s['type'] for s in result]
        assert 'posturometry_multiple_alterations' in types

    def test_customer_with_posturometry_no_postural_findings_skips_exercise_conflict(self):
        """When postural findings dict is empty, the postural-exercise conflict branch is not fired."""
        from datetime import date
        from core_app.models import User
        from core_app.models.posturometry import PosturometryEvaluation
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_posturo_nofindings@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        # No findings dict means postural_findings list stays empty → no conflict signal
        PosturometryEvaluation.objects.create(
            customer=customer,
            evaluation_date=today,
            segment_scores={},
            findings={},
        )

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        types = [s['type'] for s in result]
        assert 'postural_exercise_conflict' not in types

    def test_customer_with_physical_evaluation_exercises_physical_branch(self):
        """Customer with low PhysicalEvaluation triggers physical_low_fitness signal."""
        from datetime import date
        from core_app.models import User
        from core_app.models.physical_evaluation import PhysicalEvaluation
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_with_physical@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        # save() recomputes general_index via calculator; use update() to force low value
        eval_ = PhysicalEvaluation.objects.create(
            customer=customer,
            evaluation_date=today,
        )
        PhysicalEvaluation.objects.filter(pk=eval_.pk).update(
            general_index=1.0, general_category='Muy bajo',
        )

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        types = [s['type'] for s in result]
        assert 'physical_low_fitness' in types

    def test_customer_with_parq_assessment_exercises_parq_branch(self):
        """Customer with high-risk PARQ (3 yes answers) triggers parq_high_risk signal."""
        from datetime import date
        from core_app.models import User, ParqAssessment
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_with_parq@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        # save() recomputes yes_count from individual booleans — set 3 questions to True
        ParqAssessment.objects.create(
            customer=customer,
            q1_heart_condition=True,
            q2_chest_pain=True,
            q3_dizziness=True,
            q4_chronic_condition=False,
            q5_prescribed_medication=False,
            q6_bone_joint_problem=False,
            q7_medical_supervision=False,
        )

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        types = [s['type'] for s in result]
        assert 'parq_high_risk' in types

    def test_customer_with_nutrition_habit_exercises_nutrition_branches(self):
        """Customer with bad NutritionHabit triggers nutrition-specific and deficit signals."""
        from datetime import date
        from core_app.models import User, NutritionHabit
        from core_app.services.clinical_alert_engine import compute_clinical_signals

        customer = User.objects.create_user(
            email='test_clinical_with_nutrition@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        # save() recomputes habit_score via nutrition_calculator; use update() to force low value.
        # All required fields must be provided.
        habit = NutritionHabit.objects.create(
            customer=customer,
            meals_per_day=2,
            water_liters=0.5,
            fruit_weekly=0,
            vegetable_weekly=0,
            protein_frequency=1,
            ultraprocessed_weekly=10,
            sugary_drinks_weekly=9,
            eats_breakfast=False,
        )
        NutritionHabit.objects.filter(pk=habit.pk).update(habit_score=2.0)

        result = compute_clinical_signals(customer, None, today)

        assert isinstance(result, list)
        types = [s['type'] for s in result]
        assert 'nutrition_ultraprocessed_high' in types
        assert 'nutrition_low_water' in types
        assert 'nutrition_skips_breakfast' in types
        assert 'nutritional_deficit' in types


class TestDetectExpiredEvaluationsBoundary:
    """Edge cases for the exact boundary values of the expiry threshold."""

    def test_eval_exactly_at_threshold_returns_no_signal(self):
        """Evaluation made exactly `threshold` days ago → no signal (boundary is strict >)."""
        today = date(2026, 5, 5)
        threshold = EVAL_THRESHOLDS['anthropometry']  # 60
        # exactly threshold days ago: days_since == threshold, NOT > threshold
        exact_date = date.fromordinal(today.toordinal() - threshold)
        last_eval_dates = _all_recent(today, 'anthropometry', exact_date)
        signals = detect_expired_evaluations(last_eval_dates, today)
        anthro = [s for s in signals if s['type'] == 'expired_anthropometry']
        assert len(anthro) == 0

    def test_eval_one_day_under_threshold_returns_no_signal(self):
        """Evaluation `threshold - 1` days ago → no signal (strictly within threshold)."""
        today = date(2026, 5, 5)
        threshold = EVAL_THRESHOLDS['anthropometry']  # 60
        under_date = date.fromordinal(today.toordinal() - (threshold - 1))
        last_eval_dates = _all_recent(today, 'anthropometry', under_date)
        signals = detect_expired_evaluations(last_eval_dates, today)
        anthro = [s for s in signals if s['type'] == 'expired_anthropometry']
        assert len(anthro) == 0

    def test_eval_exactly_at_double_threshold_returns_medio_not_alto(self):
        """Evaluation made exactly 2*threshold days ago → medio (boundary is strict > 2*threshold)."""
        today = date(2026, 5, 5)
        threshold = EVAL_THRESHOLDS['anthropometry']  # 60
        double_exact = date.fromordinal(today.toordinal() - threshold * 2)
        last_eval_dates = _all_recent(today, 'anthropometry', double_exact)
        signals = detect_expired_evaluations(last_eval_dates, today)
        anthro = [s for s in signals if s['type'] == 'expired_anthropometry']
        # days_since == 120, NOT > 120, so it falls into the `> threshold` branch (medio)
        assert len(anthro) == 1
        assert anthro[0]['severity'] == 'medio'
