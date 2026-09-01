import pytest

from core_app.models.credit_package import CreditPackage
from core_app.serializers.credit_purchase_serializers import CreditPackageSerializer


@pytest.mark.django_db
def test_package_serializer_shape():
    pkg = CreditPackage.objects.create(name='300', credits=300, price_cop=50000)
    data = CreditPackageSerializer(pkg).data
    assert data['credits'] == 300
    assert data['price_cop'] == 50000
    assert set(data.keys()) == {'id', 'name', 'credits', 'price_cop'}
