"""Unit tests for renewal history recording and timeline assembly."""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from core_app.models import (
    Package,
    Payment,
    Subscription,
    SubscriptionRenewal,
    User,
)
from core_app.services.renewal_history_service import (
    build_renewal_timeline,
    record_renewal,
)

FIXED_NOW = timezone.make_aware(datetime(2026, 3, 1, 8, 0, 0))


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='renewal-cust@kore.com', password='p', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Renewal', category='personalizado', sessions_count=8,
        session_duration_minutes=60, price=Decimal('100000'), currency='COP',
        validity_days=30, is_active=True,
    )


@pytest.fixture
def subscription(customer, package):
    return Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )


# ── record_renewal ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_record_renewal_persists_row_with_actor_email(subscription, package):
    # Act
    record_renewal(
        subscription=subscription, kind=SubscriptionRenewal.Kind.MANUAL,
        period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
        sessions_granted=8, package=package, actor_email='admin@kore.com',
    )

    # Assert
    stored = SubscriptionRenewal.objects.get(subscription=subscription)
    assert stored.kind == SubscriptionRenewal.Kind.MANUAL
    assert stored.actor_email == 'admin@kore.com'


@pytest.mark.django_db
def test_record_renewal_defaults_none_note_to_empty_string(subscription, package):
    # Act
    stored = record_renewal(
        subscription=subscription, kind=SubscriptionRenewal.Kind.MANUAL,
        period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
        sessions_granted=8, package=package, note=None,
    )

    # Assert
    assert stored.note == ''


# ── build_renewal_timeline ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_timeline_includes_recorded_period(subscription, package):
    # Arrange
    record_renewal(
        subscription=subscription, kind=SubscriptionRenewal.Kind.MANUAL,
        period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
        sessions_granted=8, package=package, note='renewed',
    )

    # Act
    timeline = build_renewal_timeline(subscription.customer)

    # Assert
    assert len(timeline) == 1
    assert timeline[0]['source'] == 'record'
    assert timeline[0]['package_title'] == package.title
    assert timeline[0]['note'] == 'renewed'


@pytest.mark.django_db
def test_timeline_serializes_payment_details_for_record(subscription, package, customer):
    # Arrange
    payment = Payment.objects.create(
        subscription=subscription, customer=customer,
        status=Payment.Status.CONFIRMED, amount=Decimal('100000'),
        currency='COP', provider=Payment.Provider.CASH,
    )
    record_renewal(
        subscription=subscription, kind=SubscriptionRenewal.Kind.MANUAL,
        period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
        sessions_granted=8, package=package, payment=payment,
    )

    # Act
    timeline = build_renewal_timeline(customer)

    # Assert
    assert timeline[0]['payment'] == {
        'amount': '100000.00',
        'currency': 'COP',
        'provider': Payment.Provider.CASH,
        'status': Payment.Status.CONFIRMED,
    }


@pytest.mark.django_db
def test_timeline_marks_first_legacy_row_as_initial(customer, package):
    # Arrange — a legacy subscription with no renewal records.
    Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=FIXED_NOW - timedelta(days=60),
        expires_at=FIXED_NOW - timedelta(days=30),
    )

    # Act
    timeline = build_renewal_timeline(customer)

    # Assert
    assert timeline[0]['source'] == 'legacy'
    assert timeline[0]['kind'] == SubscriptionRenewal.Kind.INITIAL


@pytest.mark.django_db
def test_timeline_marks_second_legacy_row_as_manual(customer, package):
    # Arrange — two legacy subscriptions ordered by creation.
    older = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=FIXED_NOW - timedelta(days=90),
        expires_at=FIXED_NOW - timedelta(days=60),
    )
    Subscription.objects.filter(pk=older.pk).update(
        created_at=FIXED_NOW - timedelta(days=90),
    )
    newer = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=8,
        status=Subscription.Status.EXPIRED,
        starts_at=FIXED_NOW - timedelta(days=30),
        expires_at=FIXED_NOW,
    )
    Subscription.objects.filter(pk=newer.pk).update(
        created_at=FIXED_NOW - timedelta(days=30),
    )

    # Act — newest period sorts first, so the later legacy row leads.
    timeline = build_renewal_timeline(customer)

    # Assert — the second-created legacy row is a MANUAL renewal.
    assert timeline[0]['kind'] == SubscriptionRenewal.Kind.MANUAL


@pytest.mark.django_db
def test_timeline_orders_newest_period_first(customer, package):
    # Arrange — one old recorded period and one recent recorded period.
    sub = Subscription.objects.create(
        customer=customer, package=package, sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )
    record_renewal(
        subscription=sub, kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=FIXED_NOW - timedelta(days=60),
        period_end=FIXED_NOW - timedelta(days=30),
        sessions_granted=8, package=package,
    )
    record_renewal(
        subscription=sub, kind=SubscriptionRenewal.Kind.MANUAL,
        period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
        sessions_granted=8, package=package,
    )

    # Act
    timeline = build_renewal_timeline(customer)

    # Assert
    assert timeline[0]['period_start'] > timeline[1]['period_start']


@pytest.mark.django_db
def test_timeline_excludes_subscription_that_has_records(subscription, package):
    # Arrange — a subscription that already owns a renewal record must not
    # also appear as a synthetic legacy period.
    record_renewal(
        subscription=subscription, kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=FIXED_NOW, period_end=FIXED_NOW + timedelta(days=30),
        sessions_granted=8, package=package,
    )

    # Act
    timeline = build_renewal_timeline(subscription.customer)

    # Assert — only the record item, no legacy duplicate.
    assert len(timeline) == 1
    assert timeline[0]['source'] == 'record'
