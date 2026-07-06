# Part 5 — Store Enrichment (credit rail) — Design

**Status:** approved (brainstorming), pending plan.
**Parent branch:** `july-release`. Stacked on Part 4 (`feat/03072026-phase4-credit-store`, PR #51) until it merges; then rebased onto `july-release`.

## Goal

Enrich the internal credit store (Part 4) so trainers manage item media from
their own UI and prove delivery of physical/service redemptions with a photo the
client can see. This is the first of four store sub-projects; it touches only the
**credit rail** (no Wompi) and is additive on the Part 4 models/views/pages.

## Scope

In scope:
1. **Item media management from the trainer UI** — create *and* edit `StoreItem`
   with image (multipart), title, description, price, type.
2. **Delivery-verification photo** — when a trainer marks a `producto`/`servicio`
   redemption **Entregado**, a photo is **required**; the client sees it in
   "Mis canjes".
3. **Remove the `descuento` item type.**

Out of scope (later sub-projects): session-adicional entitlement + booking
integration (Part 6), buying credits with money (Part 7), buying packs with money
(Part 8).

## Taxonomy

Behavior is decided by `item_type`, collapsed into two behavioral categories:

- **`producto` / `servicio`** — same logic: manageable media + **mandatory
  delivery photo** on fulfillment. (Two labels, one behavior.)
- **`sesion_adicional`** — manageable media, but its special auto-grant behavior
  lands in **Part 6**. In Part 5 it is still fulfilled manually like Part 4,
  **without a photo** (transitional).
- **`descuento`** — **removed.** A migration alters the choices and a defensive
  data migration remaps any existing `descuento` row → `servicio` (production is
  not expected to have any).

## Backend

### Models (`core_app/models/store.py`)
- `RedemptionRequest.delivery_photo` → `ImageField(upload_to='redemption_deliveries/', null=True, blank=True)`.
- `StoreItem.item_type` choices lose `descuento` (keep `producto`, `servicio`,
  `sesion_adicional`).

### Migrations
- One schema migration: add `delivery_photo`, alter `item_type` choices.
- One data migration: `UPDATE store_item SET item_type='servicio' WHERE item_type='descuento'` (ORM), reversible as a no-op.

### Serializers (`core_app/serializers/store_serializers.py`)
- `RedemptionRequestSerializer`: add `delivery_photo_url` (read-only
  `SerializerMethodField`, absolute URL via `request.build_absolute_uri`, `None`
  when absent). `delivery_photo` itself is set by the view, not the serializer.
- `StoreItemSerializer`: unchanged except the narrowed `item_type` choices are
  enforced by the model.

### Views (`core_app/views/store_views.py`)
- `StoreItemViewSet` (already `ModelViewSet`, `IsTrainerRole`): confirm
  `MultiPartParser`/`FormParser` so create/edit accept the image. No new logic —
  the UI (frontend) is what was missing.
- `TrainerRedemptionReviewView.post`: accept **multipart**.
  - `decision='fulfill'` on a `producto`/`servicio` item → **require**
    `delivery_photo`; if missing → `400 {"detail": "La foto de entrega es obligatoria."}`.
    Save it on `RedemptionRequest.delivery_photo`, then mark `fulfilled`.
  - `decision='fulfill'` on `sesion_adicional` → no photo (transitional to P6).
  - `decision='reject'` → unchanged (automatic refund via `refund_redemption`).
  - The existing `TrainerMessage` notification to the client is kept.

### Error handling
- Fulfill `producto`/`servicio` without photo → 400 with the message above.
- Image > 5 MB → 400. `StoreItem.image` is validated by the serializer's existing
  `validate_image` (5 MB cap). `delivery_photo` is saved in the view, so the view
  applies the same 5 MB check before saving (extract the cap into a shared
  `MAX_IMAGE_BYTES` constant reused by both paths) and returns
  `400 {"detail": "La foto no puede superar 5MB."}` when exceeded.
- Reject path and idempotency are unchanged from Part 4.

## Frontend

### `app/(app)/trainer/tienda/page.tsx`
- **Create** form becomes multipart: image + description in addition to
  name/price/type (today it sends only name/price/type as JSON). Remove the
  `descuento` option from the type selector.
- **Edit**: clicking an item opens a form pre-filled with current values —
  replace image, edit title/description/price/type, toggle `is_active`. Submits
  `PATCH` multipart to `trainer/store-items/<id>/`.
- **Redemptions inbox**: the **Entregar** action for `producto`/`servicio` opens a
  small dialog with a required file input for the delivery photo, then submits
  multipart to the review endpoint. **Rechazar** is unchanged. For
  `sesion_adicional`, Entregar submits without a photo (transitional).

### `lib/stores/storeStore.ts`
- `reviewRedemption(pk, decision, note?, deliveryPhoto?)` — build `FormData` when a
  photo is present (multipart); otherwise keep the current JSON path.
- Catalog create/edit call `api` with `FormData` directly from the page,
  following the Part 4 pattern (page owns catalog CRUD; store owns review).

### `app/(app)/mis-creditos/page.tsx` — "Mis canjes"
- When a redemption is *Entregado* and has `delivery_photo_url`, render the
  comprobante (thumbnail/link) inline in its row.

## Testing

- **Backend** (`tests/views/test_store_views.py`, `tests/models/…`):
  - Edit an item with a new image (multipart) persists.
  - Remove-`descuento` migration: a `descuento` row is remapped to `servicio`.
  - Fulfill `producto`/`servicio` **without** photo → 400; **with** photo → 200 and
    `delivery_photo` saved.
  - Fulfill `sesion_adicional` without photo → 200.
  - `delivery_photo_url` present in `RedemptionRequestSerializer` output.
- **Frontend unit** (`app/__tests__/stores/storeStore.test.ts`):
  - `reviewRedemption` sends `FormData` when a photo is passed.
- **E2E** (`e2e/trainer/trainer-tienda.spec.ts`, `e2e/app/mis-creditos.spec.ts`):
  - Trainer edits an existing item.
  - Trainer fulfills a `producto` by uploading a photo.
  - Client sees the comprobante in "Mis canjes".
  - Update the flow triplet to **v1.2.0** and the guides
    (`GUIA_DE_VALIDACION.md` Part 5, `GUIA_QA_STAGING.md` delivery-photo route).

## File structure (units touched)

| File | Responsibility |
|---|---|
| `models/store.py` + migrations | `delivery_photo` field, `item_type` without `descuento` |
| `serializers/store_serializers.py` | expose `delivery_photo_url` |
| `views/store_views.py` | review endpoint: multipart + mandatory photo for producto/servicio |
| `trainer/tienda/page.tsx` | item create/edit with image; delivery-photo dialog on Entregar |
| `lib/stores/storeStore.ts` | multipart `reviewRedemption` |
| `mis-creditos/page.tsx` | show comprobante in Mis canjes |
| e2e + flow triplet + guides | coverage + docs |
