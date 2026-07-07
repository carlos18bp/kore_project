import pytest

from core_app.models import User
from core_app.models.credit import CreditTransaction
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


def test_purchase_action_exists():
    assert CreditTransaction.Action.PURCHASE == 'purchase'


@pytest.mark.django_db
def test_credit_purchase_defaults():
    u = User.objects.create_user(email='b@example.com', password='x', first_name='B', last_name='C')
    pkg = CreditPackage.objects.create(name='100 créditos', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=u, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-abc')
    assert p.status == CreditPurchase.Status.PENDING
    assert p.resolved_at is None
    assert pkg.is_active is True
