# Design — Phase 2 Part 2: Client Check-in, Credit Visibility & Workout Camera

Date: 2026-07-02
Branch: `feat/02072026-phase2-client-checkin-camera` (off `july-release`, includes PR #44 + #46)
Related specs: `2026-07-01-phase2-credits-engine-design.md`, `2026-07-02-phase2-credits-trainer-ui-design.md`

## Goal

The first client-facing slice of the credit economy: an enriched daily check-in,
dynamic "+X créditos" visibility on every credit-earning action, a "Hoy ganas"
dashboard block, and the camera validation flow that makes workout-day credits
earnable.

## Decisions (confirmed with product owner)

1. **Check-in evolves the existing mood flow** — no new model/screen. The
   auto-opening mood modal grows from 1 to 4 tap questions: ánimo (existing 1-10
   scale — keeps KÓRE index and trainer KPIs intact), energía (1-5),
   ¿dolor hoy? (sí/no), ¿listo para entrenar? (sí/no). Credits keep firing on
   MoodEntry creation (already wired in the engine).
2. **Sleep and mobility habits are DESCOPED** — as a plain web app there is no
   way to verify them (every other credit action has evidence: photos, captures,
   trainer confirmation). Pure self-report would be the economy's weak link.
   Hydration remains the daily habit (photo-verified, already awards credits).
   Revisit alongside the PWA module if it is ever contracted.
3. **Credit amounts are shown everywhere and are dynamic** — the UI never
   hardcodes credit values. A new read-only endpoint exposes the configured
   `action_values` to any authenticated user; when the trainer/admin tunes
   values (API today, Part 6 UI later), every chip updates automatically.
4. **The dashboard "habits block" becomes the "Hoy ganas" block** — today's
   credit actions (check-in, hidratación, comidas, rutina) each with done/pending
   state and its "+X" value.
5. **Workout camera copy (standing product decision from Part 1)**: the client
   is told *a video will be taken to validate the routine; credits arrive when
   the trainer validates it*. Internally: front-camera stream during exercise
   execution, 2-3 random photo captures per exercise, deferred background upload.
6. **`require_workout_captures` turns ON at deploy** via data migration — the
   camera flow and the rule ship together.
7. **Camera permission denied is not blocking**: the routine works normally
   (exercise marking, streak) with a notice that workout credits need validation.

## Backend (additive only)

- **`MoodEntry`**: add nullable `energy_level` (PositiveSmallIntegerField 1-5),
  `pain` (BooleanField null), `ready_to_train` (BooleanField null). `mood_view`
  POST accepts them as optional keys (mini mood cards keep posting score-only).
- **`GET /api/credits/values/`** (IsAuthenticated): returns
  `{action_values: {...}, streak_bonuses: {...}, water_goal_glasses, meal_review_days}`
  from `credit_engine.get_settings()` — read-only, no trainer data.
- **Data migration**: set `require_workout_captures=True` on the `CreditSettings`
  singleton row if it exists (and the engine default stays False for fresh
  installs until seeding — the migration flips the deployed row).
- No engine rule changes: `workout_day` pending award at day close already
  requires captures; `checkin`/`water_goal` awards unchanged.

## Frontend

**Credit values store** — `lib/stores/creditValuesStore.ts`: fetches
`/credits/values/` once per session; exposes `value(action)` helper. All chips
render from it (hide chip if store not loaded — never show a wrong number).

**Enriched check-in modal** — `app/components/profile/MoodCheckIn.tsx` becomes a
4-step tap flow (one question per screen, auto-advance, < 30 s):
ánimo (10 buttons, existing) → energía (5 buttons) → dolor (sí/no) → listo para
entrenar (sí/no) → submit once. Header chip: "Check-in de hoy · +{value('checkin')}".
`profileStore.submitMood(score, notes?, extras?)` gains the optional extras
payload; `TodayMood` type gains the new fields. Mini mood cards unchanged
(quick score-only tap) but now display the credit chip and open the full modal
when no check-in exists today.

**"Hoy ganas" dashboard block** — new `app/components/dashboard/TodayCreditsCard.tsx`
mounted in both mobile and desktop layouts of `app/(app)/dashboard/page.tsx`
(between the routine hero and progress tabs). Four rows with done/pending state
and dynamic chips, computed from existing stores (no new endpoints):
- Check-in → `profileStore.todayMood`
- Hidratación → `nutritionDailyStore.todayLog.water_glasses.length` vs goal
- Comidas → meals completed with photo count × per-meal value
- Rutina → today's exercise logs completed (credits "pendientes de validación")

**Workout camera flow** — in `app/(app)/mi-programa/rutina/page.tsx`:
- **Consent gate**: first time the routine opens with the rule active, a
  full-screen step shows the agreed copy and an "Activar cámara" button →
  `getUserMedia({video: {facingMode: 'user'}})`. Choice remembered in
  `localStorage` (`kore_workout_camera`: granted/denied); denied shows the
  non-blocking notice and never re-prompts automatically (a link in the notice
  re-opens the gate).
- **`useWorkoutCaptures` hook** (`lib/hooks/useWorkoutCaptures.ts`): owns the
  hidden `<video>` stream during `execute` phase; schedules 2-3 captures at
  random offsets within the exercise's execution window; each capture draws the
  frame to a canvas → `compressImage` → enqueues.
- **Deferred upload queue** inside the hook: uploads sequentially in the
  background via `programStore.uploadExerciseCapture(logId, exLogId, file)`
  (new action, FormData `image`, mirrors `logWaterGlass`); one silent retry per
  item; flush on exercise completion; drops on page exit (best effort — the
  engine only needs ≥1 capture that day).
- **Indicator**: small pulsing "● Validando rutina" pill during execute phase.
- Routine intro screen and completion screen show the workout credit chip
  ("+{value('workout_day')} al validar tu entrenador").

## Testing

- Backend: MoodEntry new-fields POST test, `/credits/values/` auth + payload
  test, migration state test (settings row flips to True). `frozen_now` where
  time matters.
- Jest: `creditValuesStore`, `profileStore.submitMood` extras, `TodayCreditsCard`
  states, `useWorkoutCaptures` (mock getUserMedia/canvas — capture scheduling and
  queue retry logic with fake timers `doNotFake` pattern).
- Playwright: enriched check-in 4-step flow (extends `profile-mood-entry.spec.ts`),
  "Hoy ganas" block on dashboard, camera consent gate with mocked
  `getUserMedia` (grant + deny paths) in `mi-programa-rutina.spec.ts`.
- Flow triplet: update `customer-dashboard`/`profile-mood-entry`/`mi-programa-rutina`
  flows; new flow `program-workout-captures`. New section in
  `docs/release-july/GUIA_DE_VALIDACION.md` (Parte 2).

## Out of scope

Sleep/mobility habits (descoped — see Decision 2; update the roadmap README),
credit balance/streak/history views and dashboard credit widget (Part 3), store
(Part 4), post-session rating (Part 5), trainer review calendar & difficulty UI
(Part 6). PWA/push reminders (unselected module).
