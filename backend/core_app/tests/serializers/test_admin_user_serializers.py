"""Unit tests for the admin-only User serializers."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

import pytest

from core_app.models import Package, Subscription, TrainerProfile, User
from core_app.serializers.admin_user_serializers import (
    AdminUserCreateSerializer,
    AdminUserDetailSerializer,
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
)

FIXED_NOW = datetime(2026, 2, 1, 9, 0, 0, tzinfo=dt_timezone.utc)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='admin-ser-cust@kore.com', password='p',
        first_name='Juan', last_name='López', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer(db):
    return User.objects.create_user(
        email='admin-ser-trainer@kore.com', password='p',
        first_name='Ana', last_name='Ruiz', role=User.Role.TRAINER,
    )


@pytest.fixture
def trainer_profile(trainer):
    return TrainerProfile.objects.create(user=trainer, specialty='Strength')


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Gold', category='personalizado', sessions_count=10,
        session_duration_minutes=60, price=Decimal('300000'), currency='COP',
        validity_days=30, is_active=True,
    )


@pytest.fixture
def active_sub(customer, package):
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=10, sessions_used=4,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )


# ── AdminUserListSerializer ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_full_name_combines_first_and_last_name(customer):
    # Act
    data = AdminUserListSerializer(customer).data

    # Assert
    assert data['full_name'] == 'Juan López'


@pytest.mark.django_db
def test_full_name_falls_back_to_email_when_names_blank(db):
    # Arrange
    user = User.objects.create_user(
        email='nameless@kore.com', password='p',
        first_name='', last_name='', role=User.Role.CUSTOMER,
    )

    # Act
    data = AdminUserListSerializer(user).data

    # Assert
    assert data['full_name'] == 'nameless@kore.com'


@pytest.mark.django_db
def test_has_active_subscription_true_for_customer_with_active_sub(customer, active_sub):
    # Act
    data = AdminUserListSerializer(customer).data

    # Assert
    assert data['has_active_subscription'] is True


@pytest.mark.django_db
def test_has_active_subscription_false_for_trainer(trainer):
    # Act
    data = AdminUserListSerializer(trainer).data

    # Assert
    assert data['has_active_subscription'] is False


@pytest.mark.django_db
def test_sessions_total_total_sums_active_subscription_sessions(customer, active_sub):
    # Act
    data = AdminUserListSerializer(customer).data

    # Assert
    assert data['sessions_total_total'] == 10


# ── AdminUserDetailSerializer ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_detail_lists_customer_subscription_entry(customer, active_sub):
    # Act
    data = AdminUserDetailSerializer(customer).data

    # Assert
    assert len(data['subscriptions']) == 1
    assert data['subscriptions'][0]['package']['title'] == 'Gold'
    assert data['subscriptions'][0]['role'] == 'individual'


@pytest.mark.django_db
def test_detail_returns_assigned_trainer_info_for_customer(customer, trainer_profile):
    # Arrange
    customer.assigned_trainer = trainer_profile
    customer.save(update_fields=['assigned_trainer'])

    # Act
    data = AdminUserDetailSerializer(customer).data

    # Assert
    assert data['assigned_trainer'] == {
        'id': trainer_profile.id,
        'first_name': 'Ana',
        'last_name': 'Ruiz',
    }


@pytest.mark.django_db
def test_detail_assigned_trainer_is_none_for_trainer(trainer, trainer_profile):
    # Act
    data = AdminUserDetailSerializer(trainer).data

    # Assert
    assert data['assigned_trainer'] is None


@pytest.mark.django_db
def test_detail_lists_assigned_clients_for_trainer(trainer, trainer_profile, customer):
    # Arrange
    customer.assigned_trainer = trainer_profile
    customer.save(update_fields=['assigned_trainer'])

    # Act
    data = AdminUserDetailSerializer(trainer).data

    # Assert
    assert len(data['assigned_clients']) == 1
    assert data['assigned_clients'][0]['email'] == customer.email


# ── AdminUserCreateSerializer ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_create_serializer_normalizes_email_to_lowercase(db):
    # Arrange
    serializer = AdminUserCreateSerializer(data={
        'email': 'Mixed.Case@Kore.COM',
        'first_name': 'New', 'last_name': 'User', 'role': User.Role.CUSTOMER,
    })

    # Act
    is_valid = serializer.is_valid()

    # Assert
    assert is_valid is True
    assert serializer.validated_data['email'] == 'mixed.case@kore.com'


@pytest.mark.django_db
def test_create_serializer_rejects_duplicate_email(customer):
    # Arrange
    serializer = AdminUserCreateSerializer(data={
        'email': customer.email.upper(),
        'first_name': 'Dup', 'last_name': 'User', 'role': User.Role.CUSTOMER,
    })

    # Act
    is_valid = serializer.is_valid()

    # Assert
    assert is_valid is False
    assert 'email' in serializer.errors


# ── AdminUserUpdateSerializer ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_update_serializer_rejects_invalid_role(db):
    # Arrange
    serializer = AdminUserUpdateSerializer(data={'role': 'superhero'})

    # Act
    is_valid = serializer.is_valid()

    # Assert
    assert is_valid is False
    assert 'role' in serializer.errors
