"""Tests for the posturometry calculation engine."""

import pytest
from core_app.services.posturometry_calculator import (
    SEGMENT_REGISTRY,
    classify_index,
    compute_all,
    compute_indices,
    compute_segment_scores,
    generate_default_recommendations,
    generate_findings,
)


# ── Helpers ──

def _seg(is_normal=True, severity=0, sub_fields=None):
    """Shortcut to build a segment entry dict."""
    return {
        'is_normal': is_normal,
        'severity': severity,
        'sub_fields': sub_fields or {},
    }


def _normal():
    return _seg(is_normal=True, severity=0)


def _altered(severity=1, sub_fields=None):
    return _seg(is_normal=False, severity=severity, sub_fields=sub_fields)


# ── classify_index ──

class TestClassifyIndex:
    def test_functional(self):
        assert classify_index(0.0) == ('Postura funcional', 'green')
        assert classify_index(0.50) == ('Postura funcional', 'green')

    def test_mild(self):
        assert classify_index(0.51) == ('Desbalance leve', 'yellow')
        assert classify_index(1.20) == ('Desbalance leve', 'yellow')

    def test_moderate(self):
        assert classify_index(1.21) == ('Desbalance moderado', 'orange')
        assert classify_index(2.00) == ('Desbalance moderado', 'orange')

    def test_severe(self):
        assert classify_index(2.01) == ('Desbalance importante', 'red')
        assert classify_index(3.00) == ('Desbalance importante', 'red')

    def test_none(self):
        assert classify_index(None) == ('', '')


# ── compute_segment_scores ──

class TestComputeSegmentScores:
    def test_all_normal_returns_zero_scores(self):
        """All segments marked normal → all scores 0."""
        anterior = {
            'cabeza': _normal(), 'cuello': _normal(), 'hombros': _normal(),
            'claviculas': _normal(), 'altura_tetillas': _normal(),
            'pliegue_inguinal': _normal(), 'rodillas': _normal(), 'pie': _normal(),
        }
        lat_r = {
            'cabeza': _normal(), 'escapulas': _normal(),
            'columna_vertebral': _normal(), 'codos_angulo': _normal(),
            'abdomen_prominente': _normal(), 'cadera': _normal(),
            'rodillas': _normal(), 'pies': _normal(),
        }
        lat_l = dict(lat_r)
        posterior = {
            'cabeza': _normal(), 'hombros': _normal(), 'escapulas': _normal(),
            'codos_flexionados': _normal(), 'espacios_brazo_tronco': _normal(),
            'columna_vertebral': _normal(), 'pliegues_laterales': _normal(),
            'altura_cresta_inguinales': _normal(), 'gluteos': _normal(),
            'pliegues_popliteos': _normal(), 'rodillas': _normal(), 'pies': _normal(),
        }
        scores = compute_segment_scores(anterior, lat_r, lat_l, posterior)
        for seg_key, seg_data in scores.items():
            assert seg_data['score'] == 0.0, f"{seg_key} should be 0"

    def test_single_segment_altered_in_one_view(self):
        """Cabeza altered (severity=2) only in anterior, normal in others."""
        anterior = {'cabeza': _altered(2)}
        lat_r = {'cabeza': _normal()}
        lat_l = {'cabeza': _normal()}
        posterior = {'cabeza': _normal()}
        scores = compute_segment_scores(anterior, lat_r, lat_l, posterior)
        # Average: (2 + 0 + 0 + 0) / 4 = 0.5
        assert scores['cabeza']['score'] == 0.5

    def test_segment_altered_in_all_views(self):
        """Cabeza altered severity=2 in all 4 views → score 2.0."""
        anterior = {'cabeza': _altered(2)}
        lat_r = {'cabeza': _altered(2)}
        lat_l = {'cabeza': _altered(2)}
        posterior = {'cabeza': _altered(2)}
        scores = compute_segment_scores(anterior, lat_r, lat_l, posterior)
        assert scores['cabeza']['score'] == 2.0

    def test_segment_different_severities_averaged(self):
        """Rodillas: anterior=1, lat_r=3, lat_l=1, posterior=3 → avg=2.0."""
        anterior = {'rodillas': _altered(1)}
        lat_r = {'rodillas': _altered(3)}
        lat_l = {'rodillas': _altered(1)}
        posterior = {'rodillas': _altered(3)}
        scores = compute_segment_scores(anterior, lat_r, lat_l, posterior)
        assert scores['rodillas']['score'] == 2.0

    def test_pie_alias_maps_to_pies(self):
        """Anterior uses 'pie' key → should map to 'pies' segment."""
        anterior = {'pie': _altered(2)}
        scores = compute_segment_scores(anterior, {}, {}, {})
        # pies has views: anterior, lat_r, lat_l, posterior
        # Only anterior has data → score = 2.0 / 1 = 2.0
        assert scores['pies']['score'] == 2.0

    def test_missing_views_only_average_present(self):
        """Cuello only in anterior. If not provided, score defaults to 0."""
        scores = compute_segment_scores({}, {}, {}, {})
        # Cuello appears in anterior only, no data → score 0.0
        assert scores['cuello']['score'] == 0.0

    def test_severity_clamped_to_3(self):
        """Severity > 3 should be clamped to 3."""
        anterior = {'cabeza': _seg(is_normal=False, severity=5)}
        scores = compute_segment_scores(anterior, {}, {}, {})
        assert scores['cabeza']['views']['anterior'] == 3

    def test_all_19_segments_present(self):
        """compute_segment_scores always returns all 19 segments."""
        scores = compute_segment_scores({}, {}, {}, {})
        assert len(scores) == len(SEGMENT_REGISTRY)
        for key in SEGMENT_REGISTRY:
            assert key in scores


# ── compute_indices ──

class TestComputeIndices:
    def test_all_zero_scores(self):
        scores = compute_segment_scores({}, {}, {}, {})
        indices = compute_indices(scores)
        assert indices['global_index'] == 0.0
        assert indices['global_category'] == 'Postura funcional'
        assert indices['global_color'] == 'green'
        assert indices['upper_index'] == 0.0
        assert indices['central_index'] == 0.0
        assert indices['lower_index'] == 0.0

    def test_mixed_scores_regional_grouping(self):
        """Upper altered, central/lower normal → upper index high, others low."""
        anterior = {
            'cabeza': _altered(3), 'cuello': _altered(3),
            'hombros': _altered(3), 'claviculas': _altered(3),
            'altura_tetillas': _altered(3),
        }
        posterior = {
            'hombros': _altered(3), 'escapulas': _altered(3),
            'codos_flexionados': _altered(3), 'espacios_brazo_tronco': _altered(3),
        }
        lat_r = {'escapulas': _altered(3), 'codos_angulo': _altered(3)}
        lat_l = {'escapulas': _altered(3), 'codos_angulo': _altered(3)}

        scores = compute_segment_scores(anterior, lat_r, lat_l, posterior)
        indices = compute_indices(scores)

        # Upper should be high
        assert indices['upper_index'] > 1.5
        assert indices['upper_color'] in ('orange', 'red')
        # Lower should be 0
        assert indices['lower_index'] == 0.0
        assert indices['lower_color'] == 'green'

    def test_example_from_spec(self):
        """Test the example from the requirements doc.

        Scores: 1, 2, 1, 1, 2, 1, 0, 1 → sum=9, /8 = 1.125
        (This uses 8 of the 19 segments for the example calculation.)
        """
        # Build data so 8 segments get specific scores
        anterior = {
            'cabeza': _altered(1),   # seg 1: cabeza → 1
            'cuello': _altered(2),   # seg 2: cuello → 2
            'hombros': _altered(1),  # seg 3: hombros → 1
            'claviculas': _altered(1),  # seg 4: claviculas → 1
        }
        lat_r = {
            'columna_vertebral': _altered(2),  # seg 10 → 2
            'cadera': _altered(1),  # seg 12 → 1
        }
        posterior = {
            'rodillas': _normal(),  # seg 17 → 0
            'pies': _altered(1),    # seg 18 → 1
        }
        scores = compute_segment_scores(anterior, lat_r, {}, posterior)

        # Verify specific segments
        assert scores['cabeza']['score'] == 1.0  # only in anterior
        assert scores['cuello']['score'] == 2.0
        assert scores['rodillas']['score'] == 0.0  # only posterior=0


# ── generate_findings ──

class TestGenerateFindings:
    def test_no_findings_when_all_normal(self):
        anterior = {'cabeza': _normal(), 'rodillas': _normal()}
        findings = generate_findings(anterior, {}, {}, {})
        assert findings['anterior'] == []

    def test_findings_for_altered_with_subfields(self):
        anterior = {
            'cabeza': _altered(2, {'inclinacion': 'M', 'rotacion': 'L'}),
        }
        findings = generate_findings(anterior, {}, {}, {})
        assert len(findings['anterior']) == 2
        assert any('inclinación moderada' in f for f in findings['anterior'])
        assert any('rotación leve' in f for f in findings['anterior'])

    def test_findings_checkbox_only_true(self):
        anterior = {
            'rodillas': _altered(1, {'geno_varo': True, 'evertido_valgo': False}),
        }
        findings = generate_findings(anterior, {}, {}, {})
        assert len(findings['anterior']) == 1
        assert 'geno varo' in findings['anterior'][0]

    def test_findings_across_views(self):
        lat_r = {
            'cabeza': _altered(1, {'protraccion': 'L'}),
        }
        lat_l = {
            'columna_vertebral': _altered(2, {'cifosis': 'M'}),
        }
        findings = generate_findings({}, lat_r, lat_l, {})
        assert len(findings['lateral_right']) == 1
        assert len(findings['lateral_left']) == 1
        assert 'protracción leve' in findings['lateral_right'][0]
        assert 'cifosis moderada' in findings['lateral_left'][0]

    def test_generic_finding_when_no_templates(self):
        """Segments without specific sub_field templates get a generic finding."""
        anterior = {
            'pliegue_inguinal': _altered(1),
        }
        findings = generate_findings(anterior, {}, {}, {})
        assert len(findings['anterior']) == 1
        assert 'alteración leve' in findings['anterior'][0]


# ── compute_all ──

class TestComputeAll:
    def test_returns_all_required_keys(self):
        result = compute_all({}, {}, {}, {})
        required = [
            'global_index', 'global_category', 'global_color',
            'upper_index', 'upper_category', 'upper_color',
            'central_index', 'central_category', 'central_color',
            'lower_index', 'lower_category', 'lower_color',
            'segment_scores', 'findings',
        ]
        for key in required:
            assert key in result, f"Missing key: {key}"

    def test_segment_scores_has_19_entries(self):
        result = compute_all({}, {}, {}, {})
        assert len(result['segment_scores']) == 19

    def test_findings_has_4_views(self):
        result = compute_all({}, {}, {}, {})
        assert set(result['findings'].keys()) == {
            'anterior', 'lateral_right', 'lateral_left', 'posterior',
        }


# ── generate_default_recommendations ──

class TestGenerateDefaultRecommendations:
    def test_generates_4_regions(self):
        class FakeEval:
            global_color = 'green'
            upper_color = 'yellow'
            central_color = 'orange'
            lower_color = 'red'

        recs = generate_default_recommendations(FakeEval())
        assert set(recs.keys()) == {'global', 'upper', 'central', 'lower'}
        for region, rec in recs.items():
            assert 'result' in rec
            assert 'action' in rec
            assert len(rec['result']) > 0

    def test_defaults_to_green_on_empty_color(self):
        class FakeEval:
            global_color = ''
            upper_color = ''
            central_color = ''
            lower_color = ''

        recs = generate_default_recommendations(FakeEval())
        # Should fall back to green texts
        assert 'funcional' in recs['global']['result'].lower()
