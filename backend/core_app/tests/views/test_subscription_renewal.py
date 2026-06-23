import pytest
from django.utils import timezone
from datetime import timedelta

from rest_framework.test import APIClient

from core_app.models import Package, Subscription, SubscriptionRenewal, User
from core_app.services.renewal_history_service import (
    record_renewal,
    build_renewal_timeline,
)


@pytest.fixture
def customer(db):
    return User.objects.create(email='c1@kore.com', role=User.Role.CUSTOMER)


@pytest.fixture
def admin_user(db):
    return User.objects.create(
        email='admin@kore.com', role=User.Role.ADMIN, is_staff=True, is_superuser=True,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Test', category='personalizado', sessions_count=8,
        session_duration_minutes=60, price='100000', currency='COP', validity_days=30,
    )


@pytest.fixture
def subscription(db, customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE, starts_at=now,
        expires_at=now + timedelta(days=30),
    )


def test_subscription_renewal_persists_period(subscription, package):
    now = timezone.now()
    rec = SubscriptionRenewal.objects.create(
        subscription=subscription,
        kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=now,
        period_end=now + timedelta(days=30),
        sessions_granted=8,
        package=package,
    )
    assert rec.pk is not None
    assert subscription.renewals.count() == 1
    assert subscription.renewals.first().kind == 'initial'


def test_record_renewal_creates_history_row(subscription, package):
    now = timezone.now()
    rec = record_renewal(
        subscription=subscription,
        kind=SubscriptionRenewal.Kind.MANUAL,
        period_start=now,
        period_end=now + timedelta(days=30),
        sessions_granted=8,
        package=package,
        actor_email='admin@kore.com',
    )
    assert rec.kind == 'manual'
    assert rec.actor_email == 'admin@kore.com'


def test_timeline_merges_records_and_legacy_rows(customer, package):
    now = timezone.now()
    # Legacy row: an extra past subscription with NO renewal records.
    legacy = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=now - timedelta(days=60), expires_at=now - timedelta(days=30),
    )
    # Current membership with a record.
    current = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )
    record_renewal(
        subscription=current, kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=now, period_end=now + timedelta(days=30),
        sessions_granted=8, package=package,
    )
    timeline = build_renewal_timeline(customer)
    assert len(timeline) == 2
    # Sorted desc by period_start → current first, legacy second.
    assert timeline[0]['source'] == 'record'
    assert timeline[1]['source'] == 'legacy'
    assert timeline[1]['period_start'] == legacy.starts_at


def test_admin_renew_extends_in_place(admin_user, customer, package):
    now = timezone.now()
    sub = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=now - timedelta(days=60), expires_at=now - timedelta(days=1),
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    resp = client.post(f'/api/subscriptions/{sub.id}/admin-renew/')
    assert resp.status_code == 200
    assert resp.data['id'] == sub.id  # SAME row, not a new one
    sub.refresh_from_db()
    assert sub.status == Subscription.Status.ACTIVE
    assert sub.sessions_used == 0
    assert sub.expires_at > now
    # No second subscription row was created.
    assert Subscription.objects.filter(customer=customer).count() == 1
    # A MANUAL renewal record exists.
    assert sub.renewals.filter(kind='manual').count() == 1


def test_admin_renew_rejects_active(admin_user, customer, package):
    now = timezone.now()
    sub = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=2,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    resp = client.post(f'/api/subscriptions/{sub.id}/admin-renew/')
    assert resp.status_code == 400


def test_renewal_history_endpoint(admin_user, customer, package):
    now = timezone.now()
    sub = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE, starts_at=now,
        expires_at=now + timedelta(days=30),
    )
    record_renewal(
        subscription=sub, kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=now, period_end=now + timedelta(days=30),
        sessions_granted=8, package=package,
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    resp = client.get(f'/api/subscriptions/{sub.id}/renewal-history/')
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]['kind'] == 'initial'
    assert resp.data[0]['package_title'] == 'Plan Test'


def test_admin_list_one_per_customer(admin_user, customer, package):
    now = timezone.now()
    # Two rows for the same customer (legacy data): expired + active.
    Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=now - timedelta(days=60), expires_at=now - timedelta(days=30),
    )
    active = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=1,
        status=Subscription.Status.ACTIVE, starts_at=now,
        expires_at=now + timedelta(days=30),
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    resp = client.get('/api/subscriptions/')
    results = resp.data['results'] if 'results' in resp.data else resp.data
    customer_ids = [r['customer_id'] for r in results]
    assert customer_ids.count(customer.id) == 1  # only one entry for this customer
    mine = [r for r in results if r['customer_id'] == customer.id][0]
    assert mine['id'] == active.id  # the active one is canonical


def test_customer_list_collapses_own_terms(customer, package):
    now = timezone.now()
    Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=now - timedelta(days=60), expires_at=now - timedelta(days=30),
    )
    active = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE, starts_at=now,
        expires_at=now + timedelta(days=30),
    )
    client = APIClient()
    client.force_authenticate(customer)
    resp = client.get('/api/subscriptions/')
    results = resp.data['results'] if 'results' in resp.data else resp.data
    own = [r for r in results if not r.get('is_guest')]
    assert len(own) == 1
    assert own[0]['id'] == active.id
