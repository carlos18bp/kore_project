import pytest
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot, Booking, Package, Subscription, TrainerProfile, User,
)


@pytest.fixture
def trainer_a(db):
    u = User.objects.create_user(email='ta@kore.com', password='x', role=User.Role.TRAINER,
                                 first_name='Tra', last_name='A')
    return TrainerProfile.objects.create(user=u, specialty='Func')


@pytest.fixture
def trainer_b(db):
    u = User.objects.create_user(email='tb@kore.com', password='x', role=User.Role.TRAINER,
                                 first_name='Tra', last_name='B')
    return TrainerProfile.objects.create(user=u, specialty='Func')


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='c1@kore.com', password='x', role=User.Role.CUSTOMER,
                                    first_name='Cli', last_name='One')


@pytest.mark.django_db
def test_user_has_nullable_assigned_trainer(customer, trainer_a):
    assert customer.assigned_trainer is None
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    customer.refresh_from_db()
    assert customer.assigned_trainer_id == trainer_a.id
    assert list(trainer_a.assigned_clients.all()) == [customer]


@pytest.mark.django_db
def test_deleting_trainer_profile_unassigns_clients(customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    trainer_a.delete()
    customer.refresh_from_db()
    assert customer.assigned_trainer is None
