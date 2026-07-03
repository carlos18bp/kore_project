import pytest


@pytest.mark.django_db
def test_mood_post_accepts_checkin_extras(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/auth/mood/', {
        'score': 8, 'energy_level': 4, 'pain': False, 'ready_to_train': True,
    }, format='json')
    assert resp.status_code == 201
    data = resp.json()
    assert data['energy_level'] == 4
    assert data['pain'] is False
    assert data['ready_to_train'] is True


@pytest.mark.django_db
def test_mood_post_score_only_still_works(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/auth/mood/', {'score': 7}, format='json')
    assert resp.status_code == 201
    assert resp.json()['energy_level'] is None


@pytest.mark.django_db
def test_mood_energy_level_out_of_range_rejected(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/auth/mood/', {'score': 7, 'energy_level': 9}, format='json')
    assert resp.status_code == 400
