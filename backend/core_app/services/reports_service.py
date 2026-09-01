"""Aggregation for the admin Reports panel (Fase 2 — Parte 11a).

All KPI math for GET /api/admin/reports/ lives here so the view stays thin.
"""

from datetime import timedelta

from django.db.models import Avg, Count, Q, Sum

from core_app.models import (
    CreditPurchase,
    CreditTransaction,
    Payment,
    RedemptionRequest,
    SessionRating,
    Subscription,
)

WINDOWS = ('today', '30d', '90d', 'all')


def resolve_since(window, now):
    """Map a preset window to its lower-bound datetime (None for 'all')."""
    if window == 'today':
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if window == '30d':
        return now - timedelta(days=30)
    if window == '90d':
        return now - timedelta(days=90)
    if window == 'all':
        return None
    raise ValueError(f'Unknown window: {window}')


def _month_bounds(now):
    """Return [(start, next_start, 'YYYY-MM'), ...] for the last 6 months, oldest first."""
    first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ym = []
    y, m = first.year, first.month
    for _ in range(6):
        ym.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    ym.reverse()
    bounds = []
    for yy, mm in ym:
        start = first.replace(year=yy, month=mm)
        ny, nm = (yy + 1, 1) if mm == 12 else (yy, mm + 1)
        bounds.append((start, first.replace(year=ny, month=nm), f'{yy:04d}-{mm:02d}'))
    return bounds


def _revenue_trend(now):
    out = []
    for start, end, label in _month_bounds(now):
        p = Payment.objects.filter(
            status=Payment.Status.CONFIRMED, confirmed_at__gte=start, confirmed_at__lt=end,
        ).aggregate(s=Sum('amount'))['s'] or 0
        t = CreditPurchase.objects.filter(
            status=CreditPurchase.Status.APPROVED, resolved_at__gte=start, resolved_at__lt=end,
        ).aggregate(s=Sum('amount_cop'))['s'] or 0
        out.append({'month': label, 'cop': int(p) + int(t)})
    return out


def _revenue(since, now):
    payments = Payment.objects.filter(status=Payment.Status.CONFIRMED)
    topups = CreditPurchase.objects.filter(status=CreditPurchase.Status.APPROVED)
    if since is not None:
        payments = payments.filter(confirmed_at__gte=since)
        topups = topups.filter(resolved_at__gte=since)
    subs_cop = int(payments.aggregate(s=Sum('amount'))['s'] or 0)
    credits_cop = int(topups.aggregate(s=Sum('amount_cop'))['s'] or 0)
    return {
        'total_cop': subs_cop + credits_cop,
        'subscriptions_cop': subs_cop,
        'credits_cop': credits_cop,
        'trend': _revenue_trend(now),
    }


def _subscriptions():
    c = Subscription.objects.aggregate(
        active=Count('id', filter=Q(status=Subscription.Status.ACTIVE)),
        expired=Count('id', filter=Q(status=Subscription.Status.EXPIRED)),
        canceled=Count('id', filter=Q(status=Subscription.Status.CANCELED)),
        with_nutrition=Count('id', filter=Q(
            status=Subscription.Status.ACTIVE, includes_nutrition=True,
        )),
    )
    active = c['active']
    pct = round(c['with_nutrition'] / active * 100, 1) if active else 0.0
    return {
        'active': active,
        'expired': c['expired'],
        'canceled': c['canceled'],
        'with_nutrition': c['with_nutrition'],
        'with_nutrition_pct': pct,
    }


def _credits(since):
    txns = CreditTransaction.objects.filter(status=CreditTransaction.Status.CONFIRMED)
    reds = RedemptionRequest.objects.all()
    if since is not None:
        txns = txns.filter(created_at__gte=since)
        reds = reds.filter(created_at__gte=since)
    earned = int(txns.filter(amount__gt=0).aggregate(s=Sum('amount'))['s'] or 0)
    spent = abs(int(txns.filter(amount__lt=0).aggregate(s=Sum('amount'))['s'] or 0))
    by_status = {s.value: 0 for s in RedemptionRequest.Status}
    for row in reds.values('status').annotate(n=Count('id')):
        by_status[row['status']] = row['n']
    return {'earned': earned, 'spent': spent, 'redemptions_by_status': by_status}


def _quality(since):
    ratings = SessionRating.objects.all()
    if since is not None:
        ratings = ratings.filter(created_at__gte=since)
    agg = ratings.aggregate(avg=Avg('score'), n=Count('id'))
    count = agg['n']
    average = round(agg['avg'], 1) if count else 0.0
    distribution = {str(i): 0 for i in range(1, 6)}
    for row in ratings.values('score').annotate(n=Count('id')):
        distribution[str(row['score'])] = row['n']
    return {'average_score': average, 'rated_count': count, 'distribution': distribution}


def build_admin_report(window, now):
    since = resolve_since(window, now)  # raises ValueError for unknown window
    return {
        'window': window,
        'revenue': _revenue(since, now),
        'subscriptions': _subscriptions(),
        'credits': _credits(since),
        'quality': _quality(since),
    }
