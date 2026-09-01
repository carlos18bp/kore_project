# Plan — Subscription cancel + plan change (single-membership model)

Date: 2026-07-01
Branch: `feat/01072026-subscription-cancel-downgrade` (off `july-release`)

## Context
A customer has ONE subscription that renews monthly (Netflix-style); past cycles
live as `SubscriptionRenewal` history. Admin renews manually; the customer just
gets sessions recharged. Gaps to fix:
- Admin has no proper "cancel" (only a raw status dropdown via `partial_update`).
- Plan change only allows UPGRADE; downgrade/lateral change is blocked.

## Decisions (confirmed with product owner)
- **Upgrade**: immediate — charge delta now, sessions now (keep current `evolve`).
- **Downgrade / lateral change**: scheduled for NEXT cycle. No payment/refund now.
  New price + package + sessions apply at the next renewal.
- **Cancel** (admin & customer): stop renewal, KEEP access until `expires_at`.
- **Scope**: plan change is admin-only. Customer keeps cancel only.
- **Include** the recurring-billing PENDING reconciliation fix (next-cycle apply
  depends on renewals landing correctly).

## Model changes (new migration, do not touch old ones)
- `Subscription.pending_package` → FK(Package, null=True, PROTECT) — plan scheduled
  for next renewal.
- `Subscription.cancel_at_period_end` → BooleanField(default=False) — canceled but
  active until `expires_at`.

## Validated invariants (verified in code)
- Access gating = `hasActiveSubscription` (frontend `(app)/layout.tsx`) from the
  serializer's EFFECTIVE status. `SubscriptionSerializer.get_status` already maps
  ACTIVE+`expires_at<=now` → `expired`. So cancel = `cancel_at_period_end=True` +
  keep `status=ACTIVE` preserves access until expiry, then auto-flips to expired.
- `expire_subscriptions` (cron) flips ACTIVE→EXPIRED past `expires_at` + cancels
  future bookings. Add: canceled-at-period-end → CANCELED.

## Backend work
1. **Cancel semantics** (`cancel_subscription` + admin path): set
   `cancel_at_period_end=True`, `is_recurring=False`, `next_billing_date=None`,
   keep `status=ACTIVE`. Bookings preserved. Re-renew clears the flag.
2. **Relax plan change** (`admin_create` evolve, lines ~1590-1604): by direction —
   upgrade (price greater) = immediate `evolve_subscription_for_admin`; downgrade/
   lateral (price <= current, different package) = schedule `pending_package`, no
   payment; same package still blocked.
3. **Apply scheduled change at renewal** in `_bill_subscription` (recurring task)
   AND `admin_renew`: if `pending_package` set → switch package/sessions_total,
   charge its price, clear `pending_package`, record `PLAN_CHANGE`.
4. **Expiry**: `expire_subscriptions` maps `cancel_at_period_end` → CANCELED.
5. **PENDING reconciliation fix** (separate commits): webhook Path 2 looks up the
   recurring Payment by reference (not txn id), persist txn id on the Payment, and
   advance the cycle (+ apply pending_package) when a recurring PENDING later
   approves — mirroring the APPROVED branch.
6. Serializers: add `pending_package` (nested read-only) + `cancel_at_period_end`
   to `SubscriptionSerializer` and `AdminSubscriptionSerializer`.

## Frontend work
- **Admin** (`adminSubscriptionStore` + `SubscriptionDetailPage`): add
  `cancelSubscription()` → `POST /cancel/`; add "Cancelar suscripción" for active
  subs; show pending change ("Cambiará a Y desde {next_billing_date}") with an
  option to clear it; status badge "Cancelada · activa hasta {expires_at}".
- **Admin new/evolve** (`NewSubscriptionClient`): relax `downgradeReason()` to allow
  lower/equal price; copy: upgrade "Evolucionar (inmediato)", down/lateral
  "Programar cambio (desde próximo ciclo)".
- **Customer** (`(app)/subscription/page.tsx`): cancel copy "acceso hasta {date}";
  show pending plan change read-only.

## Risks / edge cases
- If `sessions_used > pending_package.sessions_count` at apply time,
  `sessions_remaining` floors at 0. Documented, acceptable.
- Bilingual strings via next-intl for new states.
- Depends on the PENDING fix for async methods (Nequi/Bancolombia) — bundled.

## Phases
1. Model + migration.
2. Backend cancel semantics.
3. Backend plan change (relax + schedule + apply-at-renewal + expiry).
4. Backend PENDING reconciliation fix.
5. Serializers.
6. Frontend admin.
7. Frontend customer.
8. Tests per layer (CI verifies; no local suite runs).
