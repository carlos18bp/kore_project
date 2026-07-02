import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_get_settings_seeds_medium_preset():
    s = credit_engine.get_settings()
    assert s.action_values['session_attended'] == 50
    assert s.action_values['physical_test_passed'] == 100
    assert s.action_values['no_show_penalty'] == -40
    assert s.streak_bonuses['7'] == 50


@pytest.mark.django_db
def test_award_confirmed_updates_wallet(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.CHECKIN,
        'mood_entry', 10, 'Completaste tu check-in del lunes',
    )
    assert tx.amount == 5
    wallet = credit_engine.get_wallet(existing_user)
    assert wallet.balance == 5


@pytest.mark.django_db
def test_award_is_idempotent_per_reference(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 10, 'x')
    dup = credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'mood_entry', 10, 'x')
    assert dup is None
    assert credit_engine.get_wallet(existing_user).balance == 5
    assert CreditTransaction.objects.count() == 1


@pytest.mark.django_db
def test_pending_award_does_not_touch_balance(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO,
        'meal_entry', 3, 'Registraste tu almuerzo',
        status=CreditTransaction.Status.PENDING,
    )
    assert tx.status == 'pending'
    assert credit_engine.get_wallet(existing_user).balance == 0
