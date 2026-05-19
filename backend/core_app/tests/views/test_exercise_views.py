"""Tests for ExerciseListView (GET /api/exercises/)."""

import pytest
from rest_framework.test import APIClient

from core_app.models import User
from core_app.models.exercise import Exercise


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_customer(email='ex@test.com'):
    return User.objects.create_user(email=email, password='pass', role=User.Role.CUSTOMER)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


def _make_exercise(**kwargs):
    """Create an active exercise with sensible defaults."""
    defaults = dict(
        name='Default Exercise',
        pattern='PUSH',
        fitness_level_min=1,
        is_corrective=False,
        goal_tags=[],
        is_active=True,
    )
    defaults.update(kwargs)
    return Exercise.objects.create(**defaults)


URL = '/api/exercises/'


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestExerciseListViewAuthentication:
    def test_unauthenticated_request_returns_401(self):
        client = APIClient()
        resp = client.get(URL)
        assert resp.status_code == 401


@pytest.mark.django_db
class TestExerciseListViewNoFilters:
    def test_no_filters_returns_all_active_exercises(self):
        customer = _make_customer('nofilter@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Alpha Exercise')
        _make_exercise(name='Beta Exercise')
        # Inactive exercise should be excluded
        _make_exercise(name='Inactive Exercise', is_active=False)

        resp = client.get(URL)
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Alpha Exercise' in names
        assert 'Beta Exercise' in names
        assert 'Inactive Exercise' not in names

    def test_default_limit_is_20(self):
        customer = _make_customer('limit20@test.com')
        client = APIClient()
        _auth(client, customer)

        for i in range(25):
            _make_exercise(name=f'Limit Exercise {i:02d}')

        resp = client.get(URL)
        assert resp.status_code == 200
        assert len(resp.data['results']) == 20

    def test_response_has_count_and_results_keys(self):
        customer = _make_customer('shape@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Shape Exercise')

        resp = client.get(URL)
        assert resp.status_code == 200
        assert 'count' in resp.data
        assert 'results' in resp.data


@pytest.mark.django_db
class TestExerciseListViewPatternFilter:
    def test_pattern_filter_returns_matching_exercises(self):
        customer = _make_customer('pattern@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Push Up', pattern='PUSH')
        _make_exercise(name='Squat', pattern='SQUAT')

        resp = client.get(URL, {'pattern': 'PUSH'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Push Up' in names
        assert 'Squat' not in names

    def test_pattern_filter_is_case_insensitive(self):
        customer = _make_customer('patternici@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Push Up CI', pattern='PUSH')

        resp = client.get(URL, {'pattern': 'push'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Push Up CI' in names


@pytest.mark.django_db
class TestExerciseListViewSearchFilter:
    def test_search_filter_matches_name_icontains(self):
        customer = _make_customer('search@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Barbell Squat')
        _make_exercise(name='Bench Press')

        resp = client.get(URL, {'search': 'squat'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Barbell Squat' in names
        assert 'Bench Press' not in names


@pytest.mark.django_db
class TestExerciseListViewFitnessLevelFilter:
    def test_fitness_level_min_lte_valid_integer(self):
        customer = _make_customer('fitlvl@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Beginner Exercise', fitness_level_min=1)
        _make_exercise(name='Intermediate Exercise', fitness_level_min=3)
        _make_exercise(name='Advanced Exercise', fitness_level_min=5)

        resp = client.get(URL, {'fitness_level_min': '3'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Beginner Exercise' in names
        assert 'Intermediate Exercise' in names
        assert 'Advanced Exercise' not in names

    def test_fitness_level_min_invalid_string_is_gracefully_ignored(self):
        customer = _make_customer('fitlvlbad@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Level Error Exercise', fitness_level_min=5)

        # Should not raise — ValueError is caught internally
        resp = client.get(URL, {'fitness_level_min': 'abc'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        # No level filtering applied, so advanced exercise is included
        assert 'Level Error Exercise' in names


@pytest.mark.django_db
class TestExerciseListViewGoalFilter:
    def test_goal_filter_matches_goal_tag_substring(self):
        customer = _make_customer('goal@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Strength Exercise', goal_tags=['strength', 'power'])
        _make_exercise(name='Endurance Exercise', goal_tags=['endurance'])

        resp = client.get(URL, {'goal': 'strength'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Strength Exercise' in names
        assert 'Endurance Exercise' not in names


@pytest.mark.django_db
class TestExerciseListViewCorrectiveFilter:
    def test_is_corrective_true_returns_corrective_exercises(self):
        customer = _make_customer('corrective_true@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Corrective Ex', is_corrective=True)
        _make_exercise(name='Non-Corrective Ex', is_corrective=False)

        resp = client.get(URL, {'is_corrective': 'true'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Corrective Ex' in names
        assert 'Non-Corrective Ex' not in names

    def test_is_corrective_1_also_returns_corrective_exercises(self):
        customer = _make_customer('corrective_1@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Corrective 1 Ex', is_corrective=True)
        _make_exercise(name='Normal 1 Ex', is_corrective=False)

        resp = client.get(URL, {'is_corrective': '1'})
        assert resp.status_code == 200
        names = [r['name'] for r in resp.data['results']]
        assert 'Corrective 1 Ex' in names
        assert 'Normal 1 Ex' not in names


@pytest.mark.django_db
class TestExerciseListViewSimilarToFilter:
    def test_similar_to_valid_id_sorts_same_pattern_first(self):
        customer = _make_customer('similar@test.com')
        client = APIClient()
        _auth(client, customer)

        ref = _make_exercise(name='Reference Push', pattern='PUSH')
        _make_exercise(name='Another Push', pattern='PUSH')
        _make_exercise(name='A Pull Exercise', pattern='PULL')

        resp = client.get(URL, {'similar_to': ref.pk})
        assert resp.status_code == 200
        results = resp.data['results']
        names = [r['name'] for r in results]
        # Both PUSH exercises should appear before PULL
        push_indices = [i for i, r in enumerate(results) if r['name'] in ('Reference Push', 'Another Push')]
        pull_indices = [i for i, r in enumerate(results) if r['name'] == 'A Pull Exercise']
        assert max(push_indices) < min(pull_indices)

    def test_similar_to_nonexistent_id_falls_back_to_name_order(self):
        customer = _make_customer('similar_missing@test.com')
        client = APIClient()
        _auth(client, customer)

        _make_exercise(name='Alpha Fallback', pattern='PUSH')
        _make_exercise(name='Zeta Fallback', pattern='PULL')

        resp = client.get(URL, {'similar_to': 99999})
        assert resp.status_code == 200
        results = resp.data['results']
        names = [r['name'] for r in results]
        # Ordered by name when similar_to ID doesn't exist
        assert names.index('Alpha Fallback') < names.index('Zeta Fallback')


@pytest.mark.django_db
class TestExerciseListViewLimitParam:
    def test_limit_param_reduces_results(self):
        customer = _make_customer('limitparam@test.com')
        client = APIClient()
        _auth(client, customer)

        for i in range(10):
            _make_exercise(name=f'Limit Test {i:02d}')

        resp = client.get(URL, {'limit': '5'})
        assert resp.status_code == 200
        assert len(resp.data['results']) == 5

    def test_limit_invalid_string_falls_back_to_20(self):
        customer = _make_customer('limitbad@test.com')
        client = APIClient()
        _auth(client, customer)

        for i in range(25):
            _make_exercise(name=f'Bad Limit Ex {i:02d}')

        resp = client.get(URL, {'limit': 'abc'})
        assert resp.status_code == 200
        assert len(resp.data['results']) == 20

    def test_limit_200_is_capped_at_100(self):
        customer = _make_customer('limitcap@test.com')
        client = APIClient()
        _auth(client, customer)

        for i in range(110):
            _make_exercise(name=f'Cap Exercise {i:03d}')

        resp = client.get(URL, {'limit': '200'})
        assert resp.status_code == 200
        assert len(resp.data['results']) == 100
