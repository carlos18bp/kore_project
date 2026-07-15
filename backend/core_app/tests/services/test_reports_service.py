"""Golden-value tests for the admin Reports aggregation service (Parte 11a)."""

from datetime import datetime, timedelta, timezone as dt_timezone

import pytest
from django.utils import timezone

from core_app.models import (
    Booking,
    CreditPackage,
    CreditPurchase,
    CreditTransaction,
    Package,
    Payment,
    RedemptionRequest,
    SessionRating,
    StoreItem,
    Subscription,
)
from core_app.services import reports_service

NOW = datetime(2026, 7, 15, 14, 30, tzinfo=dt_timezone.utc)


def _credit_pkg():
    return CreditPackage.objects.create(name='P', credits=50, price_cop=20000).id


def _sub(user, status, nutrition=False):
    now = timezone.now()
    pkg = Package.objects.create(title='Plan', sessions_count=4)
    return Subscription.objects.create(
        customer=user, package=pkg, sessions_total=4, includes_nutrition=nutrition,
        status=status, starts_at=now, expires_at=now + timedelta(days=30),
    )


def _rating(user, score):
    now = timezone.now()
    pkg = Package.objects.create(title='Plan', sessions_count=4)
    booking = Booking.objects.create(
        customer=user, package=pkg, starts_at=now, ends_at=now + timedelta(hours=1),
    )
    return SessionRating.objects.create(
        booking=booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=score,
    )


# ── resolve_since ───────────────────────────────────────────────────────────

def test_resolve_since_today_is_start_of_day():
    assert reports_service.resolve_since('today', NOW) == datetime(
        2026, 7, 15, 0, 0, 0, 0, tzinfo=dt_timezone.utc
    )


def test_resolve_since_30d_and_90d_subtract_days():
    assert reports_service.resolve_since('30d', NOW) == NOW - timedelta(days=30)
    assert (NOW - reports_service.resolve_since('90d', NOW)).days == 90


def test_resolve_since_all_is_none():
    assert reports_service.resolve_since('all', NOW) is None


def test_resolve_since_unknown_raises():
    with pytest.raises(ValueError) as exc:
        reports_service.resolve_since('year', NOW)
    assert 'year' in str(exc.value)


# ── revenue ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_revenue_sums_confirmed_payments_and_approved_topups(existing_user):
    now = timezone.now()
    Payment.objects.create(
        customer=existing_user, status=Payment.Status.CONFIRMED,
        amount=100000, confirmed_at=now - timedelta(days=2),
    )
    Payment.objects.create(  # not confirmed → excluded
        customer=existing_user, status=Payment.Status.PENDING,
        amount=999999, confirmed_at=now - timedelta(days=2),
    )
    CreditPurchase.objects.create(
        customer=existing_user, credit_package_id=_credit_pkg(), credits=50,
        amount_cop=20000, reference='r1', status=CreditPurchase.Status.APPROVED,
        resolved_at=now - timedelta(days=1),
    )

    result = reports_service._revenue(now - timedelta(days=30), now)

    assert result['subscriptions_cop'] == 100000
    assert result['credits_cop'] == 20000
    assert result['total_cop'] == 120000


@pytest.mark.django_db
def test_revenue_window_excludes_older_rows(existing_user):
    now = timezone.now()
    Payment.objects.create(
        customer=existing_user, status=Payment.Status.CONFIRMED,
        amount=100000, confirmed_at=now - timedelta(days=45),
    )
    result = reports_service._revenue(now - timedelta(days=30), now)
    assert result['subscriptions_cop'] == 0


@pytest.mark.django_db
def test_revenue_trend_has_six_month_buckets(existing_user):
    result = reports_service._revenue(None, timezone.now())
    assert len(result['trend']) == 6
    assert all(set(b) == {'month', 'cop'} for b in result['trend'])


# ── subscriptions ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_subscriptions_counts_by_status_and_nutrition_pct(existing_user):
    _sub(existing_user, Subscription.Status.ACTIVE, nutrition=True)
    _sub(existing_user, Subscription.Status.ACTIVE, nutrition=False)
    _sub(existing_user, Subscription.Status.EXPIRED)
    _sub(existing_user, Subscription.Status.CANCELED)

    result = reports_service._subscriptions()

    assert (result['active'], result['expired'], result['canceled']) == (2, 1, 1)
    assert result['with_nutrition'] == 1
    assert result['with_nutrition_pct'] == 50.0


@pytest.mark.django_db
def test_subscriptions_nutrition_pct_zero_when_no_active():
    result = reports_service._subscriptions()
    assert result['with_nutrition_pct'] == 0.0


# ── credits ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_credits_earned_spent_and_redemptions(existing_user):
    now = timezone.now()
    CreditTransaction.objects.create(
        customer=existing_user, action=CreditTransaction.Action.WORKOUT_DAY,
        amount=30, status=CreditTransaction.Status.CONFIRMED, description='earn',
    )
    CreditTransaction.objects.create(
        customer=existing_user, action=CreditTransaction.Action.REDEMPTION,
        amount=-10, status=CreditTransaction.Status.CONFIRMED, description='spend',
    )
    CreditTransaction.objects.create(  # pending → excluded
        customer=existing_user, action=CreditTransaction.Action.WORKOUT_DAY,
        amount=999, status=CreditTransaction.Status.PENDING, description='pending',
    )
    item = StoreItem.objects.create(name='Camiseta', price_credits=10)
    RedemptionRequest.objects.create(
        customer=existing_user, item=item, credits_spent=10,
        status=RedemptionRequest.Status.PENDING,
    )

    result = reports_service._credits(now - timedelta(days=30))

    assert result['earned'] == 30
    assert result['spent'] == 10
    assert result['redemptions_by_status'] == {'pending': 1, 'fulfilled': 0, 'rejected': 0}


# ── quality ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_quality_average_and_distribution(existing_user):
    for s in (5, 5, 4, 4):  # mean 4.5 — unambiguous under round()
        _rating(existing_user, s)
    result = reports_service._quality(timezone.now() - timedelta(days=30))
    assert result['rated_count'] == 4
    assert result['average_score'] == 4.5
    assert result['distribution']['5'] == 2
    assert result['distribution']['1'] == 0


@pytest.mark.django_db
def test_quality_zero_when_no_ratings():
    result = reports_service._quality(None)
    assert result['average_score'] == 0.0
    assert result['rated_count'] == 0


# ── build_admin_report ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_build_admin_report_shape():
    report = reports_service.build_admin_report('all', timezone.now())
    assert report['window'] == 'all'
    assert set(report) == {'window', 'revenue', 'subscriptions', 'credits', 'quality'}


def test_build_admin_report_unknown_window_raises():
    with pytest.raises(ValueError) as exc:
        reports_service.build_admin_report('year', NOW)
    assert 'year' in str(exc.value)
