# Part 8 — Buy Nutrition (plan upgrade) — Design

**Status:** approved (brainstorming), pending plan.
**Parent branch:** `july-release`. Branch: `feat/07072026-phase8-buy-packs` (based on `july-release`, includes Parts 4–7).

## Goal

Make nutrition a **paid** feature. A client adds nutrition to their **current
plan** (upgrade in place, no lost sessions), paying a **prorated** amount for the
days left in the cycle; from the next renewal onward, training + nutrition are
charged as a **single combined** recurring payment. New clients can also buy a
plan that already includes nutrition.

## Key decisions (from brainstorming)

- **Paywall (retroactive):** nutrition is gated by purchase. Existing training-only clients **lose** nutrition access until they buy it (`includes_nutrition` defaults to `False` on existing subscriptions).
- **Monthly / recurring (model A):** nutrition travels with the plan — once added, every renewal charges plan + nutrition together, in one payment. Not a one-time forever purchase.
- **Prorated upgrade:** adding mid-cycle charges only `nutrition_price × (days_remaining / cycle)`.
- **Single subscription rule respected:** nutrition is an attribute of the client's one subscription (`Subscription.includes_nutrition`), not a second subscription.
- Reuse Part 7's one-time Wompi purchase pattern (purchase record + webhook branch by `reference`) for the prorated upgrade charge; reuse the existing recurring billing for the combined renewal charge.

## Scope

In scope: `Subscription.includes_nutrition` + `Package.includes_nutrition`; nutrition access gate (backend + frontend signal); admin-configured monthly nutrition price; prorated upgrade purchase (Wompi) + webhook branch; recurring-billing surcharge; frontend locked nutrition + upgrade flow.

Out of scope: canceling/removing nutrition from a plan (future); nutrition-specific content changes (the existing nutrition features are simply gated).

## 1. Access model

- **`Subscription.includes_nutrition`** (`BooleanField`, default `False`, db_index) — the real access flag on the client's subscription. Migration; existing rows stay `False` (retroactive paywall).
- **`Package.includes_nutrition`** (`BooleanField`, default `False`) — copied onto the subscription when a plan is purchased (so bundle / nutrition-only packages grant access on purchase). Set in the subscription-creation path (`_resolve_payment_intent` and the admin subscription service): `subscription.includes_nutrition = package.includes_nutrition`.
- **Access helper** (`core_app/services/nutrition_access.py`): `has_nutrition_access(user) -> bool` = the user has a `Subscription` with `status=ACTIVE` and `includes_nutrition=True`.

## 2. Price + prorated upgrade + recurring unification

- **`NutritionProduct`** (`core_app/models/nutrition_product.py`, `TimestampedModel`): `name`, `price_cop` (`PositiveIntegerField`, whole COP, monthly), `is_active`. Admin-managed; the active row holds the current monthly nutrition price. `active_nutrition_price()` helper returns the active price or `None`.
- **`NutritionUpgrade`** (`core_app/models/nutrition_upgrade.py`): `customer` FK, `subscription` FK (PROTECT), `amount_cop` (prorated snapshot), `reference` (unique, prefix `NU-`), `wompi_transaction_id`, `status` (`pending | approved | declined`), `resolved_at`.
- **Initiate** — `POST /api/nutrition/upgrade/` (`IsAuthenticated`):
  - require an **active** subscription without nutrition and an active `NutritionProduct`; else `400`.
  - compute proration: `cycle = subscription.package.validity_days`; `days_remaining = (subscription.next_billing_date - today).days` (fallback to `(subscription.expires_at.date() - today).days` when `next_billing_date` is null); clamp to `[1, cycle]`; `amount_cop = round(nutrition_price * days_remaining / cycle)`.
  - create `NutritionUpgrade(pending, amount_cop, reference='NU-'+generate_reference())`; return `{reference, checkout_url}` (Wompi Web Checkout, reuse the Part 7 URL builder with `amount_in_cents = amount_cop*100`).
- **Webhook branch** (`wompi_views._handle_transaction_updated`): add Path 1.6 — if the `reference` is a `NutritionUpgrade`, resolve it: on **APPROVED**, set the upgrade `approved` and its `subscription.includes_nutrition = True` (do not touch sessions or dates); on DECLINED/ERROR/VOIDED → `declined`. Idempotent (WompiEvent guard by txn_id + status-pending guard on the upgrade). Subscription/credit paths unchanged.
- **Recurring unification** — in `process_recurring_billing` (`core_app/tasks.py`), when `sub.includes_nutrition` and an active `NutritionProduct` exists, add the nutrition price to the charge: `amount_in_cents = int((package.price + nutrition_price) * 100)`. `apply_recurring_renewal` records the combined amount. Result: renewal is a single combined charge (training + nutrition).

## 3. Gate + frontend signal

- **Permission** `HasNutritionAccess` (`core_app/permissions.py`): allows only when `has_nutrition_access(request.user)`. Apply to the **client** nutrition routes (`my-nutrition`, `my-nutrition/<id>`, `my-nutrition-daily*`, client nutrition plan reads). Trainer nutrition routes are unchanged (trainers manage regardless). Returns `403` when locked.
- **Access signal**: expose `has_nutrition_access` to the frontend — add it to the existing profile/`me` response (or a lightweight `GET /api/nutrition/access/`). The UI reads it to lock/unlock.

## 4. Frontend

- **Mi Nutrición** (nav item + `/my-nutrition`): when `has_nutrition_access` is false, render a **locked** state — short explainer + CTA **"Agrega nutrición a tu plan"** with the prorated price → `startNutritionUpgrade()` (redirect to Wompi). On return (`?ref=NU-…`), poll status; on approval, refresh access and show the nutrition content.
- **`nutritionUpgradeStore`** (Zustand): `fetchNutritionAccess()`, `startNutritionUpgrade()` (POST → redirect to `checkout_url`), `fetchUpgradeStatus(reference)`.
- New clients: `Package.includes_nutrition` bundle / nutrition-only packages appear in the existing plan catalog (flag only; no new catalog UI). `(app)` pages use the dashboard padding pattern, never `max-w-*`.

## 5. Error handling

- Upgrade without an active subscription → `400` ("Necesitas un plan activo para agregar nutrición.").
- Upgrade when already `includes_nutrition` → `400` ("Tu plan ya incluye nutrición.").
- No active `NutritionProduct` configured → `400` ("Nutrición no disponible por ahora.").
- Locked nutrition route → `403`.
- Duplicate webhook → no-op (idempotent). DECLINED → upgrade declined, no access granted.

## 6. Testing

- **Access model**: `has_nutrition_access` true only with an active subscription flagged; a plan purchase with `package.includes_nutrition=True` sets the subscription flag.
- **Proration**: 15 of 30 days remaining → `amount_cop == round(price/2)`; full cycle → full price; clamp at cycle bounds.
- **Upgrade webhook**: APPROVED sets `subscription.includes_nutrition=True` (sessions/dates untouched); idempotent; DECLINED grants nothing; missing active subscription / already-included / no product → 400.
- **Recurring**: `process_recurring_billing` charges `package.price + nutrition_price` when `includes_nutrition`, and only `package.price` otherwise; renewal records the combined amount. Existing subscription/credit webhook paths still pass (regression).
- **Gate**: a client without access gets 403 on `my-nutrition`; with access gets 200.
- **Frontend unit**: store `fetchNutritionAccess` / `startNutritionUpgrade`.
- **E2E**: Mi Nutrición shows the locked state + CTA without access; on return from an approved upgrade it unlocks. Flow triplet **v1.5.0** (`customer-buy-nutrition`); guides (Validación Parte 8, QA staging seed + route).

## File structure (units)

| File | Responsibility |
|---|---|
| `models/nutrition_product.py`, `models/nutrition_upgrade.py` + migration | monthly price + prorated upgrade record; `Subscription.includes_nutrition`, `Package.includes_nutrition` |
| `services/nutrition_access.py` | `has_nutrition_access`, `active_nutrition_price` |
| `serializers/nutrition_upgrade_serializers.py` | upgrade status + access serializers |
| `views/nutrition_upgrade_views.py` | initiate upgrade, status, access endpoint |
| `views/wompi_views.py` | webhook branch: grant nutrition on approved upgrade |
| `tasks.py` | recurring surcharge when `includes_nutrition` |
| `permissions.py` | `HasNutritionAccess` on client nutrition routes |
| `admin.py` | register `NutritionProduct` (+ read-only `NutritionUpgrade`) |
| frontend `nutritionUpgradeStore` + `/my-nutrition` lock/upgrade | access signal, upgrade checkout |
| e2e + flow triplet + guides | coverage + docs |
