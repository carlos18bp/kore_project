# Part 7 — Buy Credits with Money (Wompi) — Design

**Status:** approved (brainstorming), pending plan.
**Parent branch:** `july-release`. Branch: `feat/07072026-phase7-credit-topup` (based on `july-release`, includes Parts 4–6).

## Goal

Let a client buy credits with real money through Wompi. When the payment is
confirmed (webhook APPROVED), the purchased credits are added to the wallet as
**confirmed** (no trainer approval), and marked with a dedicated ledger action so
purchased credits are distinguishable from earned ones for analytics.

## Key decisions (from brainstorming)

- **Admin-configured catalog** of credit packages (name, credits, COP price). No free amount.
- **No cap** on purchases. Origin is marked via a dedicated ledger action `PURCHASE` (analytics only, no hard limit).
- **Separate `CreditPurchase` model** — not the subscription `PaymentIntent`. Wompi treats one-time purchases differently from recurring subscriptions (no payment source/token), so the credit path stays isolated and the subscription payment path is untouched.
- Payment methods: reuse the existing **one-time** Wompi checkout (the same mechanism a subscription's initial charge uses), no recurrence.
- Credits from a purchase are **CONFIRMED** immediately (real money paid).

## Scope

In scope: `CreditPackage`, `CreditPurchase`, `Action.PURCHASE`; purchase-initiation endpoint (reference + integrity signature); webhook branch that awards credits idempotently; client catalog endpoint; frontend buy flow.

Out of scope: buying training/nutrition packs with money (Part 8); any change to the subscription payment path; refunds of purchased credits.

## 1. Data model

- **`CreditPackage`** (`core_app/models/credit_package.py`, `TimestampedModel`): `name` (char), `credits` (`PositiveIntegerField`), `price_cop` (`PositiveIntegerField`, whole COP), `is_active` (`BooleanField`, db_index). Managed in Django admin.
- **`CreditPurchase`** (`core_app/models/credit_purchase.py`, `TimestampedModel`):
  - `customer` FK → user, `related_name='credit_purchases'`.
  - `credit_package` FK → `CreditPackage`, `on_delete=PROTECT`.
  - `credits` (`PositiveIntegerField`) and `amount_cop` (`PositiveIntegerField`) — snapshots at purchase time (so later price/credit changes don't alter history).
  - `reference` (`CharField`, unique, db_index) — Wompi payment reference. Uses a distinct prefix (e.g. `CR-<generated>`) so the webhook routes credit purchases deterministically vs subscription references.
  - `wompi_transaction_id` (`CharField`, blank).
  - `status` (`pending | approved | declined`, default pending, db_index).
  - `resolved_at` (`DateTimeField`, null).
- **Ledger action**: add `CreditTransaction.Action.PURCHASE = 'purchase'`. Purchased credits reference `('purchase', 'credit_purchase', <purchase.pk>)`.

Migration adds the two models + the action.

## 2. Purchase flow + credit award

**Initiate** — `POST /api/credits/purchases/` (`IsAuthenticated`) `{credit_package_id}`:
- validate the package is active; create `CreditPurchase(customer, credit_package, credits=pkg.credits, amount_cop=pkg.price_cop, reference=generate_reference(), status=pending)`.
- compute `amount_in_cents = amount_cop * 100`.
- return `{ reference, amount_in_cents, currency: 'COP', signature }` where `signature = generate_integrity_signature(reference, amount_in_cents, 'COP')` (reuse `wompi_service`). The frontend drives the Wompi one-time checkout with these.

**Confirm (source of truth = webhook)** — extend `wompi_webhook` (`core_app/views/wompi_views.py`):
- it already verifies the event checksum and handles `transaction.updated`.
- add a dispatch: resolve the transaction's `reference`. If it belongs to a `PaymentIntent` → existing subscription handling (unchanged). Else if it belongs to a `CreditPurchase` → handle the credit branch:
  - if `CreditPurchase.status != pending` → no-op (idempotent guard).
  - on `APPROVED`: set `status=approved`, `wompi_transaction_id`, `resolved_at=now`; then `credit_engine.award(customer, CreditTransaction.Action.PURCHASE, 'credit_purchase', purchase.pk, f'Compraste {purchase.credits} créditos', amount=purchase.credits)` with **confirmed** status. `award` is idempotent on `(customer, action, reference_type, reference_id)`, so a duplicate webhook is a no-op.
  - on `DECLINED`/`ERROR`/`VOIDED`: set `status=declined`, no credit awarded.

**Status polling (optional convenience)** — `GET /api/credits/purchases/<reference>/` returns the purchase status so the frontend can reflect completion; the webhook remains the authority.

## 3. Catalog

- Admin manages `CreditPackage` in Django admin (register with list display of name/credits/price/active).
- `GET /api/credits/packages/` (`IsAuthenticated`) → active packages `[{id, name, credits, price_cop}]`.

## 4. Frontend

- **`/mis-creditos`**: a "Comprar créditos" button near the balance → route `/comprar-creditos`.
- **`/comprar-creditos`** (`(app)` page, dashboard padding pattern, no `max-w-*`): grid of `CreditPackage` cards (credits + COP price + "Comprar"). Selecting one calls `startCreditPurchase(packageId)`.
- **Zustand store** (`creditPurchaseStore`): `fetchCreditPackages()`, `startCreditPurchase(packageId)` (initiates the purchase, launches the Wompi one-time checkout with the returned reference/signature), and `pollPurchaseStatus(reference)` reusing the existing payment-status polling pattern.
- On approval: refresh the wallet (`useWalletStore` balance rises) and show a success state.
- The purchase appears in the Mis créditos **history** as a positive movement ("Compraste N créditos") — the existing transaction row rendering handles it (positive = sage).

## 5. Error handling

- Inactive/unknown package on initiate → `400`.
- Duplicate webhook → no-op (idempotent).
- DECLINED/ERROR/VOIDED → purchase `declined`, no credits, frontend shows a failure state.
- Checksum-invalid webhook → rejected (existing behavior).

## 6. Analytics

The `PURCHASE` ledger action cleanly separates purchased from earned credits
(`CreditTransaction.objects.filter(action='purchase')`), the foundation for the
earned-vs-bought KPIs in the later analytics part.

## 7. Testing

- **Models**: `CreditPackage` fields; `CreditPurchase` snapshot + statuses.
- **Initiate**: `POST /credits/purchases/` returns reference + signature + amount_in_cents; creates a pending purchase; inactive package → 400.
- **Webhook credit branch**: APPROVED awards `credits` confirmed credits with action `PURCHASE`; a second identical webhook awards nothing more (idempotent); DECLINED awards nothing; a subscription `PaymentIntent` reference still resolves via the unchanged path.
- **Catalog**: `GET /credits/packages/` returns only active packages.
- **Frontend unit**: `creditPurchaseStore.fetchCreditPackages` populates packages; `startCreditPurchase` posts the package id.
- **E2E**: `/comprar-creditos` lists packages and starts a purchase (Wompi checkout mocked). Flow triplet **v1.4.0** (`customer-buy-credits`); guides (Validación Parte 7, QA staging seed + route).

## File structure (units)

| File | Responsibility |
|---|---|
| `models/credit_package.py`, `models/credit_purchase.py` + migration | catalog + purchase records; `Action.PURCHASE` |
| `serializers/credit_purchase_serializers.py` | package + purchase serializers |
| `views/credit_purchase_views.py` | initiate purchase, list packages, status |
| `views/wompi_views.py` | webhook branch: award credits on APPROVED (idempotent) |
| `admin.py` | register `CreditPackage` (+ read-only `CreditPurchase`) |
| frontend `creditPurchaseStore` + `/comprar-creditos` + `/mis-creditos` button | catalog, checkout, status, wallet refresh |
| e2e + flow triplet + guides | coverage + docs |
