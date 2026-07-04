import pytest

from core_app.models import TrainerProfile, User
from core_app.models.credit import CreditTransaction
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    u = User.objects.create_user(email='t@example.com', password='x', first_name='T', last_name='R', role=User.Role.TRAINER)
    TrainerProfile.objects.get_or_create(user=u)
    return u


@pytest.fixture
def assigned_customer(existing_user, trainer_user):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user


@pytest.mark.django_db
def test_catalog_lists_active_items_with_balance(api_client, existing_user):
    StoreItem.objects.create(name='Activo', price_credits=50, item_type='producto', is_active=True)
    StoreItem.objects.create(name='Inactivo', price_credits=50, item_type='producto', is_active=False)
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/store/items/')
    assert resp.status_code == 200
    data = resp.json()
    assert len(data['items']) == 1
    assert data['balance'] == 100


@pytest.mark.django_db
def test_redeem_spends_and_creates_request(api_client, existing_user):
    item = StoreItem.objects.create(name='Camiseta', price_credits=60, item_type='producto')
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/store/redemptions/', {'item_id': item.id}, format='json')
    assert resp.status_code == 201
    assert credit_engine.get_wallet(existing_user).balance == 40
    assert RedemptionRequest.objects.filter(customer=existing_user, item=item, status='pending').exists()


@pytest.mark.django_db
def test_redeem_insufficient_funds_400(api_client, existing_user):
    item = StoreItem.objects.create(name='Caro', price_credits=500, item_type='producto')
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'seed', '1', 'x', amount=10)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/store/redemptions/', {'item_id': item.id}, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_trainer_fulfills_redemption(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='X', price_credits=30, item_type='servicio')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=30)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'fulfill'}, format='json')
    assert resp.status_code == 200
    req.refresh_from_db()
    assert req.status == 'fulfilled'


@pytest.mark.django_db
def test_trainer_rejects_redemption_refunds(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='Y', price_credits=30, item_type='servicio')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    credit_engine.spend(assigned_customer, 30, 'redemption_request', '99', 'Canje Y')
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=30)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'reject', 'note': 'no hay'}, format='json')
    assert resp.status_code == 200
    req.refresh_from_db()
    assert req.status == 'rejected'
    assert credit_engine.get_wallet(assigned_customer).balance == 100
