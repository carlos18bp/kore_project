import pytest
from decimal import Decimal

from core_app.models import Package
from core_app.serializers import PackageSerializer


@pytest.mark.django_db
class TestPackageSerializer:
    def test_serialization_fields(self):
        pkg = Package.objects.create(
            title='Test', price=Decimal('100000.00'), sessions_count=4,
        )
        data = PackageSerializer(pkg).data
        expected_fields = {
            'id', 'title', 'short_description', 'description', 'category',
            'sessions_count', 'session_duration_minutes', 'price', 'currency',
            'validity_days', 'terms_and_conditions', 'is_active', 'order',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['title'] == 'Test'
        assert Decimal(data['price']) == Decimal('100000.00')
        assert data['sessions_count'] == 4
        assert data['category'] == 'personalizado'

    def test_read_only_timestamps(self):
        serializer = PackageSerializer(data={
            'title': 'New',
            'created_at': '2020-01-01T00:00:00Z',
            'updated_at': '2020-01-01T00:00:00Z',
        })
        assert serializer.is_valid(), serializer.errors
        pkg = serializer.save()
        assert str(pkg.created_at) != '2020-01-01 00:00:00+00:00'

    def test_deserialization_creates_package(self):
        serializer = PackageSerializer(data={
            'title': 'Created',
            'sessions_count': 2,
            'price': '50000.00',
        })
        assert serializer.is_valid(), serializer.errors
        pkg = serializer.save()
        assert pkg.pk is not None
        assert pkg.title == 'Created'
        assert pkg.sessions_count == 2
