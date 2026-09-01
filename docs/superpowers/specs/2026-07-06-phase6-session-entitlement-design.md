# Part 6 — Session Entitlement (sesión adicional) — Design

**Status:** approved (brainstorming), pending plan.
**Parent branch:** `july-release`. Branch: `feat/06072026-phase6-session-entitlement` (based on `july-release`, which includes Parts 4–5).

## Goal

When a client redeems a `sesion_adicional` store item (credit rail, already
exists), automatically grant one or more **bookable sessions outside their plan**,
valid for **1 month**, reflected in the booking system — without trainer action
and without a delivery photo.

## Key business rule

**A user has a single subscription (their plan).** Modeling the bonus as a second
`Subscription` would break that invariant across the code and UI (subscription
list, booking gating, recurring billing). Therefore bonus sessions live in a
**separate `SessionGrant` model** — never a second `Subscription`. (See the
`project-single-subscription-rule` memory.)

## Scope

In scope: `SessionGrant` model; `StoreItem.sessions_granted`; auto-grant on
redemption of `sesion_adicional`; booking consuming a grant; client visibility of
grants; 1-month validity.

Out of scope: buying credits/packs with money (Parts 7–8); any change to how the
plan subscription works.

## 1. Data model

**`SessionGrant`** (`core_app/models/session_grant.py`, inherits `TimestampedModel`):
- `customer` FK → user, `related_name='session_grants'`.
- `sessions_total` `PositiveIntegerField`.
- `sessions_used` `PositiveIntegerField(default=0)`.
- `expires_at` `DateTimeField(db_index=True)`.
- `source_redemption` FK → `RedemptionRequest`, `null=True, blank=True, on_delete=SET_NULL`.
- `@property sessions_remaining` → `max(sessions_total - sessions_used, 0)`.
- `is_active(now=None)` → `sessions_remaining > 0 and (now or timezone.now()) < expires_at`.
- No `status` field, no `package` — usability is derived from `expires_at` + remaining (YAGNI). A customer may hold several grants (one per redemption), each with its own expiry.

**`StoreItem.sessions_granted`** `PositiveIntegerField(default=1)` — how many sessions the item grants; only meaningful for `sesion_adicional` (ignored otherwise). Enables multi-session packs. Migration adds the column.

**Validity:** exactly **1 month = 30 days** from redemption (`expires_at = now + timedelta(days=30)`). Surfaced to the user as "vencen el <date>".

## 2. Redemption → automatic grant

In the existing redeem endpoint (`RedemptionView.post`): after `credit_engine.spend()`
succeeds, if `item.item_type == 'sesion_adicional'`:
- create `SessionGrant(customer, sessions_total=item.sessions_granted, expires_at=now+30d, source_redemption=req)`;
- mark the `RedemptionRequest` **`fulfilled`** immediately (`resolved_at=now`, `resolved_by=None`) — no pending state.

Consequence: `sesion_adicional` redemptions never enter the trainer inbox
(`TrainerRedemptionView` filters `status=PENDING`) and need no delivery photo.
This supersedes the transitional manual fulfillment left in Part 5 for this type.
All in one atomic block with the spend.

## 3. Booking integration

- `Booking.session_grant` — new FK → `SessionGrant`, `null=True, blank=True, on_delete=SET_NULL`, `related_name='bookings'` (parallel to the existing nullable `subscription`). Migration adds the column.
- The booking consumes **one capacity source**: the plan `subscription` **or** a `session_grant`. The frontend sends `subscription_id` **or** `session_grant_id` (not both).
- **Serializer `validate()`**: if `session_grant` is provided → it must belong to the acting customer and be active (`sessions_remaining > 0` and not expired); else `ValidationError`. Reject if both a subscription and a grant are sent.
- **Serializer `create()`** (inside the existing `transaction.atomic()`): if `session_grant` → `select_for_update()`, re-check active, `sessions_used = F('sessions_used') + 1`, save, attach to the booking.
- **Cancel** (`BookingViewSet.cancel`): if the booking has a `session_grant` → decrement its `sessions_used` (mirror of the subscription refund path).
- `package_id` continues to be supplied by the frontend exactly as today (a bonus booking still records a package for grouping/duration; duration comes from the trainer's slot schedule via `session_window`, not the package).

## 4. Backend endpoints

- `GET /api/session-grants/` — the authenticated customer's **active** grants
  (`sessions_remaining > 0 and expires_at > now`), each with `id`,
  `sessions_remaining`, `sessions_total`, `expires_at`. New `SessionGrantSerializer`
  + a simple `ListAPIView` (`IsAuthenticated`, filtered to `request.user`).
- Booking create/cancel extended per section 3.

## 5. Frontend

- **`bookingStore`** (or a small `sessionGrantStore`): `fetchSessionGrants()` → `GET /session-grants/`; expose active grants with remaining + expiry.
- **Reservar sesión** (`/book-session`): show available bonus sessions as a selectable capacity source alongside the plan — e.g. "Sesiones adicionales: 2 · vencen el 5 ago". Booking against a grant sends `session_grant_id`.
- **`/mis-creditos → Mis canjes`**: a `sesion_adicional` redemption shows as **Entregado** with "N sesiones · vencen el <date>".
- **`/trainer/tienda`** (item form from Part 5): show a `sessions_granted` input **only when the type is `sesion_adicional`** (default 1), sent in the multipart create/edit. `StoreItemSerializer` adds `sessions_granted` to its fields.
- No `max-w-*` on any `(app)` page container (dashboard padding pattern).

## 6. Expiration

Derived from `expires_at` — the booking path rejects expired/used-up grants and
`GET /session-grants/` only returns active ones. No cleanup task (YAGNI); if a
future part needs a materialized "expired" state or analytics, add it then.

## 7. Error handling

- Booking against an expired or exhausted grant → `400` with a clear message ("Esa sesión adicional ya no está disponible.").
- A grant that is not the customer's → treated as not found / invalid (`400`).
- Sending both `subscription_id` and `session_grant_id` → `400`.
- Redeeming `sesion_adicional` with insufficient credits → unchanged (existing 400 from `spend`).

## 8. Testing

- **Model**: `sessions_remaining` floors at 0; `is_active` true only when remaining>0 and not expired.
- **Redemption**: redeeming `sesion_adicional` creates a `SessionGrant` with `sessions_total == item.sessions_granted`, `expires_at ≈ now+30d`, `source_redemption` set, and the `RedemptionRequest` is `fulfilled` (not pending → absent from the trainer inbox).
- **Booking**: booking against an active grant increments `sessions_used`; an expired grant → 400; cancel decrements `sessions_used`; both-sources → 400.
- **Endpoint**: `GET /session-grants/` returns only active grants for the caller.
- **Frontend unit**: store `fetchSessionGrants` populates grants.
- **E2E**: redeem a `sesion_adicional` → grant visible → book a session using it. Flow triplet **v1.3.0**; guides (Validación Parte 6, QA staging seed + route).

## File structure (units)

| File | Responsibility |
|---|---|
| `models/session_grant.py` + migration | `SessionGrant`; `StoreItem.sessions_granted`; `Booking.session_grant` |
| `serializers/session_grant_serializers.py` | `SessionGrantSerializer` |
| `views/session_grant_views.py` | `GET /session-grants/` |
| `serializers/store_serializers.py` | expose `sessions_granted` on `StoreItem` |
| `views/store_views.py` (`RedemptionView`) | auto-create grant + auto-fulfill for `sesion_adicional` |
| `serializers/booking_serializers.py` + `views/booking_views.py` | consume/refund a grant |
| frontend `bookingStore` + `/book-session` + `/mis-creditos` | fetch/select grants, show expiry |
| e2e + flow triplet + guides | coverage + docs |
