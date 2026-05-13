"""Tests for the clinical alert engine (pure functions only)."""

from datetime import date

from core_app.services.clinical_alert_engine import (
    EVAL_THRESHOLDS,
    detect_expired_evaluations,
    detect_nutritional_deficit,
    detect_postural_exercise_conflict,
)


def _all_recent(today, override_module=None, override_date=None):
    """Helper: build a full 5-module dict with a very recent date, optionally overriding one."""
    recent = date.fromordinal(today.toordinal() - 5)  # 5 days ago → never expired
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
        # All 5 modules have no date → one 'medio' signal each
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
            exercise_names=['curl de bíceps', 'extensión de tríceps'],
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
        # 3.5 with previous 2.5 → improving → no signal
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
        assert 'crítico' in result['label'].lower() or '2.0' in result['label']
