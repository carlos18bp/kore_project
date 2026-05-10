# Trainer ↔ Client Assignment — Design

**Date:** 2026-05-10
**Status:** Approved (brainstorming) — pending implementation plan
**Branch context:** `release-april-may-2026`

## Problem / Motivation

Today there is **no persistent trainer ↔ client relationship**. `TrainerClientListView`
(`backend/core_app/views/trainer_client_views.py`) derives a trainer's clients from
"any customer who has at least one booking with this trainer". Bookings, in turn, pick a
trainer client-side: `bookingStore.fetchTrainers()` sets `trainer: trainers[0]`
(`frontend/lib/stores/bookingStore.ts:231`) and `/book-session` has no trainer picker.

Consequences:
- A customer always books against `trainers[0]`. After a second `TrainerProfile`
  (`Carlos Mendoza`, id 3) was added in dev on 2026-05-05, that trainer became
  `trainers[0]` but has **no weekday `AvailabilitySlot` rows**, so `/book-session`
  generates virtual slots, the user picks one, `handleConfirm` re-fetches real slots
  for that trainer/day → `[]` → "El horario ya no está disponible. Intenta con otro."
  (`frontend/app/(app)/book-session/page.tsx:467`).
- There is no admin UI to manage which trainer owns which clients.

This feature introduces an **explicit assignment** (`User.assigned_trainer`) as the new
source of truth, an admin UI to manage it, a quick summary chart, and a client-side gate
that blocks booking until a trainer is assigned.

## Hard constraints (out of scope)

- **Do NOT modify** the slot generator (`core_app/services/slot_schedule.py`,
  `generate_slots_for_trainer`, the daily maintenance task), the `WEEKLY_SCHEDULE`
  windows, the 30-day rolling window behavior, or
  `AvailabilitySlot.Meta.constraints` (`unique_slot_window` on `(starts_at, ends_at)`).
- Slots remain per-trainer with the schedules already configured. Each trainer keeps
  its own slots.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Cardinality | One trainer per client — FK `User.assigned_trainer` → `TrainerProfile`, nullable. |
| Booking gate | Client books **only** with their assigned trainer; no trainer assigned → blocked with message. |
| "Active user" (for the chart) | Customer with ≥1 `Subscription` in status `active`. |
| Existing `my-clients` (booking-derived) | Replaced — trainer's clients = clients with `assigned_trainer = this trainer`. Stats still computed from `Booking`. |
| Backfill on deploy | Data migration: each unassigned customer gets the trainer of their most-recent `Booking`; customers who never booked stay `null`. |
| Reassignment with future bookings | Existing future bookings stay with the previous trainer; only new bookings go to the new trainer. |

## Architecture

### 1. Data model

`backend/core_app/models/user.py` — add to `User`:

```python
assigned_trainer = models.ForeignKey(
    'core_app.TrainerProfile',
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name='assigned_clients',
)
```

- Only meaningful for `role == 'customer'` (enforced in the admin serializer; not exposed
  in API output for trainers/admins as an editable field).
- `SET_NULL`: deleting a `TrainerProfile` unassigns its clients.
- Schema migration + **data migration** in the same migration file (or a paired migration):
  for each `User` with `role='customer'` and `assigned_trainer__isnull=True`, set it to
  `Booking.objects.filter(customer=u).order_by('-created_at').first().trainer` when one
  exists.

### 2. Backend API

**Assignment (edited from the customer record):**
- `PATCH /api/admin/users/<id>/` accepts `assigned_trainer_id` (int or `null`).
  - Validate: target user `role == 'customer'`; `assigned_trainer_id` references an
    existing `TrainerProfile` (or is `null`).
  - Reassigning just changes the FK. Future bookings with the previous trainer are
    untouched.
- `GET /api/admin/users/<id>/`:
  - `role == 'customer'` → response includes `assigned_trainer`: `{id, first_name,
    last_name}` or `null`.
  - `role == 'trainer'` → response includes `assigned_clients`:
    `[{id, first_name, last_name, email, active_package, is_active}]` ordered by name.

**Summary endpoint (for the chart):**
- `GET /api/admin/trainers/assignment-summary/` → admin-only →
  `{ active_customers, assigned, unassigned, per_trainer: [{trainer_id, first_name, last_name, client_count}] }`
  - `active_customers` = count of `User(role=customer)` with ≥1 `Subscription(status=active)`.
  - `assigned` / `unassigned` = of those, how many have / don't have `assigned_trainer`.
  - `client_count` per trainer = count of `assigned_clients`.

**Auth profile:**
- `GET /api/auth/profile/` — add `assigned_trainer` as a nested object
  `{id, first_name, last_name, location, session_duration_minutes}` or `null`.

**Trainer's clients:**
- `TrainerClientListView` (`GET /api/trainer/my-clients/`): change the `customer_ids`
  source from "has bookings with this trainer" to `User.objects.filter(
  assigned_trainer=trainer_profile, role=customer)`. The per-client stats
  (`total_sessions`, `completed_sessions`, `last_session_date`, `active_package`,
  `sessions_remaining`) are still computed from `Booking` / `Subscription` as today.

**Booking gate** (`BookingSerializer.validate()` and/or `BookingViewSet.create` /
`serializer.create`):
- If the customer's `assigned_trainer is None` → `serializers.ValidationError` carrying
  an identifiable code, e.g. `{'detail': 'Aún no puedes agendar...', 'code':
  'no_trainer_assigned'}` → HTTP 400.
- If the customer has an assigned trainer:
  - On create, force `validated_data['trainer'] = customer.assigned_trainer`.
  - Require `slot.trainer_id == customer.assigned_trainer_id`; otherwise
    `ValidationError({'slot_id': 'Ese horario no es de tu entrenador.'})`.
- The reschedule action gets the same trainer/slot consistency check.
- Guest bookings (`_maybe_create_guest_booking`): unchanged — the guest piggybacks on
  the host's slot/trainer; the gate applies to the host (the one who initiated).

### 3. Frontend

**`admin/users` — "Entrenadores" filter** (`app/admin/users/UsersListClient.tsx`):
- When `filters.role === 'trainer'`, render a summary card above the list (same visual
  language as the existing stat cards): "Clientes activos: N · Con entrenador: M · Sin
  entrenador: K" with a proportion bar (`assigned` vs `unassigned`). Data from
  `assignment-summary/` (new method on the admin user store, fetched when the filter
  becomes `trainer`).
- Each trainer row shows a badge with its `client_count`.

**`admin/users/[id]` — trainer detail** (`app/admin/users/[id]/...`):
- New section "Clientes asignados (M)": list of assigned customers (name, email, link to
  `/admin/users/<id>`), each with a "Quitar" action (PATCH that customer's
  `assigned_trainer_id` to `null`).
- "Asignar cliente" button → opens a picker that searches customers and, on select,
  PATCHes `/api/admin/users/<customer_id>/` with `assigned_trainer_id = <this trainer>`.

**`admin/users/[id]` — customer detail:**
- New field "Entrenador asignado": `<select>` of trainers + "Sin asignar"; on change,
  PATCH `/api/admin/users/<id>/` with `assigned_trainer_id`.

**`/book-session`** (`app/(app)/book-session/page.tsx`, `lib/stores/bookingStore.ts`,
auth store):
- The auth profile now carries `assigned_trainer`. If it's `null` → render an
  empty-state card instead of the calendar:
  **"Aún no puedes agendar. Espera a que te asignen un entrenador."**
- If it's set → use it as the `trainer` for the booking flow. `bookingStore` stops
  defaulting to `trainers[0]`; the `/api/trainers/` call is no longer needed on this
  page (the trainer object comes from the profile). The rest of the flow (virtual slot
  generation → resolution → `createBooking`) is unchanged. This fixes the "El horario ya
  no está disponible" bug as a side effect.
- Defensive: if `createBooking` returns the `no_trainer_assigned` code, show the same
  message.
- Reschedule flow: unchanged (the booking already has a trainer).

### 4. Error handling

- Admin PATCH with an invalid `assigned_trainer_id` or on a non-customer → 400 with a
  clear field error.
- Booking without an assigned trainer → 400 `no_trainer_assigned`; the frontend maps
  that to the user-facing message.
- Booking against a slot whose trainer ≠ assigned trainer → 400; in practice the UI
  won't allow it (it only shows the assigned trainer's slots), but the backend enforces.

### 5. Testing (minimal slices)

Backend (`pytest`, focused files only, ≤20 tests/batch):
- Data migration backfill (most-recent booking's trainer; never-booked → null).
- Booking gate: no trainer → 400 `no_trainer_assigned`; with trainer → 201 and
  `booking.trainer == assigned_trainer`; slot of another trainer → 400.
- `PATCH /api/admin/users/<id>/` assigns / reassigns / clears; rejects non-customer and
  bad ids.
- `GET /api/trainer/my-clients/` returns assigned clients (not booking-derived).
- `GET /api/admin/trainers/assignment-summary/` counts active/assigned/unassigned and
  `per_trainer` correctly.

Frontend (Jest / Playwright, smallest slice):
- `/book-session` renders the gate message when `assigned_trainer` is `null`.
- Admin customer detail PATCHes `assigned_trainer_id` on select change.
- Trainers summary card renders from mock data.

## Files expected to change (indicative)

Backend:
- `core_app/models/user.py` (+ new migration with data migration)
- `core_app/serializers/admin_user_serializers.py`
- `core_app/views/admin_user_views.py` (detail payload + summary action/endpoint)
- `core_app/urls.py` (summary endpoint if not an action)
- `core_app/serializers/*profile*` / auth profile view — add `assigned_trainer`
- `core_app/views/trainer_client_views.py`
- `core_app/serializers/booking_serializers.py` and/or `core_app/views/booking_views.py`
- New tests under `core_app/tests/...`

Frontend:
- `lib/stores/bookingStore.ts`, `lib/stores/authStore.ts` (or wherever the profile type lives)
- `lib/stores/adminUserStore.ts` (summary fetch, assign action)
- `app/admin/users/UsersListClient.tsx`
- `app/admin/users/[id]/...` (trainer + customer detail)
- `app/(app)/book-session/page.tsx`
- i18n strings (`next-intl` ES/EN) for the new user-facing text
- New/updated unit + E2E tests

## Explicitly NOT touched

- `core_app/services/slot_schedule.py`, `WEEKLY_SCHEDULE`, the daily slot-maintenance
  task, the 30-day rolling window, `AvailabilitySlot.Meta.constraints`.
- Existing migrations.
- Wompi / billing / evaluations / KORE index.
