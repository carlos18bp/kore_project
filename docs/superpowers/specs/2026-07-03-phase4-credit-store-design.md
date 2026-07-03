# Design — Phase 2 Part 4: Internal Credit Store

Date: 2026-07-03
Branch: `feat/03072026-phase4-credit-store` (off `july-release`, includes PRs #44/#46/#47/#48)
Roadmap: `docs/release-july/README.md` (Part 4 of 7)

## Goal

Where credits finally get spent: a client-facing catalog of redeemable items,
one-click redemption against approved credits, and trainer management of the
catalog and of redemption fulfillment. Plus the balance floor-at-0 decision.

## Decisions (confirmed with product owner)

1. **Redeem immediately with approved (confirmed) credits only.** Pending
   credits do NOT count toward purchasing power. On redemption the spend is
   immediate and atomic: verify sufficient confirmed balance, then create a
   negative `redemption` ledger entry (confirmed). No funds → no redemption.
2. **Balance floors at 0.** Redemptions require funds. Penalties (no-show,
   late-reschedule) clamp to the available balance — a penalty larger than the
   balance only debits down to 0, and the ledger records the clamped amount so
   the wallet and ledger stay consistent (`reconcile_credit_wallets` stays
   correct). Clients never see a negative balance or "owe" credits.
3. **Items are unlimited** — no stock control. Whatever is published and active
   can be redeemed anytime.
4. **Trainer role = fulfillment, not payment approval.** Since credits are
   already deducted at redemption, the trainer sees each redemption and marks it
   **Entregado** (fulfilled) or **Rechazado** (rejected → automatic refund).
   Both notify the client via `TrainerMessage`.
5. **`/mis-creditos` shows the split explicitly**: "Disponibles" (confirmed,
   spendable) and "Por aprobar" (pending) — so clients know how many credits are
   still to be recognized. Plus a "Mis canjes" section with each request's state.

## Backend (additive, on the existing engine)

**Models** (`models/store.py`, both inherit `TimestampedModel`):
- `StoreItem`: `name`, `description`, `image` (`ImageField(upload_to='store_items/')`),
  `price_credits` (PositiveIntegerField), `item_type` (`servicio | producto |
  sesion_adicional | descuento`), `is_active` (bool, db_index). No stock.
- `RedemptionRequest`: `customer` FK, `item` FK (PROTECT), `credits_spent`
  (PositiveIntegerField — price snapshot at redemption), `status`
  (`pending | fulfilled | rejected`, default pending), `trainer_note` (blank),
  `resolved_by` FK nullable, `resolved_at` nullable.

**Ledger**: add `CreditTransaction.Action.REDEMPTION = 'redemption'` and
`REDEMPTION_REFUND = 'redemption_refund'`. A redemption references
`('redemption', 'redemption_request', <request.pk>)`; a refund references
`('redemption_refund', 'redemption_request', <request.pk>)` — both idempotent
via the existing unique constraint.

**`credit_engine`** additions:
- `spend(customer, amount, reference_type, reference_id, description) -> CreditTransaction | None`:
  under `transaction.atomic()` + `select_for_update()` on the wallet, verify
  `balance >= amount` (else return None), then create a confirmed negative ledger
  entry and apply it. Guarantees balance never goes below 0 for spends.
- `apply_penalty(customer, action, reference_type, reference_id, description) -> CreditTransaction | None`:
  clamps the penalty to the available balance (`effective = min(preset_magnitude,
  balance)`; if 0 → None), records the clamped negative amount. The Part 1 penalty
  call sites (`record_attendance` no-show, `on_reschedule`, day-close no-show)
  switch from `award(no_show_penalty, ...)` to `apply_penalty(...)`. The no-show
  **reversal** logic reads the actually-recorded penalty amount (already does).
- `refund_redemption(request, reviewer, note) -> bool`: on trainer rejection,
  award a positive `redemption_refund` for `request.credits_spent`, set the
  request `rejected` + note + resolved fields.

**Views** (`views/store_views.py`):
- `StoreItemViewSet` (ModelViewSet, `IsTrainerRole`) — trainer/admin CRUD;
  molde `PhysicalTestViewSet`. `perform_create` saves as-is (catalog is global,
  not per-client). Image via write `ImageField` + the existing compression
  validator (`nutrition_daily_serializers.py:128-137`).
- `StoreCatalogView` (APIView, `IsAuthenticated`) — `GET /api/store/items/`:
  active items with absolute `image_url`, plus the caller's confirmed +
  pending balance (so the catalog can gate the redeem button).
- `RedemptionView` (APIView, `IsAuthenticated`):
  - `POST /api/store/redemptions/` `{item_id}` — validates active item + funds;
    creates `RedemptionRequest(pending)` and calls `spend(...)` in one atomic
    block; 400 with a clear message if insufficient funds.
  - `GET /api/store/redemptions/` — the caller's own redemptions, newest first.
- `TrainerRedemptionView` (APIView, `IsTrainerRole`):
  - `GET /api/trainer/store/redemptions/` — pending redemptions of the trainer's
    assigned clients (scoped via `customer__assigned_trainer`), with item + client
    info and `image_url`.
  - `POST /api/trainer/store/redemptions/<int:pk>/review/`
    `{decision: fulfill | reject, note?}` — `fulfill` sets `fulfilled` + notifies;
    `reject` calls `refund_redemption` + notifies. Idempotent (already-resolved →
    400).

**Notifications**: on fulfill/reject, create a `TrainerMessage`
(`trigger_type='manual'`, `trigger_ref_id=request.pk`, message in Spanish) so the
client sees it in their existing trainer-messages surface.

**Admin**: register `StoreItemAdmin` (molde `MealSuggestionAdmin`) so Germán can
also manage the catalog from Django admin.

**Migration**: `0060_store_item_redemption_request` (models + the two new Action
choices).

## Frontend

**`storeStore`** (`lib/stores/storeStore.ts`): `fetchCatalog()` (items +
balances), `redeem(itemId)`, `fetchMyRedemptions()`, and for the trainer
`fetchPendingRedemptions()`, `reviewRedemption(pk, decision, note?)`.

**Client — `/tienda`** (`app/(app)/tienda/page.tsx`): balance header
("Disponibles" confirmed), grid of `StoreItemCard` (image, name, description,
price chip, "Canjear" button disabled when `confirmed < price`), a confirm
dialog, and success/error feedback (inline). Redeeming refreshes the wallet.

**Client — `/mis-creditos`**: split the balance into two figures —
**Disponibles** (confirmed) and **Por aprobar** (pending) — and add a "Mis
canjes" list (item, date, status badge: pendiente/entregado/rechazado).

**Trainer** (in the trainer client-management area): a catalog management view
(list/create/edit/deactivate items with image upload) and a redemptions inbox
(pending requests with Entregar / Rechazar + note).

**Navigation**: "Tienda" link in the client sidebar (near "Mis créditos") and the
mobile bottom-nav "Más"; trainer entry in the trainer nav.

## Testing

- Backend: `spend` (funds check, floors at 0, idempotent), `apply_penalty`
  clamp (penalty > balance → down to 0, records clamped; the no-show reversal
  still nets correctly), redemption POST (success, insufficient funds),
  trainer review fulfill/reject-with-refund + TrainerMessage created, catalog
  CRUD scoping/permissions. `frozen_now` where time matters.
- Jest: `storeStore` (redeem success/insufficient, redemptions append), store
  card states, mis-creditos split.
- Playwright: client `tienda` (redeem happy path + disabled when short),
  mis-creditos split + canjes list, trainer catalog CRUD + redemption review.
- Flow triplet v1.1.0 (+`customer-store`, `trainer-store-management`); validation
  guide gains Parte 4; QA staging guide gains store seed records.

## Out of scope

Post-session rating (Part 5), trainer difficulty simulator / credits-per-client
/ meal-photo review calendar (Part 6), analytics/KPIs (Part 7). Mixed payment
(credits + money) and electronic invoicing are unselected additional modules.
Stock/inventory is explicitly excluded (items are unlimited).
