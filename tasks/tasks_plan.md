# Tasks Plan — KÓRE

## 1. Feature Status

### Core Platform (pre-April 2026)

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** (email login, JWT, pre-registration) | ✅ Complete | Custom User model, SimpleJWT, pre-register flow |
| **Packages** (CRUD, categories, pricing) | ✅ Complete | 3 categories, admin-managed |
| **Subscriptions** (purchase, track, expire) | ✅ Complete | Webhook-driven creation, session tracking |
| **Recurring Billing** (Huey periodic task) | ✅ Complete | Daily at 08:00 UTC via Wompi saved sources |
| **Expiry Reminders** (email, UI) | ✅ Complete | 7-day advance, non-recurring only |
| **Booking System** (create, cancel, reschedule) | ✅ Complete | Business rules validated, ICS generation |
| **Availability Slots** (CRUD, blocking) | ✅ Complete | Trainer-owned, unique constraint, slot_schedule service |
| **Payments** (Wompi integration, webhook) | ✅ Complete | Card, Nequi, PSE, Bancolombia |
| **PaymentIntent** (checkout flow) | ✅ Complete | Pre-payment state tracking |
| **Notifications** (email, status tracking) | ✅ Complete | Email notifications with delivery status |
| **Content** (SiteSettings, FAQ, ContactMessage) | ✅ Complete | Singleton settings, admin-managed |
| **Analytics Events** (tracking) | ✅ Complete | Event tracking with session association |
| **Django Admin Panel** | ✅ Complete | 39 Admin classes for 63 models |
| **Google reCAPTCHA** | ✅ Complete | Site key + verification endpoints |
| **Trainer / Customer Profiles** | ✅ Complete | 1:1 with User per role |
| **Diagnostic Engine** (5 modules + KORE Index) | ✅ Complete | Anthropometry, posturometry, physical eval, nutrition habits, PAR-Q+; composite KORE score |
| **Trainer Client Management** | ✅ Complete | Client list, detail, sessions, dashboard stats, per-client assessments |
| **Mood & Weight Tracking** | ✅ Complete | Daily logs, one per day |
| **Password Reset / Terms Acceptance** | ✅ Complete | 6-digit code flow; versioned consent with audit trail |
| **Deployment** (Gunicorn + Nginx + systemd) | ✅ Complete | Production on korehealths.com |
| **Backups** (django-dbbackup) / **Silk profiling** | ✅ Complete | Compressed SQL; optional profiler |

### April–June 2026 (post-core, pre-release-july)

| Feature | Status | Notes |
|---------|--------|-------|
| **Single membership per customer + renewal history** | ✅ Complete | #39 — `SubscriptionRenewal`, renewal_history_service |
| **Monthly Programs & Progress (Fase 1)** | ✅ Complete | Monthly program, daily logs, `ProgramProgress` signals, program generator |
| **Physical Tests** | ✅ Complete | `PhysicalTest` model + views + store |
| **Nutrition Suite** | ✅ Complete | Daily logs, weekly plans, meal suggestions, week notes, nutrition access service |
| **Trainer Alerts & Risk Scores** | ✅ Complete | Clinical/behavioral alert engines, risk score service, alert resolution |
| **Trainer ↔ Client Messaging** | ✅ Complete | `TrainerMessage` model + flows |
| **Duo subscriptions (guest invite)** | ✅ Complete | `SubscriptionGuest`, duo-invite views/flows |
| **Admin Platform (frontend)** | ✅ Complete | `admin-platform/` route group: users, subscriptions, plans |

### Fase 2 — July release "Economía de Créditos y Gamificación" (merged in `july-release`, pending PR #52 → master)

| # | Feature | Status | PR |
|---|---------|--------|----|
| 1 | **Credit Engine core** (earn/lose rules, streaks 3/7/14/21/28, difficulty presets, day-close no-show penalty, late-reschedule penalty) | ✅ Merged | — |
| 2 | **Daily Check-in + routine camera captures** (consent gate, `require_workout_captures`; sleep/mobility descoped 2026-07-02) | ✅ Merged | — |
| 3 | **Client credit views** (balance, streak, transaction history, dashboard widget) | ✅ Merged | — |
| 4 | **Internal Store** (catalog, redemptions, trainer approval) | ✅ Merged | — |
| 5 | **Store enrichment** (media + delivery photo) | ✅ Merged | #54 |
| 6 | **Session entitlement** (sesión adicional) | ✅ Merged | #55 |
| 7 | **Buy credits with Wompi** (top-up) | ✅ Merged | #56 |
| 8 | **Buy nutrition** (plan upgrade) | ✅ Merged | #57 |
| G1 | **Trainer pending-task hub** | ✅ Merged | #58 |
| G2 | **Admin nutrition management** | ✅ Merged | #59 |
| 9 | **Post-session rating** (customer prompt + trainer ratings panel) | ✅ Merged | #60 |
| 10 | **Trainer settings panel** (difficulty config + simulator, reschedule window) | ✅ Merged | #61 |
| 11a | **Admin Reports / KPIs panel** | ✅ Merged | #62 |
| 11b | **Trainer engagement analytics** | ✅ Merged | #63 |

| Feature | Status | Notes |
|---------|--------|-------|
| **Internationalization** (next-intl) | 🔄 In Progress | next-intl installed, not fully implemented |

---

## 2. Known Issues & Tech Debt

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| TD-01 | SQLite in dev vs MySQL in prod — possible schema drift | Medium | Open |
| TD-02 | `HUEY_IMMEDIATE=true` in dev skips Redis — task error paths untested locally | Low | Open |
| TD-03 | No WebSocket/real-time updates — booking confirmations require page refresh | Low | Open |
| TD-04 | Pre-registration stores password hash in PaymentIntent — sensitive data in model | Medium | Open |
| TD-05 | No rate limiting on API endpoints | Medium | Open |
| TD-06 | ~~No password reset flow implemented~~ | Medium | ✅ Resolved |
| TD-07 | next-intl installed but translations not fully implemented | Low | Open |
| TD-08 | No automated CD deploy (CI tests exist; deploy is manual git pull + restart) | Low | Open |
| TD-09 | ~~Diagnostic assessment E2E tests not yet implemented~~ | Medium | ✅ Resolved |
| TD-10 | ~~Trainer client management E2E tests not yet implemented~~ | Medium | ✅ Resolved |
| TD-11 | ~~Dead "P1 missing" CI gate — `report-e2e-flow-coverage-ci.mjs` schema drift vs reporter (see ERROR-004)~~ | Medium | ✅ Resolved (`a501f05`, 2026-07-17) |
| TD-12 | `core_app/tasks.py` billing-critical periodic tasks under-tested — day-close bodies covered by `test_day_close_tasks.py` (`13b6d5c`), remaining task bodies pending | Medium | Partially addressed (hardening pass 2 target) |
| TD-13 | ~~`services/recurring_renewal.py` has no direct unit tests~~ | Medium | ✅ Resolved (`13b6d5c` — direct contract tests in `tests/services/test_recurring_renewal.py`) |
| TD-14 | ~552 hand-written E2E mock payloads with no link to backend serializers — a field rename cannot fail any E2E. `e2e/factories/` now covers booking/subscription/user/trainer shapes; migrate the rest incrementally | Medium | Open (pass 4, 2026-07-24) |
| TD-15 | E2E backend is 100% mocked — no CI job exercises a real FE↔BE contract (Playwright job never starts Django). A real-backend smoke over P1 flows would catch mock drift | Medium | Open (pass 4) |

---

## 3. Testing Status (verified 2026-07-22 @ `9f2552b`)

### Backend (pytest) — 182 files

| Category | Test Files |
|----------|-----------|
| Views | 69 |
| Services | 36 |
| Models | 30 |
| Commands | 20 |
| Serializers | 18 |
| Tasks | 6 |
| Utils | 2 |
| Permissions | 1 |
| **Total** | **182** |

CI coverage @ `d7cf79b`: **89.90%** (branch coverage on). Weakest files: `management/commands/import_food_catalog.py` (0%), `management/commands/import_exercises.py` (57%), `views/physical_test_views.py` (59%), `tasks.py` (64%), `views/trainer_intelligence_views.py` (68%), `serializers/store_serializers.py` (73%). Since that artifact, `13b6d5c` added coverage for `recurring_renewal`, day-close tasks, `store_serializers` and `TrainerClientKPIView` — CI artifact re-run pending to requantify.

### Frontend Unit (Jest) — 202 files

All under `frontend/app/__tests__/` (stores, components, views, hooks, services, lib, reporters, scripts, styles). CI coverage @ `d7cf79b`: **86.75% statements / 77.04% branches**. Weakest: ~~`RatingsSummaryCard.tsx` (0%)~~ (covered in `9f2552b`), `SubCardCompact.tsx` (38%), `UserRow.tsx` (38%), `NotesTab.tsx` (41%), `trainerStore.ts` (50%), `programStore.ts` (53%).

### E2E (Playwright) — 103 files

| Category | Spec Files |
|----------|-----------|
| App (authenticated customer) | 43 |
| Trainer | 22 |
| Public | 15 |
| Admin | 10 |
| Auth | 7 |
| Program | 5 |
| Customer (rating) | 1 |
| **Total** | **103** |

### Grand Total: 487 test files
### Flow Definitions: 104 flows (registry v1.11.0, 2026-07-15) — runtime coverage **104/104 covered** (CI artifact 2026-07-16)

### Quality Gate: 99/100 — 0 errors, 86 warnings, 131 info (CI 2026-07-16, pre-sweep). The warning sweep `d3aa82a` (2026-07-17) reduced warnings 86 → 59 on the top-density backend files; CI artifact re-run pending to confirm the new breakdown.

---

## 4. Documentation Status

| Document | Location | Status |
|----------|----------|--------|
| PRD | `docs/methodology/product_requirement_docs.md` | ✅ Refreshed 2026-07-17 |
| Technical | `docs/methodology/technical.md` | ✅ Refreshed 2026-07-17 |
| Architecture | `docs/methodology/architecture.md` | ✅ Refreshed 2026-07-17 |
| Tasks Plan | `tasks/tasks_plan.md` | ✅ Refreshed 2026-07-22 |
| Active Context | `tasks/active_context.md` | ✅ Refreshed 2026-07-22 |
| Error Documentation | `docs/methodology/error-documentation.md` | ✅ Maintained |
| Lessons Learned | `docs/methodology/lessons-learned.md` | ✅ Maintained |
| Release July (Fase 2) | `docs/release-july/{README,GUIA_DE_VALIDACION,GUIA_QA_STAGING}.md` | ✅ Existing |
| Deployment Guide | `docs/deployment-guide.md` | ✅ Existing |
| Testing Quality Standards | `docs/TESTING_QUALITY_STANDARDS.md` | ✅ Existing |
| User Flow Map | `docs/USER_FLOW_MAP.md` | ✅ Reconciled 2026-07-17 (`0440992` — runtime artifact is coverage source of truth) |

---

## 5. Potential Improvements

| Priority | Improvement | Impact |
|----------|-------------|--------|
| High | Add API rate limiting (django-ratelimit or DRF throttling) | Security (TD-05) |
| ~~High~~ | ~~Revive the P1-missing CI gate (align report script with reporter schema)~~ | ✅ Done — `a501f05` (TD-11) |
| Medium | Raise `tasks.py` and `trainer_intelligence_views.py` coverage | Billing/analytics reliability (TD-12) |
| ~~Medium~~ | ~~Direct unit tests for `recurring_renewal` service~~ | ✅ Done — `13b6d5c` (TD-13) |
| Medium | Complete i18n with next-intl (Spanish/English) | Market reach (TD-07) |
| Medium | Add CD pipeline for automated deployment | DevOps efficiency (TD-08) |
| Medium | Migrate dev database to MySQL for parity with production | Reliability (TD-01) |
| Low | Add WebSocket notifications for real-time booking updates | UX polish |
| Low | Add Sentry or similar error tracking in production | Observability |
| ~~Low~~ | ~~Implement admin dashboard with analytics charts~~ | ✅ Done — Part 11a Admin Reports/KPIs (#62) |
