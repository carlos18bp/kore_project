import pytest
from decimal import Decimal

from core_app.models import Package


@pytest.mark.django_db
class TestPackageModel:
    def test_defaults(self):
        pkg = Package.objects.create(title='Test')
        assert pkg.sessions_count == 1
        assert pkg.session_duration_minutes == 60
        assert pkg.price == Decimal('0.00')
        assert pkg.currency == 'COP'
        assert pkg.validity_days == 30
        assert pkg.is_active is True
        assert pkg.order == 0

    def test_str_returns_title(self):
        pkg = Package.objects.create(title='My Package')
        assert str(pkg) == 'My Package'

    def test_ordering_by_order_then_id(self):
        p2 = Package.objects.create(title='Second', order=2)
        p1 = Package.objects.create(title='First', order=1)
        p3 = Package.objects.create(title='Third', order=1)
        ids = list(Package.objects.values_list('id', flat=True))
        assert ids == [p1.id, p3.id, p2.id]
