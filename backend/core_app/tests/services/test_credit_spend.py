import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_spend_deducts_when_funds_suffice(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    tx = credit_engine.spend(existing_user, 60, 'redemption_request', '5', 'Canje camiseta')
    assert tx is not None
    assert tx.amount == -60
    assert credit_engine.get_wallet(existing_user).balance == 40


@pytest.mark.django_db
def test_spend_refuses_insufficient_funds(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'seed', '2', 'x', amount=10)
    tx = credit_engine.spend(existing_user, 60, 'redemption_request', '6', 'Canje')
    assert tx is None
    assert credit_engine.get_wallet(existing_user).balance == 10


@pytest.mark.django_db
def test_spend_is_idempotent_per_reference(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '3', 'x', amount=100)
    credit_engine.spend(existing_user, 20, 'redemption_request', '7', 'Canje')
    dup = credit_engine.spend(existing_user, 20, 'redemption_request', '7', 'Canje')
    assert dup is None
    assert credit_engine.get_wallet(existing_user).balance == 80
