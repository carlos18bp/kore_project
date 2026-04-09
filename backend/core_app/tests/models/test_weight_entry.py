"""Tests for WeightEntry model."""

from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from core_app.models import User, WeightEntry


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='weight-customer@test.com', password='p',
        first_name='Weight', last_name='Customer', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestWeightEntryModel:
    """Validates WeightEntry creation, ordering, and uniqueness constraints."""

    def test_creates_entry_with_weight_and_date(self, customer):
        """A weight entry stores the kilogram value and date for the user."""
        entry = WeightEntry.objects.create(
            user=customer, weight_kg=Decimal('72.5'), date=date(2026, 4, 1),
        )
        assert entry.weight_kg == Decimal('72.5')
        assert entry.date == date(2026, 4, 1)
        assert entry.user == customer

    def test_default_date_is_today(self, customer):
        """When date is not provided, it defaults to today's localdate."""
        from django.utils import timezone
        entry = WeightEntry.objects.create(user=customer, weight_kg=Decimal('70.0'))
        assert entry.date == timezone.localdate()

    def test_unique_user_date_constraint(self, customer):
        """Same user cannot record two weight entries on the same date."""
        WeightEntry.objects.create(
            user=customer, weight_kg=Decimal('72.0'), date=date(2026, 4, 1),
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            WeightEntry.objects.create(
                user=customer, weight_kg=Decimal('73.0'), date=date(2026, 4, 1),
            )
        assert WeightEntry.objects.filter(user=customer, date=date(2026, 4, 1)).count() == 1

    def test_different_users_can_share_date(self, customer):
        """Two different users can each record weight on the same date."""
        other = User.objects.create_user(
            email='weight-other@test.com', password='p', role=User.Role.CUSTOMER,
        )
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('72.0'), date=date(2026, 4, 1))
        WeightEntry.objects.create(user=other, weight_kg=Decimal('80.0'), date=date(2026, 4, 1))
        assert WeightEntry.objects.filter(date=date(2026, 4, 1)).count() == 2

    def test_ordering_by_date_descending(self, customer):
        """Default queryset orders weight entries by most recent date first."""
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('75.0'), date=date(2026, 3, 1))
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('72.0'), date=date(2026, 4, 1))
        WeightEntry.objects.create(user=customer, weight_kg=Decimal('73.5'), date=date(2026, 3, 15))

        dates = list(WeightEntry.objects.values_list('date', flat=True))
        assert dates == [date(2026, 4, 1), date(2026, 3, 15), date(2026, 3, 1)]

    def test_str_representation(self, customer):
        """String representation contains email, weight and date."""
        entry = WeightEntry.objects.create(
            user=customer, weight_kg=Decimal('72.5'), date=date(2026, 4, 1),
        )
        assert str(entry) == 'weight-customer@test.com — 72.5 kg (2026-04-01)'

    def test_cascade_delete_with_user(self, customer):
        """Weight entries are deleted when their owning user is deleted."""
        WeightEntry.objects.create(
            user=customer, weight_kg=Decimal('70.0'), date=date(2026, 4, 1),
        )
        customer.delete()
        assert WeightEntry.objects.count() == 0
