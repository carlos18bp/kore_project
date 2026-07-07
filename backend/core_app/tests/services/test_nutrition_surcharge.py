import pytest

from core_app.models.nutrition_product import NutritionProduct
from core_app.services.nutrition_access import nutrition_surcharge


@pytest.mark.django_db
def test_surcharge_zero_without_flag():
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    assert nutrition_surcharge(False) == 0


@pytest.mark.django_db
def test_surcharge_equals_price_with_flag():
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    assert nutrition_surcharge(True) == 30000


@pytest.mark.django_db
def test_surcharge_zero_when_no_product():
    assert nutrition_surcharge(True) == 0
