"""Tests for admin-only SubscriptionViewSet actions: PATCH and admin-renew."""

from datetime import datetime, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Payment, Subscription, SubscriptionGuest, User

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
def trainer(db):
    return User.objects.create_user(
        email='trainer@kore.com', password='p',
        first_name='Ana', last_name='Ruiz', role=User.Role.TRAINER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Gold', sessions_count=10, validity_days=30,
        price='300000', currency='COP', is_active=True,
    )


@pytest.fixture
def active_sub(customer, package):
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=10, sessions_used=3,
        status=Subscription.Status.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=30),
    )


@pytest.fixture
def expired_sub(customer, package):
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=10, sessions_used=10,
        status=Subscription.Status.EXPIRED,
        starts_at=now - timedelta(days=60),
        expires_at=now - timedelta(days=30),
    )


@pytest.fixture
def another_customer_sub(db, package):
    other = User.objects.create_user(
        email='other@kore.com', password='p', role=User.Role.CUSTOMER,
    )
    now = FIXED_NOW
    return Subscription.objects.create(
        customer=other, package=package,
        sessions_total=10, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


# ── List with admin filters ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_list_returns_all_subscriptions(api_client, admin_user, active_sub, another_customer_sub):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-list'))
    assert resp.status_code == status.HTTP_200_OK
    ids = [s['id'] for s in resp.data.get('results', resp.data)]
    assert active_sub.id in ids
    assert another_customer_sub.id in ids


@pytest.mark.django_db
def test_admin_list_search_filter(api_client, admin_user, active_sub, another_customer_sub):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-list'), {'search': 'juan'})
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data.get('results', resp.data)
    assert all('juan' in r['customer_email'].lower() or 'juan' in r['customer_name'].lower() for r in results)
    # another_customer_sub belongs to 'other@kore.com', should not appear
    ids = [r['id'] for r in results]
    assert another_customer_sub.id not in ids


@pytest.mark.django_db
def test_admin_list_status_filter(api_client, admin_user, active_sub, expired_sub):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-list'), {'status': 'expired'})
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data.get('results', resp.data)
    assert all(r['status'] == 'expired' for r in results)
    ids = [r['id'] for r in results]
    assert expired_sub.id in ids
    assert active_sub.id not in ids


# ── Admin includes customer_name ─────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_list_includes_customer_name(api_client, admin_user, active_sub):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-list'))
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data.get('results', resp.data)
    assert any('customer_name' in r for r in results)


# ── PATCH — admin can update fields ─────────────────────────────────────────

@pytest.mark.django_db
def test_patch_status_as_admin(api_client, admin_user, active_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-detail', kwargs={'pk': active_sub.pk})
    resp = api_client.patch(url, {'status': 'canceled'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    active_sub.refresh_from_db()
    assert active_sub.status == Subscription.Status.CANCELED


@pytest.mark.django_db
def test_patch_sessions_as_admin(api_client, admin_user, active_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-detail', kwargs={'pk': active_sub.pk})
    resp = api_client.patch(url, {'sessions_total': 20, 'sessions_used': 5}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    active_sub.refresh_from_db()
    assert active_sub.sessions_total == 20
    assert active_sub.sessions_used == 5
    assert resp.data['sessions_remaining'] == 15


@pytest.mark.django_db
def test_patch_forbidden_for_customer(api_client, customer, active_sub):
    api_client.force_authenticate(user=customer)
    url = reverse('subscription-detail', kwargs={'pk': active_sub.pk})
    resp = api_client.patch(url, {'status': 'canceled'}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_patch_forbidden_for_trainer(api_client, trainer, active_sub):
    api_client.force_authenticate(user=trainer)
    url = reverse('subscription-detail', kwargs={'pk': active_sub.pk})
    resp = api_client.patch(url, {'status': 'canceled'}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── admin-renew ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_renew_creates_new_active_subscription(api_client, admin_user, expired_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data['status'] == 'active'
    assert resp.data['sessions_used'] == 0
    assert resp.data['sessions_total'] == expired_sub.package.sessions_count


@pytest.mark.django_db
def test_admin_renew_creates_cash_payment(api_client, admin_user, expired_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_201_CREATED
    new_sub_id = resp.data['id']
    payment = Payment.objects.filter(subscription_id=new_sub_id).first()
    assert payment is not None
    assert payment.provider == Payment.Provider.CASH
    assert payment.status == Payment.Status.CONFIRMED
    assert 'renewed_from_subscription_id' in payment.metadata


@pytest.mark.django_db
def test_admin_renew_marks_old_subscription_expired(api_client, admin_user, active_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-renew', kwargs={'pk': active_sub.pk})
    api_client.post(url, {}, format='json')
    active_sub.refresh_from_db()
    assert active_sub.status == Subscription.Status.EXPIRED


@pytest.mark.django_db
def test_admin_renew_forbidden_for_customer(api_client, customer, expired_sub):
    api_client.force_authenticate(user=customer)
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_admin_renew_forbidden_for_trainer(api_client, trainer, expired_sub):
    api_client.force_authenticate(user=trainer)
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN


# ── New: ?category= filter and is_duo / guest_info exposure ────────────────

@pytest.mark.django_db
def test_admin_list_filter_by_category(api_client, admin_user, customer):
    duo_pkg = Package.objects.create(
        title='Duo', sessions_count=8, validity_days=60,
        price='240000', currency='COP', is_active=True, category='semi_personalizado',
    )
    individual_pkg = Package.objects.create(
        title='Solo', sessions_count=8, validity_days=30,
        price='320000', currency='COP', is_active=True, category='personalizado',
    )
    Subscription.objects.create(
        customer=customer, package=duo_pkg,
        sessions_total=8, sessions_used=0, status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=60),
    )
    Subscription.objects.create(
        customer=customer, package=individual_pkg,
        sessions_total=8, sessions_used=0, status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-list'), {'category': 'semi_personalizado'})
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data.get('results', resp.data)
    assert all(r['package']['category'] == 'semi_personalizado' for r in results)


@pytest.mark.django_db
def test_admin_serializer_includes_is_duo_and_guest_info(api_client, admin_user, customer):
    duo_pkg = Package.objects.create(
        title='Duo', sessions_count=8, validity_days=60,
        price='240000', currency='COP', is_active=True, category='semi_personalizado',
    )
    sub = Subscription.objects.create(
        customer=customer, package=duo_pkg,
        sessions_total=8, sessions_used=0, status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=60),
    )
    SubscriptionGuest.objects.create(
        subscription=sub, invited_email='guest@example.com',
        status=SubscriptionGuest.STATUS_PENDING, token='tok-x',
    )
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-detail', kwargs={'pk': sub.pk}))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['is_duo'] is True
    assert resp.data['guest_info']['status'] == 'pending'
    assert resp.data['guest_info']['invited_email'] == 'guest@example.com'
