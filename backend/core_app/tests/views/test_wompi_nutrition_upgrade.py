import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import Package, Subscription
from core_app.models.nutrition_upgrade import NutritionUpgrade
from core_app.views.wompi_views import _handle_transaction_updated


def _event(reference, txn_id, status='APPROVED'):
    return {'transaction': {'id': txn_id, 'status': status, 'reference': reference}}


def _sub(user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000, validity_days=30)
    return Subscription.objects.create(customer=user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=15), status='active', next_billing_date=timezone.localdate() + timedelta(days=15))


@pytest.mark.django_db
def test_webhook_approved_grants_nutrition(existing_user):
    sub = _sub(existing_user)
    up = NutritionUpgrade.objects.create(customer=existing_user, subscription=sub, amount_cop=15000, reference='NU-1')
    _handle_transaction_updated(_event('NU-1', 'txn-n1'))
    up.refresh_from_db(); sub.refresh_from_db()
    assert up.status == 'approved'
    assert sub.includes_nutrition is True


@pytest.mark.django_db
def test_webhook_declined_does_not_grant(existing_user):
    sub = _sub(existing_user)
    up = NutritionUpgrade.objects.create(customer=existing_user, subscription=sub, amount_cop=15000, reference='NU-2')
    _handle_transaction_updated(_event('NU-2', 'txn-n2', status='DECLINED'))
    up.refresh_from_db(); sub.refresh_from_db()
    assert up.status == 'declined'
    assert sub.includes_nutrition is False
