"""Tests for the create_trainer_weekday_slots management command."""

from datetime import datetime
from datetime import timezone as dt_timezone

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core_app.models import AvailabilitySlot, TrainerProfile, User

FIXED_NOW = datetime(2026, 3, 4, 12, 0, tzinfo=dt_timezone.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='weekday-trainer@kore.com', password='p', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, specialty='General')


@pytest.mark.django_db
class TestCreateTrainerWeekdaySlots:
    def test_creates_slots_for_trainer(self, trainer):
        """Command creates availability slots for the given trainer email."""
        call_command('create_trainer_weekday_slots', email=trainer.user.email, days=3)
        assert AvailabilitySlot.objects.filter(trainer=trainer).count() > 0

    def test_raises_error_for_nonexistent_email(self, db):
        """Command raises CommandError when trainer email does not exist."""
        with pytest.raises(CommandError, match='No TrainerProfile found') as exc_info:
            call_command('create_trainer_weekday_slots', email='nobody@kore.com', days=3)
        assert 'nobody@kore.com' in str(exc_info.value)

    def test_raises_error_for_zero_days(self, trainer):
        """Command raises CommandError when --days is 0."""
        with pytest.raises(CommandError, match='--days must be > 0') as exc_info:
            call_command('create_trainer_weekday_slots', email=trainer.user.email, days=0)
        assert 'days' in str(exc_info.value).lower()

    def test_raises_error_for_zero_slot_minutes(self, trainer):
        """Command raises CommandError when --slot-minutes is 0."""
        with pytest.raises(CommandError, match='--slot-minutes must be > 0') as exc_info:
            call_command('create_trainer_weekday_slots', email=trainer.user.email, days=3, slot_minutes=0)
        assert 'slot-minutes' in str(exc_info.value).lower()

    def test_raises_error_for_zero_slot_step_minutes(self, trainer):
        """Command raises CommandError when --slot-step-minutes is 0."""
        with pytest.raises(CommandError, match='--slot-step-minutes must be > 0') as exc_info:
            call_command('create_trainer_weekday_slots', email=trainer.user.email, days=3, slot_step_minutes=0)
        assert 'slot-step-minutes' in str(exc_info.value).lower()

    def test_with_explicit_timezone(self, trainer):
        """Command works with an explicit timezone argument."""
        call_command(
            'create_trainer_weekday_slots',
            email=trainer.user.email, days=2, timezone='America/Bogota',
        )
        assert AvailabilitySlot.objects.filter(trainer=trainer).count() > 0

    def test_idempotent_on_second_run(self, trainer):
        """Running twice does not duplicate slots."""
        call_command('create_trainer_weekday_slots', email=trainer.user.email, days=3)
        count_first = AvailabilitySlot.objects.filter(trainer=trainer).count()
        call_command('create_trainer_weekday_slots', email=trainer.user.email, days=3)
        count_second = AvailabilitySlot.objects.filter(trainer=trainer).count()
        assert count_first == count_second
