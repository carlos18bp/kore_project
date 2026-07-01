# Design — Phase 2 Part 1: Credits Engine Core

Date: 2026-07-01
Branch: `feat/01072026-phase2-credits-engine-core` (off `july-release`)
Roadmap: `docs/release-july/README.md` (Part 1 of 7)

## Context

Phase 2 introduces a gamified credit economy on top of Phase 1 data. Part 1 builds
the engine: models, earning/loss rules, streaks with progressive bonuses, difficulty
presets, day-close task, and the balance/history API. Later parts consume it
(client views in Part 3, store in Part 4, trainer panel in Part 6).

Constraint honored throughout: **Phase 1 logic is not modified** — the engine hooks
onto existing signals via the project's proven pattern (`post_save` receiver →
`transaction.on_commit` → Huey task), the same one used by the risk score
(`signals.py:31-54` → `recompute_risk_score_task`). Additive fields/models only.

## Decisions (confirmed with product owner)

1. **Attendance confirmation is built in Part 1.** It does not exist today
   (bookings auto-complete `PENDING → CONFIRMED` when `ends_at` passes,
   `tasks.py:173`). The loss rule depends on it.
2. **Active day (streak)** = the customer fulfilled BOTH training and nutrition
   that day. Thresholds configurable; defaults: training day's exercises ≥ 70%
   completed (planned rest days count as fulfilled) AND ≥ 3 of 5 meals completed.
3. **Config is a single global record** (`SingletonModel` pattern). No per-trainer
   economies for now.
4. **Trust model for earning** (manual per-action approval by the trainer was
   rejected as operationally unviable; the redemption approval in Part 4 remains
   the human gate before credits convert to real value):
   - **Human-verified, high credits**: biweekly physical test recorded by the
     trainer (pass → credits); session attendance confirmed by the trainer.
   - **Photo evidence, medium credits, trainer-reviewable**: meals (photo
     required to earn), workout day (random camera captures required — see §
     Workout evidence). These transactions are created `pending` and
     **auto-confirm after 3 days** unless the trainer rejects them.
   - **Low-risk self-report, low credits, auto-confirmed**: daily check-in
     (existing `MoodEntry`), hydration goal (existing `WaterGlassLog`).
5. **Daily routine credits are gated by camera evidence.** Marking exercises
   without captures still counts for adherence/streak, but earns no direct credits.
6. **Workout evidence UX copy (product decision)**: the client-facing text states
   that *a video will be taken to validate the routine and credits are delivered
   once the trainer validates it*. Internally the system requests camera
   permission and takes a few random photos per exercise (2-3, unpredictable
   moments), uploading them to the session with deferred/background upload.
   Recorded here explicitly: copy says video; mechanism is sparse random photos
   (a strict subset of what the copy implies is captured).
7. **Late-forgiveness for attendance**: if the day closes without trainer
   confirmation the booking is marked no-show and penalized, but a later trainer
   confirmation reverses the penalty with a compensating transaction and awards
   the attendance credits.

## Data model (all new models inherit `TimestampedModel`)

### `CreditSettings` (singleton — `models/credit.py`)
- `difficulty`: `easy | medium | hard` (default `medium`).
- `action_values`: JSON map action-slug → credits, seeded from the selected
  preset; individually adjustable (Part 6 UI).
- `streak_bonuses`: JSON `{3, 7, 14, 21, 28}` → bonus credits.
- `training_day_threshold` (default 0.70), `nutrition_min_meals` (default 3).
- `water_goal_glasses` (default 8).
- `meal_review_days` (default 3) — pending auto-confirm window (also applies to
  workout-evidence transactions).
- `reschedule_window_hours` (default 24) — late-reschedule penalty window.
- `require_workout_captures` (default false until client camera flow ships in a
  later part; flipping it on activates the workout-credit rule).

Difficulty presets live as constants in `services/credit_engine.py`:

| action | easy | medium | hard |
|---|---|---|---|
| `physical_test_passed` | 150 | 100 | 75 |
| `session_attended` | 75 | 50 | 40 |
| `workout_day` | 25 | 15 | 10 |
| `meal_photo` (per meal, max 5/day) | 8 | 5 | 4 |
| `checkin` | 8 | 5 | 4 |
| `water_goal` | 15 | 10 | 8 |
| `streak_bonus` 3/7/14/21/28 | 30/75/150/225/375 | 20/50/100/150/250 | 15/40/75/110/190 |
| `no_show_penalty` | -20 | -40 | -60 |
| `late_reschedule_penalty` | -10 | -20 | -30 |

### `CreditWallet` (`models/credit.py`)
- `customer` O2O → User; `balance` (int, confirmed only), `current_streak`,
  `longest_streak`, `last_active_date` (date of last streak evaluation that
  counted as active).
- Balance is denormalized: updated with `F()` expressions in the same DB
  transaction as the ledger insert; always reconstructible from the ledger.

### `CreditTransaction` (`models/credit.py`) — append-only ledger
- `customer` FK, `action` (slug choices listed above plus `adjustment`),
  `amount` (int, signed), `status` (`pending | confirmed | rejected`),
  `description` (customer-facing Spanish, e.g. "Completaste tu check-in del martes"),
  `reference_type` + `reference_id` (origin row), `review_deadline` (nullable,
  pending only), `reviewed_by` FK nullable, `reviewed_at`.
- **Unique constraint `(customer, action, reference_type, reference_id)`** —
  idempotency: a re-fired signal cannot double-award. Reversals use a distinct
  action slug (`no_show_reversal`) so they don't collide.
- Only `confirmed` transactions touch `CreditWallet.balance`. Pending ones are
  summed on read for the wallet's `pending_balance` (no denormalized column).

### `PhysicalTest` (`models/physical_test.py`)
- `customer` FK, `trainer` FK (TrainerProfile), `performed_at` (date),
  `result` (`passed | failed`), `notes`. Trainer CRUD via ViewSet.
- On save with `result=passed` → engine awards `physical_test_passed` (ref =
  test id). Biweekly cadence is operational, not enforced by the system.

### `ExerciseCapture` (`models/monthly_program.py` — additive)
- `exercise_log` FK → `ExerciseLog`, `image` (ImageField, compressed client-side
  ~720p JPEG), `captured_at`. Uploaded via deferred queue from the client.
- Part 1 ships model + upload endpoint + the engine rule that requires captures;
  the camera capture flow itself ships with the client views (Part 2/3), enabled
  via `require_workout_captures`.

### `Booking` — additive fields only
- `attendance_status`: `unset | attended | no_show` (default `unset`),
  `attendance_confirmed_at` (nullable). Existing status flow untouched.

## Event wiring (signal → `on_commit` → Huey `process_credit_event`)

| Phase 1 event | Rule |
|---|---|
| `MoodEntry` created | award `checkin`, confirmed (ref: entry id) |
| `WaterGlassLog` created and day count reaches goal | award `water_goal`, confirmed, once/day (ref: day's `NutritionDailyLog` id) |
| `MealEntry` saved as `completed` **with photo** | award `meal_photo`, `pending`, deadline now+3d (ref: meal entry id) |
| `Booking.attendance_status → attended` | award `session_attended`, confirmed (ref: booking id); if a `no_show_penalty` exists for this booking, emit `no_show_reversal` compensating it |
| `Booking.attendance_status → no_show` | emit `no_show_penalty`, confirmed |
| `PhysicalTest` saved as `passed` | award `physical_test_passed`, confirmed |
| Reschedule with less anticipation than `reschedule_window_hours` | emit `late_reschedule_penalty` — detected at reschedule time via one explicit `credit_engine.on_reschedule(old, new)` call in the reschedule action (file already touched for attendance; acceptable additive change) |

Receivers live in `signals.py` next to the existing ones; the Huey task swallows
and logs errors (risk-score pattern) so a credits failure never breaks a user save.

## Streak & day close

New Huey task `process_credits_day_close` at **23:57 UTC**, right after
`close_daily_logs` (23:55, `tasks.py:319`), same day semantics as the rest of the
platform (known quirk: 23:55 UTC = 18:55 Bogotá; billing's `bogota_today()` exists
but daily logs already close on UTC dates — the engine follows the logs it reads).

For each customer with an active subscription:
1. **Active-day evaluation** — training fulfilled (≥ threshold or planned rest)
   AND nutrition fulfilled (≥ min meals): extend `current_streak`, update
   `longest_streak`/`last_active_date`; otherwise reset streak to 0.
   When `require_workout_captures` is on, the `workout_day` pending award is
   emitted here too (ref: day's `DailyLog` id) if captures exist.
2. **Milestone bonuses** — crossing 3/7/14/21/28 emits `streak_bonus`, confirmed
   (ref: `customer + milestone + streak start date`, so a broken-and-rebuilt
   streak can earn the milestone again, but the same run cannot twice).
3. **No-shows** — today's bookings (`CONFIRMED`, `attendance_status=unset`) →
   mark `no_show` + penalty (model save triggers the wiring in the table above).
4. **Pending expiry** — `pending` transactions past `review_deadline` →
   `confirmed`, balance applied.

## API

Customer (`IsAuthenticated`, own data):
- `GET /api/credits/wallet/` → balance, pending_balance, current/longest streak,
  next milestone + progress, days to next bonus.
- `GET /api/credits/transactions/` → paginated ledger, newest first.

Trainer (`IsTrainerRole`) / admin:
- `GET /api/trainer/credits/pending-reviews/` → pending transactions of the
  trainer's clients (meal/workout evidence, with photo URLs).
- `POST /api/trainer/credits/transactions/{id}/review/` `{action: approve|reject, note?}`.
- `PhysicalTestViewSet` → `POST/GET/PATCH /api/trainer/physical-tests/`.
- `GET/PUT /api/credits/settings/` → singleton config (choosing a preset reseeds
  `action_values`; individual overrides allowed).
- `POST /api/bookings/{id}/confirm-attendance/` `{attended: true|false}` on the
  existing `BookingViewSet`.

Upload (customer): `POST /api/my-program/logs/{log_id}/exercises/{ex_log_id}/captures/`
(multipart, deferred client queue; rejects if `daily_log.is_closed`).

## Frontend scope in Part 1

Minimal trainer UI only: attendance confirm/no-show action on the session detail
the trainer already uses, and a small form to record a `PhysicalTest`. The meal
photo calendar, difficulty simulator (Part 6), client credit views (Part 3) and
the camera capture flow (Part 2/3) come later — the backend rules behind them
ship now, gated by `require_workout_captures` where relevant.

## Error handling & consistency

- Engine = pure rule functions + ORM orchestrator in `services/credit_engine.py`
  (style of `adherence_calculator` + `progress_service`).
- All award/penalty paths idempotent via the ledger unique constraint
  (`get_or_create`); wallet updates atomic with `F()`.
- Management command `reconcile_credit_wallets`: recomputes balances/streak
  fields from the ledger and reports/repairs drift.
- Signal handlers never raise into the caller; failures logged.

## Testing (per project constraints: small batches, CI verifies)

- Golden-value unit tests for preset tables and rule functions (award amounts,
  active-day evaluation, milestone crossing including re-earn after streak reset).
- Idempotency: double-fire each signal, assert single transaction.
- Day-close task: fixtures for active/inactive days, no-show marking,
  late-confirmation reversal, pending auto-confirm.
- API: wallet/history payloads, role permissions (customer vs trainer vs admin),
  review action transitions.

## Out of scope (later parts / not selected)

Client-facing credit views (Part 3), store & redemptions (Part 4), post-session
rating (Part 5), trainer panel with meal-photo calendar + simulator (Part 6),
analytics/KPIs (Part 7). Unselected additional modules (PWA, AI detection, email
marketing, Telegram alerts, etc.) are excluded.
