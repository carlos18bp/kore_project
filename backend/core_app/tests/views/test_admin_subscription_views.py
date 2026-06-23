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
def test_admin_renew_reactivates_in_place(api_client, admin_user, expired_sub):
    """Manual renewal extends the SAME subscription in place (no new row)."""
    api_client.force_authenticate(user=admin_user)
    before = Subscription.objects.count()
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['id'] == expired_sub.pk
    assert resp.data['status'] == 'active'
    assert resp.data['sessions_used'] == 0
    assert resp.data['sessions_total'] == expired_sub.package.sessions_count
    # No new subscription row is created — it is the same membership.
    assert Subscription.objects.count() == before


@pytest.mark.django_db
def test_admin_renew_creates_cash_payment(api_client, admin_user, expired_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    # The payment is recorded on the SAME subscription that was renewed.
    payment = Payment.objects.filter(subscription_id=expired_sub.pk).first()
    assert payment is not None
    assert payment.provider == Payment.Provider.CASH
    assert payment.status == Payment.Status.CONFIRMED
    assert 'renewed_by_admin' in payment.metadata


@pytest.mark.django_db
def test_admin_renew_records_manual_renewal_history(api_client, admin_user, expired_sub):
    """A manual renewal appends a SubscriptionRenewal history row."""
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-renew', kwargs={'pk': expired_sub.pk})
    api_client.post(url, {}, format='json')
    expired_sub.refresh_from_db()
    assert expired_sub.status == Subscription.Status.ACTIVE
    renewal = expired_sub.renewals.first()
    assert renewal is not None
    assert renewal.kind == 'manual'


@pytest.mark.django_db
def test_admin_renew_rejects_active_subscription(api_client, admin_user, active_sub):
    """Renewal is only allowed once a subscription is expired or canceled."""
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-renew', kwargs={'pk': active_sub.pk})
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    active_sub.refresh_from_db()
    assert active_sub.status == Subscription.Status.ACTIVE


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


# ── admin-delete ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_admin_delete_removes_subscription(api_client, admin_user, active_sub):
    api_client.force_authenticate(user=admin_user)
    url = reverse('subscription-admin-delete', kwargs={'pk': active_sub.pk})
    resp = api_client.delete(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert not Subscription.objects.filter(pk=active_sub.pk).exists()


@pytest.mark.django_db
def test_admin_delete_cascades_payments_and_guest_link(api_client, admin_user, active_sub):
    Payment.objects.create(
        subscription=active_sub, customer=active_sub.customer,
        status=Payment.Status.CONFIRMED, amount='300000', currency='COP',
        provider=Payment.Provider.CASH, confirmed_at=timezone.now(),
    )
    SubscriptionGuest.objects.create(
        subscription=active_sub, invited_email='guest@kore.com',
        token=SubscriptionGuest.generate_token(),
    )

    api_client.force_authenticate(user=admin_user)
    resp = api_client.delete(reverse('subscription-admin-delete', kwargs={'pk': active_sub.pk}))
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert not Subscription.objects.filter(pk=active_sub.pk).exists()
    assert not Payment.objects.filter(subscription_id=active_sub.pk).exists()
    assert not SubscriptionGuest.objects.filter(subscription_id=active_sub.pk).exists()


@pytest.mark.django_db
def test_admin_delete_forbidden_for_customer(api_client, customer, active_sub):
    api_client.force_authenticate(user=customer)
    resp = api_client.delete(reverse('subscription-admin-delete', kwargs={'pk': active_sub.pk}))
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert Subscription.objects.filter(pk=active_sub.pk).exists()


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


# ── Category counts ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_category_counts_returns_totals_per_category(api_client, admin_user):
    """Counts are per canonical membership (one row per customer), matching the list."""
    pkg_pareja = Package.objects.create(
        title='Pareja', category='semi_personalizado',
        sessions_count=8, validity_days=30, price='200000', currency='COP',
    )
    pkg_personal = Package.objects.create(
        title='Personalizada', category='personalizado',
        sessions_count=12, validity_days=30, price='400000', currency='COP',
    )
    now = FIXED_NOW
    # Two distinct customers on semi_personalizado, one on personalizado.
    for i in range(2):
        cust = User.objects.create_user(
            email=f'cat_semi_{i}@kore.com', password='p',
            first_name='Semi', last_name=str(i), role=User.Role.CUSTOMER,
        )
        Subscription.objects.create(
            customer=cust, package=pkg_pareja,
            sessions_total=8, sessions_used=0,
            status=Subscription.Status.ACTIVE,
            starts_at=now, expires_at=now + timedelta(days=30),
        )
    cust_personal = User.objects.create_user(
        email='cat_personal@kore.com', password='p',
        first_name='Solo', last_name='User', role=User.Role.CUSTOMER,
    )
    Subscription.objects.create(
        customer=cust_personal, package=pkg_personal,
        sessions_total=12, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )

    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('subscription-category-counts'))

    assert resp.status_code == status.HTTP_200_OK
    assert resp.data == {
        'semi_personalizado': 2,
        'personalizado': 1,
        'terapeutico': 0,
    }


@pytest.mark.django_db
def test_category_counts_forbidden_for_non_admin(api_client, customer):
    api_client.force_authenticate(user=customer)
    resp = api_client.get(reverse('subscription-category-counts'))
    assert resp.status_code == status.HTTP_403_FORBIDDEN
