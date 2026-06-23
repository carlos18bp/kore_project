# Subscription Renewal History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each customer appear as ONE logical subscription (membership) in admin and customer UIs, with manual renewal extending the subscription in place (no new rows) and a full renewal-history timeline in the detail views.

**Architecture:** Surgical, low-risk. The existing `Subscription` row remains the persistent membership (recurring billing and `evolve` already mutate it in place). We (1) rewrite manual `admin_renew` to extend in place instead of creating a new row, (2) add an append-only `SubscriptionRenewal` history table that NOTHING reads except a new timeline endpoint, (3) group the admin list one-per-customer, (4) collapse the customer view to one membership + history. No FK repointing, no destructive migration, webhook/booking/payment logic untouched.

**Tech Stack:** Django 6.0 + DRF (backend, app `core_app`, module `core_project`), Next.js 16 + React 19 + TypeScript + Zustand (frontend), Huey (recurring task).

## Global Constraints

- Module is `core_project` / app `core_app` — never rename to `kore_*`.
- Do NOT change old migrations; add new ones (`python manage.py makemigrations core_app`). The new migration will auto-number `0055`.
- New model goes in its own file `core_app/models/subscription_renewal.py` and is registered in `core_app/models/__init__.py`.
- Match existing view style: `SubscriptionViewSet` uses DRF ViewSet + `@action`. Keep that.
- Business logic stays in services — the renewal-recording + timeline-building logic lives in a service module, not inlined in views/tasks.
- **Test execution policy (user preference):** DO NOT run jest/pytest locally. Write the tests (they run in CI on push). Local verification gates allowed: `cd backend && source venv/bin/activate && python manage.py check`, `cd backend && python manage.py makemigrations --check --dry-run`, and `cd frontend && npm run build`. Each "verify" step uses these, not the test runner.
- Frontend: no `max-w-*` on `(app)` page containers; user-facing strings in Spanish; HTTP only via `lib/services/http.ts` (`api`); stores in `lib/stores/` camelCase.
- Commit after each task. Branch: `feat/22062026-subscription-renewal-history` (already created).
- Commit footer line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**Create:**
- `backend/core_app/models/subscription_renewal.py` — the history model.
- `backend/core_app/services/renewal_history_service.py` — `record_renewal(...)` + `build_renewal_timeline(...)`.
- `backend/core_app/serializers/renewal_history_serializers.py` — output serializer for timeline items.
- `backend/core_app/tests/test_subscription_renewal.py` — backend tests.
- `frontend/app/components/shared/RenewalHistory.tsx` — shared timeline UI (admin + customer).

**Modify:**
- `backend/core_app/models/__init__.py` — register `SubscriptionRenewal`.
- `backend/core_app/views/subscription_views.py` — rewrite `admin_renew` (in place), add `renewal_history` action, group admin list + category_counts by customer, customer `get_queryset` one membership.
- `backend/core_app/tasks.py` — record AUTOMATIC renewal in `_bill_subscription`.
- `backend/core_app/views/wompi_views.py` — record INITIAL renewal on purchase.
- `backend/core_app/services/admin_subscription_service.py` — record PLAN_CHANGE in `evolve_subscription_for_admin`.
- `frontend/lib/stores/adminSubscriptionStore.ts` — add timeline type + `fetchRenewalHistory`.
- `frontend/lib/stores/subscriptionStore.ts` — add `fetchRenewalHistory` for customer.
- `frontend/app/admin-platform/subscriptions/detail/SubscriptionDetailPage.tsx` — history section + success-copy fix.
- `frontend/app/(app)/subscription/page.tsx` — history section under hero.

---

## Task 1: `SubscriptionRenewal` model + migration

**Files:**
- Create: `backend/core_app/models/subscription_renewal.py`
- Modify: `backend/core_app/models/__init__.py`
- Test: `backend/core_app/tests/test_subscription_renewal.py`

**Interfaces:**
- Produces: `SubscriptionRenewal` model with class `Kind` (`INITIAL`, `MANUAL`, `AUTOMATIC`, `PLAN_CHANGE`); fields `subscription` (FK → Subscription, `related_name='renewals'`, CASCADE), `kind`, `period_start` (DateTimeField), `period_end` (DateTimeField), `sessions_granted` (PositiveIntegerField), `payment` (FK → Payment, null, SET_NULL), `package` (FK → Package, PROTECT), `actor_email` (CharField blank), `note` (CharField blank), plus `created_at`/`updated_at` from `TimestampedModel`. `Meta.ordering = ('-period_start',)`.

- [ ] **Step 1: Write the failing test**

Create `backend/core_app/tests/test_subscription_renewal.py`:

```python
import pytest
from django.utils import timezone
from datetime import timedelta

from core_app.models import Package, Subscription, SubscriptionRenewal, User


@pytest.fixture
def customer(db):
    return User.objects.create(email='c1@kore.com', role=User.Role.CUSTOMER)


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
```

- [ ] **Step 2: Create the model**

Create `backend/core_app/models/subscription_renewal.py`:

```python
from django.db import models

from core_app.models.base import TimestampedModel


class SubscriptionRenewal(TimestampedModel):
    """Append-only history of a subscription's billing periods.

    One row per period the membership has gone through: the initial purchase,
    each manual or automatic renewal, and each plan change. Nothing in the
    app reads this table except the renewal-history timeline endpoint — it is
    purely a record so the UI can show "renewed from X to Y" without inferring
    it from scattered Subscription rows or Payment metadata.
    """

    class Kind(models.TextChoices):
        INITIAL = 'initial', 'Initial purchase'
        MANUAL = 'manual', 'Manual renewal'
        AUTOMATIC = 'automatic', 'Automatic renewal'
        PLAN_CHANGE = 'plan_change', 'Plan change'

    subscription = models.ForeignKey(
        'core_app.Subscription',
        on_delete=models.CASCADE,
        related_name='renewals',
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    sessions_granted = models.PositiveIntegerField()
    payment = models.ForeignKey(
        'core_app.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='renewal_records',
    )
    package = models.ForeignKey(
        'core_app.Package',
        on_delete=models.PROTECT,
        related_name='renewal_records',
    )
    actor_email = models.CharField(max_length=255, blank=True, default='')
    note = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ('-period_start',)

    def __str__(self):
        return f'Renewal #{self.pk} — sub {self.subscription_id} ({self.kind})'
```

- [ ] **Step 3: Register the model**

In `backend/core_app/models/__init__.py`, after line 5 (`from .subscription import Subscription`) add:

```python
from .subscription_renewal import SubscriptionRenewal
```

And in the `__all__` tuple, after the `'Subscription',` entry add:

```python
    'SubscriptionRenewal',
```

- [ ] **Step 4: Make the migration**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations core_app`
Expected: creates `core_app/migrations/0055_subscriptionrenewal.py` (only adds the new table).

- [ ] **Step 5: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations --check --dry-run && python manage.py check`
Expected: "No changes detected" + "System check identified no issues".

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/models/subscription_renewal.py backend/core_app/models/__init__.py backend/core_app/migrations/0055_subscriptionrenewal.py backend/core_app/tests/test_subscription_renewal.py
git commit -m "feat(subscription): add append-only SubscriptionRenewal history model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Renewal-history service (record + timeline builder)

**Files:**
- Create: `backend/core_app/services/renewal_history_service.py`
- Test: append to `backend/core_app/tests/test_subscription_renewal.py`

**Interfaces:**
- Consumes: `SubscriptionRenewal` (Task 1).
- Produces:
  - `record_renewal(*, subscription, kind, period_start, period_end, sessions_granted, package, payment=None, actor_email='', note='') -> SubscriptionRenewal`
  - `build_renewal_timeline(customer) -> list[dict]` — merged, period_start-desc list of items, each: `{kind, period_start, period_end, sessions_granted, package_title, source, actor_email, note, payment}` where `payment` is `None` or `{amount, currency, provider, status}` and `source` ∈ `{'record', 'legacy'}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/core_app/tests/test_subscription_renewal.py`:

```python
from core_app.services.renewal_history_service import (
    record_renewal,
    build_renewal_timeline,
)


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
```

- [ ] **Step 2: Implement the service**

Create `backend/core_app/services/renewal_history_service.py`:

```python
"""Recording and assembly of subscription renewal history.

`record_renewal` appends one row to the append-only SubscriptionRenewal table.
`build_renewal_timeline` assembles a customer's full period timeline by merging:
  (A) SubscriptionRenewal rows of any subscription owned by the customer, and
  (B) the customer's Subscription rows that have NO renewal records (legacy
      data created before this feature) as synthetic period items.
The two sources never overlap: (B) excludes rows that already have records.
"""

from __future__ import annotations

from core_app.models import Subscription, SubscriptionRenewal


def record_renewal(
    *,
    subscription,
    kind: str,
    period_start,
    period_end,
    sessions_granted: int,
    package,
    payment=None,
    actor_email: str = '',
    note: str = '',
) -> SubscriptionRenewal:
    """Append a single period record to the subscription's history."""
    return SubscriptionRenewal.objects.create(
        subscription=subscription,
        kind=kind,
        period_start=period_start,
        period_end=period_end,
        sessions_granted=sessions_granted,
        package=package,
        payment=payment,
        actor_email=actor_email or '',
        note=note or '',
    )


def _payment_dict(payment):
    if payment is None:
        return None
    return {
        'amount': str(payment.amount),
        'currency': payment.currency,
        'provider': payment.provider,
        'status': payment.status,
    }


def build_renewal_timeline(customer) -> list[dict]:
    """Return the customer's full period timeline, newest period first."""
    items: list[dict] = []

    # (A) New-style records across all of the customer's subscriptions.
    records = (
        SubscriptionRenewal.objects
        .filter(subscription__customer=customer)
        .select_related('package', 'payment')
    )
    for r in records:
        items.append({
            'kind': r.kind,
            'period_start': r.period_start,
            'period_end': r.period_end,
            'sessions_granted': r.sessions_granted,
            'package_title': r.package.title,
            'actor_email': r.actor_email,
            'note': r.note,
            'payment': _payment_dict(r.payment),
            'source': 'record',
        })

    # (B) Legacy subscription rows with no records → synthetic periods.
    legacy_rows = list(
        Subscription.objects
        .filter(customer=customer, renewals__isnull=True)
        .select_related('package')
        .order_by('created_at')
    )
    for index, sub in enumerate(legacy_rows):
        items.append({
            'kind': (
                SubscriptionRenewal.Kind.INITIAL
                if index == 0
                else SubscriptionRenewal.Kind.MANUAL
            ),
            'period_start': sub.starts_at,
            'period_end': sub.expires_at,
            'sessions_granted': sub.sessions_total,
            'package_title': sub.package.title,
            'actor_email': '',
            'note': '',
            'payment': None,
            'source': 'legacy',
        })

    items.sort(key=lambda it: it['period_start'], reverse=True)
    return items
```

- [ ] **Step 3: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 4: Commit**

```bash
git add backend/core_app/services/renewal_history_service.py backend/core_app/tests/test_subscription_renewal.py
git commit -m "feat(subscription): add renewal-history record + timeline service

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Rewrite `admin_renew` to extend in place

**Files:**
- Modify: `backend/core_app/views/subscription_views.py:1271-1317`
- Test: append to `backend/core_app/tests/test_subscription_renewal.py`

**Interfaces:**
- Consumes: `record_renewal` (Task 2), `MAX_ROLLOVER_SESSIONS` from `core_app.services.slot_schedule`.
- Produces: `POST /api/subscriptions/{id}/admin-renew/` now mutates the SAME subscription (status→active, expiry pushed, sessions rolled over), creates a CASH `Payment` on the same sub, writes a `SubscriptionRenewal(kind=MANUAL)`, and returns the same subscription with HTTP 200. Still rejects when the sub is not `expired`/`canceled` (400).

- [ ] **Step 1: Write the failing test**

Append to `backend/core_app/tests/test_subscription_renewal.py`:

```python
from rest_framework.test import APIClient


@pytest.fixture
def admin_user(db):
    return User.objects.create(
        email='admin@kore.com', role=User.Role.ADMIN, is_staff=True, is_superuser=True,
    )


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
```

- [ ] **Step 2: Add imports**

In `backend/core_app/views/subscription_views.py`, ensure these imports exist near the other service imports at the top of the file (add any that are missing):

```python
from core_app.services.slot_schedule import MAX_ROLLOVER_SESSIONS
from core_app.services.renewal_history_service import record_renewal
```

- [ ] **Step 3: Replace the `admin_renew` body**

Replace the whole method at `subscription_views.py:1271-1317` with:

```python
    @action(detail=True, methods=['post'], url_path='admin-renew')
    def admin_renew(self, request, pk=None):
        """Manually renew a subscription in place as a cash payment. Admin-only.

        Extends the SAME subscription (no new row is created): reactivates it,
        pushes ``expires_at`` by the package validity, rolls over remaining
        sessions, records a CASH ``Payment`` and a ``SubscriptionRenewal``
        history row. Only allowed when the subscription is expired or canceled.
        Returns 403 for non-admin callers, 400 if the sub is still active.
        """
        if not is_admin_user(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        sub = self.get_object()
        if sub.status not in (
            Subscription.Status.EXPIRED,
            Subscription.Status.CANCELED,
        ):
            return Response(
                {'detail': 'Sólo se puede renovar una suscripción expirada o cancelada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        package = sub.package
        now = timezone.now()
        period_end = now + timedelta(days=package.validity_days)
        leftover = max(sub.sessions_total - sub.sessions_used, 0)
        rollover = min(leftover, MAX_ROLLOVER_SESSIONS)

        with transaction.atomic():
            payment = Payment.objects.create(
                subscription=sub,
                customer=sub.customer,
                status=Payment.Status.CONFIRMED,
                amount=package.price,
                currency=package.currency,
                provider=Payment.Provider.CASH,
                confirmed_at=now,
                metadata={'renewed_by_admin': request.user.email},
            )

            sub.status = Subscription.Status.ACTIVE
            sub.starts_at = now
            sub.expires_at = period_end
            sub.sessions_total = package.sessions_count + rollover
            sub.sessions_used = 0
            sub.billing_failed_at = None
            sub.save(update_fields=[
                'status', 'starts_at', 'expires_at',
                'sessions_total', 'sessions_used', 'billing_failed_at', 'updated_at',
            ])

            record_renewal(
                subscription=sub,
                kind=SubscriptionRenewal.Kind.MANUAL,
                period_start=now,
                period_end=period_end,
                sessions_granted=sub.sessions_total,
                package=package,
                payment=payment,
                actor_email=request.user.email,
            )

        return Response(
            self.get_serializer(sub, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )
```

- [ ] **Step 4: Ensure `SubscriptionRenewal` is imported**

In `subscription_views.py`, the models import block imports from `core_app.models`. Add `SubscriptionRenewal` to it (find the existing `from core_app.models import (...)` group and add the name), e.g.:

```python
from core_app.models import (
    # ...existing names...
    Subscription,
    SubscriptionRenewal,
)
```

(If models are imported individually, add `from core_app.models import SubscriptionRenewal`.)

- [ ] **Step 5: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/subscription_views.py backend/core_app/tests/test_subscription_renewal.py
git commit -m "feat(subscription): manual renewal extends in place + records history

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Record AUTOMATIC renewal in recurring billing

**Files:**
- Modify: `backend/core_app/tasks.py:108-154` (inside `_bill_subscription`, the `if txn_status == 'APPROVED':` block)

**Interfaces:**
- Consumes: `record_renewal` (Task 2).
- Produces: every approved recurring charge writes a `SubscriptionRenewal(kind=AUTOMATIC)`.

- [ ] **Step 1: Add imports**

In `backend/core_app/tasks.py`, after line 25 (`from core_app.services.slot_schedule import MAX_ROLLOVER_SESSIONS`) add:

```python
from core_app.models import SubscriptionRenewal
from core_app.services.renewal_history_service import record_renewal
```

- [ ] **Step 2: Capture the new period boundary**

In `_bill_subscription`, the approved block (lines 123-139) computes the new expiry. Modify it so the new expiry is stored in a variable and a record is written. Replace lines 123-139 (`if txn_status == 'APPROVED':` through the `sub.save(...)` call) with:

```python
        if txn_status == 'APPROVED':
            leftover = max(sub.sessions_total - sub.sessions_used, 0)
            rollover = min(leftover, MAX_ROLLOVER_SESSIONS)
            new_period_start = timezone.now()
            new_period_end = new_period_start + timedelta(days=package.validity_days)
            sub.next_billing_date = sub.next_billing_date + timedelta(
                days=package.validity_days
            )
            sub.sessions_total = package.sessions_count + rollover
            sub.sessions_used = 0
            sub.expires_at = new_period_end
            sub.save(
                update_fields=[
                    'next_billing_date',
                    'sessions_used',
                    'sessions_total',
                    'expires_at',
                ]
            )

            record_renewal(
                subscription=sub,
                kind=SubscriptionRenewal.Kind.AUTOMATIC,
                period_start=new_period_start,
                period_end=new_period_end,
                sessions_granted=sub.sessions_total,
                package=package,
                payment=payment,
            )
```

(The `Notification.objects.create(...)` and `send_payment_receipt(payment)` lines that follow stay unchanged.)

- [ ] **Step 3: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 4: Commit**

```bash
git add backend/core_app/tasks.py
git commit -m "feat(subscription): record automatic renewal in recurring billing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Record INITIAL renewal on purchase + PLAN_CHANGE on evolve

**Files:**
- Modify: `backend/core_app/views/wompi_views.py:331-359`
- Modify: `backend/core_app/services/admin_subscription_service.py:98-153` and `:67-95`

**Interfaces:**
- Consumes: `record_renewal` (Task 2).
- Produces: webhook purchase writes `INITIAL`; admin `create_subscription_for_admin` writes `INITIAL`; `evolve_subscription_for_admin` writes `PLAN_CHANGE`.

- [ ] **Step 1: wompi_views — record INITIAL**

In `backend/core_app/views/wompi_views.py`, add near the top imports:

```python
from core_app.models import SubscriptionRenewal
from core_app.services.renewal_history_service import record_renewal
```

After the `payment = Payment.objects.create(...)` block that ends at line 359 (still inside the `with db_transaction.atomic():`), add:

```python
                record_renewal(
                    subscription=subscription,
                    kind=SubscriptionRenewal.Kind.INITIAL,
                    period_start=now,
                    period_end=subscription.expires_at,
                    sessions_granted=subscription.sessions_total,
                    package=package,
                    payment=payment,
                )
```

- [ ] **Step 2: admin_subscription_service — record INITIAL + PLAN_CHANGE**

In `backend/core_app/services/admin_subscription_service.py`, add the import near the top:

```python
from core_app.models import SubscriptionRenewal
from core_app.services.renewal_history_service import record_renewal
```

In `create_subscription_for_admin`, after the `Payment.objects.create(...)` call (ends line 93), before `return subscription`, add:

```python
    record_renewal(
        subscription=subscription,
        kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=starts_at,
        period_end=expires_at,
        sessions_granted=subscription.sessions_total,
        package=package,
        payment=payment,
        actor_email=getattr(actor, 'email', '') or '',
        note=notes,
    )
```

Note: capture the created payment — change `Payment.objects.create(` on line 79 to `payment = Payment.objects.create(`.

In `evolve_subscription_for_admin`, change `Payment.objects.create(` on line 132 to `payment = Payment.objects.create(`, then before `return current_subscription` add:

```python
    record_renewal(
        subscription=current_subscription,
        kind=SubscriptionRenewal.Kind.PLAN_CHANGE,
        period_start=current_subscription.starts_at,
        period_end=current_subscription.expires_at,
        sessions_granted=current_subscription.sessions_total,
        package=new_package,
        payment=payment,
        actor_email=getattr(actor, 'email', '') or '',
        note=notes,
    )
```

- [ ] **Step 3: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 4: Commit**

```bash
git add backend/core_app/views/wompi_views.py backend/core_app/services/admin_subscription_service.py
git commit -m "feat(subscription): record initial purchase and plan-change in history

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Renewal-history endpoint + serializer

**Files:**
- Create: `backend/core_app/serializers/renewal_history_serializers.py`
- Modify: `backend/core_app/views/subscription_views.py` (add `renewal_history` action)
- Test: append to `backend/core_app/tests/test_subscription_renewal.py`

**Interfaces:**
- Consumes: `build_renewal_timeline` (Task 2).
- Produces: `GET /api/subscriptions/{id}/renewal-history/` → JSON list of timeline items (newest first). Permission via `get_object()` (admins: any; customers: own + accepted guest).

- [ ] **Step 1: Write the failing test**

Append to `backend/core_app/tests/test_subscription_renewal.py`:

```python
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
```

- [ ] **Step 2: Create the serializer**

Create `backend/core_app/serializers/renewal_history_serializers.py`:

```python
from rest_framework import serializers


class RenewalHistoryPaymentSerializer(serializers.Serializer):
    amount = serializers.CharField()
    currency = serializers.CharField()
    provider = serializers.CharField()
    status = serializers.CharField()


class RenewalHistoryItemSerializer(serializers.Serializer):
    """Read-only serializer for one timeline item built by the service layer."""

    kind = serializers.CharField()
    period_start = serializers.DateTimeField()
    period_end = serializers.DateTimeField()
    sessions_granted = serializers.IntegerField()
    package_title = serializers.CharField()
    actor_email = serializers.CharField(allow_blank=True)
    note = serializers.CharField(allow_blank=True)
    source = serializers.CharField()
    payment = RenewalHistoryPaymentSerializer(allow_null=True)
```

- [ ] **Step 3: Add the action to the ViewSet**

In `backend/core_app/views/subscription_views.py`, add the import near the serializer imports:

```python
from core_app.serializers.renewal_history_serializers import RenewalHistoryItemSerializer
from core_app.services.renewal_history_service import build_renewal_timeline
```

Add this action inside `SubscriptionViewSet` (place it right after the `payments` action near line 1534):

```python
    @action(detail=True, methods=['get'], url_path='renewal-history')
    def renewal_history(self, request, pk=None):
        """Return the full renewal timeline for the subscription's customer.

        Combines append-only SubscriptionRenewal records with legacy
        subscription rows (those with no records) into one period timeline,
        newest first. Access is gated by ``get_object`` (admins see any;
        customers see their own / accepted guest subscriptions).
        """
        subscription = self.get_object()
        timeline = build_renewal_timeline(subscription.customer)
        serializer = RenewalHistoryItemSerializer(timeline, many=True)
        return Response(serializer.data)
```

- [ ] **Step 4: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/serializers/renewal_history_serializers.py backend/core_app/views/subscription_views.py backend/core_app/tests/test_subscription_renewal.py
git commit -m "feat(subscription): add renewal-history timeline endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Admin list — one entry per customer

**Files:**
- Modify: `backend/core_app/views/subscription_views.py:413-463` (`get_queryset` admin branch + `category_counts`)
- Test: append to `backend/core_app/tests/test_subscription_renewal.py`

**Interfaces:**
- Produces: admin `GET /subscriptions/` returns ONE canonical subscription per customer (the active one if any, else the most recently created). `category-counts` counts distinct customers per category.

- [ ] **Step 1: Write the failing test**

Append to `backend/core_app/tests/test_subscription_renewal.py`:

```python
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
```

- [ ] **Step 2: Implement canonical-per-customer in `get_queryset`**

In `subscription_views.py`, in the admin branch of `get_queryset` (lines 421-437), after applying the search/status/category filters and before `return qs.distinct()`, replace `return qs.distinct()` with a reduction to one canonical id per customer:

```python
            qs = qs.distinct()
            # Collapse to ONE canonical subscription per customer: the active
            # one if present, otherwise the most recently created. Past terms
            # remain in the DB and surface via the renewal-history timeline.
            canonical_ids: dict[int, int] = {}
            best_rank: dict[int, tuple] = {}
            for sub in qs.order_by('-created_at'):
                rank = (
                    1 if sub.status == Subscription.Status.ACTIVE else 0,
                    sub.created_at.timestamp(),
                )
                if sub.customer_id not in best_rank or rank > best_rank[sub.customer_id]:
                    best_rank[sub.customer_id] = rank
                    canonical_ids[sub.customer_id] = sub.id
            return (
                Subscription.objects
                .select_related('customer', 'package')
                .filter(id__in=list(canonical_ids.values()))
                .order_by('-created_at')
            )
```

- [ ] **Step 3: `category_counts` by distinct customer**

Replace the aggregation in `category_counts` (lines 453-462) with a distinct-customer count:

```python
        counts = {'semi_personalizado': 0, 'personalizado': 0, 'terapeutico': 0}
        rows = (
            Subscription.objects
            .values('package__category')
            .annotate(total=Count('customer_id', distinct=True))
        )
        for row in rows:
            category = row['package__category']
            if category in counts:
                counts[category] = row['total']
        return Response(counts)
```

- [ ] **Step 4: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/subscription_views.py backend/core_app/tests/test_subscription_renewal.py
git commit -m "feat(subscription): admin list shows one canonical subscription per customer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Customer list — one membership + guest subs

**Files:**
- Modify: `backend/core_app/views/subscription_views.py:438-441` (customer branch of `get_queryset`)
- Test: append to `backend/core_app/tests/test_subscription_renewal.py`

**Interfaces:**
- Produces: customer `GET /subscriptions/` returns the customer's ONE canonical own membership plus any accepted guest subscription. Past own terms no longer appear as separate subscriptions.

- [ ] **Step 1: Write the failing test**

Append to `backend/core_app/tests/test_subscription_renewal.py`:

```python
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
```

- [ ] **Step 2: Implement canonical own membership in the customer branch**

In `subscription_views.py`, replace the customer branch return (lines 438-441):

```python
        return qs.filter(
            Q(customer=self.request.user) |
            Q(guest_link__guest=self.request.user, guest_link__status=SubscriptionGuest.STATUS_ACCEPTED)
        ).distinct()
```

with:

```python
        # Guest subscriptions the user was accepted into (genuinely separate).
        guest_qs = qs.filter(
            guest_link__guest=self.request.user,
            guest_link__status=SubscriptionGuest.STATUS_ACCEPTED,
        ).distinct()
        # The user's OWN membership collapses to one canonical row: active if
        # present, else most recent. Past own terms surface via renewal-history.
        own_qs = qs.filter(customer=self.request.user).order_by('-created_at')
        own_canonical = (
            own_qs.filter(status=Subscription.Status.ACTIVE).first()
            or own_qs.first()
        )
        keep_ids = list(guest_qs.values_list('id', flat=True))
        if own_canonical:
            keep_ids.append(own_canonical.id)
        return (
            Subscription.objects
            .select_related('customer', 'package')
            .filter(id__in=keep_ids)
            .order_by('-created_at')
            .distinct()
        )
```

- [ ] **Step 3: Verify (local gate)**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: "System check identified no issues".

- [ ] **Step 4: Commit**

```bash
git add backend/core_app/views/subscription_views.py backend/core_app/tests/test_subscription_renewal.py
git commit -m "feat(subscription): customer list collapses own terms to one membership

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Frontend admin store — renewal-history fetch + types

**Files:**
- Modify: `frontend/lib/stores/adminSubscriptionStore.ts`

**Interfaces:**
- Produces: type `RenewalHistoryItem`; store method `fetchRenewalHistory(id: number) => Promise<RenewalHistoryItem[]>`.

- [ ] **Step 1: Add the type**

In `adminSubscriptionStore.ts`, after the `AdminSubscription` type (after line 41), add:

```typescript
export type RenewalHistoryItem = {
  kind: 'initial' | 'manual' | 'automatic' | 'plan_change';
  period_start: string;
  period_end: string;
  sessions_granted: number;
  package_title: string;
  actor_email: string;
  note: string;
  source: 'record' | 'legacy';
  payment: { amount: string; currency: string; provider: string; status: string } | null;
};
```

- [ ] **Step 2: Declare the method in the state type**

In the `AdminSubscriptionState` type (after line 97 `renewSubscription: ...`), add:

```typescript
  fetchRenewalHistory: (id: number) => Promise<RenewalHistoryItem[]>;
```

- [ ] **Step 3: Implement the method**

In the store object, after `renewSubscription` (after line 210), add:

```typescript
  fetchRenewalHistory: async (id: number) => {
    try {
      const { data } = await api.get(`/subscriptions/${id}/renewal-history/`, {
        headers: authHeaders(),
      });
      return data as RenewalHistoryItem[];
    } catch {
      return [];
    }
  },
```

- [ ] **Step 4: Verify (local gate)**

Run: `cd frontend && npm run build`
Expected: build succeeds (static export to `../backend/templates/`).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/adminSubscriptionStore.ts
git commit -m "feat(subscription): admin store fetchRenewalHistory

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Shared `RenewalHistory` component

**Files:**
- Create: `frontend/app/components/shared/RenewalHistory.tsx`
- Test: `frontend/app/__tests__/components/shared/RenewalHistory.test.tsx`

**Interfaces:**
- Consumes: `RenewalHistoryItem` (Task 9).
- Produces: `default export function RenewalHistory({ items }: { items: RenewalHistoryItem[] })` — renders a vertical timeline; empty state when `items.length === 0`.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/__tests__/components/shared/RenewalHistory.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import RenewalHistory from '@/app/components/shared/RenewalHistory';
import type { RenewalHistoryItem } from '@/lib/stores/adminSubscriptionStore';

const item: RenewalHistoryItem = {
  kind: 'manual',
  period_start: '2026-05-10T00:00:00Z',
  period_end: '2026-06-10T00:00:00Z',
  sessions_granted: 8,
  package_title: 'Plan Test',
  actor_email: 'admin@kore.com',
  note: '',
  source: 'record',
  payment: { amount: '100000', currency: 'COP', provider: 'cash', status: 'confirmed' },
};

test('renders a timeline entry', () => {
  render(<RenewalHistory items={[item]} />);
  expect(screen.getByText(/Renovación manual/i)).toBeInTheDocument();
  expect(screen.getByText(/8 sesiones/i)).toBeInTheDocument();
});

test('renders empty state', () => {
  render(<RenewalHistory items={[]} />);
  expect(screen.getByText(/Sin renovaciones/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the component**

Create `frontend/app/components/shared/RenewalHistory.tsx`:

```tsx
'use client';

import type { RenewalHistoryItem } from '@/lib/stores/adminSubscriptionStore';

const KIND_LABEL: Record<RenewalHistoryItem['kind'], string> = {
  initial: 'Compra inicial',
  manual: 'Renovación manual',
  automatic: 'Renovación automática',
  plan_change: 'Cambio de plan',
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RenewalHistory({ items }: { items: RenewalHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[12px] text-kore-burgundy/55">
        Sin renovaciones todavía.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li
          key={`${it.period_start}-${i}`}
          className="rounded-2xl border border-kore-burgundy/10 bg-white/70 backdrop-blur-sm p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-kore-burgundy/65">
              {KIND_LABEL[it.kind] ?? it.kind}
            </span>
            <span className="text-[11px] text-kore-burgundy/55">
              {fmt(it.period_start)} → {fmt(it.period_end)}
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-kore-burgundy/80">
            {it.package_title} · {it.sessions_granted} sesiones
            {it.payment && (
              <> · {it.payment.amount} {it.payment.currency} ({it.payment.provider})</>
            )}
          </div>
          {it.actor_email && (
            <div className="mt-0.5 text-[11px] text-kore-burgundy/45">
              Registrada por {it.actor_email}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Verify (local gate)**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/shared/RenewalHistory.tsx frontend/app/__tests__/components/shared/RenewalHistory.test.tsx
git commit -m "feat(subscription): shared RenewalHistory timeline component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Admin detail page — history section + success-copy fix

**Files:**
- Modify: `frontend/app/admin-platform/subscriptions/detail/SubscriptionDetailPage.tsx`

**Interfaces:**
- Consumes: `fetchRenewalHistory` (Task 9), `RenewalHistory` (Task 10), `RenewalHistoryItem` (Task 9).

- [ ] **Step 1: Import the component, type, and store method**

In `SubscriptionDetailPage.tsx`, update the store import (lines 21-24) to include `fetchRenewalHistory` and the type, and import the component:

```tsx
import RenewalHistory from '@/app/components/shared/RenewalHistory';
import {
  useAdminSubscriptionStore,
  type PatchSubscriptionPayload,
  type RenewalHistoryItem,
} from '@/lib/stores/adminSubscriptionStore';
```

In the destructure at lines 50-53, add `fetchRenewalHistory`:

```tsx
  const {
    selected, loading, actionLoading, error,
    fetchById, patchSubscription, renewSubscription, deleteSubscription,
    fetchRenewalHistory,
  } = useAdminSubscriptionStore();
```

- [ ] **Step 2: Load the timeline**

After the existing state declarations (after line 60), add:

```tsx
  const [history, setHistory] = useState<RenewalHistoryItem[]>([]);
```

Add an effect after the existing `useEffect` at lines 62-64:

```tsx
  useEffect(() => {
    if (Number.isFinite(id) && id > 0) {
      fetchRenewalHistory(id).then(setHistory);
    }
  }, [id, fetchRenewalHistory]);
```

In `handleRenew` (lines 115-123), after `await fetchById(id);` add `setHistory(await fetchRenewalHistory(id));` so the timeline refreshes after a renewal.

- [ ] **Step 3: Fix the renewal success copy**

Replace the success message text at line 354:

```tsx
            Suscripción renovada. La actual quedó marcada como expirada y se creó una nueva.
```

with:

```tsx
            Suscripción renovada: se extendió el periodo en sitio (no se creó una suscripción nueva).
```

- [ ] **Step 4: Render the history section**

Insert a new section right after the Detail+Edit grid closing `</div>` at line 348 (before the `{/* Renewal */}` block at line 350):

```tsx
      {/* Renewal history */}
      <Card className="p-7 mt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
          Historial
        </div>
        <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
          Historial de renovaciones
        </div>
        <RenewalHistory items={history} />
      </Card>
```

- [ ] **Step 5: Verify (local gate)**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/admin-platform/subscriptions/detail/SubscriptionDetailPage.tsx
git commit -m "feat(subscription): admin detail shows renewal history + fixes copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Customer subscription page — history section

**Files:**
- Modify: `frontend/lib/stores/subscriptionStore.ts`
- Modify: `frontend/app/(app)/subscription/page.tsx`

**Interfaces:**
- Consumes: `RenewalHistory` (Task 10), `RenewalHistoryItem` (Task 9).
- Produces: `subscriptionStore.fetchRenewalHistory(id: number) => Promise<RenewalHistoryItem[]>`.

Note: the multi-pill selector at `page.tsx:1164-1188` already only renders when `subscriptions.length > 1`. After Task 8 the customer's own past terms no longer appear as separate subscriptions, so the pills naturally collapse (they remain only when a genuine guest subscription coexists). No change to the pill block is required — only add the history section.

- [ ] **Step 1: Add `fetchRenewalHistory` to the customer store**

In `frontend/lib/stores/subscriptionStore.ts`, import the type from the admin store and add a method mirroring Task 9 (reuse the same endpoint). Add to the state type:

```typescript
  fetchRenewalHistory: (id: number) => Promise<import('@/lib/stores/adminSubscriptionStore').RenewalHistoryItem[]>;
```

And in the store implementation, add:

```typescript
  fetchRenewalHistory: async (id: number) => {
    try {
      const { data } = await api.get(`/subscriptions/${id}/renewal-history/`, {
        headers: authHeaders(),
      });
      return data;
    } catch {
      return [];
    }
  },
```

(If `subscriptionStore.ts` does not already have an `authHeaders()` helper, reuse the existing token-injection pattern in that file — the wrapped `api` instance already injects the JWT, so `headers: authHeaders()` can be dropped if the file calls `api.get('/...')` without explicit headers elsewhere. Match the file's existing convention.)

- [ ] **Step 2: Load and render the timeline in the page**

In `frontend/app/(app)/subscription/page.tsx`:

Import the component at the top with the other imports:

```tsx
import RenewalHistory from '@/app/components/shared/RenewalHistory';
import type { RenewalHistoryItem } from '@/lib/stores/adminSubscriptionStore';
```

Add state near the component's other `useState` declarations:

```tsx
  const [renewalHistory, setRenewalHistory] = useState<RenewalHistoryItem[]>([]);
```

Add an effect that loads history whenever the displayed subscription changes (place it next to the effects that react to `detailSubscription`):

```tsx
  useEffect(() => {
    if (detailSubscription && !detailSubscription.is_guest) {
      fetchRenewalHistory(detailSubscription.id).then(setRenewalHistory);
    } else {
      setRenewalHistory([]);
    }
  }, [detailSubscription, fetchRenewalHistory]);
```

(Pull `fetchRenewalHistory` from `useSubscriptionStore()` in the existing destructure.)

Render the section inside the detail panel, after the Benefits+Actions row (`</div>` that closes the grid at line ~1290, before the Sessions Card). Use the page's existing card styling pattern (glass card). Insert:

```tsx
            {!detailSubscription.is_guest && (
              <div
                className="mt-8"
                style={{
                  background: 'rgba(255,255,255,0.65)',
                  borderRadius: 28,
                  padding: 'clamp(20px, 2.5vw, 28px)',
                  border: '1px solid rgba(103,15,34,0.08)',
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4"
                  style={{ color: 'rgba(103,15,34,0.55)' }}
                >
                  Historial de renovaciones
                </p>
                <RenewalHistory items={renewalHistory} />
              </div>
            )}
```

- [ ] **Step 3: Verify (local gate)**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/stores/subscriptionStore.ts "frontend/app/(app)/subscription/page.tsx"
git commit -m "feat(subscription): customer view shows single membership + renewal history

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Re-seed staging fake data

**Files:** none (operational step).

- [ ] **Step 1: Re-seed**

Use the `fake-data-refresh` skill (it runs `delete_fake_data` + `create_fake_data` with guardrails) so the database reflects the new one-membership model without legacy multi-row noise.

- [ ] **Step 2: Manual smoke (app already running on host-only IP)**

- Admin: open `http://192.168.56.10:3000` → `/admin-platform/subscriptions`. Confirm each customer appears once.
- Open a detail with an expired subscription → "Renovar manualmente" → confirm status flips to Activa in place (no new entry in the list) and the "Historial de renovaciones" section gains an entry.
- Customer: log in as a seeded customer → `/subscription` → confirm one subscription + the history section.

---

## Task 14: E2E flow audit

**Files:** none (verification step).

- [ ] **Step 1: Run the E2E coverage audit**

Invoke the `e2e-user-flows-check` skill (the subscription admin + customer flows changed). Address any High-priority gap it reports for the renewal/subscription flows, or note it explicitly if deferred.

- [ ] **Step 2: Push and let CI run the full test suite**

```bash
git push -u origin feat/22062026-subscription-renewal-history
```

Report the PR URL from the push output.

---

## Self-Review Notes

- **Spec coverage:** §1 in-place renewal → Task 3; §2 SubscriptionRenewal table → Tasks 1-5; §3 admin list one-per-customer → Task 7; §4 detail timeline + endpoint → Tasks 6, 11; §5 customer one membership → Tasks 8, 12; §6 re-seed → Task 13; full-timeline kinds (initial/manual/automatic/plan_change) → Tasks 3-5. All covered.
- **Restriction kept:** Task 3 keeps "renew only when expired/canceled" (matches the approved decision).
- **No FK repointing / no destructive migration:** only one additive table (Task 1); legacy rows preserved and surfaced via timeline (Task 2 source='legacy').
- **Type consistency:** `RenewalHistoryItem` defined in Task 9, reused in Tasks 10-12; `record_renewal` / `build_renewal_timeline` signatures consistent across Tasks 2-8.
- **Test policy:** tests are written in every backend/frontend task but executed by CI on push (Task 14), per user preference; local gates are `manage.py check` / `makemigrations --check` / `npm run build`.
