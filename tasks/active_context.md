# Active Context — KÓRE

## 1. Current State

The KÓRE platform is **fully functional in production** at `korehealths.com` (production checkout: `master`). The **July release — "Fase 2: Economía de Créditos y Gamificación" (13 functionalities) is complete and merged into `july-release`**, awaiting promotion to `master` via the umbrella **PR #52**.

- **Core**: Authentication, packages, subscriptions, booking, payments (Wompi), notifications, content management, analytics, admin panel
- **Diagnostic Engine**: 5 assessment modules (anthropometry, posturometry, physical evaluation, nutrition habits, PAR-Q+) with auto-computed indices and KORE General Index
- **Client Management**: Customer profiles, trainer client views, mood/weight tracking, pending assessments dashboard, trainer alerts & risk scores, trainer↔client messaging
- **Programs & Tracking (Fase 1)**: Monthly programs, daily logs, program progress signals, physical tests, adherence metrics
- **Nutrition Suite**: Daily nutrition logs, weekly nutrition plans, meal suggestions, nutrition products & plan upgrades
- **Credit Economy & Gamification (Fase 2 — July release)**: Credit engine (earn/lose rules hooked on Fase 1 signals), streaks with progressive bonuses (3/7/14/21/28 days), difficulty presets (Fácil/Medio/Difícil), daily check-in + workout captures, client credit views & wallet, internal store with redemptions, store enrichment (media + delivery photo), session entitlements (sesión adicional), buy credits via Wompi, buy nutrition (plan upgrade), post-session rating, trainer settings panel (difficulty + reschedule window + simulator), trainer pending-task hub, trainer engagement analytics, admin nutrition management, admin Reports/KPIs panel
- **Admin Platform (frontend)**: `admin-platform/` route group — users, subscriptions, plans, nutrition, reports (10 pages)
- **Backend**: Django 6 + DRF + Huey (11 tasks: 9 periodic + 2 on-demand) + 29 services + MySQL (prod)
- **Frontend**: Next.js 16 (static export) + 30 Zustand stores + 57 pages + 131 components
- **Testing**: **487 test files** (182 backend + 202 frontend unit + 103 E2E) · 104 registered E2E flows, runtime coverage 104/104 (CI artifact 2026-07-16)
- **Deployment**: Gunicorn + Nginx + systemd on Ubuntu; GitHub Actions CI (tests + quality gate) on push/PR

---

## 2. Recent Focus Areas

- **Release hardening pipeline — pass 2 (2026-07-22/23)** (latest — completed):
  - 5-phase skill-driven pipeline over `july-release`: (1) Memory Bank refresh, (2) `new-feature-checklist` + backend/frontend-unit coverage + quality gate, (3) `e2e-user-flows-check` + E2E closure (no gaps, 104/104), (4) `fake-data-refresh` on staging, (5) `deploy-and-check` on staging
  - Coverage closed: `import_food_catalog` 0→100%, `import_exercises` 57→99%, `physical_test_views` 59→100%, `trainer_intelligence_views` 60→97.5%, `tasks.py` 100%; frontend `trainerStore` 50→79%, `programStore` 53→94%, `SubCardCompact` 0→92%, `UserRow` 38→88%, `NotesTab` 41→65%. Quality gate 0 errors / 59 warnings (no regression). CI green @ `e814983` (Tests + Quality Gate)
  - E2E CI resharded 4 → 6 shards (517 listed tests, ~86/shard)
  - Staging: catalogs were empty (programs/nutrition seeders no-op'd) — imported via `import_exercises --csv` (1093; venv lacks openpyxl so Excel path unusable), `import_food_catalog` (5533 foods), `seed_meal_suggestions` (1000), then re-ran dependent seeders (23 programs / 23 plans / 23 risk scores). Credit ledger coherent (532 confirmed rows, 0 inconsistencies)
  - Staging serving restored: nginx site `kore_staging_project` re-enabled + Let's Encrypt cert emitted for `korehealths.projectapp.co` (2026-07-23); health/homepage/login 200, gunicorn+huey clean logs. Note: `post-deploy-check.sh` does not register `kore_project_staging` (manual equivalent checks used)
- **Release hardening pipeline — pass 1 (2026-07-17)** (completed — commits `0440992..9f2552b`):
  - Delivered: Memory Bank refresh, `create_fake_credits` seeder (+ PROTECT-order fix in `delete_fake_data`), flow-map reconciliation (runtime artifact = coverage source of truth, `expectedSpecs: 0` convention), 40 backend tests (`recurring_renewal` direct contract tests, day-close tasks, store serializers, `TrainerClientKPIView`), quality-gate warning sweep (86 → 59), revived P1-missing CI gate (`a501f05`, closes TD-11/ERROR-004)
  - Coverage baseline from CI artifacts @ `d7cf79b`: backend **89.90%**, frontend unit **86.75%** stmts / 77.04% branches, E2E flows 104/104, quality gate **99/100**
  - Staging DB was 18 migrations behind — migrated to `0068` and fake data reseeded (543 ledger rows, 0 accounting inconsistencies)
  - Remaining targets (pass 2): `import_food_catalog.py` (0%), `import_exercises.py` (57%), `physical_test_views.py` (59%), `tasks.py` non-day-close bodies (64%), `trainer_intelligence_views.py` (68%), `SubCardCompact` (38%), `UserRow` (38%), `NotesTab` (41%), `trainerStore` (50%), `programStore` (53%)
- **Fase 2 parts 9–11b + gaps merged (2026-07-10 → 2026-07-15)** (previous):
  - #58 trainer pending-task hub, #59 admin nutrition management, #60 post-session rating, #61 trainer settings panel, #62 admin Reports/KPIs, #63 trainer engagement analytics
  - Each sub-PR shipped with backend tests, store unit tests, E2E specs and flow-definitions updates (flow registry now v1.11.0, 104 flows)
- **Fase 2 parts 1–8 merged (2026-06 → 2026-07-07)** (previous):
  - Credit engine core, daily check-in + routine camera captures, client credit views, internal store, store enrichment (media + delivery photo), session entitlement (sesión adicional), buy credits with Wompi (#56), buy nutrition / plan upgrade (#57)
- **E2E user flows audit — 4 new flows registered + spec'd (2026-04-09)** (previous):
  - Registered `subscription-billing-failed-recovery`, `mobile-bottom-nav`, `trainer-mobile-bottom-nav`, `profile-mood-entry` (56 → 60 flows at the time); weight tracking documented as future work
- **Audit follow-up — 5 sprints completed (2026-04-09)** (previous):
  - Permission tests, wompi race-condition tests (100% on `wompi_service`/`wompi_views`), `create_fake_diagnostics` command, 8 model test files, race-condition store tests

---

## 3. Active Decisions & Considerations

| Decision | Context |
|----------|---------|
| Static export over SSR | Next.js `output: 'export'` — simplifies deployment (no Node.js in prod) but limits dynamic features |
| Wompi as sole payment provider | Colombian market — may need multi-provider support in future |
| Huey over Celery | Lightweight choice — now 11 tasks (9 periodic + 2 on-demand); still sufficient |
| SQLite for dev | Acceptable for now but creates risk of schema drift vs MySQL in production |
| Auto-computed indices on model save | All diagnostic models compute their indices in `save()` — ensures consistency but adds save-time cost |
| Pure-function calculator services | Calculators receive data as args (no DB access) — testable, composable, but requires model to orchestrate calls |
| APIView for assessment endpoints | Diagnostic views use `APIView` (not ViewSet) for finer trainer-vs-client endpoint control |
| Cooldown enforcement at view level | Nutrition (7d) and PAR-Q (90d) cooldowns checked in the view, not the model |
| Credit engine listens, never refactors | Fase 2 hooks onto existing Fase 1 signals (`ProgramProgress`, daily logs, bookings) — no changes to Fase 1 code paths |
| Day-close evaluation via Huey | No-show penalty evaluated at 23:55 (`close_daily_logs`) and credits day-close at 23:57 (`close_credits_day`) |
| Single release branch + umbrella PR | Feature sub-PRs merge into `july-release`; one umbrella PR (#52) promotes the release to `master` |
| Coverage truth = CI artifacts | Local scoped runs use `--no-cov` (pytest addopts include `--cov`); coverage numbers are read from CI artifacts only |
| `expectedSpecs: 0` for spec-less flows | `check-flow-definitions-sync.mjs` is bidirectional — registered flows without specs must carry `expectedSpecs: 0` or CI fails |

---

## 4. Development Environment

| Component | Status |
|-----------|--------|
| Backend (Django 6 / Python 3.12) | ✅ Running |
| Frontend (Next.js 16 / Node 22) | ✅ Running |
| Database (SQLite dev / MySQL prod) | ✅ Available |
| Redis (Huey broker) | ⚠️ Optional in dev (`HUEY_IMMEDIATE=true`) |
| Fake data commands | ✅ Available (29 management commands) |
| Testing tools | ✅ pytest (182 files), Jest (202 files), Playwright (103 files) |
| CI | ✅ GitHub Actions: `CI — Tests` (backend + unit + E2E sharded ×6, ~86 tests/shard + coverage summary) and `Test Quality Gate` |

---

## 5. Next Steps

1. **Finish hardening pass 2** (in progress): coverage passes on the remaining targets (§2), quality-gate no-regression check, E2E closure, fake-data refresh + staging deploy-and-check
2. **Merge PR #52** (`july-release` → `master`) once the pipeline is green, then deploy to production
3. **API rate limiting**: No throttling in place — security concern (TD-05)
4. **Complete i18n**: Finish Spanish/English translation implementation with next-intl (TD-07)
5. **Automated deploy (CD)**: CI tests exist; deployment is still manual (TD-08)

---

## 6. Codebase Inventory (Verified 2026-07-22 @ `9f2552b`)

| Layer | Count |
|-------|-------|
| Model classes | 63 across 46 files |
| Views | 40 files |
| Serializers | 22 files |
| Services | 29 files |
| URLs | 4 files (126 URL patterns) |
| Management commands | 29 |
| Admin classes | 39 |
| Migrations | 68 (latest: `0068_session_rating`) |
| Huey tasks | 11 (9 periodic + 2 on-demand) |
| Frontend pages | 57 (11 public + 35 app + 10 admin-platform + 1 root-level) |
| Frontend components | 131 |
| Zustand stores | 30 |
| Backend test files | 182 |
| Frontend unit test files | 202 |
| E2E spec files | 103 |
| Flow definitions | 104 (registry v1.11.0) |
| **Total test files** | **487** |
