"""Unit tests for admin-driven subscription creation and plan evolution."""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from core_app.models import Package, Payment, Subscription, SubscriptionRenewal, User
from core_app.services.admin_subscription_service import (
    _payment_metadata,
    create_subscription_for_admin,
    evolve_subscription_for_admin,
)

FIXED_NOW = timezone.make_aware(datetime(2026, 5, 1, 9, 0, 0))
STARTS_AT = FIXED_NOW
EXPIRES_AT = FIXED_NOW + timedelta(days=30)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='admin-svc-cust@kore.com', password='p',
        first_name='Juan', last_name='López', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def admin(db):
    return User.objects.create_user(
        email='admin-svc-admin@kore.com', password='p',
        first_name='Ada', last_name='Min', role=User.Role.ADMIN,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Silver', category='personalizado', sessions_count=8,
        session_duration_minutes=60, price=Decimal('150000'), currency='COP',
        validity_days=30, is_active=True,
    )


@pytest.fixture
def larger_package(db):
    return Package.objects.create(
        title='Gold', category='personalizado', sessions_count=12,
        session_duration_minutes=60, price=Decimal('250000'), currency='COP',
        validity_days=30, is_active=True,
    )


@pytest.fixture
def active_sub(customer, package):
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=package.sessions_count, sessions_used=3,
        status=Subscription.Status.ACTIVE,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT,
        is_recurring=True, payment_method_type='CARD',
    )


# ── create_subscription_for_admin ────────────────────────────────────────────

@pytest.mark.django_db
def test_create_subscription_persists_active_subscription(customer, package, admin):
    # Act
    sub = create_subscription_for_admin(
        customer=customer, package=package, payment_method=Payment.Provider.CASH,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT, sessions_used=0, actor=admin,
    )

    # Assert
    stored = Subscription.objects.get(pk=sub.pk)
    assert stored.status == Subscription.Status.ACTIVE
    assert stored.customer_id == customer.id
    assert stored.is_recurring is False


@pytest.mark.django_db
def test_create_subscription_sets_sessions_total_from_package(customer, package, admin):
    # Act
    sub = create_subscription_for_admin(
        customer=customer, package=package, payment_method=Payment.Provider.CASH,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT, sessions_used=2, actor=admin,
    )

    # Assert
    assert sub.sessions_total == package.sessions_count
    assert sub.sessions_used == 2


@pytest.mark.django_db
def test_create_subscription_creates_confirmed_payment_with_full_price(customer, package, admin):
    # Act
    sub = create_subscription_for_admin(
        customer=customer, package=package, payment_method=Payment.Provider.TRANSFER,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT, sessions_used=0, actor=admin,
    )

    # Assert
    payment = Payment.objects.get(subscription=sub)
    assert payment.status == Payment.Status.CONFIRMED
    assert payment.amount == package.price
    assert payment.provider == Payment.Provider.TRANSFER


@pytest.mark.django_db
def test_create_subscription_records_initial_renewal(customer, package, admin):
    # Act
    sub = create_subscription_for_admin(
        customer=customer, package=package, payment_method=Payment.Provider.CASH,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT, sessions_used=0, actor=admin,
    )

    # Assert
    renewal = SubscriptionRenewal.objects.get(subscription=sub)
    assert renewal.kind == SubscriptionRenewal.Kind.INITIAL
    assert renewal.sessions_granted == sub.sessions_total


@pytest.mark.django_db
def test_create_subscription_stores_actor_email_in_payment_metadata(customer, package, admin):
    # Act
    sub = create_subscription_for_admin(
        customer=customer, package=package, payment_method=Payment.Provider.CASH,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT, sessions_used=0,
        notes='paid in cash', actor=admin,
    )

    # Assert
    payment = Payment.objects.get(subscription=sub)
    assert payment.metadata['admin_action'] == 'admin_create'
    assert payment.metadata['recorded_by_email'] == admin.email
    assert payment.metadata['notes'] == 'paid in cash'


@pytest.mark.django_db
def test_create_subscription_omits_actor_email_when_actor_missing(customer, package):
    # Act
    sub = create_subscription_for_admin(
        customer=customer, package=package, payment_method=Payment.Provider.CASH,
        starts_at=STARTS_AT, expires_at=EXPIRES_AT, sessions_used=0, actor=None,
    )

    # Assert
    payment = Payment.objects.get(subscription=sub)
    assert 'recorded_by_email' not in payment.metadata


# ── evolve_subscription_for_admin ────────────────────────────────────────────

@pytest.mark.django_db
def test_evolve_subscription_swaps_package(active_sub, larger_package, admin):
    # Act
    evolve_subscription_for_admin(
        current_subscription=active_sub, new_package=larger_package,
        payment_method=Payment.Provider.CASH, actor=admin,
    )

    # Assert
    active_sub.refresh_from_db()
    assert active_sub.package_id == larger_package.id


@pytest.mark.django_db
def test_evolve_subscription_updates_sessions_total(active_sub, larger_package, admin):
    # Act
    evolve_subscription_for_admin(
        current_subscription=active_sub, new_package=larger_package,
        payment_method=Payment.Provider.CASH, actor=admin,
    )

    # Assert
    active_sub.refresh_from_db()
    assert active_sub.sessions_total == larger_package.sessions_count


@pytest.mark.django_db
def test_evolve_subscription_preserves_sessions_used(active_sub, larger_package, admin):
    # Act
    evolve_subscription_for_admin(
        current_subscription=active_sub, new_package=larger_package,
        payment_method=Payment.Provider.CASH, actor=admin,
    )

    # Assert
    active_sub.refresh_from_db()
    assert active_sub.sessions_used == 3


@pytest.mark.django_db
def test_evolve_subscription_preserves_validity_dates(active_sub, larger_package, admin):
    # Act
    evolve_subscription_for_admin(
        current_subscription=active_sub, new_package=larger_package,
        payment_method=Payment.Provider.CASH, actor=admin,
    )

    # Assert
    active_sub.refresh_from_db()
    assert active_sub.starts_at == STARTS_AT
    assert active_sub.expires_at == EXPIRES_AT


@pytest.mark.django_db
def test_evolve_subscription_records_delta_payment(active_sub, larger_package, admin):
    # Arrange — capture the old price before the service mutates the instance.
    old_price = active_sub.package.price

    # Act
    evolve_subscription_for_admin(
        current_subscription=active_sub, new_package=larger_package,
        payment_method=Payment.Provider.CASH, actor=admin,
    )

    # Assert — new payment is for the price difference only.
    payment = Payment.objects.get(subscription=active_sub)
    assert payment.amount == larger_package.price - old_price
    assert payment.status == Payment.Status.CONFIRMED


@pytest.mark.django_db
def test_evolve_subscription_records_plan_change_renewal(active_sub, larger_package, admin):
    # Act
    evolve_subscription_for_admin(
        current_subscription=active_sub, new_package=larger_package,
        payment_method=Payment.Provider.CASH, actor=admin,
    )

    # Assert
    renewal = SubscriptionRenewal.objects.get(subscription=active_sub)
    assert renewal.kind == SubscriptionRenewal.Kind.PLAN_CHANGE
    assert renewal.sessions_granted == larger_package.sessions_count


# ── _payment_metadata ─────────────────────────────────────────────────────────

def test_payment_metadata_omits_notes_when_blank():
    # Arrange / Act
    data = _payment_metadata(kind='admin_create', actor=None, notes='', extra=None)

    # Assert
    assert data == {'admin_action': 'admin_create'}
