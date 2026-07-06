import pytest

from core_app.models.store import StoreItem, RedemptionRequest


@pytest.mark.django_db
def test_store_item_defaults():
    item = StoreItem.objects.create(name='Camiseta KÓRE', price_credits=120, item_type='producto')
    assert item.is_active is True
    assert item.price_credits == 120


@pytest.mark.django_db
def test_redemption_request_defaults(existing_user):
    item = StoreItem.objects.create(name='Sesión extra', price_credits=200, item_type='sesion_adicional')
    r = RedemptionRequest.objects.create(customer=existing_user, item=item, credits_spent=200)
    assert r.status == RedemptionRequest.Status.PENDING
    assert r.resolved_at is None


@pytest.mark.django_db
def test_redemption_ledger_actions_exist():
    from core_app.models.credit import CreditTransaction
    assert CreditTransaction.Action.REDEMPTION == 'redemption'
    assert CreditTransaction.Action.REDEMPTION_REFUND == 'redemption_refund'


def test_item_type_has_no_descuento():
    assert 'descuento' not in StoreItem.ItemType.values


@pytest.mark.django_db
def test_redemption_has_delivery_photo_field(existing_user):
    item = StoreItem.objects.create(name='X', price_credits=10, item_type='servicio')
    req = RedemptionRequest.objects.create(customer=existing_user, item=item, credits_spent=10)
    assert req.delivery_photo.name in (None, '')  # unset by default
