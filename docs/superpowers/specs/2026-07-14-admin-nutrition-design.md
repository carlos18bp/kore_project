# Admin Nutrition Management — Design Spec

**Date:** 2026-07-14
**Phase:** Fase 2 — Gap #2
**Branch:** `feat/14072026-admin-nutrition`

## Problem

Nutrition is a paid add-on, but neither of the two levers that control it is reachable from the frontend admin panel:

- `Package.includes_nutrition` exists on the model but is **absent from `PackageSerializer.fields`**, so the admin panel can neither read nor write it.
- `NutritionProduct` (the single active row holding the add-on's monthly price) has **no API at all** — it lives only in `core_app/admin.py`.

Today an operator has to open the Django admin to change either one. Its price feeds `nutrition_surcharge()`, which drives both the daily recurring-billing task and the prorated Wompi upgrade.

## Goal

Manage both levers from `/admin-platform/nutricion`, without changing billing logic.

## Backend

### 1. Expose `includes_nutrition` on `PackageSerializer`

Add the field to `PackageSerializer.Meta.fields`. No new endpoint: `PackageViewSet` already serves `PATCH /api/packages/{id}/` with admin-only write permission, and the public catalog gains the flag as a read field.

### 2. Nutrition-product singleton endpoint

`GET` / `PATCH` `/api/admin/nutrition-product/`, an `APIView` with `IsAdminUser` — matching the style of the other standalone admin views (e.g. `admin/trainers/assignment-summary/`).

- `NutritionProductSerializer` exposes `id`, `name`, `price_cop`, `is_active`.
- **Singleton semantics:** `GET` returns the active row; if none exists it is created with a default. `PATCH` updates that row.
- `price_cop` is a whole-COP positive integer, validated by the serializer.

### 3. Impact count on `GET`

The `GET` payload includes `active_nutrition_subscriptions`: the number of `Subscription` rows with `status=ACTIVE` and `includes_nutrition=True`. It is a derived `count()`, not a model field, and it feeds the UI's confirmation dialog.

**Why it matters:** `nutrition_surcharge()` reads the active price *at charge time*, so editing it changes what every nutrition subscriber pays on their next renewal. The count makes that blast radius visible before the operator commits.

## Frontend

### Store

`lib/stores/adminNutritionStore.ts` — `fetchProduct()` and `updateProduct({ price_cop, is_active })`. Packages keep using the existing `adminPackageStore.updatePackage`; no duplicated state.

### Page `/admin-platform/nutricion`

Follows the plans pattern: a thin `page.tsx` rendering a `NutritionAdminClient.tsx`.

- **Block 1 — Add-on Nutrición:** monthly COP price plus an active/inactive toggle. If the price changed, saving opens a confirmation dialog: *"Esto cambiará el cobro de N suscripciones activas en su próxima renovación."* The value cannot be saved without confirming.
- **Block 2 — Planes que incluyen nutrición:** the package list with a per-row `includes_nutrition` switch that issues `PATCH /packages/{id}/`. This spares the operator from opening each plan's modal.

### Navigation

A "Nutrición" entry in `AdminSidebar` and in `AdminMobileBottomNav`.

## Tests

- **Backend:** the endpoint returns and lazily creates the singleton; a non-admin gets 403; `PATCH` persists the price; `includes_nutrition` round-trips through `PackageSerializer`.
- **Frontend:** store tests (fetch, update, error path) and an E2E spec for the `admin-nutrition` flow, with its triplet updated (`e2e/flow-definitions.json`, `e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`).

## Out of scope

- Freezing the nutrition price per subscription (grandfathering). Rejected: it needs a migration plus changes to recurring billing and the prorated upgrade.
- A read-only table of purchased `NutritionUpgrade` rows.
- Any change to `nutrition_surcharge()` or the recurring-billing task.
