import pytest
from django.core.management import call_command

from core_app.models.credit import CreditTransaction, CreditWallet
from core_app.services import credit_engine


@pytest.mark.django_db
def test_reconcile_detects_and_fixes_drift(existing_user, capsys):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 1, 'x')
    CreditWallet.objects.filter(customer=existing_user).update(balance=999)

    call_command('reconcile_credit_wallets')
    assert 'drift' in capsys.readouterr().out

    call_command('reconcile_credit_wallets', '--fix')
    wallet = CreditWallet.objects.get(customer=existing_user)
    assert wallet.balance == 5
