"""Tests for Package model defaults, ordering, and category behavior."""

from decimal import Decimal

import pytest

from core_app.models import Package


@pytest.mark.django_db
class TestPackageModel:
    """Validates Package model defaults, helpers, and category usage."""

    def test_numeric_defaults(self):
        """New packages start with expected numeric default values."""
        pkg = Package.objects.create(title='Test')
        assert pkg.sessions_count == 1
        assert pkg.session_duration_minutes == 60
        assert pkg.price == Decimal('0.00')
        assert pkg.validity_days == 30
        assert pkg.order == 0

    def test_state_defaults(self):
        """New packages default to active COP personalized state."""
        pkg = Package.objects.create(title='Test')
        assert pkg.currency == 'COP'
        assert pkg.is_active is True
        assert pkg.category == Package.Category.PERSONALIZADO

    def test_str_returns_title(self):
        """String conversion returns the package title."""
        pkg = Package.objects.create(title='My Package')
        assert str(pkg) == 'My Package'

    def test_ordering_by_order_then_id(self):
        """Default ordering sorts by order field and then primary key."""
        p2 = Package.objects.create(title='Second', order=2)
        p1 = Package.objects.create(title='First', order=1)
        p3 = Package.objects.create(title='Third', order=1)
        ids = list(Package.objects.values_list('id', flat=True))
        assert ids == [p1.id, p3.id, p2.id]

    def test_category_choices(self):
        """All three category values are accepted."""
        for cat_value, _label in Package.Category.choices:
            pkg = Package.objects.create(title=f'Cat {cat_value}', category=cat_value)
            pkg.refresh_from_db()
            assert pkg.category == cat_value

    def test_category_filter(self):
        """Packages can be filtered by category."""
        Package.objects.create(title='P1', category=Package.Category.PERSONALIZADO)
        Package.objects.create(title='S1', category=Package.Category.SEMI_PERSONALIZADO)
        Package.objects.create(title='T1', category=Package.Category.TERAPEUTICO)
        assert Package.objects.filter(category='personalizado').count() == 1
        assert Package.objects.filter(category='semi_personalizado').count() == 1
        assert Package.objects.filter(category='terapeutico').count() == 1
