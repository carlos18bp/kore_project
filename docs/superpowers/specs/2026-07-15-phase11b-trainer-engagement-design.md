# Phase 11b — Trainer Engagement Analytics — Design

**Status:** Approved (brainstorming) — 2026-07-15
**Phase:** Fase 2, Part 11b (second of two; 11a = admin business KPIs, merged in PR #62). **Last piece of Fase 2.**
**Parent branch:** `july-release`
**Feature branch:** `feat/15072026-phase11b-trainer-engagement`

## Goal

Replace the ComingSoon placeholder at `/trainer/metrics` with a live view of
Fase 2 **engagement over the trainer's own client portfolio**: a portfolio
summary (streaks, check-ins, credits, attendance) plus a per-client roster.
Scoped to the customers assigned to the authenticated trainer.

This is the trainer-facing complement to 11a (admin business KPIs) and the final
deliverable of Fase 2.

## Context

The trainer surface already has a **"Métricas" nav entry** →
`/trainer/metrics` (`TrainerSidebar.tsx:98`, `ChartIcon`), but the page is gated:
`frontend/app/(app)/trainer/metrics/page.tsx:15` sets `const PHASE_3_READY = false`
and line 55 returns `<ComingSoon section="Métricas" />` before rendering the
Fase 3 "Métricas Comparativas" UI (adherence ranking, weekly deltas, non-compliance
patterns). That Fase 3 view is **not part of this release**.

**Decision (brainstorming):** reuse the pre-wired "Métricas" slot rather than add
a second analytics entry. The 11b engagement view becomes the live content of the
`!PHASE_3_READY` branch; the Fase 3 comparativas code stays intact for when
`PHASE_3_READY` flips true. Same pattern 11a used with the admin "Reportes" slot.

**Existing infrastructure reused:**
- `core_app/views/trainer_intelligence_views.py` — `_get_trainer_profile(request)`
  (returns `request.user.trainer_profile` or None), `_trainer_customer_ids(trainer_profile)`
  (distinct `customer_id`s from bookings where `trainer=trainer_profile`), and the
  `TrainerRiskDashboardView` / `TrainerClientKPIView` patterns.
- `core_app/permissions.IsTrainerRole`.
- `RatingsSummaryCard` + `sessionRatingStore` + `TrainerRatingsSummaryView`
  (`GET /api/trainer/ratings/summary/`) from Part 9.

**Data sources** (all scoped to `_trainer_customer_ids(trainer)`):
- `CreditWallet` — `customer` (OneToOne), `current_streak`, `longest_streak`, `last_active_date`.
- `MoodEntry` — `user` FK, `date` (`default=timezone.localdate`), unique `(user, date)`. This is the daily check-in row.
- `CreditTransaction` — `customer`, `amount` (signed), `status` (`Status.CONFIRMED`), `created_at`.
- `Booking` — `trainer` (FK to TrainerProfile), `customer`, `starts_at`, `attendance_status` (`AttendanceStatus.{UNSET,ATTENDED,NO_SHOW}`).
- `SessionRating` — `booking` FK, `rater_role` (`RaterRole.CUSTOMER`), `score`.

## Non-Goals

- No time-window selector (unlike 11a) — fixed periods per metric (below).
- No Fase 3 "Métricas Comparativas" work — that code is preserved, not extended.
- No CSV export, no per-client drill-down page (the roster links to the existing
  client detail if convenient, but no new detail view).
- No new domain model or migration.
- No changes to the "Métricas" nav entry (already points at `/trainer/metrics`).
- No chart library — any viz is hand-built per the KORE design system.

## Architecture

### Backend

Single aggregation endpoint, logic in a service (respects the "no calculation in
views" invariant).

**`core_app/services/trainer_engagement_service.py`** (new)
- `build_engagement(trainer_profile, now) -> dict` — returns `{summary, roster}`,
  scoped to `_trainer_customer_ids(trainer_profile)`. `now` injected for testability.
- Private helpers: `_summary(customer_ids, trainer_profile, now)`, `_roster(customer_ids, trainer_profile, now)`.
- ORM only (`.aggregate`, `.values().annotate()`, `.filter`). Build per-client maps
  with **grouped** queries (one query per metric via `values('customer_id').annotate(...)`),
  then join in Python — no per-client N+1 loop of queries.

**Payload shape:**

```json
{
  "summary": {
    "clients_total": 8,
    "active_streaks": 3,
    "checked_in_today": 5,
    "checked_in_today_pct": 62.5,
    "credits_earned_30d": 420,
    "credits_spent_30d": 150,
    "attendance_rate_30d": 91.7
  },
  "roster": [
    {
      "customer_id": 12,
      "name": "Ana García",
      "current_streak": 5,
      "last_checkin": "2026-07-15",
      "attendance_rate_30d": 100.0,
      "average_rating": 4.5
    }
  ]
}
```

**Metric rules:**
- `clients_total` = `len(customer_ids)`.
- `active_streaks` = count of `CreditWallet` with `customer_id in ids` and `current_streak > 0`.
- `checked_in_today` = count of distinct customers with a `MoodEntry` where `date == now.date()` and `user_id in ids`. (`(user, date)` is unique, so a plain count of matching rows equals distinct customers.)
- `checked_in_today_pct` = `checked_in_today / clients_total * 100` rounded to 1 decimal; `0.0` when `clients_total == 0`.
- `credits_earned_30d` / `credits_spent_30d` = sum of `CreditTransaction.amount` (status `CONFIRMED`, `customer_id in ids`, `created_at >= now - 30d`): earned = sum of positive amounts (positive int); spent = absolute value of the sum of negatives (positive int).
- `attendance_rate_30d` (portfolio) = over bookings with `trainer=trainer_profile`, `starts_at >= now - 30d`, `attendance_status in (ATTENDED, NO_SHOW)`: `attended / (attended + no_show) * 100` rounded to 1 decimal; **`null`** when there are no such bookings (distinguish "no data" from "0%").

**Roster** — one entry per customer id, each field independently `null`-safe:
- `name` = `f'{first_name} {last_name}'.strip()` or the email.
- `current_streak` = the customer's `CreditWallet.current_streak`, or `0` if no wallet.
- `last_checkin` = ISO date of the customer's most recent `MoodEntry`, or `null`.
- `attendance_rate_30d` = same formula as portfolio but filtered to `customer_id=this`; `null` when the client had no attended/no-show sessions in the window.
- `average_rating` = avg `SessionRating.score` where `booking__customer_id=this`, `booking__trainer=trainer_profile`, `rater_role=CUSTOMER`, rounded to 1 decimal; `null` when none.
- **Order:** `current_streak` descending, then `name` ascending (most-engaged first, stable tiebreak).

**`core_app/views/trainer_intelligence_views.py`** (extend — the natural home next to the other trainer-intelligence views)
- `TrainerEngagementView(APIView)`, `permission_classes = [IsAuthenticated, IsTrainerRole]`.
- `get(request)`: resolve `trainer = _get_trainer_profile(request)`; if `None` return `403` (`{'detail': 'Not a trainer.'}`); else return `200` with `build_engagement(trainer, timezone.now())`.

**Route:** in `core_app/urls/api_urls.py`, next to the other `trainer/...` intelligence routes:
`path('trainer/engagement/', TrainerEngagementView.as_view(), name='trainer-engagement')`.

### Frontend

**`frontend/lib/stores/trainerEngagementStore.ts`** (new) — Zustand:
- State: `data: TrainerEngagement | null`, `loading`, `error`.
- `fetchEngagement()`: `GET /trainer/engagement/` via `@/lib/services/http` `api`; errors via `extractApiError`.
- Typed `TrainerEngagement`, `EngagementSummary`, `RosterEntry` mirroring the payload.

**`frontend/app/components/trainer/TrainerEngagementView.tsx`** (new) — `'use client'`:
- On mount, `fetchEngagement()`.
- **Header:** SectionLabel "Inteligencia" + `h1` "Engagement de tu cartera" (reuse the trainer surface's typographic pattern).
- **Summary tiles:** streaks activas, % check-in hoy, créditos ganados/gastados (30d), asistencia 30d (or "—" when `null`). Built from the trainer/customer design-system card primitives (NOT the admin `StatTile`).
- **Ratings:** render the existing `RatingsSummaryCard` (portfolio-level, no `customerId`).
- **Roster:** a list/table, one row per client (nombre, racha, último check-in relativo, asistencia 30d, rating). Each row links to `/trainer/clients/<id>` if that route exists; otherwise plain text. Empty state (typographic) when the trainer has no clients.
- Loading: per-section dimming; never a full-page blocker.

**`frontend/app/(app)/trainer/metrics/page.tsx`** (modify, minimal):
- Replace `if (!PHASE_3_READY) return <ComingSoon section="Métricas" />;` with `if (!PHASE_3_READY) return <TrainerEngagementView />;`.
- Guard the comparative fetch so it does not fire while the Fase 3 view is dormant: `useEffect(() => { if (PHASE_3_READY) fetchComparativeMetrics(); }, [fetchComparativeMetrics]);`.
- Leave all Fase 3 JSX and helpers untouched below the guard.

## Data Flow

1. Trainer opens **Métricas** → `/trainer/metrics` → `PHASE_3_READY` is false → renders `<TrainerEngagementView/>`.
2. The view calls `GET /api/trainer/engagement/` → `TrainerEngagementView` → `IsTrainerRole` gate → `build_engagement(trainer, now())` → scoped ORM aggregates → `{summary, roster}`.
3. Tiles + `RatingsSummaryCard` + roster render. `RatingsSummaryCard` fetches its own `/trainer/ratings/summary/` (unchanged Part 9 behavior).

## Error Handling

- Non-trainer / unauthenticated → `IsTrainerRole` / missing profile → `403`/`401`. The `(app)` trainer layout already guards the route by role.
- Frontend fetch failure → inline error line via `extractApiError`; prior data stays visible.
- Zero-safe throughout: `checked_in_today_pct` → `0.0` with no clients; `attendance_rate_30d` and per-client `average_rating`/`attendance_rate_30d`/`last_checkin` → `null` when their inputs are empty, rendered as "—".

## Testing

**Backend** (`core_app/tests/services/test_trainer_engagement_service.py`,
`core_app/tests/views/test_trainer_engagement_views.py`):
- Golden values with a frozen `now` and a seeded trainer + 2–3 clients:
  active-streak count, check-in-today count/pct, credits earned/spent (30d window
  boundary in vs out), attendance rate (attended/no-show), roster fields + ordering.
- **Scoping:** a customer who is NOT this trainer's client does not appear in the
  roster and does not affect the summary.
- Zero-safe edges: `attendance_rate_30d is None` when no sessions; `checked_in_today_pct == 0.0` with no clients; roster `average_rating`/`last_checkin` `None` when absent.
- View: trainer gets `200` with `{summary, roster}`; non-trainer gets `403`.

**Frontend unit** (Jest):
- `trainerEngagementStore` — `fetchEngagement` sets `data` on success, `error` via `extractApiError` on failure. Mock `@/lib/services/http`.
- `TrainerEngagementView` — renders the summary tiles and a roster row from mocked
  store data; renders the empty state when `roster` is empty. Mock the store,
  `RatingsSummaryCard`, and (if pulled in) `next/navigation`.

**E2E** (`frontend/e2e/trainer/trainer-engagement.spec.ts`):
- `injectTrainerAuthCookies`; route `**/api/trainer/engagement/**` and
  `**/api/trainer/ratings/summary/**` to canned payloads; go to `/trainer/metrics`;
  assert a summary tile and a roster row render.
- **Flow triplet** (both versions bumped; CI `e2e-flow-definitions-sync` enforces):
  add a `trainer-engagement` flow to `frontend/e2e/flow-definitions.json` (edit by hand),
  `frontend/e2e/helpers/flow-tags.ts` (`TRAINER_ENGAGEMENT`), `docs/USER_FLOW_MAP.md`.

Per project constraints: run only touched slices; CI runs suites on push.

## Release Docs

Add a Part 11b section to `docs/release-july/GUIA_DE_VALIDACION.md` and
`docs/release-july/GUIA_QA_STAGING.md` (trainer opens Métricas → sees portfolio
engagement + roster), and update the "Próximas secciones" note — after 11b, Fase 2
is complete.

## File Summary

**New:**
- `backend/core_app/services/trainer_engagement_service.py`
- `backend/core_app/tests/services/test_trainer_engagement_service.py`
- `backend/core_app/tests/views/test_trainer_engagement_views.py`
- `frontend/lib/stores/trainerEngagementStore.ts`
- `frontend/app/components/trainer/TrainerEngagementView.tsx`
- `frontend/e2e/trainer/trainer-engagement.spec.ts`
- unit tests for store / view component

**Modified:**
- `backend/core_app/views/trainer_intelligence_views.py` (add `TrainerEngagementView`)
- `backend/core_app/urls/api_urls.py` (route)
- `frontend/app/(app)/trainer/metrics/page.tsx` (swap ComingSoon → engagement view; guard fetch)
- `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md` (flow triplet)
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`
