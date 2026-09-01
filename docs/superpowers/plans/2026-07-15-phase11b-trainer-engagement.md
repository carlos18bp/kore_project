# Phase 11b — Trainer Engagement Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ComingSoon at `/trainer/metrics` with a live Fase 2 engagement view over the trainer's own client portfolio: a summary (streaks, check-ins, credits, attendance) plus a per-client roster.

**Architecture:** One backend aggregation endpoint `GET /api/trainer/engagement/`, scoped to the trainer's clients, computed in a new `trainer_engagement_service.py` (no logic in the view). The frontend adds a `trainerEngagementStore` and a `TrainerEngagementView` component rendered in the `!PHASE_3_READY` branch of the existing metrics page; the Fase 3 comparativas code stays intact.

**Tech Stack:** Django 6 + DRF (APIView, ORM aggregates), Next.js 16 App Router + React 19 + TS, Zustand 5, Axios wrapper (`@/lib/services/http`), Playwright + Jest, pytest.

**Spec:** `docs/superpowers/specs/2026-07-15-phase11b-trainer-engagement-design.md`

## Global Constraints

- **No local test runs.** Do NOT run pytest / jest / playwright locally — CI runs the suites on push. Local gates only: `cd backend && source venv/bin/activate && python manage.py check` and `cd frontend && npx tsc --noEmit`. Write tests first (TDD), commit with the code, let CI run them. Each task lists the CI command for reference.
- **Branch:** `feat/15072026-phase11b-trainer-engagement` (already created off synced `july-release`). Commit every task; never commit to `master`/`july-release`.
- **Scoping:** everything is scoped to the trainer's clients = distinct `customer_id`s from `Booking.objects.filter(trainer=trainer_profile)`. The service computes this itself (do NOT import `_trainer_customer_ids` from the views module — that risks a circular import; the query is a one-liner).
- **Backend enum names (verbatim):** `CreditTransaction.Status.CONFIRMED`; `Booking.AttendanceStatus.{UNSET,ATTENDED,NO_SHOW}`; `SessionRating.RaterRole.CUSTOMER`.
- **Data sources:** streaks `CreditWallet.current_streak` (FK `customer`); check-in `MoodEntry` (FK `user`, `date`); credits `CreditTransaction` (FK `customer`, signed `amount`, `created_at`); attendance `Booking` (FK `trainer`, `starts_at`, `attendance_status`); ratings `SessionRating` (`booking__trainer`, `booking__customer_id`, `rater_role`).
- **Null vs zero:** `attendance_rate_30d` (portfolio and per-client), `average_rating`, `last_checkin` are `null`/`None` when their inputs are empty (distinct from 0). `checked_in_today_pct` is `0.0` when `clients_total == 0`. Percentages round to 1 decimal; credits cast to `int`.
- **Service layer:** aggregation lives in `trainer_engagement_service.py`, never in the view. Roster uses grouped queries (`values(...).annotate(...)`) + Python join — no per-client N+1.
- **Frontend:** calls via `api` from `@/lib/services/http`; errors via `extractApiError(err, fallback)`. Use the trainer/shared design-system card classes (`bg-white/70 backdrop-blur-sm rounded-2xl ...`), NOT the admin `StatTile`. Roster rows link to `/trainer/clients/client?id=${customer_id}`.
- **Do NOT touch** the "Métricas" nav entry or the Fase 3 comparativas JSX; only swap the ComingSoon return and guard its fetch.
- **Flow triplet must change together**, both versions bumped: `frontend/e2e/flow-definitions.json` (hand-edit), `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`. CI job `e2e-flow-definitions-sync` enforces this.

---

## File Structure

**Backend (new):**
- `backend/core_app/services/trainer_engagement_service.py` — public `build_engagement(trainer_profile, now)`; private `_customer_ids`, `_summary`, `_roster`.
- `backend/core_app/tests/services/test_trainer_engagement_service.py`
- `backend/core_app/tests/views/test_trainer_engagement_views.py`

**Backend (modify):**
- `backend/core_app/views/trainer_intelligence_views.py` — add `TrainerEngagementView`.
- `backend/core_app/urls/api_urls.py` — import + one `path(...)`.

**Frontend (new):**
- `frontend/lib/stores/trainerEngagementStore.ts`
- `frontend/app/components/trainer/TrainerEngagementView.tsx`
- `frontend/app/__tests__/stores/trainerEngagementStore.test.ts`
- `frontend/app/__tests__/components/trainer/TrainerEngagementView.test.tsx`
- `frontend/e2e/trainer/trainer-engagement.spec.ts`

**Frontend (modify):**
- `frontend/app/(app)/trainer/metrics/page.tsx` — swap ComingSoon → engagement view; guard comparative fetch.
- `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md` — flow triplet.

**Docs (modify):**
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`.

---

## Task 1: Engagement service — summary + composition

**Files:**
- Create: `backend/core_app/services/trainer_engagement_service.py`
- Test: `backend/core_app/tests/services/test_trainer_engagement_service.py`

**Interfaces:**
- Produces: `build_engagement(trainer_profile, now) -> {'summary': dict, 'roster': list}`; `_customer_ids(trainer_profile) -> list[int]`; `_summary(ids, trainer_profile, now) -> dict` with keys `clients_total, active_streaks, checked_in_today, checked_in_today_pct, credits_earned_30d, credits_spent_30d, attendance_rate_30d`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_trainer_engagement_service.py
from datetime import datetime, timedelta, timezone as dt_tz

import pytest
from django.utils import timezone

from core_app.models import (
    Booking, CreditTransaction, CreditWallet, MoodEntry, Package, TrainerProfile, User,
)
from core_app.services import trainer_engagement_service as svc

NOW = datetime(2026, 7, 15, 14, 0, tzinfo=dt_tz.utc)


@pytest.fixture
def trainer(db):
    u = User.objects.create_user(
        email='tr@test.com', password='p', first_name='Ana', last_name='G',
        role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, location='Gym')


@pytest.fixture
def package(db):
    return Package.objects.create(title='Plan', sessions_count=8)


def _client(email):
    return User.objects.create_user(email=email, password='p', first_name='C', last_name='L', role=User.Role.CUSTOMER)


def _booking(trainer, customer, package, when, attendance=Booking.AttendanceStatus.UNSET):
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=when, ends_at=when + timedelta(hours=1),
        status=Booking.Status.CONFIRMED, attendance_status=attendance,
    )


@pytest.mark.django_db
def test_summary_counts_streaks_checkins_credits_attendance(trainer, package):
    c1, c2 = _client('c1@t.com'), _client('c2@t.com')
    # Both are this trainer's clients via a booking.
    _booking(trainer, c1, package, NOW - timedelta(days=1), Booking.AttendanceStatus.ATTENDED)
    _booking(trainer, c2, package, NOW - timedelta(days=2), Booking.AttendanceStatus.NO_SHOW)
    CreditWallet.objects.create(customer=c1, current_streak=5)
    CreditWallet.objects.create(customer=c2, current_streak=0)
    MoodEntry.objects.create(user=c1, score=8, date=NOW.date())
    CreditTransaction.objects.create(customer=c1, action=CreditTransaction.Action.WORKOUT_DAY, amount=30, status=CreditTransaction.Status.CONFIRMED, description='e')
    CreditTransaction.objects.create(customer=c1, action=CreditTransaction.Action.REDEMPTION, amount=-10, status=CreditTransaction.Status.CONFIRMED, description='s')

    ids = svc._customer_ids(trainer)
    result = svc._summary(ids, trainer, NOW)

    assert result['clients_total'] == 2
    assert result['active_streaks'] == 1
    assert result['checked_in_today'] == 1
    assert result['checked_in_today_pct'] == 50.0
    assert (result['credits_earned_30d'], result['credits_spent_30d']) == (30, 10)
    assert result['attendance_rate_30d'] == 50.0  # 1 attended / (1 attended + 1 no_show)


@pytest.mark.django_db
def test_summary_attendance_none_when_no_sessions(trainer, package):
    c1 = _client('c1@t.com')
    _booking(trainer, c1, package, NOW - timedelta(days=1))  # UNSET → not counted
    ids = svc._customer_ids(trainer)
    result = svc._summary(ids, trainer, NOW)
    assert result['attendance_rate_30d'] is None


@pytest.mark.django_db
def test_summary_pct_zero_when_no_clients(trainer):
    result = svc._summary([], trainer, NOW)
    assert result['checked_in_today_pct'] == 0.0
    assert result['clients_total'] == 0
```

- [ ] **Step 2: Verify it fails** — CI: `pytest core_app/tests/services/test_trainer_engagement_service.py -v` → ImportError.

- [ ] **Step 3: Implement**

```python
# backend/core_app/services/trainer_engagement_service.py
"""Aggregation for the trainer engagement panel (Fase 2 — Parte 11b).

Portfolio engagement over the trainer's own clients. All KPI math lives here
so the view stays thin.
"""

from datetime import timedelta

from django.db.models import Avg, Count, Max, Q, Sum

from core_app.models import (
    Booking,
    CreditTransaction,
    CreditWallet,
    MoodEntry,
    SessionRating,
    User,
)


def _customer_ids(trainer_profile):
    """Distinct customer ids booked with this trainer (defines their portfolio)."""
    return list(
        Booking.objects.filter(trainer=trainer_profile)
        .values_list('customer_id', flat=True)
        .distinct()
    )


def _summary(ids, trainer_profile, now):
    since = now - timedelta(days=30)
    total = len(ids)

    active_streaks = CreditWallet.objects.filter(
        customer_id__in=ids, current_streak__gt=0,
    ).count()

    checked_in = MoodEntry.objects.filter(user_id__in=ids, date=now.date()).count()
    checked_pct = round(checked_in / total * 100, 1) if total else 0.0

    txns = CreditTransaction.objects.filter(
        customer_id__in=ids, status=CreditTransaction.Status.CONFIRMED, created_at__gte=since,
    )
    earned = int(txns.filter(amount__gt=0).aggregate(s=Sum('amount'))['s'] or 0)
    spent = abs(int(txns.filter(amount__lt=0).aggregate(s=Sum('amount'))['s'] or 0))

    att = Booking.objects.filter(
        trainer=trainer_profile, starts_at__gte=since,
        attendance_status__in=[Booking.AttendanceStatus.ATTENDED, Booking.AttendanceStatus.NO_SHOW],
    ).aggregate(
        attended=Count('id', filter=Q(attendance_status=Booking.AttendanceStatus.ATTENDED)),
        total=Count('id'),
    )
    attendance_rate = round(att['attended'] / att['total'] * 100, 1) if att['total'] else None

    return {
        'clients_total': total,
        'active_streaks': active_streaks,
        'checked_in_today': checked_in,
        'checked_in_today_pct': checked_pct,
        'credits_earned_30d': earned,
        'credits_spent_30d': spent,
        'attendance_rate_30d': attendance_rate,
    }


def build_engagement(trainer_profile, now):
    ids = _customer_ids(trainer_profile)
    return {
        'summary': _summary(ids, trainer_profile, now),
        'roster': _roster(ids, trainer_profile, now),
    }
```

> Note: `build_engagement` references `_roster`, added in Task 2. If running Task 1 in isolation, temporarily stub `def _roster(ids, tp, now): return []` and replace it in Task 2. (Under normal sequential execution, add `_roster` before committing Task 2.)

- [ ] **Step 4: Verify** — `python manage.py check`. CI: the three summary tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/trainer_engagement_service.py backend/core_app/tests/services/test_trainer_engagement_service.py
git commit -m "feat(engagement): trainer portfolio summary aggregation"
```

---

## Task 2: Engagement service — roster

**Files:**
- Modify: `backend/core_app/services/trainer_engagement_service.py`
- Test: `backend/core_app/tests/services/test_trainer_engagement_service.py`

**Interfaces:**
- Produces: `_roster(ids, trainer_profile, now) -> list[dict]`; each dict has `customer_id, name, current_streak, last_checkin, attendance_rate_30d, average_rating`. Ordered by `current_streak` desc, then `name` asc.

- [ ] **Step 1: Write the failing test** (append)

```python
from core_app.models import SessionRating


@pytest.mark.django_db
def test_roster_fields_and_ordering(trainer, package):
    c1, c2 = _client('ana@t.com'), _client('beto@t.com')
    b1 = _booking(trainer, c1, package, NOW - timedelta(days=1), Booking.AttendanceStatus.ATTENDED)
    _booking(trainer, c2, package, NOW - timedelta(days=3), Booking.AttendanceStatus.NO_SHOW)
    CreditWallet.objects.create(customer=c1, current_streak=7)
    CreditWallet.objects.create(customer=c2, current_streak=2)
    MoodEntry.objects.create(user=c1, score=9, date=NOW.date())
    SessionRating.objects.create(booking=b1, rater_role=SessionRating.RaterRole.CUSTOMER, score=5)

    ids = svc._customer_ids(trainer)
    roster = svc._roster(ids, trainer, NOW)

    assert [r['current_streak'] for r in roster] == [7, 2]  # streak desc
    ana = roster[0]
    assert ana['name'] == 'C L'  # first_name 'C' last_name 'L'
    assert ana['last_checkin'] == NOW.date().isoformat()
    assert ana['attendance_rate_30d'] == 100.0
    assert ana['average_rating'] == 5.0
    beto = roster[1]
    assert beto['last_checkin'] is None
    assert beto['attendance_rate_30d'] == 0.0  # 0 attended / 1 no_show
    assert beto['average_rating'] is None


@pytest.mark.django_db
def test_roster_excludes_non_clients(trainer, package):
    mine = _client('mine@t.com')
    stranger = _client('stranger@t.com')  # no booking with this trainer
    _booking(trainer, mine, package, NOW - timedelta(days=1))
    CreditWallet.objects.create(customer=stranger, current_streak=99)

    ids = svc._customer_ids(trainer)
    roster = svc._roster(ids, trainer, NOW)

    assert [r['customer_id'] for r in roster] == [mine.id]
```

> Note: both clients use `first_name='C', last_name='L'` from `_client`, so names tie — ordering is driven by streak here. That is fine for this assertion. If you want the name tiebreak covered too, give the clients distinct names in a separate test.

- [ ] **Step 2: Verify it fails** — CI: `AttributeError: _roster` (or the stub returns `[]`).

- [ ] **Step 3: Implement** (add `_roster` to the service, replacing any stub)

```python
def _roster(ids, trainer_profile, now):
    if not ids:
        return []
    since = now - timedelta(days=30)

    users = {u.id: u for u in User.objects.filter(id__in=ids)}
    streaks = dict(
        CreditWallet.objects.filter(customer_id__in=ids)
        .values_list('customer_id', 'current_streak')
    )

    last_checkin = {
        row['user_id']: row['last']
        for row in MoodEntry.objects.filter(user_id__in=ids)
        .values('user_id').annotate(last=Max('date'))
    }

    att_map = {
        row['customer_id']: (row['attended'], row['total'])
        for row in Booking.objects.filter(
            trainer=trainer_profile, customer_id__in=ids, starts_at__gte=since,
            attendance_status__in=[Booking.AttendanceStatus.ATTENDED, Booking.AttendanceStatus.NO_SHOW],
        ).values('customer_id').annotate(
            attended=Count('id', filter=Q(attendance_status=Booking.AttendanceStatus.ATTENDED)),
            total=Count('id'),
        )
    }

    rating_map = {
        row['booking__customer_id']: row['avg']
        for row in SessionRating.objects.filter(
            booking__customer_id__in=ids, booking__trainer=trainer_profile,
            rater_role=SessionRating.RaterRole.CUSTOMER,
        ).values('booking__customer_id').annotate(avg=Avg('score'))
    }

    roster = []
    for cid in ids:
        u = users.get(cid)
        if u is None:
            continue
        att = att_map.get(cid)
        rate = round(att[0] / att[1] * 100, 1) if att and att[1] else None
        avg = rating_map.get(cid)
        lc = last_checkin.get(cid)
        roster.append({
            'customer_id': cid,
            'name': f'{u.first_name} {u.last_name}'.strip() or u.email,
            'current_streak': streaks.get(cid, 0),
            'last_checkin': lc.isoformat() if lc else None,
            'attendance_rate_30d': rate,
            'average_rating': round(avg, 1) if avg is not None else None,
        })
    roster.sort(key=lambda r: (-r['current_streak'], r['name']))
    return roster
```

Ensure the imports at the top of the service include `Avg, Count, Max, Q, Sum` (Task 1 already imports `Avg, Count, Max, Q, Sum` — verify `Max` is present).

- [ ] **Step 4: Verify** — `python manage.py check`. CI: roster tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/trainer_engagement_service.py backend/core_app/tests/services/test_trainer_engagement_service.py
git commit -m "feat(engagement): per-client roster aggregation"
```

---

## Task 3: Endpoint + route

**Files:**
- Modify: `backend/core_app/views/trainer_intelligence_views.py`, `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_trainer_engagement_views.py`

**Interfaces:**
- Consumes: `trainer_engagement_service.build_engagement`, `_get_trainer_profile`, `IsTrainerRole`.
- Produces: route name `trainer-engagement` at `trainer/engagement/`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_trainer_engagement_views.py
from datetime import datetime, timedelta, timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Booking, CreditWallet, Package, TrainerProfile, User

FIXED_NOW = datetime(2026, 7, 15, 14, 0, tzinfo=dt_tz.utc)
URL_NAME = 'trainer-engagement'


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    u = User.objects.create_user(email='tr@test.com', password='p', first_name='Ana', last_name='G', role=User.Role.TRAINER)
    return TrainerProfile.objects.create(user=u, location='Gym')


@pytest.mark.django_db
def test_non_trainer_forbidden(api_client):
    u = User.objects.create_user(email='cust@test.com', password='p', role=User.Role.CUSTOMER)
    _auth(api_client, u)
    response = api_client.get(reverse(URL_NAME))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_trainer_gets_summary_and_roster(api_client, trainer):
    customer = User.objects.create_user(email='c@test.com', password='p', first_name='Bea', last_name='R', role=User.Role.CUSTOMER)
    package = Package.objects.create(title='Plan', sessions_count=8)
    Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=FIXED_NOW - timedelta(days=1), ends_at=FIXED_NOW,
        status=Booking.Status.CONFIRMED,
    )
    CreditWallet.objects.create(customer=customer, current_streak=4)

    _auth(api_client, trainer.user)
    response = api_client.get(reverse(URL_NAME))

    assert response.status_code == status.HTTP_200_OK
    assert set(response.data) == {'summary', 'roster'}
    assert response.data['summary']['active_streaks'] == 1
    assert response.data['roster'][0]['customer_id'] == customer.id
```

- [ ] **Step 2: Verify it fails** — CI: `NoReverseMatch` for `trainer-engagement`.

- [ ] **Step 3: Add the view** — in `backend/core_app/views/trainer_intelligence_views.py`, add the service import near the top imports:

```python
from core_app.services import trainer_engagement_service
```

and add the view class (near the other trainer-intelligence views):

```python
class TrainerEngagementView(APIView):
    """GET /api/trainer/engagement/ — Fase 2 engagement over the trainer's portfolio."""

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer = _get_trainer_profile(request)
        if trainer is None:
            return Response({'detail': 'Not a trainer.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(trainer_engagement_service.build_engagement(trainer, timezone.now()))
```

- [ ] **Step 4: Add the route** — in `backend/core_app/urls/api_urls.py`, extend the existing `from core_app.views.trainer_intelligence_views import (...)` block to include `TrainerEngagementView`, then add the path near the other `trainer/...` intelligence routes (e.g. after `trainer/risk-dashboard/`):

```python
    path('trainer/engagement/', TrainerEngagementView.as_view(), name='trainer-engagement'),
```

- [ ] **Step 5: Verify** — `python manage.py check`. CI: `pytest core_app/tests/views/test_trainer_engagement_views.py -v` passes.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/trainer_intelligence_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_trainer_engagement_views.py
git commit -m "feat(engagement): trainer engagement endpoint + route"
```

---

## Task 4: Frontend store

**Files:**
- Create: `frontend/lib/stores/trainerEngagementStore.ts`
- Test: `frontend/app/__tests__/stores/trainerEngagementStore.test.ts`

**Interfaces:**
- Produces: `useTrainerEngagementStore` with `{ data: TrainerEngagement | null, loading, error, fetchEngagement() }`. Exported types `TrainerEngagement`, `EngagementSummary`, `RosterEntry`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/trainerEngagementStore.test.ts
import { useTrainerEngagementStore } from '@/lib/stores/trainerEngagementStore';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn() },
  extractApiError: jest.fn(() => 'boom'),
}));

const mockedGet = api.get as jest.Mock;

const DATA = {
  summary: {
    clients_total: 2, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 50,
    credits_earned_30d: 30, credits_spent_30d: 10, attendance_rate_30d: 50,
  },
  roster: [
    { customer_id: 1, name: 'Ana', current_streak: 7, last_checkin: '2026-07-15', attendance_rate_30d: 100, average_rating: 5 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useTrainerEngagementStore.setState({ data: null, loading: false, error: null });
});

it('fetchEngagement loads data', async () => {
  mockedGet.mockResolvedValue({ data: DATA });
  await useTrainerEngagementStore.getState().fetchEngagement();
  expect(mockedGet).toHaveBeenCalledWith('/trainer/engagement/');
  expect(useTrainerEngagementStore.getState().data?.summary.active_streaks).toBe(1);
});

it('fetchEngagement sets error via extractApiError on failure', async () => {
  mockedGet.mockRejectedValue(new Error('x'));
  await useTrainerEngagementStore.getState().fetchEngagement();
  expect(useTrainerEngagementStore.getState().error).toBe('boom');
  expect(useTrainerEngagementStore.getState().loading).toBe(false);
});
```

- [ ] **Step 2: Verify it fails** — CI: module not found.

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/stores/trainerEngagementStore.ts
import { create } from 'zustand';
import { api, extractApiError } from '@/lib/services/http';

export type RosterEntry = {
  customer_id: number;
  name: string;
  current_streak: number;
  last_checkin: string | null;
  attendance_rate_30d: number | null;
  average_rating: number | null;
};

export type EngagementSummary = {
  clients_total: number;
  active_streaks: number;
  checked_in_today: number;
  checked_in_today_pct: number;
  credits_earned_30d: number;
  credits_spent_30d: number;
  attendance_rate_30d: number | null;
};

export type TrainerEngagement = {
  summary: EngagementSummary;
  roster: RosterEntry[];
};

type State = {
  data: TrainerEngagement | null;
  loading: boolean;
  error: string | null;
  fetchEngagement: () => Promise<void>;
};

export const useTrainerEngagementStore = create<State>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchEngagement: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get('/trainer/engagement/');
      set({ data: data as TrainerEngagement, loading: false });
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo cargar el engagement.'), loading: false });
    }
  },
}));
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`. CI: `npm test -- trainerEngagementStore` passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/trainerEngagementStore.ts frontend/app/__tests__/stores/trainerEngagementStore.test.ts
git commit -m "feat(engagement): trainerEngagementStore"
```

---

## Task 5: Engagement view component

**Files:**
- Create: `frontend/app/components/trainer/TrainerEngagementView.tsx`
- Test: `frontend/app/__tests__/components/trainer/TrainerEngagementView.test.tsx`

**Interfaces:**
- Consumes: `useTrainerEngagementStore`, `RatingsSummaryCard`.
- Produces: `export default function TrainerEngagementView()`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/components/trainer/TrainerEngagementView.test.tsx
import { render, screen } from '@testing-library/react';
import TrainerEngagementView from '@/app/components/trainer/TrainerEngagementView';
import { useTrainerEngagementStore } from '@/lib/stores/trainerEngagementStore';

jest.mock('@/lib/stores/trainerEngagementStore', () => ({
  useTrainerEngagementStore: jest.fn(),
}));

// RatingsSummaryCard fetches on its own — stub it out.
jest.mock('@/app/components/trainer/RatingsSummaryCard', () => ({
  __esModule: true,
  default: () => <div data-testid="ratings-card" />,
}));

const mocked = useTrainerEngagementStore as unknown as jest.Mock;

const DATA = {
  summary: {
    clients_total: 2, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 50,
    credits_earned_30d: 30, credits_spent_30d: 10, attendance_rate_30d: 50,
  },
  roster: [
    { customer_id: 1, name: 'Ana García', current_streak: 7, last_checkin: '2026-07-15', attendance_rate_30d: 100, average_rating: 5 },
  ],
};

it('renders summary tiles and a roster row', () => {
  mocked.mockReturnValue({ data: DATA, loading: false, error: null, fetchEngagement: jest.fn() });
  render(<TrainerEngagementView />);
  expect(screen.getByText('Rachas activas')).toBeInTheDocument();
  expect(screen.getByText('Ana García')).toBeInTheDocument();
});

it('renders an empty state when there are no clients', () => {
  mocked.mockReturnValue({
    data: { summary: { ...DATA.summary, clients_total: 0 }, roster: [] },
    loading: false, error: null, fetchEngagement: jest.fn(),
  });
  render(<TrainerEngagementView />);
  expect(screen.getByText(/Sin clientes/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify it fails** — CI: module not found.

- [ ] **Step 3: Implement** (`'use client'`, design-system card classes, roster rows link to client detail)

```tsx
// frontend/app/components/trainer/TrainerEngagementView.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTrainerEngagementStore } from '@/lib/stores/trainerEngagementStore';
import RatingsSummaryCard from '@/app/components/trainer/RatingsSummaryCard';

const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
const num = (v: number | null) => (v == null ? '—' : String(v));

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-kore-gray-dark/50">{label}</div>
      <div className="font-heading text-3xl font-semibold text-kore-gray-dark mt-1 leading-none">{value}</div>
    </div>
  );
}

export default function TrainerEngagementView() {
  const { data, error, fetchEngagement } = useTrainerEngagementStore();

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  const s = data?.summary;
  const roster = data?.roster ?? [];

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-0.5">Inteligencia</p>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">Engagement de tu cartera</h1>
        </div>

        {error && <p className="text-sm text-kore-red">{error}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Rachas activas" value={num(s?.active_streaks ?? 0)} />
          <Tile label="Check-in hoy" value={pct(s?.checked_in_today_pct ?? 0)} />
          <Tile label="Créditos 30d" value={`+${s?.credits_earned_30d ?? 0} / -${s?.credits_spent_30d ?? 0}`} />
          <Tile label="Asistencia 30d" value={pct(s?.attendance_rate_30d ?? null)} />
        </div>

        <RatingsSummaryCard />

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm">
          <h2 className="text-sm font-bold text-kore-gray-dark mb-3">Tus clientes</h2>
          {roster.length === 0 ? (
            <p className="text-sm text-kore-gray-dark/50">Sin clientes todavía.</p>
          ) : (
            <ul className="divide-y divide-kore-gray-light/40">
              {roster.map((r) => (
                <li key={r.customer_id}>
                  <Link
                    href={`/trainer/clients/client?id=${r.customer_id}`}
                    prefetch={false}
                    className="flex items-center justify-between py-3 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-sm font-semibold text-kore-gray-dark">{r.name}</span>
                    <span className="text-xs text-kore-gray-dark/60 flex gap-3">
                      <span>🔥 {r.current_streak}</span>
                      <span>Asist. {pct(r.attendance_rate_30d)}</span>
                      <span>★ {num(r.average_rating)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit`. CI: `npm test -- TrainerEngagementView` passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/trainer/TrainerEngagementView.tsx frontend/app/__tests__/components/trainer/TrainerEngagementView.test.tsx
git commit -m "feat(engagement): TrainerEngagementView component"
```

---

## Task 6: Wire into the metrics page

**Files:**
- Modify: `frontend/app/(app)/trainer/metrics/page.tsx`

- [ ] **Step 1: Add the import** — at the top of `frontend/app/(app)/trainer/metrics/page.tsx`, add:

```tsx
import TrainerEngagementView from '@/app/components/trainer/TrainerEngagementView';
```

- [ ] **Step 2: Swap the ComingSoon return** — replace:

```tsx
  if (!PHASE_3_READY) return <ComingSoon section="Métricas" />;
```

with:

```tsx
  if (!PHASE_3_READY) return <TrainerEngagementView />;
```

- [ ] **Step 3: Guard the comparative fetch** — change the effect so the Fase 3 fetch only runs when that view is live:

```tsx
  useEffect(() => {
    if (PHASE_3_READY) fetchComparativeMetrics();
  }, [fetchComparativeMetrics]);
```

Leave the `ComingSoon` import in place only if still referenced; if it is now unused, remove the `import ComingSoon from '@/app/components/shared/ComingSoon';` line to keep the build lint-clean. Do NOT touch any Fase 3 JSX below the guard.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (expect no unused-import / type errors). CI: existing metrics-page tests (if any) still pass.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(app)/trainer/metrics/page.tsx"
git commit -m "feat(engagement): serve engagement view at /trainer/metrics"
```

---

## Task 7: E2E spec + flow triplet

**Files:**
- Create: `frontend/e2e/trainer/trainer-engagement.spec.ts`
- Modify: `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`

- [ ] **Step 1: Add the flow tag** — in `frontend/e2e/helpers/flow-tags.ts`, near the other `TRAINER_*` entries:

```typescript
  TRAINER_ENGAGEMENT: ['@flow:trainer-engagement', '@module:trainer', '@priority:P2'],
```

- [ ] **Step 2: Add the flow definition** — in `frontend/e2e/flow-definitions.json`, bump top-level `"version"` (e.g. `1.10.0` → `1.11.0`) and `"lastUpdated"` to `2026-07-15`, and add a `trainer-engagement` flow object **by hand** mirroring an existing `trainer-*` flow (id, name, module `trainer`, priority `P2`, route `/trainer/metrics`, short description, `"coverage": "covered"`).

- [ ] **Step 3: Document the flow** — in `docs/USER_FLOW_MAP.md`, bump its `Version` and `Last Updated`, and add a `trainer-engagement` section consistent with the other trainer flows (route `/trainer/metrics`, describes the summary tiles + roster).

- [ ] **Step 4: Write the E2E spec**

```typescript
// frontend/e2e/trainer/trainer-engagement.spec.ts
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:trainer-engagement
 * The trainer reads Fase 2 engagement over their portfolio at /trainer/metrics:
 * summary tiles + a per-client roster.
 */

const ENGAGEMENT = {
  summary: {
    clients_total: 2, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 50,
    credits_earned_30d: 30, credits_spent_30d: 10, attendance_rate_30d: 50,
  },
  roster: [
    { customer_id: 1, name: 'Ana García', current_streak: 7, last_checkin: '2026-07-15', attendance_rate_30d: 100, average_rating: 5 },
  ],
};

const RATINGS = { average: 4.5, count: 4, recent: [] };

test.describe('Trainer — engagement', { tag: [...FlowTags.TRAINER_ENGAGEMENT, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
  });

  test('shows portfolio summary and roster', async ({ page }) => {
    await page.route('**/api/trainer/engagement/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ENGAGEMENT) }),
    );
    await page.route('**/api/trainer/ratings/summary/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RATINGS) }),
    );

    await page.goto('/trainer/metrics');

    await expect(page.getByRole('heading', { name: 'Engagement de tu cartera' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rachas activas')).toBeVisible();
    await expect(page.getByText('Ana García')).toBeVisible();
  });
});
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit`. CI: E2E job and `e2e-flow-definitions-sync` pass (all three triplet files changed + versions bumped).

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/trainer/trainer-engagement.spec.ts frontend/e2e/flow-definitions.json frontend/e2e/helpers/flow-tags.ts docs/USER_FLOW_MAP.md
git commit -m "test(engagement): E2E for trainer engagement + flow triplet"
```

---

## Task 8: Release docs

**Files:**
- Modify: `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`

- [ ] **Step 1: Validation guide** — in `docs/release-july/GUIA_DE_VALIDACION.md`, add a "Parte 11b — Analítica del entrenador" section (Funcionalidad 17): trainer opens **Métricas** → sees engagement tiles (rachas, check-in hoy, créditos 30d, asistencia 30d) + Calificaciones + roster de clientes; tapping a client opens their detail. Update the "Próximas secciones" note — after 11b, Fase 2 is complete (nothing pending).

- [ ] **Step 2: QA staging guide** — in `docs/release-july/GUIA_QA_STAGING.md`, add a matching `3.16 Entrenador — Engagement de cartera (Parte 11b)` section: login trainer → `/trainer/metrics` loads `GET /api/trainer/engagement/`; verify the summary numbers reflect seeded streaks/check-ins/credits/attendance; a client with no attended/no-show sessions shows asistencia "—"; a customer not booked with this trainer does not appear in the roster; `GET` as a non-trainer returns 403.

- [ ] **Step 3: Commit**

```bash
git add docs/release-july/GUIA_DE_VALIDACION.md docs/release-july/GUIA_QA_STAGING.md
git commit -m "docs(release): trainer engagement panel in validation + QA guides"
```

---

## Task 9: E2E user-flows audit + finish

- [ ] **Step 1:** Invoke the `e2e-user-flows-check` skill to audit coverage of the new `trainer-engagement` flow (per CLAUDE.md, final step for any change touching a frontend user flow). Address any gap it reports.
- [ ] **Step 2:** Push the branch and open the PR **against `july-release`** (not `master`). Report the PR URL. The user merges. Note in the PR that this is the **final piece of Fase 2**.

---

## Self-Review Notes

- **Spec coverage:** summary (T1), roster (T2), endpoint+403 (T3), store (T4), view component + empty state + roster links (T5), metrics-page wiring + fetch guard (T6), E2E + triplet (T7), release docs (T8), audit + PR (T9). All spec sections mapped.
- **Type consistency:** the store's `TrainerEngagement`/`EngagementSummary`/`RosterEntry` (T4) match the backend payload keys (T1–T2) and the component/E2E fixtures (T5/T7) exactly: `summary.{clients_total,active_streaks,checked_in_today,checked_in_today_pct,credits_earned_30d,credits_spent_30d,attendance_rate_30d}`, `roster[].{customer_id,name,current_streak,last_checkin,attendance_rate_30d,average_rating}`.
- **Circular-import guard:** the service does NOT import from the views module; it computes `_customer_ids` itself. The view imports the service (one direction only).
- **Null vs zero honored:** `attendance_rate_30d`/`average_rating`/`last_checkin` are `None`/`null` when empty; the component renders them as "—".
- **Known follow-up flagged inline:** if Task 1 is executed in isolation before Task 2, stub `_roster` (noted in T1) — under sequential execution add `_roster` before committing T2.
