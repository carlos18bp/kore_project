"""Tests for the PAR-Q+ risk classification calculator."""
# quality: disable test_too_short (boundary-value calculator assertions, intentionally concise)


from core_app.services.parq_calculator import (
    PARQ_QUESTION_KEYS,
    classify_risk,
    compute_all,
)


class TestClassifyRisk:
    def test_zero_yes_apto(self):
        classification, label, color = classify_risk(0)
        assert classification == 'apto'
        assert label == 'Apto para ejercicio'
        assert color == 'green'

    def test_one_yes_precaution(self):
        classification, label, color = classify_risk(1)
        assert classification == 'apto_con_precaucion'
        assert color == 'yellow'

    def test_two_yes_precaution(self):
        classification, label, color = classify_risk(2)
        assert classification == 'apto_con_precaucion'
        assert color == 'yellow'

    def test_three_yes_requires_medical(self):
        classification, label, color = classify_risk(3)
        assert classification == 'requiere_valoracion'
        assert label == 'Requiere valoración médica'
        assert color == 'red'

    def test_seven_yes_requires_medical(self):
        classification, label, color = classify_risk(7)
        assert classification == 'requiere_valoracion'
        assert color == 'red'


class TestComputeAll:
    def test_all_false_apto(self):
        result = compute_all()
        assert result['yes_count'] == 0
        assert result['risk_classification'] == 'apto'
        assert result['risk_color'] == 'green'

    def test_one_true_precaution(self):
        result = compute_all(q1_heart_condition=True)
        assert result['yes_count'] == 1
        assert result['risk_classification'] == 'apto_con_precaucion'
        assert result['risk_color'] == 'yellow'

    def test_two_true_precaution(self):
        result = compute_all(
            q2_chest_pain=True,
            q6_bone_joint_problem=True,
        )
        assert result['yes_count'] == 2
        assert result['risk_classification'] == 'apto_con_precaucion'

    def test_three_true_requires_medical(self):
        result = compute_all(
            q1_heart_condition=True,
            q4_chronic_condition=True,
            q5_prescribed_medication=True,
        )
        assert result['yes_count'] == 3
        assert result['risk_classification'] == 'requiere_valoracion'
        assert result['risk_color'] == 'red'

    def test_all_true_requires_medical(self):
        result = compute_all(
            q1_heart_condition=True,
            q2_chest_pain=True,
            q3_dizziness=True,
            q4_chronic_condition=True,
            q5_prescribed_medication=True,
            q6_bone_joint_problem=True,
            q7_medical_supervision=True,
        )
        assert result['yes_count'] == 7
        assert result['risk_classification'] == 'requiere_valoracion'
        assert result['risk_color'] == 'red'

    def test_result_keys(self):
        result = compute_all()
        assert 'yes_count' in result
        assert 'risk_classification' in result
        assert 'risk_label' in result
        assert 'risk_color' in result


class TestQuestionKeys:
    def test_seven_questions(self):
        assert len(PARQ_QUESTION_KEYS) == 7
