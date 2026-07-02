import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_wallet_endpoint_returns_state_and_next_milestone(api_client, existing_user, frozen_now):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 1, 'Check-in')
    credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1, 'Almuerzo',
        status=CreditTransaction.Status.PENDING,
        review_deadline=frozen_now,
    )
    wallet = credit_engine.get_wallet(existing_user)
    wallet.current_streak = 5
    wallet.save(update_fields=['current_streak'])

    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/wallet/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['balance'] == 5
    assert data['pending_balance'] == 5
    assert data['current_streak'] == 5
    assert data['next_milestone'] == {'days': 7, 'bonus': 50, 'remaining': 2}


@pytest.mark.django_db
def test_transactions_endpoint_paginates_newest_first(api_client, existing_user):
    for i in range(3):
        credit_engine.award(
            existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', i, f'Check-in {i}',
        )
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/transactions/?limit=2')
    assert resp.status_code == 200
    data = resp.json()
    assert data['count'] == 3
    assert len(data['results']) == 2
    assert data['results'][0]['description'] == 'Check-in 2'


@pytest.mark.django_db
def test_wallet_requires_auth(api_client):
    assert api_client.get('/api/credits/wallet/').status_code == 401
