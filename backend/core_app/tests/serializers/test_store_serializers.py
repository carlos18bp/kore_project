from types import SimpleNamespace

import pytest
from rest_framework import serializers as drf_serializers

from core_app.models import User
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.serializers.store_serializers import (
    MAX_IMAGE_BYTES,
    RedemptionRequestSerializer,
    StoreItemSerializer,
)


def _fake_image(url='/media/store_items/x.png', size=1024):
    return SimpleNamespace(url=url, size=size)


@pytest.mark.django_db
def test_delivery_photo_url_is_none_when_unset():
    u = User.objects.create_user(email='s@example.com', password='x', first_name='S', last_name='T')
    item = StoreItem.objects.create(name='X', price_credits=10, item_type='servicio')
    req = RedemptionRequest.objects.create(customer=u, item=item, credits_spent=10)
    data = RedemptionRequestSerializer(req).data
    assert data['delivery_photo_url'] is None
    assert 'delivery_photo_url' in data
    assert data['item_type'] == 'servicio'


def test_store_item_image_url_relative_without_request():
    """Without a request in context the image URL is returned as-is."""
    serializer = StoreItemSerializer(context={})
    obj = SimpleNamespace(image=_fake_image('/media/store_items/x.png'))

    assert serializer.get_image_url(obj) == '/media/store_items/x.png'


def test_store_item_image_url_absolute_with_request():
    """With a request in context the image URL is made absolute."""
    request = SimpleNamespace(build_absolute_uri=lambda u: f'https://kore.test{u}')
    serializer = StoreItemSerializer(context={'request': request})
    obj = SimpleNamespace(image=_fake_image('/media/store_items/x.png'))

    assert serializer.get_image_url(obj) == 'https://kore.test/media/store_items/x.png'


def test_store_item_image_url_none_without_image():
    """Items without an image serialize a null image URL."""
    serializer = StoreItemSerializer(context={})
    obj = SimpleNamespace(image=None)

    assert serializer.get_image_url(obj) is None


def test_validate_image_rejects_oversized_file():
    """Images above the 5MB cap are rejected with the Spanish error message."""
    serializer = StoreItemSerializer()
    oversized = SimpleNamespace(size=MAX_IMAGE_BYTES + 1)

    with pytest.raises(drf_serializers.ValidationError) as exc_info:
        serializer.validate_image(oversized)

    assert 'no puede superar 5MB' in str(exc_info.value)


def test_validate_image_accepts_file_at_limit():
    """An image exactly at the cap passes validation unchanged."""
    serializer = StoreItemSerializer()
    at_limit = SimpleNamespace(size=MAX_IMAGE_BYTES)

    assert serializer.validate_image(at_limit) is at_limit


def test_redemption_item_image_url_absolute_with_request():
    """The redemption serializer exposes the item image as an absolute URL."""
    request = SimpleNamespace(build_absolute_uri=lambda u: f'https://kore.test{u}')
    serializer = RedemptionRequestSerializer(context={'request': request})
    obj = SimpleNamespace(item=SimpleNamespace(image=_fake_image('/media/store_items/i.png')))

    assert serializer.get_item_image_url(obj) == 'https://kore.test/media/store_items/i.png'


def test_redemption_delivery_photo_url_relative_without_request():
    """A set delivery photo serializes its storage URL when no request exists."""
    serializer = RedemptionRequestSerializer(context={})
    obj = SimpleNamespace(delivery_photo=_fake_image('/media/redemption_deliveries/d.png'))

    assert serializer.get_delivery_photo_url(obj) == '/media/redemption_deliveries/d.png'
