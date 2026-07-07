import pytest

from core_app.models.credit import CreditTransaction
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.services import credit_engine
from core_app.views.wompi_views import _handle_transaction_updated


def _event(reference, txn_id, status='APPROVED'):
    return {'transaction': {'id': txn_id, 'status': status, 'reference': reference}}


@pytest.mark.django_db
def test_webhook_approved_awards_confirmed_credits(existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-a1')
    _handle_transaction_updated(_event('CR-a1', 'txn-1'))
    p.refresh_from_db()
    assert p.status == 'approved'
    assert credit_engine.get_wallet(existing_user).balance == 100
    assert CreditTransaction.objects.filter(customer=existing_user, action='purchase', status='confirmed').count() == 1


@pytest.mark.django_db
def test_webhook_duplicate_awards_once(existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-a2')
    _handle_transaction_updated(_event('CR-a2', 'txn-2'))
    _handle_transaction_updated(_event('CR-a2', 'txn-2'))  # retransmission
    assert credit_engine.get_wallet(existing_user).balance == 100
    assert CreditTransaction.objects.filter(customer=existing_user, action='purchase').count() == 1


@pytest.mark.django_db
def test_webhook_declined_awards_nothing(existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-a3')
    _handle_transaction_updated(_event('CR-a3', 'txn-3', status='DECLINED'))
    p.refresh_from_db()
    assert p.status == 'declined'
    assert credit_engine.get_wallet(existing_user).balance == 0
