import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_penalty_clamps_to_balance(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'seed', '1', 'x', amount=10)
    tx = credit_engine.apply_penalty(existing_user, CreditTransaction.Action.NO_SHOW_PENALTY, 'booking', '9', 'No asististe')
    # preset no_show_penalty is -40 but only 10 available → records -10, balance 0
    assert tx.amount == -10
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_penalty_on_zero_balance_records_nothing(existing_user):
    tx = credit_engine.apply_penalty(existing_user, CreditTransaction.Action.NO_SHOW_PENALTY, 'booking', '10', 'No asististe')
    assert tx is None
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_penalty_full_when_funds_suffice(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '2', 'x', amount=100)
    tx = credit_engine.apply_penalty(existing_user, CreditTransaction.Action.NO_SHOW_PENALTY, 'booking', '11', 'No asististe')
    assert tx.amount == -40
    assert credit_engine.get_wallet(existing_user).balance == 60
