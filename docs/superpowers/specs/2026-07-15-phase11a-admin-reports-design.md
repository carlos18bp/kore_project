# Phase 11a — Admin Reports / KPIs — Design

**Status:** Approved (brainstorming) — 2026-07-15
**Phase:** Fase 2, Part 11a (first of two; 11b = trainer engagement analytics, later)
**Parent branch:** `july-release`
**Feature branch:** `feat/15072026-phase11a-admin-reports`

## Goal

Activate the admin "Reportes" panel — currently a disabled placeholder in both
nav surfaces — with a single-page dashboard of business KPIs for the Fase 2
economy (revenue, subscriptions, credit economy, session-rating quality),
filterable by a preset time window.

This is the capstone of the monetization phase: it surfaces *how the economy
Fase 2 built is performing*. It does **not** introduce a general BI module,
custom date ranges, CSV export, or per-metric drill-downs (out of scope; see
Non-Goals).

## Context

Fase 2 built an economy across ten prior parts: credits earned/spent, streaks,
an internal store (credit rail), Wompi top-ups and packs, and post-session
ratings. The data to report on already exists. No new domain models are needed.

**Pre-wired home.** The admin navigation already reserves a "Reportes" slot:
- `frontend/app/components/admin/AdminSidebar.tsx:63` — `{ key: 'reports', label: 'Reportes', href: '#', icon: ChartIcon, soon: true }`
- `frontend/app/components/layouts/AdminMobileBottomNav.tsx:90` — `{ key: 'reports', label: 'Reportes', icon: ChartIcon, disabled: true }`

Both must be activated (drop `soon`/`disabled`, point `href` at `/admin-platform/reports`).

**Existing data sources** (all in `core_app`):
- `Payment` — `amount` (Decimal COP), `status` (`Status.CONFIRMED`), `confirmed_at`, `subscription`/`booking` FKs. Subscription + booking revenue.
- `CreditPurchase` — `amount_cop` (int), `credits`, `status` (`Status.APPROVED` = paid; enum is `PENDING`/`APPROVED`/`DECLINED`), `resolved_at`. Wompi credit top-ups.
- `Subscription` — `status` (active/expired/canceled), `includes_nutrition`, `package`.
- `CreditTransaction` — `amount` (signed int), `status` (`Status.CONFIRMED`), `action`, `created_at`. Ledger for earned (`amount>0`) vs spent (`amount<0`).
- `RedemptionRequest` — `status` (pending/approved/…), `credits_spent`, `created_at`. Store redemptions.
- `SessionRating` — `score` (1–5), `rater_role`, `created_at`.

**Audience decision:** Part 11 was split into two independent subsystems.
11a (this spec) = admin business KPIs. 11b (later) = trainer engagement over
their own portfolio, reusing the `RatingsSummaryCard` from Part 9.

## Non-Goals

- Custom (from/to) date ranges or arbitrary time-series — only preset windows.
- CSV/PDF export, scheduled reports, email digests.
- Per-metric drill-down pages or clickable cohorts.
- Trainer-scoped analytics (that is Part 11b).
- Any new domain model or migration.
- Charts via a third-party library — visualization is hand-built SVG per the
  KORE design system (no chart lib, arc/bar primitives only).

## Architecture

### Backend

Single aggregation endpoint. All aggregation logic lives in a service, not the
view (respects the "service layer is real; do not inline calculation into
views" invariant).

**`core_app/services/reports_service.py`** (new)
- `WINDOWS = {'today', '30d', '90d', 'all'}`
- `resolve_since(window, now) -> datetime | None` — maps a window to its lower
  bound. `today` → start of `now`'s day; `30d`/`90d` → `now - N days`;
  `all` → `None` (no lower bound). `now` is injected for testability.
- `build_admin_report(window, now) -> dict` — returns the full payload below.
  Validates `window` against `WINDOWS`, raising `ValueError` for unknown values.
- Aggregation uses the ORM (`.aggregate(Sum/Count/Avg)`, `.filter`,
  `.values(...).annotate(...)`). No raw SQL.

**Payload shape** (returned as a plain dict; no serializer needed — it is a
read-only aggregate, not a model):

```json
{
  "window": "30d",
  "revenue": {
    "total_cop": 4200000,
    "subscriptions_cop": 3600000,
    "credits_cop": 600000,
    "trend": [
      { "month": "2026-02", "cop": 500000 },
      { "month": "2026-03", "cop": 700000 }
      // last 6 calendar months, fixed (independent of window)
    ]
  },
  "subscriptions": {
    "active": 42,
    "expired": 11,
    "canceled": 7,
    "with_nutrition": 18,
    "with_nutrition_pct": 42.9
  },
  "credits": {
    "earned": 12500,
    "spent": 4800,
    "redemptions_by_status": { "pending": 3, "fulfilled": 9, "rejected": 1 }
  },
  "quality": {
    "average_score": 4.6,
    "rated_count": 58,
    "distribution": { "1": 0, "2": 1, "3": 4, "4": 18, "5": 35 }
  }
}
```

**Windowing rules:**
- `revenue.total_cop` / `subscriptions_cop` / `credits_cop`: sum over the window
  by the *money-confirmed timestamp* — `Payment.confirmed_at` for payments,
  `CreditPurchase.resolved_at` for top-ups. Only `Payment.CONFIRMED` /
  `CreditPurchase.APPROVED` rows count.
- `revenue.trend`: **fixed** last-6-calendar-months monthly revenue, independent
  of the window selector (context strip). Buckets by the same confirmed
  timestamps. Months with no revenue appear with `cop: 0` (no gaps).
- `subscriptions.*`: `active`/`expired`/`canceled` are **current** counts of all
  subscriptions in that status (a status snapshot is not time-windowed — a
  subscription's "active" state is a present fact, not an event in the window).
  `with_nutrition` counts active subs with `includes_nutrition=True`.
  `with_nutrition_pct` = `with_nutrition / active * 100` rounded to 1 decimal,
  or `0.0` when `active == 0`.
- `credits.earned` / `spent`: sum of confirmed `CreditTransaction.amount` in the
  window by `created_at` (`earned` = sum of positive amounts as a positive int;
  `spent` = absolute value of the sum of negative amounts, as a positive int).
- `credits.redemptions_by_status`: count of `RedemptionRequest` created in the
  window, grouped by status. Every status key in `RedemptionRequest.Status`
  appears, defaulting to 0.
- `quality.*`: `SessionRating` created in the window. `average_score` rounded to
  1 decimal, or `0.0` when `rated_count == 0`. `distribution` has keys `"1"`…`"5"`,
  each defaulting to 0.

**`core_app/views/admin_reports_views.py`** (new)
- `AdminReportsView(APIView)`, `permission_classes = [IsAuthenticated, IsAdminRole]`.
- `get(request)`: reads `?window=` (default `'30d'`). If the value is not in
  `WINDOWS`, return `400` with `{'detail': 'Invalid window.'}`. Otherwise call
  `build_admin_report(window, timezone.now())` and return `200` with the dict.

**Route:** in `core_app/urls/api_urls.py`, add
`path('admin/reports/', AdminReportsView.as_view(), name='admin-reports')`
alongside the other `admin/...` paths.

### Frontend

**`frontend/lib/stores/adminReportsStore.ts`** (new) — Zustand store:
- State: `window: 'today' | '30d' | '90d' | 'all'` (default `'30d'`),
  `data: AdminReport | null`, `loading: boolean`, `error: string | null`.
- `fetchReport(window)`: sets `loading`, `GET /admin/reports/?window=${window}`
  via `@/lib/services/http` `api`, stores `data`, clears/sets `error` using
  `extractApiError(err, fallback)`. Updates `window` in state.
- Typed `AdminReport` interface mirroring the payload above.

**`frontend/app/admin-platform/reports/page.tsx`** (new) — `'use client'`:
- Wrapped in `AdminShell` with `breadcrumb={[{ label: 'Panel de administración', href: '/admin-platform/dashboard' }, { label: 'Reportes' }]}` and `title="Reportes"`.
- On mount, `fetchReport('30d')`.
- **Window selector**: pill group (Hoy / 30 días / 90 días / Todo) styled per the
  admin/design-system active-pill pattern; selecting a pill calls `fetchReport`.
- **Revenue block**: headline `StatTile` (total COP, formatted with thousands
  separators + " COP"), two secondary tiles (suscripciones / créditos), and a
  `TrendBars` strip labeled "Ingresos · últimos 6 meses".
- **Subscriptions block**: tiles active/expired/canceled + a "% con nutrición" tile.
- **Credits block**: earned vs spent tiles + a small redemptions-by-status list.
- **Quality block**: average score tile + rated count + a 1–5 distribution bar row.
- Loading: per-section skeleton dimming (reuse `StatTile`'s `loading` prop);
  never a full-page blocker. Empty/zero data renders zeros, not empty states.

**`frontend/app/components/admin/TrendBars.tsx`** (new) — presentational:
- Props: `data: { month: string; cop: number }[]`.
- Renders a row of vertical bars (SVG or flexbox `div`s with height %). Bar
  height = `cop / max(cop)` normalized; `max === 0` → all bars at baseline.
- Month label under each bar (short `MM` or `feb`, `mar`…). Accent = `kore-red`
  fill, track/baseline at low opacity, per design system. No chart library.

**KPI tiles**: reuse the existing `frontend/app/components/admin/StatTile.tsx`.
Do not build a parallel tile component.

**Navigation activation** (both surfaces):
- `AdminSidebar.tsx:63` → `{ key: 'reports', label: 'Reportes', href: '/admin-platform/reports', icon: ChartIcon }` (remove `soon`).
- `AdminMobileBottomNav.tsx:90` → `{ key: 'reports', label: 'Reportes', icon: ChartIcon, href: '/admin-platform/reports' }` (remove `disabled`).

## Data Flow

1. Admin opens `/admin-platform/reports` → page mounts → `fetchReport('30d')`.
2. Store `GET /api/admin/reports/?window=30d` → `AdminReportsView` → `IsAdminRole`
   gate → `reports_service.build_admin_report('30d', now())` → ORM aggregates →
   dict → `200`.
3. Store saves `data`; page renders four blocks + trend strip.
4. Admin clicks a window pill → `fetchReport(window)` → tiles refresh; trend strip
   is fixed (always last 6 months).

## Error Handling

- Non-admin (or unauthenticated) → `IsAdminRole`/`IsAuthenticated` → `403`/`401`;
  the `(app)` admin layout already guards the route by role, so this is defense
  in depth.
- Invalid `window` query param → `400 {'detail': 'Invalid window.'}`.
- Frontend fetch failure → `error` set via `extractApiError`; page shows an
  inline error line and leaves prior `data` visible if any.
- Division-by-zero guards: `with_nutrition_pct` and `average_score` both return
  `0.0` when their denominators are zero (specified above).

## Testing

**Backend** (`core_app/tests/services/test_reports_service.py`,
`core_app/tests/views/test_admin_reports_views.py`):
- `build_admin_report` golden values with a seeded fixture and a frozen `now`:
  revenue sum (payments + top-ups, only confirmed/paid), subscription status
  counts, credits earned/spent, rating average + distribution. One test per
  group to keep assertions focused.
- Window boundary: a row just inside vs just outside the `30d` bound is
  included/excluded correctly.
- Zero-data edges: `with_nutrition_pct == 0.0` when no active subs;
  `average_score == 0.0` when no ratings.
- `resolve_since('all', now) is None`; unknown window raises `ValueError`.
- View: admin gets `200` with the expected keys; non-admin gets `403`; invalid
  `?window=` gets `400`.

**Frontend unit** (Jest):
- `adminReportsStore` — `fetchReport` sets `data` on success and `error` via
  `extractApiError` on failure; switching window updates `window` and refetches.
  Mock `@/lib/services/http`.
- `TrendBars` — renders one bar per datum; all-zero data does not throw.
- `reports/page` — renders the four block headings and the window pills; mock the
  store.

**E2E** (`frontend/e2e/admin/admin-reports.spec.ts`):
- `injectAuthCookies` as admin (reuse `mockLoginAsAdmin`/admin fixture); route
  `**/api/admin/reports/**` to a canned payload; assert the revenue headline and
  block headings render; click the "90 días" pill and assert a refetch with
  `?window=90d`.
- **Flow triplet** (must change together, both versions bumped, CI
  `e2e-flow-definitions-sync` enforces): add an `admin-reports` flow to
  `frontend/e2e/flow-definitions.json` (edit by hand), `frontend/e2e/helpers/flow-tags.ts`,
  and `docs/USER_FLOW_MAP.md`.

Per project testing constraints: run only the touched slices (≤20 tests/batch,
≤3 commands/cycle); CI runs the suites on push.

## Release Docs

Add a Part 11a entry to `docs/release-july/GUIA_DE_VALIDACION.md` and
`docs/release-july/GUIA_QA_STAGING.md` (admin opens Reportes, sees KPIs, switches
window), consistent with prior parts.

## File Summary

**New:**
- `backend/core_app/services/reports_service.py`
- `backend/core_app/views/admin_reports_views.py`
- `backend/core_app/tests/services/test_reports_service.py`
- `backend/core_app/tests/views/test_admin_reports_views.py`
- `frontend/lib/stores/adminReportsStore.ts`
- `frontend/app/admin-platform/reports/page.tsx`
- `frontend/app/components/admin/TrendBars.tsx`
- `frontend/e2e/admin/admin-reports.spec.ts`
- unit tests for store / TrendBars / page

**Modified:**
- `backend/core_app/urls/api_urls.py` (route)
- `frontend/app/components/admin/AdminSidebar.tsx:63` (activate nav)
- `frontend/app/components/layouts/AdminMobileBottomNav.tsx:90` (activate nav)
- `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md` (flow triplet)
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`
