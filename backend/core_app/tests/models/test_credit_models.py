import pytest
from django.db import IntegrityError

from core_app.models.credit import CreditSettings, CreditTransaction, CreditWallet


@pytest.mark.django_db
def test_credit_settings_is_singleton():
    a = CreditSettings.load()
    b = CreditSettings.load()
    assert a.pk == b.pk == 1
    assert a.difficulty == CreditSettings.Difficulty.MEDIUM
    assert a.training_day_threshold == 0.70
    assert a.nutrition_min_meals == 3
    assert a.water_goal_glasses == 8
    assert a.meal_review_days == 3
    assert a.reschedule_window_hours == 24
    assert a.require_workout_captures is False


@pytest.mark.django_db
def test_wallet_defaults(existing_user):
    wallet = CreditWallet.objects.create(customer=existing_user)
    assert wallet.balance == 0
    assert wallet.current_streak == 0
    assert wallet.longest_streak == 0
    assert wallet.last_active_date is None


@pytest.mark.django_db
def test_transaction_reference_is_unique_per_customer_action(existing_user):
    CreditTransaction.objects.create(
        customer=existing_user,
        action=CreditTransaction.Action.CHECKIN,
        amount=5,
        description='Completaste tu check-in',
        reference_type='mood_entry',
        reference_id='1',
    )
    with pytest.raises(IntegrityError):
        CreditTransaction.objects.create(
            customer=existing_user,
            action=CreditTransaction.Action.CHECKIN,
            amount=5,
            description='dup',
            reference_type='mood_entry',
            reference_id='1',
        )
