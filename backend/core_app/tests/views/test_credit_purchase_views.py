import pytest

from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


@pytest.mark.django_db
def test_lists_active_packages(api_client, existing_user):
    CreditPackage.objects.create(name='A', credits=100, price_cop=20000, is_active=True)
    CreditPackage.objects.create(name='B', credits=200, price_cop=35000, is_active=False)
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/packages/')
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.django_db
def test_initiate_purchase_returns_checkout(api_client, existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/credits/purchases/', {'credit_package_id': pkg.id}, format='json')
    assert resp.status_code == 201
    body = resp.json()
    assert body['reference'].startswith('CR-')
    assert 'checkout_url' in body and 'checkout.wompi.co' in body['checkout_url']
    purchase = CreditPurchase.objects.get(reference=body['reference'])
    assert purchase.status == 'pending'
    assert purchase.credits == 100
    assert purchase.amount_cop == 20000


@pytest.mark.django_db
def test_initiate_inactive_package_400(api_client, existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000, is_active=False)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/credits/purchases/', {'credit_package_id': pkg.id}, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_purchase_status(api_client, existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-xyz')
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/purchases/CR-xyz/')
    assert resp.status_code == 200
    assert resp.json()['status'] == 'pending'
