# Trainer Task Hub ("Tareas pendientes") — Design

> Phase 2 · Gap #1. Parent branch: `july-release`. Feature branch:
> `feat/10072026-trainer-task-hub`. One PR to `july-release`.

## Goal

Give the trainer a dedicated **"Tareas pendientes"** hub in the sidebar where they
review the actions that require their decision — pending **credit reviews** (meal
photos AND workout-day camera captures) and pending **store redemptions** — approve
or reject each with a note, and see the same tasks scoped to a single client from
the client-detail view.

This closes the business gap where training credit is granted without the trainer
ever validating the workout evidence.

## Background (current state, verified)

- **Credit reviews already exist in the backend but no frontend consumes them:**
  - `TrainerPendingReviewsView` — `GET /api/trainer/credits/pending-reviews/`
    (`core_app/views/credit_views.py:75`). Returns `{count, results}` of every
    `CreditTransaction` with `status=PENDING`, scoped to the trainer's assigned
    clients (admins see all). Each row is `CreditTransactionSerializer(tx).data`
    plus `customer_email`, `customer_name`, `photo_url`.
  - **`photo_url` is resolved ONLY for `reference_type == 'meal_entry'`**
    (`credit_views.py:85-92`, via `MealEntry.photo.url`). Workout-day pending
    credits (`reference_type == 'daily_log'`) get `photo_url = None`.
  - `TrainerReviewTransactionView` — `POST /api/trainer/credits/transactions/<tx_id>/review/`
    (`credit_views.py:103`). Body `{decision: 'approve'|'reject', note?}`. `approve`
    → `credit_engine.confirm_transaction`; `reject` → `credit_engine.reject_transaction`.
    400 if already reviewed.
- **Workout-day credit is not minted today.** In `_evaluate_customer_day`
  (`core_app/services/credit_day_close.py:66-79`) a `WORKOUT_DAY` credit is awarded
  as `status=PENDING` **only when `settings_obj.require_workout_captures` is True**
  (default `False`). So with the shipped config, training days only feed the
  streak; no reviewable workout credit exists.
- **Pending credits auto-confirm at day close.** `process_credits_day_close`
  (`credit_day_close.py:118-125`) confirms every PENDING tx whose `review_deadline`
  has passed. So today an unreviewed credit is granted automatically.
- **Workout capture evidence:** `ExerciseCapture` (`core_app/models/monthly_program.py:143`)
  — `image = ImageField(upload_to='workout_captures/%Y/%m/')`, FK `exercise_log`.
  Chain: `DailyLog → ExerciseLog → ExerciseCapture`. There is **no** trainer-facing
  endpoint that exposes these images.
- **Store redemption reviews already have a working flow:** the frontend
  `trainer/tienda/page.tsx` already uses `useStoreStore().pendingReviews`,
  `fetchPendingReviews`, `reviewRedemption`. No backend change needed to reuse it.
- **Credit lifecycle:** `CreditTransaction.Status` ∈ `{PENDING, CONFIRMED, REJECTED}`
  (`models/credit.py`). Only CONFIRMED rows touch the wallet balance.

## Decisions (from brainstorming)

1. **Hub contents (v1):** credit reviews (meal + workout) **and** store redemptions.
   Alerts stay out (informational, not actionable).
2. **What the trainer validates for training:** a **workout-day credit**. We enable
   the workout-day PENDING credit so each training day with a camera capture mints a
   reviewable credit. Approve → credited; reject → not credited. Reuses the existing
   PENDING→CONFIRMED lifecycle, identical to meals.
3. **No auto-confirmation.** Pending credits (meal and workout) stay PENDING until a
   trainer acts. Remove the auto-confirm block at day close. `review_deadline` is
   retained only as an **"overdue" indicator** for sorting/highlighting in the hub.
   Consequence (accepted): the client's wallet does **not** receive those points
   until the trainer approves, and the hub can accumulate a backlog.
4. **Notes = per-review notes** (approval note / rejection reason), which the review
   endpoint already accepts. Free-form client logbook notes are **out of scope** for
   this part.
5. **Sidebar badge** sums pending credit reviews + pending store redemptions.

## Backend changes

### B1 — Enable the workout-day credit

Turn the workout-day review path on so training days with a capture mint a PENDING
`WORKOUT_DAY` credit. `require_workout_captures` is a field on the singleton credit
settings read via `credit_engine.get_settings()` and consumed at
`credit_day_close.py:67`.

- Change the model field default to `True`.
- Add a data migration that flips the existing settings row to `require_workout_captures=True`.

No change to `_evaluate_customer_day`'s award logic itself — it already awards
`WORKOUT_DAY` as PENDING with `reference_type='daily_log'`, `reference_id=log.pk`
and a `review_deadline` when the gate passes.

### B2 — Expose workout capture photos in pending reviews

In `TrainerPendingReviewsView.get` (`credit_views.py:78-100`), replace the single
`photo_url` (meal-only) with a **`photos` list** resolved per reference type, and
keep `photo_url` as the first element for convenience:

- `reference_type == 'meal_entry'` → `[MealEntry.photo.url]` (if a photo exists).
- `reference_type == 'daily_log'` → all `ExerciseCapture.image.url` for that daily
  log, i.e. `ExerciseCapture.objects.filter(exercise_log__daily_log_id=<ref_id>)`.
  Resolve in bulk: collect the `daily_log` reference ids across the PENDING rows,
  run one `ExerciseCapture` query, group image urls by `daily_log_id`.
- Any other reference type → `[]`.

Each result row gains `row['photos'] = [...urls]` and `row['photo_url'] =
photos[0] if photos else None` (back-compat; the new frontend reads `photos`).

### B3 — Remove auto-confirm at day close

In `process_credits_day_close` (`credit_day_close.py:118-125`), delete the block
that confirms PENDING transactions past their `review_deadline`. Drop
`pending_confirmed` from the returned summary (or set it to `0`). The rest of the
day-close (streaks, no-shows) is unchanged. `review_deadline` keeps being set on the
award so the hub can flag overdue items.

**No new backend for store redemptions** — the existing trainer redemption endpoints
and `storeStore` are reused as-is.

## Frontend changes

### F1 — New route + sidebar module

- New page `frontend/app/(app)/trainer/tareas/page.tsx` — the hub, with two
  sections/tabs: **Créditos** and **Canjes**.
- Add a **"Tareas pendientes"** item to the trainer sidebar nav (wherever the trainer
  nav items are defined) with a **count badge** = pending credit reviews + pending
  redemptions.

### F2 — New store `trainerTasksStore.ts`

- `fetchPendingCreditReviews()` → `GET /trainer/credits/pending-reviews/`; holds
  `creditReviews`, `loading`, `error`.
- `reviewCreditTransaction(txId, decision: 'approve' | 'reject', note?)` →
  `POST /trainer/credits/transactions/${txId}/review/`; on success removes the row
  from local state.
- A derived `pendingCount` (credit reviews). The redemptions count comes from the
  existing `storeStore`; the sidebar badge sums both.
- HTTP via the `@/lib/services/http` wrapper, matching existing stores.

### F3 — Hub UI

- **Créditos section:** one card per pending credit review — customer name, type
  (Comida / Entrenamiento, derived from `action`/`reference_type`), date, points
  (`amount`), a **photo gallery** from `photos[]`, an **overdue** badge when
  `review_deadline` is past, and **Aprobar / Rechazar** actions. Reject opens a note
  input (reason); approve accepts an optional note.
- **Canjes section:** reuse the existing redemption review cards/flow from
  `storeStore` (`pendingReviews`, `reviewRedemption`), same as `trainer/tienda`.
- Empty states per section ("No hay créditos por revisar", "No hay canjes pendientes").
- Follows the Kore frontend-design system (custom components, no maxwidth on the
  page container — use the dashboard padding pattern).

### F4 — Client-detail entry point

- In the trainer client-detail view, add a **"Tareas pendientes (N)"** strip that
  shows the count of that client's pending credit reviews (filter the
  pending-reviews payload by `customer` client-side) and links into the hub. Keeps
  the trainer in-flow when already looking at a client.

## Flow definitions

Add the new hub flow to the flow triplet
(`frontend/e2e/flow-definitions.json` + `frontend/e2e/helpers/flow-tags.ts` +
`docs/USER_FLOW_MAP.md`), bumping the version, mirroring how prior parts registered
new flows.

## Testing

- **Backend (pytest):**
  - `_evaluate_customer_day` mints a PENDING `WORKOUT_DAY` credit when a training day
    has a capture and `require_workout_captures=True`.
  - `TrainerPendingReviewsView` returns `photos` with the workout captures for a
    `daily_log` pending credit, and `[meal.photo.url]` for a `meal_entry` one.
  - `process_credits_day_close` no longer confirms an overdue PENDING credit (it
    stays PENDING).
- **Frontend unit (Jest):** `trainerTasksStore` — fetch populates `creditReviews`;
  approve/reject calls the right endpoint and removes the row; `pendingCount`.
- **E2E (Playwright):** trainer opens `/trainer/tareas`, sees a credit card with
  photos, approves → row disappears; rejects with a note → row disappears. Mock the
  pending-reviews and review endpoints.

## Out of scope

- Free-form client logbook notes.
- Consolidating `/trainer/alerts` into the hub.
- Retroactively minting workout credits for past days (only future day-closes apply).
- Any change to the store-redemption backend.
