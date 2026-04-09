"""Tests for MoodEntry model."""

from datetime import date

import pytest
from django.db import IntegrityError, transaction

from core_app.models import MoodEntry, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='mood-customer@test.com', password='p',
        first_name='Mood', last_name='Customer', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestMoodEntryModel:
    """Validates MoodEntry creation, ordering, and uniqueness constraints."""

    def test_creates_entry_with_score_and_date(self, customer):
        """A mood entry stores the score, notes and date for the user."""
        entry = MoodEntry.objects.create(
            user=customer, score=8, notes='Felicidad', date=date(2026, 4, 1),
        )
        assert entry.score == 8
        assert entry.notes == 'Felicidad'
        assert entry.date == date(2026, 4, 1)
        assert entry.user == customer

    def test_default_date_is_today(self, customer):
        """When date is not provided, it defaults to today's localdate."""
        from django.utils import timezone
        entry = MoodEntry.objects.create(user=customer, score=5)
        assert entry.date == timezone.localdate()

    def test_default_notes_is_empty(self, customer):
        """Notes defaults to an empty string when not provided."""
        entry = MoodEntry.objects.create(user=customer, score=7)
        assert entry.notes == ''

    def test_unique_user_date_constraint(self, customer):
        """Same user cannot have two mood entries on the same date."""
        MoodEntry.objects.create(user=customer, score=4, date=date(2026, 4, 1))
        with pytest.raises(IntegrityError), transaction.atomic():
            MoodEntry.objects.create(user=customer, score=9, date=date(2026, 4, 1))
        assert MoodEntry.objects.filter(user=customer, date=date(2026, 4, 1)).count() == 1

    def test_different_users_can_share_date(self, customer):
        """Two different users can each have their own mood entry on the same date."""
        other = User.objects.create_user(
            email='mood-other@test.com', password='p', role=User.Role.CUSTOMER,
        )
        MoodEntry.objects.create(user=customer, score=6, date=date(2026, 4, 1))
        MoodEntry.objects.create(user=other, score=8, date=date(2026, 4, 1))
        assert MoodEntry.objects.filter(date=date(2026, 4, 1)).count() == 2

    def test_ordering_by_date_descending(self, customer):
        """Default queryset orders mood entries by most recent date first."""
        MoodEntry.objects.create(user=customer, score=3, date=date(2026, 3, 1))
        MoodEntry.objects.create(user=customer, score=8, date=date(2026, 4, 1))
        MoodEntry.objects.create(user=customer, score=6, date=date(2026, 3, 15))

        dates = list(MoodEntry.objects.values_list('date', flat=True))
        assert dates == [date(2026, 4, 1), date(2026, 3, 15), date(2026, 3, 1)]

    def test_str_representation(self, customer):
        """String representation contains email, score and date."""
        entry = MoodEntry.objects.create(user=customer, score=7, date=date(2026, 4, 1))
        assert str(entry) == 'mood-customer@test.com — 7/10 (2026-04-01)'

    def test_cascade_delete_with_user(self, customer):
        """Mood entries are deleted when their owning user is deleted."""
        MoodEntry.objects.create(user=customer, score=5, date=date(2026, 4, 1))
        customer.delete()
        assert MoodEntry.objects.count() == 0
