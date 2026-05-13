# Design: Admin Create / Evolve Subscription

**Date:** 2026-05-10
**Owner:** Kore Backend + Admin Frontend
**Status:** Approved (pending user review of this document)

## Problem

Admins cannot register a subscription for a customer who paid outside the Wompi web checkout (cash, transfer). Today, subscriptions are created only via:

- The customer-facing Wompi checkout (`/api/subscriptions/purchase*`) — handled automatically by webhook.
- `POST /api/subscriptions/{id}/admin-renew/` — renews an expired/canceled subscription with a hardcoded CASH payment and `is_recurring=False`.

There is no way for an admin to:

- Create a new subscription from scratch for a customer who paid in cash or by bank transfer.
- Evolve an existing active subscription to a different package (e.g., upgrade from an 8-session plan to a 12-session plan) and record the price/session delta the customer paid.

The business rule "one active subscription per customer" must be preserved.

## Decisions

The following decisions were made during brainstorming and are load-bearing for this design. Changing any of them invalidates parts of the design.

1. **Two sub-flows in one feature.** A single admin endpoint and a single admin form serve both "create new subscription" (customer has no active sub) and "evolve plan" (customer has an active sub). The form auto-detects state and changes its UX.
2. **Web payment methods are not in scope.** Wompi-handled subscriptions (CARD, NEQUI, PSE, BANCOLOMBIA_TRANSFER) flow in via the existing webhook and never enter the admin create form. The admin form's payment-method selector only offers **cash** and **transfer**.
3. **Evolution preserves dates.** When evolving, `starts_at` and `expires_at` are not changed. The customer does not gain new validity days from an upgrade.
4. **Evolution preserves `sessions_used`.** Total sessions become the new package's `sessions_count`; sessions already used are kept; remaining is recomputed.
5. **Evolution preserves `is_recurring` and `payment_method_type`** of the existing subscription. The recorded delta payment does not change whether the subscription auto-renews. If the customer had Wompi card auto-renewal, they keep it (at the new plan's price on the next cycle).
6. **Downgrade is blocked.** An evolve attempt where the new package has a lower price *or* fewer sessions than the current package returns `400`. If the admin needs to downgrade, they cancel the current subscription first and create a new one.
7. **Admin form is reachable from two places.** A button on `/admin/users/{id}` (deep-links to the form with the customer pre-selected) and a button on `/admin/subscriptions` (form with empty customer selector). Both go to a dedicated page, not a modal.

## Scope

### In scope

- New DB choice: `TRANSFER` on `Payment.PaymentProvider`.
- New backend endpoint: `POST /api/subscriptions/admin-create/` with `action: create | evolve`.
- New backend serializer(s) and service-layer function.
- New admin frontend page `/admin/subscriptions/new` with customer/package selectors and computed delta UI.
- Buttons on `/admin/users/{id}` and `/admin/subscriptions` linking to the new page.
- Backend pytest coverage for both flows plus the 409/400 error paths.
- Minimal frontend unit tests + one Playwright E2E happy path.

### Out of scope (explicit)

- Creating duo (semi-personalizado guest) subscriptions from admin.
- Subscriptions with future `starts_at` (the system has no PENDING status; subs created with future dates are still ACTIVE).
- Refunds, credit notes, or any downgrade path.
- Editing `payment_method_type` of an existing subscription.
- Automatic email to the customer notifying admin-created subscription (can be added later).
- Cross-currency or partial-currency support; everything stays in COP per package.
- Bulk subscription creation.

## Data model

Single migration, single choice addition:

```python
# core_app/models/payment.py — PaymentProvider TextChoices
TRANSFER = 'transfer', 'Transferencia'
```

No data backfill needed. Existing rows keep their current providers.

## Backend

### Endpoint

`POST /api/subscriptions/admin-create/`

Permissions: `IsAuthenticated` + `IsAdminRole` (same chain used by `AdminUserViewSet`).

Request body:

```json
{
  "action": "create" | "evolve",
  "customer_id": <int>,
  "package_id": <int>,
  "payment_method": "cash" | "transfer",
  "starts_at": "<ISO date>",
  "expires_at": "<ISO date>",
  "sessions_used": <int>,
  "notes": "<string, optional>"
}
```

`starts_at`, `expires_at`, and `sessions_used` are **only required when `action=create`** and are ignored if sent with `action=evolve`. `notes` is optional in both flows and persisted on the resulting `Payment` record.

Response: `201 Created` for `create`; `200 OK` for `evolve`. Both return the subscription serialized via `AdminSubscriptionSerializer`.

### Error contract

- `400` — validation error (missing fields, invalid dates, `sessions_used > package.sessions_count`, downgrade attempt, inactive package, non-existent customer/package).
- `403` — non-admin caller.
- `409` — action mismatches customer state. Body: `{"detail": "...", "expected_action": "create" | "evolve"}`. The frontend can show a confirm dialog and re-submit with the corrected action.

### Validation rules

For both actions:

- `customer` must exist, be `is_active=True`, and have `role='customer'`.
- `package` must exist and be `is_active=True`.
- `payment_method` must be `cash` or `transfer`.

For `action=create`:

- Customer must have **zero** subscriptions with `status='active'`.
- `starts_at <= expires_at`.
- `0 <= sessions_used <= package.sessions_count`.

For `action=evolve`:

- Customer must have **exactly one** subscription with `status='active'`.
- `new_package.price > current.package.price` AND `new_package.sessions_count > current.sessions_total`. Both must hold; the error message names which check failed first to help the admin understand.

### Service layer

A new module `core_app/services/admin_subscription_service.py` exposes two functions:

```python
def create_subscription_for_admin(
    *, customer, package, payment_method, starts_at, expires_at,
    sessions_used, notes, actor,
) -> Subscription: ...

def evolve_subscription_for_admin(
    *, current_subscription, new_package, payment_method, notes, actor,
) -> Subscription: ...
```

Both functions are wrapped in `transaction.atomic()`. Both create a `Payment` row tied to the resulting `Subscription`. The `actor` parameter is accepted but not persisted — `Payment` has no `recorded_by` column today and adding one is out of scope. Pass it through anyway so we can wire it to an audit log in a later pass without changing service signatures.

Keep the view thin: parse payload, route to the right service function, return serialized result.

### Resulting state — create

| Field | Value |
| --- | --- |
| `Subscription.status` | `ACTIVE` |
| `Subscription.sessions_total` | `package.sessions_count` |
| `Subscription.sessions_used` | from form |
| `Subscription.starts_at` | from form |
| `Subscription.expires_at` | from form |
| `Subscription.is_recurring` | `False` |
| `Subscription.payment_method_type` | `''` |
| `Payment.provider` | `CASH` or `TRANSFER` |
| `Payment.status` | `CONFIRMED` |
| `Payment.amount` | `package.price` |
| `Payment.notes` | from form (optional) |

### Resulting state — evolve

| Field | Behavior |
| --- | --- |
| `Subscription.package` | replaced with `new_package` |
| `Subscription.sessions_total` | `new_package.sessions_count` |
| `Subscription.sessions_used` | **preserved** |
| `Subscription.starts_at` | **preserved** |
| `Subscription.expires_at` | **preserved** |
| `Subscription.is_recurring` | **preserved** |
| `Subscription.payment_method_type` | **preserved** |
| New `Payment.amount` | `new_package.price − current.package.price` |
| New `Payment.provider` | `CASH` or `TRANSFER` |
| New `Payment.status` | `CONFIRMED` |
| New `Payment.notes` | `"Evolución de plan <A.title> → <B.title>"` + optional admin notes |

### View placement

Add the endpoint as a new `@action` on the existing `SubscriptionViewSet` in `backend/core_app/views/subscription_views.py`, next to `admin_renew`. The action signature:

```python
@action(detail=False, methods=['post'], url_path='admin-create',
        permission_classes=[IsAuthenticated, IsAdminRole])
def admin_create(self, request): ...
```

This routes to `POST /api/subscriptions/admin-create/`. We keep the URL inside the existing `subscriptions` namespace because it mutates subscription resources — co-locating with `admin_renew` makes the admin-only mutations easy to find. No new file is created and no `urls.py` change is needed beyond DRF's auto-router.

## Frontend

### New page: `/admin/subscriptions/new`

App Router page at `frontend/app/admin/subscriptions/new/page.tsx` with a client component for the form (`NewSubscriptionForm.tsx` colocated under `components/admin/`).

The page reads `customer` from `searchParams` and pre-selects the customer if present.

Form layout from top to bottom:

1. **Customer block.** If a customer is pre-selected, show their name, email, and current subscription status as a read-only card. Otherwise, show an async search input that hits `GET /api/admin/users/?role=customer&search=`.
2. **State banner.** Computed from the selected customer's subscriptions (already returned by `AdminUserDetailSerializer`):
   - No active sub → green banner: "Crearás una **suscripción nueva** para <name>."
   - Active sub → blue banner: "<name> ya tiene plan **<current.package.title>**. Esta operación es una **evolución de plan**."
3. **Package selector.** Cards grid showing each active package with: `category` chip (color-coded), `sessions_count`, `session_duration_minutes`, `price`, `validity_days`. In evolution mode, packages that would be a downgrade (lower price OR fewer sessions than current) are visually disabled with a tooltip explaining the block.
4. **Selected-package detail panel.** Once a package is selected, show all fields the user asked for:
   - Category, value (price), total sessions, session duration, validity days.
   - Sessions already used (read-only, comes from active sub if evolution; comes from the form input below if create).
   - Computed `starts_at` and `expires_at`.
   - In evolution mode, additionally: **"Diferencia a pagar: $X"** and **"Sesiones adicionales: N"**.
5. **Payment method.** Two radio options: **Efectivo** / **Transferencia**.
6. **Editable fields (create mode only).** `starts_at` (date picker, default = today), `expires_at` (date picker, default = `starts_at` + `package.validity_days`, auto-updated when package or starts_at changes), `sessions_used` (number input, default 0, max = `package.sessions_count`). In evolution mode these fields are hidden or shown read-only with the active sub's values.
7. **Notes (optional).** Free text, ≤ 250 chars.
8. **Submit.** Opens a confirm modal: "Vas a crear/evolucionar la suscripción de <customer.name>. Monto a registrar: $X. ¿Confirmas?". On confirm, calls the store action; on success, navigates to `/admin/subscriptions/{id}` and shows a toast.

### Store changes

Extend `frontend/lib/stores/adminSubscriptionStore.ts` with:

```ts
createOrEvolveSubscription(payload): Promise<Subscription>
```

It POSTs to `/api/subscriptions/admin-create/` and on `409`, re-throws an error with `expected_action` so the form can swap mode and let the user confirm.

### Entry-point buttons

- `/admin/users/[id]/...` — add a "Crear/Evolucionar suscripción" button that links to `/admin/subscriptions/new?customer={id}`. Place it near the existing user-action buttons in the user detail header.
- `/admin/subscriptions/page.tsx` — add a "Crear suscripción" primary button in the existing toolbar (next to filters), linking to `/admin/subscriptions/new`.

## Race conditions and concurrency

The `409` contract covers the realistic race: an admin opens the form for a customer with no active sub, the customer buys via Wompi in the meantime, the admin submits `action=create`, the server detects the active sub now exists and refuses. The frontend converts the error into a "this customer now has plan X; switch to evolution?" prompt.

We do not need DB-level locking. The "one active sub per customer" invariant is enforced by validation, and even a worst-case double-create would still create two Subscription rows — the existing customer-side logic (which already coexists with admin renewals) handles the case where multiple actives exist by picking the latest. We accept that tiny risk for now and revisit if logs show races.

## Testing

### Backend pytest (`backend/core_app/tests/views/test_admin_subscription_create.py`)

1. `test_admin_create_subscription_no_active_creates_new` — happy path A; asserts Subscription row + Payment row state.
2. `test_admin_create_subscription_with_active_returns_409` — wrong action; asserts response body.
3. `test_admin_create_subscription_sessions_used_exceeds_total_returns_400`.
4. `test_admin_create_subscription_inactive_package_returns_400`.
5. `test_admin_evolve_subscription_upgrades_and_charges_delta` — happy path B; asserts sessions_total, sessions_used preserved, dates preserved, Payment delta amount.
6. `test_admin_evolve_subscription_blocks_downgrade_lower_price_returns_400`.
7. `test_admin_evolve_subscription_blocks_downgrade_fewer_sessions_returns_400`.
8. `test_admin_create_subscription_non_admin_forbidden_403`.

Run only this new file during the implementation cycle. Do not run the full suite.

### Frontend Jest

1. `NewSubscriptionForm.test.tsx` — given a customer with no active sub, mode = "create"; submitting calls the store with `action=create`.
2. Given a customer with active sub, mode = "evolve"; downgrade packages are disabled; submit calls the store with `action=evolve` and delta-only amount in confirm modal.

### Playwright E2E

One spec: `frontend/e2e/admin/create-subscription.spec.ts` — login admin, navigate to `/admin/subscriptions`, click "Crear suscripción", pick a customer with no active sub, pick a package, choose Efectivo, confirm, verify the new sub appears in the list and the customer's detail page reflects it.

## Risks and mitigations

- **Wrong-action drift.** The form might submit `action=create` while the customer state shifted. Mitigated by the `409 + expected_action` contract.
- **Date-picker timezone.** Backend uses `DateTimeField` with timezone; frontend must send ISO strings with timezone. The existing `admin_renew` flow does not send dates, so there is no helper to reuse. The new form serializes via `new Date(value).toISOString()` against a date-only `<input type="date">` — confirm UTC drift behaves correctly in pytest against America/Bogotá (UTC-5), since that is the production timezone.
- **`is_recurring` semantics surprise.** If a Wompi-recurring customer evolves their plan, the next auto-charge will be at the new package's price. We accept this and document it in the confirm modal: "El cobro automático del próximo periodo será al precio del plan nuevo." (Only shown if `is_recurring=True` on the current sub.)
- **Concurrent admin actions.** Two admins create simultaneously: handled by the action validation at write time. Worst case is one of them gets `409`.
- **Audit trail.** This design does not add an explicit audit log entry for who created/evolved the subscription. The existing `Payment.notes` plus `created_at` plus `Payment` ownership give us most of what we need; a real audit log is out of scope.

## Acceptance checklist

The feature is done when:

- Admin can create a subscription for a customer who paid cash from `/admin/users/{id}`, and it shows up in `/admin/subscriptions`.
- Admin can evolve a customer's active plan from a smaller package to a larger one, the delta payment is recorded, and the new sessions are reflected on the customer's dashboard.
- Attempting to downgrade fails with a clear error and the existing subscription is untouched.
- Attempting to create when the customer already has an active sub yields a `409` and the form prompts the admin to evolve instead.
- All 8 pytest cases pass.
- The Playwright E2E happy path passes.
- The two frontend Jest tests pass.
