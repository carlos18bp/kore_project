import pytest

from core_app.models import User
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.serializers.store_serializers import RedemptionRequestSerializer


@pytest.mark.django_db
def test_delivery_photo_url_is_none_when_unset():
    u = User.objects.create_user(email='s@example.com', password='x', first_name='S', last_name='T')
    item = StoreItem.objects.create(name='X', price_credits=10, item_type='servicio')
    req = RedemptionRequest.objects.create(customer=u, item=item, credits_spent=10)
    data = RedemptionRequestSerializer(req).data
    assert data['delivery_photo_url'] is None
    assert 'delivery_photo_url' in data
    assert data['item_type'] == 'servicio'
