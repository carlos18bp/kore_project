import pytest

from core_app.models import TrainerProfile, User
from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def assigned_customer(existing_user, trainer_user):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user


@pytest.mark.django_db
def test_pending_reviews_lists_only_own_clients(api_client, trainer_user, assigned_customer, frozen_now):
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1,
        'Registraste tu almuerzo', status=CreditTransaction.Status.PENDING,
        review_deadline=frozen_now,
    )
    other = User.objects.create_user(email='o@example.com', password='x', role=User.Role.CUSTOMER)
    credit_engine.award(
        other, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 2,
        'Cena', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )
    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')
    assert resp.status_code == 200
    results = resp.json()['results']
    assert len(results) == 1
    assert results[0]['customer_email'] == assigned_customer.email


@pytest.mark.django_db
def test_review_approve_and_reject(api_client, trainer_user, assigned_customer, frozen_now):
    tx1 = credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 3,
        'Almuerzo', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )
    tx2 = credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 4,
        'Cena', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )
    api_client.force_authenticate(trainer_user)
    assert api_client.post(
        f'/api/trainer/credits/transactions/{tx1.pk}/review/',
        {'decision': 'approve'}, format='json',
    ).status_code == 200
    assert api_client.post(
        f'/api/trainer/credits/transactions/{tx2.pk}/review/',
        {'decision': 'reject', 'note': 'Foto borrosa'}, format='json',
    ).status_code == 200
    assert credit_engine.get_wallet(assigned_customer).balance == 5


@pytest.mark.django_db
def test_settings_put_reseeds_on_difficulty_change(api_client, trainer_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.put(
        '/api/credits/settings/',
        {'difficulty': 'hard', 'action_values': {}, 'streak_bonuses': {}},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.json()['action_values']['session_attended'] == 40
