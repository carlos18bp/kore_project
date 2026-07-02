# Design — Phase 2 Part 1: Trainer UI for the Credits Engine

Date: 2026-07-02
Branch: `feat/02072026-phase2-credits-trainer-ui` (off `july-release`)
Backend spec: `docs/superpowers/specs/2026-07-01-phase2-credits-engine-design.md` (merged in PR #44)

## Goal

The two trainer-facing features the credit engine needs to operate fairly:
1. **Attendance confirmation** (✓ asistió / ✗ no asistió) — without it, the 23:57
   day-close marks every session as no-show and penalizes customers unfairly.
2. **Biweekly physical test registration** (passed/failed) — the human-verified
   source of training credits.

## Decisions (confirmed with product owner)

1. **Attendance lives in BOTH places**: the agenda day modal on the trainer
   dashboard (daily workflow: confirm the day's sessions before 23:55) and the
   "Sesiones recientes" rows in the client detail (late corrections — the
   backend reverses the penalty automatically).
2. **The biweekly test lives INSIDE the existing "Ev. Física" view** — no new
   tab. `EvalFisicaTab` is already built around physical tests (squats,
   pushups, plank, ATS walk, unipodal); the quincenal registration is a compact
   section at the top of that tab. Explicitly rejected: a 10th tab, a modal
   from the resumen tab.
3. Client-facing credit views are OUT of scope (Parts 2-3 of the roadmap).
4. Strings: hardcoded Spanish in JSX (next-intl is declared but not wired —
   every existing view does this; do not introduce message files).

## Architecture

**Backend (additive only):** `TrainerAgendaView` and `TrainerClientSessionsView`
payloads gain `attendance_status` and `attendance_confirmed_at` (the model
fields exist since PR #44; the handwritten dicts just don't include them).

**Stores (Zustand, existing patterns):**
- `bookingStore`: `confirmAttendance(bookingId, attended)` → POST
  `/bookings/{id}/confirm-attendance/`; `BookingData` gains the two fields.
- `trainerStore`: `UpcomingSession` and `ClientSession` types gain the two
  fields; new local updater `markSessionAttendance(bookingId, status)` patches
  `agendaSessions` and `clientSessions` in place after a confirm (no refetch).
- New `physicalTestStore`: `tests[]`, `fetchTests(clientId)`,
  `createTest(clientId, {performed_at, result, notes})` against
  `/trainer/physical-tests/` (ViewSet expects `customer` in the POST body).

**Components:**
- `AttendanceActions` (new, `app/components/trainer/AttendanceActions.tsx`):
  given a session (id, starts_at, status, attendance_status) renders — nothing
  for future/canceled sessions; ✓/✗ pill buttons for started sessions with
  `attendance_status === 'unset'`; a status badge (green "Asistió" / red
  "No asistió") once set. Owns its submitting state; calls
  `bookingStore.confirmAttendance` then `trainerStore.markSessionAttendance`.
- `AgendaDayModal`: session rows restructured from a single `<Link>` to a row
  container (info area stays a Link to the client; actions area hosts
  `AttendanceActions`).
- `SessionRow` (client detail): renders `AttendanceActions` for non-upcoming
  sessions, next to the existing "Mensaje" button.
- `PhysicalTestSection` (new, `app/components/trainer/evals/PhysicalTestSection.tsx`):
  rendered at the top of `EvalFisicaTab`. Shows last test (date + badge
  Aprobado/No aprobado + notes) with a collapsible history, and a "Registrar
  test" inline form (date default today, Aprobado/No aprobado toggle, notes)
  built with the `evals/shared.tsx` primitives and the design-system tokens.

**Feedback/errors:** project pattern — inline error banner from store `error`,
button states ("Guardando…"), no toasts.

## Testing

- Jest: `bookingStore.confirmAttendance` (success + error), `physicalTestStore`
  (clone of `physicalEvaluationStore.test.ts` patterns), `AttendanceActions`
  component states (hidden/buttons/badge).
- Backend: one small test asserting the two serializer payloads include the
  attendance fields.
- Playwright: attendance in `e2e/trainer/trainer-dashboard.spec.ts` (day modal)
  and `trainer-client-detail.spec.ts` (session row); new
  `trainer-client-physical-tests.spec.ts` (register + history), all with
  mocked API fixtures per existing patterns.
- Flow triplet updated together: `frontend/e2e/flow-definitions.json` +
  `frontend/e2e/helpers/flow-tags.ts` + `docs/USER_FLOW_MAP.md`
  (attendance = new steps/branches under `trainer-dashboard` and
  `trainer-client-detail`; physical test = new flow
  `trainer-client-physical-tests`). Final step: run the `e2e-user-flows-check`
  audit (CLAUDE.md requirement for user-flow changes).

## Out of scope

Client credit views (balance/streak/history — Part 3), check-in/habits/camera
capture flow (Part 2), meal-photo calendar + difficulty simulator (Part 6),
pending-review UI for meal credits (Part 6).
