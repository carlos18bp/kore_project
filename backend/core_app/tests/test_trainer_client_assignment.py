import pytest
from django.utils import timezone
from rest_framework.test import APIClient

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


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(email='admin@kore.com', password='x', role=User.Role.ADMIN,
                                    is_staff=True, is_superuser=True)


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.mark.django_db
def test_admin_detail_customer_includes_assigned_trainer(admin_client, customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    resp = admin_client.get(f'/api/admin/users/{customer.id}/')
    assert resp.status_code == 200
    assert resp.data['assigned_trainer'] == {
        'id': trainer_a.id,
        'first_name': 'Tra',
        'last_name': 'A',
    }


@pytest.mark.django_db
def test_admin_detail_customer_assigned_trainer_null_when_unassigned(admin_client, customer):
    resp = admin_client.get(f'/api/admin/users/{customer.id}/')
    assert resp.status_code == 200
    assert resp.data['assigned_trainer'] is None


@pytest.mark.django_db
def test_admin_detail_trainer_includes_assigned_clients(admin_client, customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    resp = admin_client.get(f'/api/admin/users/{trainer_a.user_id}/')
    assert resp.status_code == 200
    clients = resp.data['assigned_clients']
    assert [c['id'] for c in clients] == [customer.id]
    assert clients[0]['email'] == 'c1@kore.com'


@pytest.mark.django_db
def test_admin_patch_assigns_trainer_to_customer(admin_client, customer, trainer_a):
    resp = admin_client.patch(f'/api/admin/users/{customer.id}/',
                              {'assigned_trainer_id': trainer_a.id}, format='json')
    assert resp.status_code == 200
    customer.refresh_from_db()
    assert customer.assigned_trainer_id == trainer_a.id
    assert resp.data['assigned_trainer']['id'] == trainer_a.id


@pytest.mark.django_db
def test_admin_patch_reassigns_then_clears(admin_client, customer, trainer_a, trainer_b):
    admin_client.patch(f'/api/admin/users/{customer.id}/',
                       {'assigned_trainer_id': trainer_a.id}, format='json')
    admin_client.patch(f'/api/admin/users/{customer.id}/',
                       {'assigned_trainer_id': trainer_b.id}, format='json')
    customer.refresh_from_db()
    assert customer.assigned_trainer_id == trainer_b.id
    admin_client.patch(f'/api/admin/users/{customer.id}/',
                       {'assigned_trainer_id': None}, format='json')
    customer.refresh_from_db()
    assert customer.assigned_trainer_id is None


@pytest.mark.django_db
def test_admin_patch_assigning_trainer_to_a_trainer_is_rejected(admin_client, trainer_a, trainer_b):
    resp = admin_client.patch(f'/api/admin/users/{trainer_a.user_id}/',
                              {'assigned_trainer_id': trainer_b.id}, format='json')
    assert resp.status_code == 400
    assert 'assigned_trainer_id' in resp.data


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='P', short_description='s', category='personalizado',
        sessions_count=10, session_duration_minutes=60, price=1, currency='COP',
        validity_days=30, is_active=True, order=1,
    )


def _active_sub(customer, package):
    return Subscription.objects.create(
        customer=customer, package=package, status=Subscription.Status.ACTIVE,
        starts_at=timezone.now(), expires_at=timezone.now() + timezone.timedelta(days=30),
        sessions_used=0, sessions_total=10,
    )


@pytest.mark.django_db
def test_assignment_summary_counts(admin_client, trainer_a, trainer_b, package):
    c_assigned = User.objects.create_user(email='ca@kore.com', password='x', role=User.Role.CUSTOMER)
    c_unassigned = User.objects.create_user(email='cu@kore.com', password='x', role=User.Role.CUSTOMER)
    c_no_sub = User.objects.create_user(email='cn@kore.com', password='x', role=User.Role.CUSTOMER)
    _active_sub(c_assigned, package)
    _active_sub(c_unassigned, package)
    c_assigned.assigned_trainer = trainer_a
    c_assigned.save(update_fields=['assigned_trainer'])

    resp = admin_client.get('/api/admin/trainers/assignment-summary/')
    assert resp.status_code == 200
    assert resp.data['active_customers'] == 2
    assert resp.data['assigned'] == 1
    assert resp.data['unassigned'] == 1
    per = {row['trainer_id']: row['client_count'] for row in resp.data['per_trainer']}
    assert per[trainer_a.id] == 1
    assert per[trainer_b.id] == 0


@pytest.mark.django_db
def test_assignment_summary_requires_admin(customer):
    c = APIClient()
    c.force_authenticate(user=customer)
    assert c.get('/api/admin/trainers/assignment-summary/').status_code in (403, 401)


@pytest.mark.django_db
def test_profile_includes_assigned_trainer(customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.get('/api/auth/profile/')
    assert resp.status_code == 200
    at = resp.data['user']['assigned_trainer']
    assert at['id'] == trainer_a.id
    assert at['session_duration_minutes'] == 60
    assert 'location' in at


@pytest.mark.django_db
def test_profile_assigned_trainer_null_when_unassigned(customer):
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.get('/api/auth/profile/')
    assert resp.status_code == 200
    assert resp.data['user']['assigned_trainer'] is None
