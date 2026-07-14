# Trainer Settings Panel — Design Spec

**Date:** 2026-07-14
**Phase:** Fase 2 — Parte 10
**Branch:** `feat/14072026-trainer-settings`

## Problem

The credit economy's knobs — difficulty preset, activity thresholds, the reschedule window — live only in the Django admin. The trainer, who owns those rules, cannot touch them.

Worse, the reschedule rule is **three constants that nobody keeps in sync**:

| # | Location | Role |
| --- | --- | --- |
| 1 | `booking_views.py:25` — `CANCEL_RESCHEDULE_HOURS = 24` | **Blocks** cancel/reschedule server-side |
| 2 | `CreditSettings.reschedule_window_hours = 24` | Triggers the credit **penalty** (`credit_engine.on_reschedule`) |
| 3 | `SessionDetailModal.tsx:14` — `CANCEL_HOURS = 24` | **Disables the buttons** in the customer's UI |

Only #2 is configurable today, and configuring it alone is a trap: set it below 24 and the penalty becomes unreachable (the hard block fires first); set it above 24 and the penalty window covers reschedules the block already forbids.

## Goal

One number, edited by the trainer, that governs all three.

## Backend

### 1. `booking_views` reads the setting

Delete `CANCEL_RESCHEDULE_HOURS`. Both guards (cancel at line 172, reschedule at line 226) read `reschedule_window_hours` from `CreditSettings`, and the error message interpolates the configured value.

Trainers and admins keep bypassing the window entirely (`bypass_window`, line 170) — unchanged.

### 2. The customer must be able to read the window

`CreditSettingsView` is `IsTrainerRole` today, so the customer's UI has no way to learn the window. Split the permission by method via `get_permissions()`: **`GET` → `IsAuthenticated`, `PUT` → `IsTrainerRole`**. Nothing there is secret — it is the rules of the game the customer already lives under.

### 3. Range validation

`CreditSettingsSerializer` validates `reschedule_window_hours` between **0 and 168** (a week). The model is a `PositiveSmallIntegerField`, so without a ceiling a typo of `480` would freeze everyone's booking for 20 days.

The endpoint itself already exists (`GET`/`PUT /api/credits/settings/`) and already reseeds the preset maps when a `PUT` arrives with an empty `action_values` — that contract is unchanged.

## Frontend

**`trainerSettingsStore`** (`fetchSettings`, `updateSettings`) — consumed by both the trainer's panel and the customer's session modal.

**Page `/trainer/configuracion`**, three blocks:

1. **Dificultad** — three cards (Fácil / Medio / Difícil) plus a read-only table of what each action grants under the active preset. Switching preset opens a confirmation ("se reescribirán los valores de cada acción") and then sends `PUT {difficulty, action_values: {}, streak_bonuses: {}}` — the empty maps are what trigger the reseed.
2. **Reglas de actividad** — training-day threshold (%), minimum meals, water-glass goal, meal review days, and the require-captures toggle.
3. **Reagendamiento** — the window in hours, with copy stating that this number both blocks the reschedule and triggers the penalty.

Plus a "Configuración" entry in `TrainerSidebar` and in the mobile *Más* menu.

**`SessionDetailModal` stops hardcoding `CANCEL_HOURS = 24`** and reads the window from the store, **falling back to 24 while it has not loaded**. The fallback is load-bearing: it keeps the existing test (`SessionDetailModal.test.tsx:113`) honest without mocking the store into it, and it stops a failed request from enabling buttons the backend will reject anyway.

## Tests

- **Backend:** with the window at 48, cancelling and rescheduling a session 30h out are rejected (today they would pass) and 60h out are allowed; the trainer still bypasses the window; a customer can `GET` the settings but gets 403 on `PUT`; a 200-hour value is rejected.
- **Frontend:** store tests, and an E2E for the `trainer-settings` flow with its triplet (`e2e/flow-definitions.json`, `e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`).

## Risk

This changes booking behaviour that currently works. The mitigation is that the default stays **24** — identical to all three constants — so **nothing changes in production until someone moves the knob**.

## Out of scope

- Editing individual action values or streak bonuses (the preset defines them).
- Per-customer settings: `CreditSettings` is a global singleton.
- Feeding the Parte 9 rating into the difficulty.
