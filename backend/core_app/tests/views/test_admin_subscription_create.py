"""Tests for the admin-create / admin-evolve subscription action.

Covers both sub-flows of ``POST /api/subscriptions/admin-create/``:
- ``action="create"`` for customers with no active subscription.
- ``action="evolve"`` for customers with one active subscription, upgrading
  to a strictly larger package and recording only the price delta.
"""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Payment, Subscription, User


FIXED_NOW = timezone.make_aware(datetime(2024, 6, 1, 10, 0, 0))


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@kore.com', password='p',
        first_name='Admin', last_name='User', role=User.Role.ADMIN,
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer@kore.com', password='p',
        first_name='Juan', last_name='López', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def small_package(db):
    return Package.objects.create(
        title='Plan Small', sessions_count=8, validity_days=30,
        price=Decimal('200000'), currency='COP', is_active=True,
    )


@pytest.fixture
def large_package(db):
    return Package.objects.create(
        title='Plan Large', sessions_count=12, validity_days=30,
        price=Decimal('300000'), currency='COP', is_active=True,
    )


@pytest.fixture
def inactive_package(db):
    return Package.objects.create(
        title='Retired', sessions_count=5, validity_days=30,
        price=Decimal('150000'), currency='COP', is_active=False,
    )


@pytest.fixture
def active_sub_for_customer(customer, small_package):
    return Subscription.objects.create(
        customer=customer, package=small_package,
        sessions_total=small_package.sessions_count, sessions_used=3,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW,
        expires_at=FIXED_NOW + timedelta(days=30),
    )


@pytest.fixture
def url():
    return reverse('subscription-admin-create')


# ── action="create" ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_create_subscription_no_active_creates_new(api_client, admin_user, customer, small_package, url):
    api_client.force_authenticate(user=admin_user)

    starts = FIXED_NOW.isoformat()
    ends = (FIXED_NOW + timedelta(days=30)).isoformat()

    response = api_client.post(url, {
        'action': 'create',
        'customer_id': customer.pk,
        'package_id': small_package.pk,
        'payment_method': 'cash',
        'starts_at': starts,
        'expires_at': ends,
        'sessions_used': 2,
        'notes': 'Pago en sede principal',
    }, format='json')

    assert response.status_code == status.HTTP_201_CREATED, response.data
    sub = Subscription.objects.get(customer=customer, status=Subscription.Status.ACTIVE)
    assert sub.package_id == small_package.pk
    assert sub.sessions_total == small_package.sessions_count
    assert sub.sessions_used == 2
    assert sub.is_recurring is False

    payment = Payment.objects.get(subscription=sub)
    assert payment.provider == Payment.Provider.CASH
    assert payment.status == Payment.Status.CONFIRMED
    assert payment.amount == small_package.price
    assert payment.metadata.get('admin_action') == 'admin_create'
    assert payment.metadata.get('notes') == 'Pago en sede principal'
    assert payment.metadata.get('recorded_by_email') == admin_user.email


@pytest.mark.django_db
def test_admin_create_subscription_with_active_returns_409(
    api_client, admin_user, customer, small_package, active_sub_for_customer, url,
):
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(url, {
        'action': 'create',
        'customer_id': customer.pk,
        'package_id': small_package.pk,
        'payment_method': 'cash',
        'starts_at': FIXED_NOW.isoformat(),
        'expires_at': (FIXED_NOW + timedelta(days=30)).isoformat(),
        'sessions_used': 0,
    }, format='json')

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.data.get('expected_action') == 'evolve'
    assert Subscription.objects.filter(customer=customer).count() == 1


@pytest.mark.django_db
def test_admin_create_subscription_sessions_used_exceeds_total_returns_400(
    api_client, admin_user, customer, small_package, url,
):
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(url, {
        'action': 'create',
        'customer_id': customer.pk,
        'package_id': small_package.pk,
        'payment_method': 'transfer',
        'starts_at': FIXED_NOW.isoformat(),
        'expires_at': (FIXED_NOW + timedelta(days=30)).isoformat(),
        'sessions_used': 99,
    }, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not Subscription.objects.filter(customer=customer).exists()


@pytest.mark.django_db
def test_admin_create_subscription_inactive_package_returns_400(
    api_client, admin_user, customer, inactive_package, url,
):
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(url, {
        'action': 'create',
        'customer_id': customer.pk,
        'package_id': inactive_package.pk,
        'payment_method': 'cash',
        'starts_at': FIXED_NOW.isoformat(),
        'expires_at': (FIXED_NOW + timedelta(days=30)).isoformat(),
        'sessions_used': 0,
    }, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_admin_create_subscription_non_admin_forbidden_403(
    api_client, customer, small_package, url,
):
    api_client.force_authenticate(user=customer)

    response = api_client.post(url, {
        'action': 'create',
        'customer_id': customer.pk,
        'package_id': small_package.pk,
        'payment_method': 'cash',
        'starts_at': FIXED_NOW.isoformat(),
        'expires_at': (FIXED_NOW + timedelta(days=30)).isoformat(),
        'sessions_used': 0,
    }, format='json')

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ── action="evolve" ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_evolve_subscription_upgrades_and_charges_delta(
    api_client, admin_user, customer, large_package, active_sub_for_customer, url,
):
    api_client.force_authenticate(user=admin_user)

    original_starts_at = active_sub_for_customer.starts_at
    original_expires_at = active_sub_for_customer.expires_at
    original_sessions_used = active_sub_for_customer.sessions_used
    expected_delta = large_package.price - active_sub_for_customer.package.price

    response = api_client.post(url, {
        'action': 'evolve',
        'customer_id': customer.pk,
        'package_id': large_package.pk,
        'payment_method': 'transfer',
        'notes': 'Upgrade en recepción',
    }, format='json')

    assert response.status_code == status.HTTP_200_OK, response.data

    active_sub_for_customer.refresh_from_db()
    assert active_sub_for_customer.package_id == large_package.pk
    assert active_sub_for_customer.sessions_total == large_package.sessions_count
    assert active_sub_for_customer.sessions_used == original_sessions_used
    assert active_sub_for_customer.starts_at == original_starts_at
    assert active_sub_for_customer.expires_at == original_expires_at

    delta_payment = Payment.objects.filter(
        subscription=active_sub_for_customer,
        metadata__admin_action='admin_evolve',
    ).get()
    assert delta_payment.amount == expected_delta
    assert delta_payment.provider == Payment.Provider.TRANSFER
    assert delta_payment.status == Payment.Status.CONFIRMED
    assert delta_payment.metadata.get('to_package_id') == large_package.pk
    assert delta_payment.metadata.get('notes') == 'Upgrade en recepción'


@pytest.mark.django_db
def test_admin_evolve_subscription_lower_price_schedules_plan_change(
    api_client, admin_user, customer, large_package, url,
):
    cheaper = Package.objects.create(
        title='Plan Cheaper', sessions_count=20, validity_days=30,
        price=Decimal('150000'), currency='COP', is_active=True,
    )
    sub = Subscription.objects.create(
        customer=customer, package=large_package,
        sessions_total=large_package.sessions_count, sessions_used=1,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(url, {
        'action': 'evolve',
        'customer_id': customer.pk,
        'package_id': cheaper.pk,
        'payment_method': 'cash',
    }, format='json')

    # Downgrade is scheduled for the next cycle: current package unchanged, the
    # target stored in pending_package, and no payment recorded now.
    assert response.status_code == status.HTTP_200_OK
    sub.refresh_from_db()
    assert sub.package_id == large_package.pk
    assert sub.pending_package_id == cheaper.pk
    assert not Payment.objects.filter(subscription=sub).exists()


@pytest.mark.django_db
def test_admin_evolve_subscription_fewer_sessions_schedules_plan_change(
    api_client, admin_user, customer, large_package, url,
):
    # Lower price AND fewer sessions than the current plan: a genuine downgrade,
    # which is now scheduled for the next cycle rather than blocked.
    fewer_sessions = Package.objects.create(
        title='Plan Fewer', sessions_count=6, validity_days=30,
        price=Decimal('250000'), currency='COP', is_active=True,
    )
    sub = Subscription.objects.create(
        customer=customer, package=large_package,
        sessions_total=large_package.sessions_count, sessions_used=1,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(url, {
        'action': 'evolve',
        'customer_id': customer.pk,
        'package_id': fewer_sessions.pk,
        'payment_method': 'cash',
    }, format='json')

    assert response.status_code == status.HTTP_200_OK
    sub.refresh_from_db()
    assert sub.package_id == large_package.pk
    assert sub.pending_package_id == fewer_sessions.pk
    assert not Payment.objects.filter(subscription=sub).exists()
