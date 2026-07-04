import pytest

from core_app.models.credit import CreditTransaction
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.services import credit_engine


@pytest.mark.django_db
def test_refund_returns_credits_and_marks_rejected(existing_user, admin_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    item = StoreItem.objects.create(name='X', price_credits=60, item_type='producto')
    credit_engine.spend(existing_user, 60, 'redemption_request', '1', 'Canje X')
    req = RedemptionRequest.objects.create(customer=existing_user, item=item, credits_spent=60)
    # after spend, balance is 40
    assert credit_engine.get_wallet(existing_user).balance == 40
    ok = credit_engine.refund_redemption(req, admin_user, 'Sin stock')
    assert ok is True
    req.refresh_from_db()
    assert req.status == RedemptionRequest.Status.REJECTED
    assert 'Sin stock' in req.trainer_note
    assert credit_engine.get_wallet(existing_user).balance == 100
    # idempotent
    assert credit_engine.refund_redemption(req, admin_user, 'otra') is False
