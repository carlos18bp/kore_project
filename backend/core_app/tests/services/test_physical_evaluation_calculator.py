"""Tests for the physical evaluation calculator service."""

from django.test import TestCase

from core_app.services.physical_evaluation_calculator import (
    classify_index,
    compute_all,
    generate_cross_module_alerts,
    score_plank,
    score_pushups,
    score_squats,
    score_unipodal,
    score_walk,
)


class ScoreSquatsTests(TestCase):
    """Baremo tests for squats scoring by age and sex."""

    def test_male_18_35_very_low(self):
        self.assertEqual(score_squats(10, 25, 'masculino'), 1)

    def test_male_18_35_low(self):
        self.assertEqual(score_squats(15, 25, 'masculino'), 2)

    def test_male_18_35_intermediate(self):
        self.assertEqual(score_squats(30, 25, 'masculino'), 3)

    def test_male_18_35_good(self):
        self.assertEqual(score_squats(40, 25, 'masculino'), 4)

    def test_male_18_35_very_good(self):
        self.assertEqual(score_squats(50, 25, 'masculino'), 5)

    def test_female_36_50_very_low(self):
        self.assertEqual(score_squats(5, 40, 'femenino'), 1)

    def test_female_36_50_intermediate(self):
        self.assertEqual(score_squats(20, 40, 'femenino'), 3)

    def test_male_66_plus(self):
        self.assertEqual(score_squats(7, 70, 'masculino'), 1)
        self.assertEqual(score_squats(8, 70, 'masculino'), 2)
        self.assertEqual(score_squats(28, 70, 'masculino'), 5)

    def test_none_returns_none(self):
        self.assertIsNone(score_squats(None, 30, 'masculino'))


class ScorePushupsTests(TestCase):
    def test_male_18_35_tiers(self):
        self.assertEqual(score_pushups(3, 25, 'masculino'), 1)
        self.assertEqual(score_pushups(6, 25, 'masculino'), 2)
        self.assertEqual(score_pushups(13, 25, 'masculino'), 3)
        self.assertEqual(score_pushups(25, 25, 'masculino'), 4)
        self.assertEqual(score_pushups(35, 25, 'masculino'), 5)

    def test_female_51_65(self):
        self.assertEqual(score_pushups(1, 55, 'femenino'), 1)
        self.assertEqual(score_pushups(5, 55, 'femenino'), 3)
        self.assertEqual(score_pushups(15, 55, 'femenino'), 5)


class ScorePlankTests(TestCase):
    def test_male_18_35_tiers(self):
        self.assertEqual(score_plank(10, 25, 'masculino'), 1)
        self.assertEqual(score_plank(20, 25, 'masculino'), 2)
        self.assertEqual(score_plank(50, 25, 'masculino'), 3)
        self.assertEqual(score_plank(70, 25, 'masculino'), 4)
        self.assertEqual(score_plank(100, 25, 'masculino'), 5)

    def test_female_66_plus(self):
        self.assertEqual(score_plank(5, 70, 'femenino'), 1)
        self.assertEqual(score_plank(20, 70, 'femenino'), 3)
        self.assertEqual(score_plank(50, 70, 'femenino'), 5)


class ScoreWalkTests(TestCase):
    def test_male_51_65(self):
        self.assertEqual(score_walk(250, 55, 'masculino'), 1)
        self.assertEqual(score_walk(350, 55, 'masculino'), 2)
        self.assertEqual(score_walk(450, 55, 'masculino'), 3)
        self.assertEqual(score_walk(550, 55, 'masculino'), 4)
        self.assertEqual(score_walk(650, 55, 'masculino'), 5)

    def test_female_18_35(self):
        self.assertEqual(score_walk(300, 25, 'femenino'), 1)
        self.assertEqual(score_walk(650, 25, 'femenino'), 5)


class ScoreUnipodalTests(TestCase):
    def test_18_35(self):
        self.assertEqual(score_unipodal(5, 25), 1)
        self.assertEqual(score_unipodal(15, 25), 2)
        self.assertEqual(score_unipodal(30, 25), 3)
        self.assertEqual(score_unipodal(50, 25), 4)
        self.assertEqual(score_unipodal(60, 25), 5)

    def test_66_plus(self):
        self.assertEqual(score_unipodal(2, 70), 1)
        self.assertEqual(score_unipodal(10, 70), 3)
        self.assertEqual(score_unipodal(30, 70), 5)


class ClassifyIndexTests(TestCase):
    def test_very_low(self):
        self.assertEqual(classify_index(1.5), ('Muy bajo', 'red'))

    def test_low(self):
        self.assertEqual(classify_index(2.5), ('Bajo', 'yellow'))

    def test_intermediate(self):
        self.assertEqual(classify_index(3.5), ('Intermedio', 'green'))

    def test_good(self):
        self.assertEqual(classify_index(4.3), ('Bueno', 'green'))

    def test_very_good(self):
        self.assertEqual(classify_index(4.8), ('Muy bueno', 'green'))

    def test_none(self):
        self.assertEqual(classify_index(None), ('', ''))

    def test_boundary_2(self):
        self.assertEqual(classify_index(2.0)[0], 'Bajo')

    def test_boundary_3(self):
        self.assertEqual(classify_index(3.0)[0], 'Intermedio')

    def test_boundary_4(self):
        self.assertEqual(classify_index(4.0)[0], 'Bueno')

    def test_boundary_4_5(self):
        self.assertEqual(classify_index(4.5)[0], 'Bueno')

    def test_boundary_4_6(self):
        self.assertEqual(classify_index(4.6)[0], 'Muy bueno')


class ComputeAllTests(TestCase):
    def test_full_evaluation_male_30_individual_scores(self):
        result = compute_all(
            age=30, sex='masculino',
            squats_reps=30, pushups_reps=15, plank_seconds=50,
            walk_meters=550, unipodal_seconds=30,
            hip_mobility=4, shoulder_mobility=3, ankle_mobility=4,
        )
        self.assertEqual(result['squats_score'], 3)
        self.assertEqual(result['pushups_score'], 3)
        self.assertEqual(result['plank_score'], 3)
        self.assertEqual(result['walk_score'], 3)
        self.assertEqual(result['unipodal_score'], 3)

    def test_full_evaluation_male_30_composite_indices(self):
        result = compute_all(
            age=30, sex='masculino',
            squats_reps=30, pushups_reps=15, plank_seconds=50,
            walk_meters=550, unipodal_seconds=30,
            hip_mobility=4, shoulder_mobility=3, ankle_mobility=4,
        )
        self.assertIsNotNone(result['strength_index'])
        self.assertIsNotNone(result['general_index'])
        self.assertEqual(result['general_color'], 'green')

    def test_partial_evaluation(self):
        result = compute_all(
            age=40, sex='femenino',
            squats_reps=5, pushups_reps=None, plank_seconds=None,
            walk_meters=None, unipodal_seconds=None,
            hip_mobility=2, shoulder_mobility=2, ankle_mobility=2,
        )
        self.assertEqual(result['squats_score'], 1)
        self.assertIsNone(result['pushups_score'])
        self.assertIsNone(result['endurance_index'])
        # Strength is only from squats
        self.assertEqual(result['strength_index'], 1.0)
        # Mobility
        self.assertEqual(result['mobility_index'], 2.0)

    def test_very_good_all(self):
        result = compute_all(
            age=25, sex='masculino',
            squats_reps=50, pushups_reps=35, plank_seconds=100,
            walk_meters=750, unipodal_seconds=60,
            hip_mobility=5, shoulder_mobility=5, ankle_mobility=5,
        )
        self.assertEqual(result['general_index'], 5.0)
        self.assertEqual(result['general_category'], 'Muy bueno')
        self.assertEqual(result['general_color'], 'green')

    def test_cross_module_alerts_included(self):
        result = compute_all(
            age=30, sex='masculino',
            squats_reps=20,
            anthropometry_context={'bmi': 32, 'bmi_color': 'red'},
            posturometry_context={'lower_color': 'red'},
        )
        alerts = result['cross_module_alerts']
        self.assertIn('squats', alerts)
        self.assertTrue(len(alerts['squats']) >= 2)  # BMI + lower posture


class CrossModuleAlertsTests(TestCase):
    def test_no_context(self):
        alerts = generate_cross_module_alerts()
        self.assertEqual(alerts, {})

    def test_bmi_obesity_alerts(self):
        alerts = generate_cross_module_alerts(
            anthropometry_ctx={'bmi': 35, 'bmi_color': 'red'},
        )
        self.assertIn('squats', alerts)
        self.assertIn('walk', alerts)
        self.assertIn('plank', alerts)

    def test_body_fat_alert(self):
        alerts = generate_cross_module_alerts(
            anthropometry_ctx={'bf_color': 'red'},
        )
        self.assertIn('walk', alerts)

    def test_waist_risk_alert(self):
        alerts = generate_cross_module_alerts(
            anthropometry_ctx={'waist_risk_color': 'red'},
        )
        self.assertIn('plank', alerts)

    def test_posturometry_lower_alert(self):
        alerts = generate_cross_module_alerts(
            posturometry_ctx={'lower_color': 'orange'},
        )
        self.assertIn('squats', alerts)
        self.assertIn('unipodal', alerts)

    def test_posturometry_central_alert(self):
        alerts = generate_cross_module_alerts(
            posturometry_ctx={'central_color': 'red'},
        )
        self.assertIn('plank', alerts)

    def test_posturometry_upper_alert(self):
        alerts = generate_cross_module_alerts(
            posturometry_ctx={'upper_color': 'orange'},
        )
        self.assertIn('pushups', alerts)

    def test_varo_valgo_findings(self):
        alerts = generate_cross_module_alerts(
            posturometry_ctx={
                'findings': {
                    'anterior': ['Rodillas: geno varo'],
                    'posterior': [],
                },
            },
        )
        self.assertIn('squats', alerts)

    def test_no_alert_when_green(self):
        alerts = generate_cross_module_alerts(
            anthropometry_ctx={'bmi': 22, 'bmi_color': 'green'},
            posturometry_ctx={'lower_color': 'green', 'upper_color': 'green'},
        )
        self.assertEqual(alerts, {})
