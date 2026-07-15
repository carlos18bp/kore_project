# Phase 11a — Admin Reports / KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the admin "Reportes" panel with a single-page dashboard of Fase 2 business KPIs (revenue, subscriptions, credit economy, rating quality), filterable by a preset time window.

**Architecture:** One backend aggregation endpoint `GET /api/admin/reports/?window=today|30d|90d|all` returns all four KPI groups plus a fixed 6-month revenue trend, computed in a new `reports_service.py` (no logic in the view). The frontend adds a `/admin-platform/reports` page backed by a Zustand `adminReportsStore`, reusing `StatTile` and a new hand-built `TrendBars` SVG component, and activates the two pre-wired "Reportes" nav entries.

**Tech Stack:** Django 6 + DRF (APIView, ORM aggregates), Next.js 16 App Router + React 19 + TypeScript, Zustand 5, Axios wrapper (`@/lib/services/http`), Playwright + Jest, pytest.

**Spec:** `docs/superpowers/specs/2026-07-15-phase11a-admin-reports-design.md`

## Global Constraints

- **No local test runs.** Do NOT run pytest / jest / playwright locally — CI runs the suites on push. Local gates only: `cd backend && source venv/bin/activate && python manage.py check` and `cd frontend && npx tsc --noEmit`. Still write tests first (TDD), commit them with the code, and let CI be the runner. Each task lists the pytest/jest command CI will run for reference.
- **Branch:** `feat/15072026-phase11a-admin-reports` (already created off synced `july-release`). Commit every task; never commit to `master`/`july-release` directly.
- **Backend enum names (verbatim):** `Payment.Status.CONFIRMED`, `CreditPurchase.Status.APPROVED`, `CreditTransaction.Status.CONFIRMED`, `RedemptionRequest.Status` = `PENDING`/`FULFILLED`/`REJECTED`, `Subscription.Status` = `ACTIVE`/`EXPIRED`/`CANCELED`.
- **Revenue timestamps:** payments by `Payment.confirmed_at`, top-ups by `CreditPurchase.resolved_at`.
- **Service layer:** aggregation logic lives in `reports_service.py`, never in the view.
- **No chart library:** `TrendBars` is hand-built (SVG/flex), per the KORE design system (`kore-red` accent, low-opacity track).
- **Money math:** `Payment.amount` is `Decimal`; cast sums to `int` COP. Guard divisions: `with_nutrition_pct` and `average_score` return `0.0` when their denominators are 0.
- **Flow triplet must change together** and both versions bump: `frontend/e2e/flow-definitions.json` (edit by hand), `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`. CI job `e2e-flow-definitions-sync` enforces this.
- **HTTP:** frontend calls go through `api` from `@/lib/services/http`; errors surfaced via `extractApiError(err, fallback)`.
- **No `max-w-*` on `(app)` containers** — but this page uses `AdminShell`, which owns its own layout; follow the admin dashboard page pattern.

---

## File Structure

**Backend (new):**
- `backend/core_app/services/reports_service.py` — all aggregation. Public: `WINDOWS`, `resolve_since(window, now)`, `build_admin_report(window, now)`. Private group helpers `_revenue`, `_subscriptions`, `_credits`, `_quality`, `_revenue_trend`, `_month_bounds`.
- `backend/core_app/views/admin_reports_views.py` — `AdminReportsView(APIView)`.
- `backend/core_app/tests/services/test_reports_service.py`
- `backend/core_app/tests/views/test_admin_reports_views.py`

**Backend (modify):**
- `backend/core_app/urls/api_urls.py` — import + one `path(...)`.

**Frontend (new):**
- `frontend/lib/stores/adminReportsStore.ts`
- `frontend/app/components/admin/TrendBars.tsx`
- `frontend/app/admin-platform/reports/page.tsx`
- `frontend/app/__tests__/stores/adminReportsStore.test.ts`
- `frontend/app/__tests__/components/admin/TrendBars.test.tsx`
- `frontend/app/__tests__/admin/reports-page.test.tsx`
- `frontend/e2e/admin/admin-reports.spec.ts`

**Frontend (modify):**
- `frontend/app/components/admin/AdminSidebar.tsx:63` — activate nav entry.
- `frontend/app/components/layouts/AdminMobileBottomNav.tsx:90` — activate nav entry.
- `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md` — flow triplet.

**Docs (modify):**
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`.

---

## Task 1: Window resolution helper

**Files:**
- Create: `backend/core_app/services/reports_service.py`
- Test: `backend/core_app/tests/services/test_reports_service.py`

**Interfaces:**
- Produces: `WINDOWS: tuple[str, ...] = ('today', '30d', '90d', 'all')`; `resolve_since(window: str, now: datetime) -> datetime | None` (raises `ValueError` for unknown window).

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_reports_service.py
from datetime import datetime, timezone as dt_timezone

import pytest

from core_app.services import reports_service


NOW = datetime(2026, 7, 15, 14, 30, tzinfo=dt_timezone.utc)


def test_resolve_since_today_is_start_of_day():
    assert reports_service.resolve_since('today', NOW) == datetime(
        2026, 7, 15, 0, 0, 0, 0, tzinfo=dt_timezone.utc
    )


def test_resolve_since_30d_and_90d_subtract_days():
    assert reports_service.resolve_since('30d', NOW) == NOW.replace(
        hour=14, minute=30
    ) - __import__('datetime').timedelta(days=30)
    assert (NOW - reports_service.resolve_since('90d', NOW)).days == 90


def test_resolve_since_all_is_none():
    assert reports_service.resolve_since('all', NOW) is None


def test_resolve_since_unknown_raises():
    with pytest.raises(ValueError):
        reports_service.resolve_since('year', NOW)
```

- [ ] **Step 2: Verify it fails** — CI runs `pytest core_app/tests/services/test_reports_service.py -v` (expect ImportError / AttributeError). Locally: `python manage.py check` should still pass once the file exists in Step 3.

- [ ] **Step 3: Write the implementation**

```python
# backend/core_app/services/reports_service.py
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
```

- [ ] **Step 4: Verify** — `python manage.py check` passes. CI: the four tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/reports_service.py backend/core_app/tests/services/test_reports_service.py
git commit -m "feat(reports): window resolution helper for admin KPIs"
```

---

## Task 2: Revenue group + 6-month trend

**Files:**
- Modify: `backend/core_app/services/reports_service.py`
- Test: `backend/core_app/tests/services/test_reports_service.py`

**Interfaces:**
- Consumes: `resolve_since`.
- Produces: `_revenue(since, now) -> dict` with keys `total_cop, subscriptions_cop, credits_cop, trend`; `trend` is a list of `{'month': 'YYYY-MM', 'cop': int}` (6 entries, oldest first).

- [ ] **Step 1: Write the failing test** (append)

```python
from datetime import timedelta

from django.utils import timezone

from core_app.models import CreditPurchase, Payment


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
    cp = CreditPurchase.objects.create(
        customer=existing_user, credit_package_id=_pkg(), credits=50,
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
    now = timezone.now()
    result = reports_service._revenue(None, now)
    assert len(result['trend']) == 6
    assert all(set(b) == {'month', 'cop'} for b in result['trend'])
```

Add the `_pkg()` helper near the top of the test module:

```python
def _pkg():
    from core_app.models import CreditPackage
    return CreditPackage.objects.create(name='P', credits=50, price_cop=20000).id
```

- [ ] **Step 2: Verify it fails** — CI: `AttributeError: _revenue`.

- [ ] **Step 3: Implement** (append to `reports_service.py`)

```python
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
```

- [ ] **Step 4: Verify** — `python manage.py check`. CI: revenue tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/reports_service.py backend/core_app/tests/services/test_reports_service.py
git commit -m "feat(reports): revenue group with fixed 6-month trend"
```

---

## Task 3: Subscriptions group

**Files:**
- Modify: `backend/core_app/services/reports_service.py`
- Test: `backend/core_app/tests/services/test_reports_service.py`

**Interfaces:**
- Produces: `_subscriptions() -> dict` with keys `active, expired, canceled, with_nutrition, with_nutrition_pct` (pct is `float`, 1 decimal, `0.0` when no active subs).

- [ ] **Step 1: Write the failing test** (append)

```python
from datetime import timedelta

from core_app.models import Package, Subscription


def _sub(user, status, nutrition=False):
    now = timezone.now()
    pkg = Package.objects.create(title='Plan', sessions_count=4)
    return Subscription.objects.create(
        customer=user, package=pkg, sessions_total=4, includes_nutrition=nutrition,
        status=status, starts_at=now, expires_at=now + timedelta(days=30),
    )


@pytest.mark.django_db
def test_subscriptions_counts_by_status_and_nutrition_pct(existing_user):
    _sub(existing_user, Subscription.Status.ACTIVE, nutrition=True)
    _sub(existing_user, Subscription.Status.ACTIVE, nutrition=False)
    _sub(existing_user, Subscription.Status.EXPIRED)
    _sub(existing_user, Subscription.Status.CANCELED)

    result = reports_service._subscriptions()

    assert result['active'] == 2
    assert result['expired'] == 1
    assert result['canceled'] == 1
    assert result['with_nutrition'] == 1
    assert result['with_nutrition_pct'] == 50.0


@pytest.mark.django_db
def test_subscriptions_nutrition_pct_zero_when_no_active():
    result = reports_service._subscriptions()
    assert result['with_nutrition_pct'] == 0.0
```

- [ ] **Step 2: Verify it fails** — CI: `AttributeError: _subscriptions`.

- [ ] **Step 3: Implement** (append)

```python
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
```

- [ ] **Step 4: Verify** — `python manage.py check`. CI: subscription tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/reports_service.py backend/core_app/tests/services/test_reports_service.py
git commit -m "feat(reports): subscription status + nutrition% group"
```

---

## Task 4: Credit economy group

**Files:**
- Modify: `backend/core_app/services/reports_service.py`
- Test: `backend/core_app/tests/services/test_reports_service.py`

**Interfaces:**
- Consumes: `resolve_since` bound (`since`).
- Produces: `_credits(since) -> dict` with keys `earned` (int ≥0), `spent` (int ≥0, absolute), `redemptions_by_status` (dict with every `RedemptionRequest.Status` value → count, default 0).

- [ ] **Step 1: Write the failing test** (append)

```python
from core_app.models import (
    CreditTransaction, RedemptionRequest, StoreItem,
)


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
    assert result['redemptions_by_status']['pending'] == 1
    assert result['redemptions_by_status']['fulfilled'] == 0
    assert result['redemptions_by_status']['rejected'] == 0
```

> Note: use whatever `CreditTransaction.Action` members exist — inspect the enum first (`grep -n "= '" backend/core_app/models/credit.py`) and substitute valid `Action.*` names for `WORKOUT_DAY` / `REDEMPTION` if they differ. The assertions do not depend on the action name.

- [ ] **Step 2: Verify it fails** — CI: `AttributeError: _credits`.

- [ ] **Step 3: Implement** (append)

```python
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
```

- [ ] **Step 4: Verify** — `python manage.py check`. CI: credit tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/reports_service.py backend/core_app/tests/services/test_reports_service.py
git commit -m "feat(reports): credit economy group (earned/spent/redemptions)"
```

---

## Task 5: Quality group + report composition

**Files:**
- Modify: `backend/core_app/services/reports_service.py`
- Test: `backend/core_app/tests/services/test_reports_service.py`

**Interfaces:**
- Consumes: `resolve_since`, `_revenue`, `_subscriptions`, `_credits`.
- Produces:
  - `_quality(since) -> dict`: `average_score` (float 1-dec, `0.0` if none), `rated_count` (int), `distribution` (keys `"1"`..`"5"` → count).
  - `build_admin_report(window, now) -> dict`: `{window, revenue, subscriptions, credits, quality}`; raises `ValueError` on unknown window.

- [ ] **Step 1: Write the failing test** (append)

```python
from core_app.models import Booking, SessionRating


def _rating(user, score):
    # Minimal booking to hang the rating on; adjust required Booking fields as needed.
    booking = Booking.objects.create(customer=user)
    return SessionRating.objects.create(
        booking=booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=score,
    )


@pytest.mark.django_db
def test_quality_average_and_distribution(existing_user):
    for s in (5, 5, 4, 3):
        _rating(existing_user, s)
    result = reports_service._quality(timezone.now() - timedelta(days=30))
    assert result['rated_count'] == 4
    assert result['average_score'] == 4.3  # (5+5+4+3)/4 = 4.25 → 4.3 (banker's? use round())
    assert result['distribution']['5'] == 2
    assert result['distribution']['1'] == 0


@pytest.mark.django_db
def test_quality_zero_when_no_ratings():
    result = reports_service._quality(None)
    assert result['average_score'] == 0.0
    assert result['rated_count'] == 0


@pytest.mark.django_db
def test_build_admin_report_shape():
    report = reports_service.build_admin_report('all', timezone.now())
    assert report['window'] == 'all'
    assert set(report) == {'window', 'revenue', 'subscriptions', 'credits', 'quality'}


def test_build_admin_report_unknown_window_raises():
    with pytest.raises(ValueError):
        reports_service.build_admin_report('year', NOW)
```

> Note: `round(4.25, 1)` in Python yields `4.2` (banker's rounding on the binary float), not `4.3`. Before finalizing, pick concrete scores whose mean rounds unambiguously (e.g. `5,5,4,4` → mean `4.5`) and set the expected value accordingly, OR assert with `pytest.approx`. Do NOT ship a brittle expected value. Also inspect `Booking`'s required fields (`grep -n "= models\." backend/core_app/models/booking.py`) and populate them in `_rating` so the row saves.

- [ ] **Step 2: Verify it fails** — CI: `AttributeError: _quality` / `build_admin_report`.

- [ ] **Step 3: Implement** (append)

```python
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
```

- [ ] **Step 4: Verify** — `python manage.py check`. CI: quality + composition tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/reports_service.py backend/core_app/tests/services/test_reports_service.py
git commit -m "feat(reports): rating quality group + build_admin_report composition"
```

---

## Task 6: Admin endpoint + route

**Files:**
- Create: `backend/core_app/views/admin_reports_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_admin_reports_views.py`

**Interfaces:**
- Consumes: `reports_service.WINDOWS`, `reports_service.build_admin_report`.
- Produces: route name `admin-reports` at `admin/reports/`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_admin_reports_views.py
import pytest
from django.urls import reverse
from rest_framework import status

URL_NAME = 'admin-reports'


@pytest.mark.django_db
def test_non_admin_cannot_read_reports(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)
    response = api_client.get(reverse(URL_NAME))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_admin_gets_report_with_all_groups(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse(URL_NAME))
    assert response.status_code == status.HTTP_200_OK
    assert set(response.data) == {'window', 'revenue', 'subscriptions', 'credits', 'quality'}
    assert response.data['window'] == '30d'  # default


@pytest.mark.django_db
def test_admin_can_select_window(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse(URL_NAME), {'window': '90d'})
    assert response.data['window'] == '90d'


@pytest.mark.django_db
def test_invalid_window_is_rejected(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse(URL_NAME), {'window': 'year'})
    assert response.status_code == status.HTTP_400_BAD_REQUEST
```

- [ ] **Step 2: Verify it fails** — CI: `NoReverseMatch` for `admin-reports`.

- [ ] **Step 3: Implement the view**

```python
# backend/core_app/views/admin_reports_views.py
"""Admin-only KPI report endpoint (Fase 2 — Parte 11a)."""

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.permissions import IsAdminRole
from core_app.services import reports_service


class AdminReportsView(APIView):
    """GET /api/admin/reports/?window=today|30d|90d|all — business KPIs."""

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        window = request.query_params.get('window', '30d')
        if window not in reports_service.WINDOWS:
            return Response({'detail': 'Invalid window.'}, status=400)
        report = reports_service.build_admin_report(window, timezone.now())
        return Response(report)
```

- [ ] **Step 4: Add the route** — in `backend/core_app/urls/api_urls.py`, add the import near the other admin view imports (top of file):

```python
from core_app.views.admin_reports_views import AdminReportsView
```

and the path immediately after the existing `admin/nutrition-product/` line:

```python
    path('admin/reports/', AdminReportsView.as_view(), name='admin-reports'),
```

- [ ] **Step 5: Verify** — `python manage.py check`. CI: `pytest core_app/tests/views/test_admin_reports_views.py -v` passes.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/admin_reports_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_admin_reports_views.py
git commit -m "feat(reports): admin reports endpoint + route"
```

---

## Task 7: Frontend store

**Files:**
- Create: `frontend/lib/stores/adminReportsStore.ts`
- Test: `frontend/app/__tests__/stores/adminReportsStore.test.ts`

**Interfaces:**
- Produces: `useAdminReportsStore` with state `{ window, data: AdminReport | null, loading, error }` and `fetchReport(window)`. Exported types `AdminReport`, `ReportWindow`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/adminReportsStore.test.ts
import { useAdminReportsStore } from '@/lib/stores/adminReportsStore';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn() },
  extractApiError: jest.fn(() => 'boom'),
}));

const mockedGet = api.get as jest.Mock;

const REPORT = {
  window: '30d',
  revenue: { total_cop: 120000, subscriptions_cop: 100000, credits_cop: 20000, trend: [] },
  subscriptions: { active: 2, expired: 1, canceled: 0, with_nutrition: 1, with_nutrition_pct: 50 },
  credits: { earned: 30, spent: 10, redemptions_by_status: { pending: 1, fulfilled: 0, rejected: 0 } },
  quality: { average_score: 4.5, rated_count: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 2 } },
};

beforeEach(() => {
  jest.clearAllMocks();
  useAdminReportsStore.setState({ window: '30d', data: null, loading: false, error: null });
});

it('fetchReport loads data and stores the window', async () => {
  mockedGet.mockResolvedValue({ data: REPORT });
  await useAdminReportsStore.getState().fetchReport('90d');
  expect(mockedGet).toHaveBeenCalledWith('/admin/reports/?window=90d');
  expect(useAdminReportsStore.getState().data?.revenue.total_cop).toBe(120000);
  expect(useAdminReportsStore.getState().window).toBe('90d');
});

it('fetchReport sets error via extractApiError on failure', async () => {
  mockedGet.mockRejectedValue(new Error('x'));
  await useAdminReportsStore.getState().fetchReport('30d');
  expect(useAdminReportsStore.getState().error).toBe('boom');
  expect(useAdminReportsStore.getState().loading).toBe(false);
});
```

- [ ] **Step 2: Verify it fails** — CI: module not found.

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/stores/adminReportsStore.ts
import { create } from 'zustand';
import { api, extractApiError } from '@/lib/services/http';

export type ReportWindow = 'today' | '30d' | '90d' | 'all';

export type AdminReport = {
  window: ReportWindow;
  revenue: {
    total_cop: number;
    subscriptions_cop: number;
    credits_cop: number;
    trend: { month: string; cop: number }[];
  };
  subscriptions: {
    active: number;
    expired: number;
    canceled: number;
    with_nutrition: number;
    with_nutrition_pct: number;
  };
  credits: {
    earned: number;
    spent: number;
    redemptions_by_status: Record<string, number>;
  };
  quality: {
    average_score: number;
    rated_count: number;
    distribution: Record<string, number>;
  };
};

type State = {
  window: ReportWindow;
  data: AdminReport | null;
  loading: boolean;
  error: string | null;
  fetchReport: (window: ReportWindow) => Promise<void>;
};

export const useAdminReportsStore = create<State>((set) => ({
  window: '30d',
  data: null,
  loading: false,
  error: null,
  fetchReport: async (window) => {
    set({ loading: true, error: null, window });
    try {
      const { data } = await api.get(`/admin/reports/?window=${window}`);
      set({ data: data as AdminReport, loading: false });
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudieron cargar los reportes.'), loading: false });
    }
  },
}));
```

- [ ] **Step 4: Verify** — `cd frontend && npx tsc --noEmit`. CI: `npm test -- adminReportsStore` passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/adminReportsStore.ts frontend/app/__tests__/stores/adminReportsStore.test.ts
git commit -m "feat(reports): adminReportsStore for the KPI panel"
```

---

## Task 8: TrendBars component

**Files:**
- Create: `frontend/app/components/admin/TrendBars.tsx`
- Test: `frontend/app/__tests__/components/admin/TrendBars.test.tsx`

**Interfaces:**
- Produces: `export default function TrendBars({ data }: { data: { month: string; cop: number }[] })`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/components/admin/TrendBars.test.tsx
import { render, screen } from '@testing-library/react';
import TrendBars from '@/app/components/admin/TrendBars';

const DATA = [
  { month: '2026-02', cop: 0 },
  { month: '2026-03', cop: 500000 },
  { month: '2026-04', cop: 250000 },
];

it('renders one labeled bar per datum', () => {
  render(<TrendBars data={DATA} />);
  expect(screen.getByTestId('trend-bars').querySelectorAll('[data-bar]')).toHaveLength(3);
});

it('does not throw when all values are zero', () => {
  render(<TrendBars data={[{ month: '2026-02', cop: 0 }]} />);
  expect(screen.getByTestId('trend-bars')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify it fails** — CI: module not found.

- [ ] **Step 3: Implement** (flex bars, no chart lib; design-system accent)

```tsx
// frontend/app/components/admin/TrendBars.tsx
type Datum = { month: string; cop: number };

/** Short 'feb'/'mar' label from a 'YYYY-MM' key. */
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortMonth(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTHS_ES[m - 1] ?? key;
}

export default function TrendBars({ data }: { data: Datum[] }) {
  const max = Math.max(0, ...data.map((d) => d.cop));
  return (
    <div data-testid="trend-bars" className="flex items-end gap-2 h-24">
      {data.map((d) => {
        const pct = max > 0 ? Math.round((d.cop / max) * 100) : 0;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex-1 flex items-end rounded-t-md bg-kore-red/10">
              <div
                data-bar
                className="w-full rounded-t-md bg-kore-red transition-all duration-700"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-kore-burgundy/50">{shortMonth(d.month)}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`. CI: `npm test -- TrendBars` passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/admin/TrendBars.tsx frontend/app/__tests__/components/admin/TrendBars.test.tsx
git commit -m "feat(reports): TrendBars mini-chart component"
```

---

## Task 9: Reports page + nav activation

**Files:**
- Create: `frontend/app/admin-platform/reports/page.tsx`
- Modify: `frontend/app/components/admin/AdminSidebar.tsx:63`, `frontend/app/components/layouts/AdminMobileBottomNav.tsx:90`
- Test: `frontend/app/__tests__/admin/reports-page.test.tsx`

**Interfaces:**
- Consumes: `useAdminReportsStore`, `AdminShell`, `StatTile`, `TrendBars`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/admin/reports-page.test.tsx
import { render, screen } from '@testing-library/react';
import ReportsPage from '@/app/admin-platform/reports/page';
import { useAdminReportsStore } from '@/lib/stores/adminReportsStore';

jest.mock('@/lib/stores/adminReportsStore', () => ({
  useAdminReportsStore: jest.fn(),
}));

const mocked = useAdminReportsStore as unknown as jest.Mock;

const REPORT = {
  window: '30d',
  revenue: { total_cop: 120000, subscriptions_cop: 100000, credits_cop: 20000, trend: [{ month: '2026-07', cop: 120000 }] },
  subscriptions: { active: 2, expired: 1, canceled: 0, with_nutrition: 1, with_nutrition_pct: 50 },
  credits: { earned: 30, spent: 10, redemptions_by_status: { pending: 1, fulfilled: 0, rejected: 0 } },
  quality: { average_score: 4.5, rated_count: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 2 } },
};

beforeEach(() => {
  mocked.mockReturnValue({
    window: '30d', data: REPORT, loading: false, error: null, fetchReport: jest.fn(),
  });
});

it('renders the four KPI block headings', () => {
  render(<ReportsPage />);
  expect(screen.getByText('Ingresos')).toBeInTheDocument();
  expect(screen.getByText('Suscripciones')).toBeInTheDocument();
  expect(screen.getByText('Créditos')).toBeInTheDocument();
  expect(screen.getByText('Calidad')).toBeInTheDocument();
});

it('renders the window selector pills', () => {
  render(<ReportsPage />);
  expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '90 días' })).toBeInTheDocument();
});
```

> If `AdminShell`/`AdminSidebar` pull in `next/navigation` or `next/link` in a way jsdom dislikes, add the same mocks the existing `frontend/app/__tests__/components/admin/AdminShell.test.tsx` uses (check that file first and mirror its mocks).

- [ ] **Step 2: Verify it fails** — CI: module not found.

- [ ] **Step 3: Implement the page** (`'use client'`)

```tsx
// frontend/app/admin-platform/reports/page.tsx
'use client';

import { useEffect } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Card from '@/app/components/admin/Card';
import StatTile from '@/app/components/admin/StatTile';
import TrendBars from '@/app/components/admin/TrendBars';
import { useAdminReportsStore, type ReportWindow } from '@/lib/stores/adminReportsStore';

const WINDOWS: { key: ReportWindow; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: 'all', label: 'Todo' },
];

const fmtCop = (n: number) => `${n.toLocaleString('es-CO')} COP`;

export default function ReportsPage() {
  const { window: active, data, loading, error, fetchReport } = useAdminReportsStore();

  useEffect(() => {
    fetchReport('30d');
  }, [fetchReport]);

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Reportes' },
      ]}
      title="Reportes"
    >
      <div className="flex gap-2 mb-6 flex-wrap">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => fetchReport(w.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active === w.key
                ? 'bg-kore-red text-white'
                : 'bg-white/60 border border-white/60 text-kore-burgundy/60 hover:bg-white/80'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-kore-red mb-4">{error}</p>}

      {/* Ingresos */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Ingresos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <StatTile kicker="Total" value={fmtCop(data?.revenue.total_cop ?? 0)} tone="dark" loading={loading && !data} />
          <StatTile kicker="Suscripciones" value={fmtCop(data?.revenue.subscriptions_cop ?? 0)} tone="sage" loading={loading && !data} />
          <StatTile kicker="Créditos (Wompi)" value={fmtCop(data?.revenue.credits_cop ?? 0)} tone="amber" loading={loading && !data} />
        </div>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
            Ingresos · últimos 6 meses
          </p>
          <TrendBars data={data?.revenue.trend ?? []} />
        </Card>
      </section>

      {/* Suscripciones */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Suscripciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile kicker="Activas" value={data?.subscriptions.active ?? 0} tone="sage" loading={loading && !data} />
          <StatTile kicker="Expiradas" value={data?.subscriptions.expired ?? 0} tone="amber" loading={loading && !data} />
          <StatTile kicker="Canceladas" value={data?.subscriptions.canceled ?? 0} tone="sakura" loading={loading && !data} />
          <StatTile kicker="% Nutrición" value={`${data?.subscriptions.with_nutrition_pct ?? 0}%`} tone="dark" loading={loading && !data} />
        </div>
      </section>

      {/* Créditos */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Créditos</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatTile kicker="Ganados" value={data?.credits.earned ?? 0} tone="sage" loading={loading && !data} />
          <StatTile kicker="Gastados" value={data?.credits.spent ?? 0} tone="sakura" loading={loading && !data} />
        </div>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">Canjes por estado</p>
          <div className="flex gap-4 text-sm text-kore-burgundy/80">
            <span>Pendiente: {data?.credits.redemptions_by_status.pending ?? 0}</span>
            <span>Entregado: {data?.credits.redemptions_by_status.fulfilled ?? 0}</span>
            <span>Rechazado: {data?.credits.redemptions_by_status.rejected ?? 0}</span>
          </div>
        </Card>
      </section>

      {/* Calidad */}
      <section>
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Calidad</h2>
        <div className="grid grid-cols-2 gap-4">
          <StatTile kicker="Promedio" value={data?.quality.average_score ?? 0} hint="de 5 estrellas" tone="dark" loading={loading && !data} />
          <StatTile kicker="Calificadas" value={data?.quality.rated_count ?? 0} hint="sesiones" tone="sage" loading={loading && !data} />
        </div>
      </section>
    </AdminShell>
  );
}
```

> Before writing, confirm `frontend/app/components/admin/Card.tsx` accepts a `className` prop (the dashboard uses `<Card className="p-5 ...">`, so it does). If `Card` is not the right import path, mirror the dashboard page's imports.

- [ ] **Step 4: Activate the sidebar nav** — in `frontend/app/components/admin/AdminSidebar.tsx`, replace the reports line (currently `href: '#', ... soon: true`):

```tsx
      { key: 'reports', label: 'Reportes', href: '/admin-platform/reports', icon: ChartIcon },
```

- [ ] **Step 5: Activate the mobile nav** — in `frontend/app/components/layouts/AdminMobileBottomNav.tsx`, replace the reports line (currently `disabled: true`):

```tsx
  { key: 'reports', label: 'Reportes', icon: ChartIcon, href: '/admin-platform/reports' },
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit`. CI: `npm test -- reports-page` passes.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/admin-platform/reports/page.tsx frontend/app/components/admin/AdminSidebar.tsx frontend/app/components/layouts/AdminMobileBottomNav.tsx frontend/app/__tests__/admin/reports-page.test.tsx
git commit -m "feat(reports): admin reports page + activate Reportes nav"
```

---

## Task 10: E2E spec + flow triplet

**Files:**
- Create: `frontend/e2e/admin/admin-reports.spec.ts`
- Modify: `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`

**Interfaces:**
- Consumes: `mockLoginAsAdmin` (`frontend/e2e/helpers/admin-auth.ts`), `FlowTags`/`RoleTags`.

- [ ] **Step 1: Add the flow tag** — in `frontend/e2e/helpers/flow-tags.ts`, add near the other `ADMIN_*` entries:

```typescript
  ADMIN_REPORTS: ['@flow:admin-reports', '@module:admin', '@priority:P2'],
```

- [ ] **Step 2: Add the flow definition** — in `frontend/e2e/flow-definitions.json`, bump the top-level `"version"` (e.g. `1.9.0` → `1.10.0`) and add an `admin-reports` flow object **by hand**, mirroring the shape of an existing `admin-*` flow (id, name, module `admin`, priority `P2`, route `/admin-platform/reports`, a short description). Do not run a formatter — hand-edit to keep the diff small.

- [ ] **Step 3: Document the flow** — in `docs/USER_FLOW_MAP.md`, bump its version to match and add a row/section for the admin reports flow consistent with the other admin flows.

- [ ] **Step 4: Write the E2E spec**

```typescript
// frontend/e2e/admin/admin-reports.spec.ts
import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-reports
 * Admin Reports: KPI tiles (revenue/subscriptions/credits/quality) with a
 * preset window selector that refetches on change.
 */

const REPORT = {
  window: '30d',
  revenue: { total_cop: 120000, subscriptions_cop: 100000, credits_cop: 20000, trend: [{ month: '2026-07', cop: 120000 }] },
  subscriptions: { active: 2, expired: 1, canceled: 0, with_nutrition: 1, with_nutrition_pct: 50 },
  credits: { earned: 30, spent: 10, redemptions_by_status: { pending: 1, fulfilled: 0, rejected: 0 } },
  quality: { average_score: 4.5, rated_count: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 2 } },
};

test.describe('Admin Reports', { tag: [...FlowTags.ADMIN_REPORTS, RoleTags.ADMIN] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
  });

  test('renders the KPI blocks and refetches on window change', async ({ page }) => {
    const windows: string[] = [];
    await page.route('**/api/admin/reports/**', async (route) => {
      const url = new URL(route.request().url());
      windows.push(url.searchParams.get('window') ?? '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...REPORT, window: url.searchParams.get('window') ?? '30d' }),
      });
    });

    await page.goto('/admin-platform/reports');

    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByText('Ingresos', { exact: true })).toBeVisible();
    await expect(page.getByText('Calidad', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '90 días' }).click();
    await expect.poll(() => windows).toContain('90d');
  });
});
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit`. CI: the E2E job and `e2e-flow-definitions-sync` pass (the latter only if all three triplet files changed and versions bumped).

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/admin/admin-reports.spec.ts frontend/e2e/flow-definitions.json frontend/e2e/helpers/flow-tags.ts docs/USER_FLOW_MAP.md
git commit -m "test(reports): E2E for admin reports + flow triplet"
```

---

## Task 11: Release docs

**Files:**
- Modify: `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`

- [ ] **Step 1: Add a validation section** — in `docs/release-july/GUIA_DE_VALIDACION.md`, append a Part 11a subsection consistent with the existing part numbering: admin logs in → opens **Reportes** from the sidebar → sees the four KPI blocks (Ingresos con tendencia de 6 meses, Suscripciones, Créditos, Calidad) → switches the window (Hoy/30d/90d/Todo) and the tiles refresh.

- [ ] **Step 2: Add a QA staging section** — in `docs/release-july/GUIA_QA_STAGING.md`, add the matching QA steps (same flow, staging URLs/credentials pattern as the other parts).

- [ ] **Step 3: Commit**

```bash
git add docs/release-july/GUIA_DE_VALIDACION.md docs/release-july/GUIA_QA_STAGING.md
git commit -m "docs(release): admin reports panel in validation + QA guides"
```

---

## Task 12: E2E user-flows audit + finish

- [ ] **Step 1:** Invoke the `e2e-user-flows-check` skill to audit coverage of the new admin-reports flow (per CLAUDE.md, this is the final step for any change touching a frontend user flow). Address any gap it reports.
- [ ] **Step 2:** Push the branch and open the PR **against `july-release`** (not `master`). Report the PR URL. The user merges (you cannot merge your own PR).

---

## Self-Review Notes

- **Spec coverage:** revenue (T2), subscriptions (T3), credits (T4), quality (T5), endpoint+window validation (T6), store (T7), TrendBars (T8), page+nav (T9), E2E+triplet (T10), release docs (T11), audit (T12). All spec sections mapped.
- **Type consistency:** `AdminReport` fields in the store (T7) match the backend payload keys (T2–T5) and the page/E2E fixtures (T9/T10) exactly: `revenue.{total_cop,subscriptions_cop,credits_cop,trend}`, `subscriptions.{active,expired,canceled,with_nutrition,with_nutrition_pct}`, `credits.{earned,spent,redemptions_by_status}`, `quality.{average_score,rated_count,distribution}`.
- **Known follow-ups flagged inline (must resolve during implementation, not ship blind):** (a) `round(4.25,1)` float rounding — pick unambiguous scores or `pytest.approx` (T5); (b) verify `CreditTransaction.Action` member names before using them (T4); (c) populate `Booking`'s required fields in the rating fixture (T5); (d) mirror existing jsdom mocks for `AdminShell` in the page test (T9).
