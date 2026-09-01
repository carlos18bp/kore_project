# Post-Session Rating — Design Spec

**Date:** 2026-07-14
**Phase:** Fase 2 — Parte 9
**Branch:** `feat/14072026-session-rating`
**Source requirement:** `docs/next_requirements/v2.md:79` (P2) and `:223`

## Problem

A session ends and nothing captures how it went. The trainer confirms attendance
(`POST /api/bookings/{id}/confirm-attendance/`, trainer-only) and the flow stops there:
the customer's satisfaction is never recorded, and the trainer's read on the customer's
effort lives only in their head.

## Goal

Both sides rate an attended session, and each side sees the other's feedback where it is
useful: the customer in a dashboard card, the trainer in the attendance dialog he already
opens, plus a summary on his dashboard.

## Model and economy

**`SessionRating`** (`core_app/models/session_rating.py`):

| Field | Type |
| --- | --- |
| `booking` | FK → `Booking`, `related_name='ratings'` |
| `rater_role` | `TextChoices` ∈ `{customer, trainer}` |
| `score` | `PositiveSmallIntegerField`, validated 1–5 |
| `comment` | `TextField(blank=True)` |
| timestamps | via `TimestampedModel` |

**`UniqueConstraint(booking, rater_role)`** is load-bearing: it makes rating idempotent and
is what prevents a customer from farming the credit twice on one session.

**Credits.** A new `session_rated` action on `CreditTransaction.Action`, added to the three
difficulty presets in `credit_engine.DIFFICULTY_PRESETS` (easy 10 / medium 5 / hard 3).
`value_for()` resolves as `action_values.get(action, preset.get(action, 0))`, so a new preset
key needs **no `CreditSettings` migration**. Only the **customer's** rating awards credits,
once per booking, confirmed immediately.

## Endpoints

### `POST /api/bookings/{id}/rate/`

An `@action` on `BookingViewSet`, authenticated. Body: `{"score": 1..5, "comment": "..."}`.

- **`rater_role` is derived from the requesting user, never read from the body.** The booking's
  customer rates as `customer`; the booking's trainer (or an admin) rates as `trainer`. Anyone
  else gets 403.
- Rejects a booking whose `attendance_status != attended` (400) — you cannot rate a session that
  did not happen.
- Rejects a duplicate `(booking, rater_role)` (400).
- On a customer rating, awards `session_rated` credits referencing the booking.

### `GET /api/bookings/pending-rating/`

Attended bookings of the requesting customer that carry no `customer` rating yet. Feeds the
dashboard card.

### `GET /api/trainer/ratings/summary/`

`{average, count, recent[]}` over the ratings **customers left on this trainer's bookings**.
Feeds the trainer's dashboard tile.

## Frontend

**Customer.** A `sessionRatingStore` (`fetchPendingRatings`, `submitRating`) and a
**"Califica tu sesión"** card on the dashboard: five stars, an optional comment, and *Omitir*.
It appears once the trainer confirms attendance and disappears once rated. Skipping leaves the
session unrated forever — no nagging.

**Trainer.** Stars and an optional comment inside the **existing confirm-attendance dialog**;
the trainer is already there, so rating costs no extra navigation and never becomes a pending
task. **The rating is optional: confirming attendance without stars must keep working.**
A summary tile on the trainer dashboard (average received + latest comments), and, on the client
detail page, the ratings that client has left.

## Tests

- **Backend:** the unique constraint holds; a non-attended booking is rejected; `rater_role` is
  derived (a third party gets 403, and a body-supplied role is ignored); the customer's rating
  awards `session_rated` exactly once; the trainer summary aggregates correctly.
- **Frontend:** store tests, plus an E2E for the `customer-session-rating` flow with its triplet
  (`e2e/flow-definitions.json`, `e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`).

## Out of scope

- Public ratings, or any rating visible between customers.
- Exposing a trainer's average to customers.
- Email or push reminders to rate.
- Feeding the rating into program difficulty (that is Parte 10's territory).
