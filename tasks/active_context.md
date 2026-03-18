# Active Context — KÓRE

## 1. Current State

The KÓRE platform is **fully functional in production** at `korehealths.com`. All core features plus the **Diagnostic Engine** and **Trainer Client Management** system are implemented:

- **Core**: Authentication, packages, subscriptions, booking, payments (Wompi), notifications, content management, analytics, admin panel
- **Diagnostic Engine**: 5 assessment modules (anthropometry, posturometry, physical evaluation, nutrition habits, PAR-Q+) with auto-computed indices and KORE General Index
- **Client Management**: Customer profiles, trainer client views, mood/weight tracking, pending assessments dashboard
- **Account**: Password reset (6-digit code), terms acceptance tracking, profile completion
- **Backend**: Django 6 + DRF + Huey + 12 services (incl. 6 calculators) + MySQL (prod)
- **Frontend**: Next.js 16 (static export) + 12 Zustand stores + 30 pages + 36 components
- **Testing**: 180 test files (72 backend + 66 frontend unit + 42 E2E)
- **Deployment**: Gunicorn + Nginx + systemd on Ubuntu

---

## 2. Recent Focus Areas

- **Wave 1 E2E specs — 4 new spec files, 42 new tests** (latest):
  - Added `FAKE_TRAINER_COOKIE`, `mockTrainerAuthProfile`, `injectTrainerAuthCookies`, `mockLoginAsTrainer` to `fixtures.ts`
  - `forgot-password.spec.ts`: 12 tests — multi-step password reset flow (request code → verify → reset)
  - `profile.spec.ts`: 10 tests — personal info, goal selector, mood card, security, summary, debounced save
  - `trainer-clients.spec.ts`: 9 tests — client list rendering, search/filter, empty states, avatars
  - `trainer-client-detail.spec.ts`: 11 tests — personal info card, subscription, stats, sessions, modules
  - All 42 tests pass with `--workers=1 --retries=1`
  - Key patterns: direct navigation with LIFO mock override for profile; scoped assertions (`.locator('..')`) to avoid strict-mode violations
- **E2E test fix — 27 timeouts across 9 spec files** (previous):
  - Root causes: ProfileCompletionCTA overlay, MoodCheckIn modal, outdated UI assertions, 24h→12h slot label mismatch, forceClickCalendarDay hacks, 16h buffer filtering, LIFO route conflicts
  - Fixed `fixtures.ts`: added `profile_completed`, `customer_profile`, `today_mood` to auth mocks; added 6 new dashboard API endpoint mocks
  - Fixed 7 spec files: dashboard, booking-error-paths, calendar-edge-cases, subscription-cancel-flow, edge-case-branches, coverage-gaps, subscription-expiry-reminder
  - Result: 61 tests across 9 spec files — all pass with `--workers=1`
- **Memory Bank refresh** (previous):
  - Full codebase re-audit: discovered 10 new model files, 8 new view files, 7 new services, 8 new stores since last Memory Bank initialization
  - Updated all 7 core Memory Files with verified counts
- **Diagnostic Engine** (previous major feature):
  - 5 assessment models with auto-computed indices on save
  - 6 pure-function calculator services (scientific basis referenced in docstrings)
  - Cross-module integration: PhysicalEvaluation pulls context from Anthropometry + Posturometry
  - KORE General Index: composite score (0–100) aggregating all modules
  - Cooldown enforcement: nutrition (7 days), PAR-Q (90 days)
- **Trainer Client Management** (previous major feature):
  - Trainer dashboard stats, client list, client detail, client sessions
  - Per-client CRUD for all 5 assessment modules
  - 8 trainer-specific frontend pages
- **Quality gate 100/100**: All backend + frontend quality rules passing
- **CI coverage workflows**: 3 coverage report artifacts + combined summary in GitHub Actions

---

## 3. Active Decisions & Considerations

| Decision | Context |
|----------|---------|
| Static export over SSR | Next.js `output: 'export'` — simplifies deployment (no Node.js in prod) but limits dynamic features |
| Wompi as sole payment provider | Colombian market — may need multi-provider support in future |
| Huey over Celery | Lightweight choice for 2 periodic tasks — may need re-evaluation if task complexity grows |
| SQLite for dev | Acceptable for now but creates risk of schema drift vs MySQL in production |
| Auto-computed indices on model save | All diagnostic models compute their indices in `save()` — ensures consistency but adds save-time cost |
| Pure-function calculator services | Calculators receive data as args (no DB access) — testable, composable, but requires model to orchestrate calls |
| APIView for assessment endpoints | Diagnostic views use `APIView` (not ViewSet) for finer trainer-vs-client endpoint control |
| Cooldown enforcement at view level | Nutrition (7d) and PAR-Q (90d) cooldowns checked in the view, not the model |

---

## 4. Development Environment

| Component | Status |
|-----------|--------|
| Backend (Django 6 / Python 3.12) | ✅ Running |
| Frontend (Next.js 16 / Node 22) | ✅ Running |
| Database (SQLite dev) | ✅ Available |
| Redis (Huey broker) | ⚠️ Optional in dev (`HUEY_IMMEDIATE=true`) |
| Fake data commands | ✅ Available (18 management commands) |
| Testing tools | ✅ pytest (72 files), Jest (66 files), Playwright (38 files) |

---

## 5. Next Steps

1. **E2E coverage gaps**: 12 uncovered flows remain (Wave 1 complete — see tasks_plan.md §3 gaps table)
   - ~~Wave 1 (P1): auth-forgot-password, profile-management, trainer-clients-list, trainer-client-detail~~ ✅ Done (42 tests)
   - Wave 2 (P2): customer diagnostic flows (diagnosis, nutrition, parq, physical-evaluation, posturometry, password-change)
   - Wave 3 (P2): trainer-side assessment flows (anthropometry, nutrition, physical-eval, posturometry, parq)
   - Wave 4 (P3): customer-pending-assessments
2. **API rate limiting**: No throttling in place — security concern (TD-05)
3. **Complete i18n**: Finish Spanish/English translation implementation with next-intl (TD-07)
4. **CI/CD automation**: Deployment still manual (TD-08)

---

## 6. Codebase Inventory (Verified)

| Layer | Count |
|-------|-------|
| Models | 24 across 22 files |
| Views | 20 files |
| Serializers | 12 files |
| Services | 12 files |
| URLs | 4 files |
| Management commands | 18 |
| Admin classes | 23 (22 ModelAdmin + 1 Form) |
| Frontend pages | 30 (10 public + 20 authenticated) |
| Frontend components | 36 |
| Zustand stores | 12 |
| Backend test files | 72 |
| Frontend unit test files | 66 |
| E2E spec files | 42 |
| **Total test files** | **180** |
