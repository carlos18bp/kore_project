---
trigger: model_decision
description: Project intelligence and lessons learned. Reference for project-specific patterns, preferences, and key insights discovered during development.
---

# Lessons Learned — KoreProject

This file captures important patterns, preferences, and project intelligence that help work more effectively with this codebase. Updated as new insights are discovered.

---

## 1. Architecture Patterns

- **Static export + Django serving**: Next.js builds to `out/` → moved to `backend/templates/`. Django serves HTML via catch-all `serve_nextjs_page` view. No Node.js in production.
- **Webhook-driven state machine**: PaymentIntent starts as `pending` → Wompi webhook confirms → creates Payment + Subscription atomically. Never create subscriptions on the client side.
- **Service layer**: Business logic lives in `core_app/services/` (12 services), not in views or serializers. Views orchestrate; services decide.
- **Calculator service pattern**: Pure-function calculators for each diagnostic module (anthropometry, posturometry, physical_evaluation, nutrition, parq, kore_index). They receive data as args, never access DB directly. Models call them in `save()`.
- **Auto-computed on save**: All 5 diagnostic models compute their indices in `save()` — ensures data consistency. The model orchestrates: snapshot demographics → call calculator → set fields → super().save().
- **Cross-module integration**: `PhysicalEvaluation._get_anthropometry_context()` and `._get_posturometry_context()` pull the latest eval from sibling modules to generate cross-module alerts.
- **Cooldown enforcement**: Assessment views (nutrition: 7 days, PAR-Q: 90 days) check last submission date before allowing new entries. Enforced at the view level, not the model.
- **Trainer-vs-client endpoint pattern**: Diagnostic views use separate `APIView` classes (e.g., `TrainerAnthropometryListCreateView` vs `ClientAnthropometryListView`) instead of a single ViewSet with permission branching.
- **SingletonModel pattern**: `SiteSettings` uses `pk=1` enforcement. Use `SiteSettings.load()` to fetch, never `.objects.create()`.
- **Route groups**: Next.js `(public)/` for unauthenticated pages, `(app)/` for authenticated pages. Each group has its own `layout.tsx`.
- **Pre-registration flow**: Guest users have their credentials stored in `PaymentIntent` (hashed password). User account created only after successful Wompi webhook.

---

## 2. Code Style & Conventions

- **Backend**: Single Django app (`core_app`) with modular subdirectories (models/, views/, serializers/, services/, urls/).
- **Model files**: One file per domain concept (e.g., `booking.py`, `payment.py`). Exception: `content.py` has 4 related models (SiteSettings, FAQCategory, FAQItem, ContactMessage).
- **Base model**: All timestamped models inherit `TimestampedModel` (created_at, updated_at auto-fields).
- **Status enums**: All status fields use Django `TextChoices` (not IntegerChoices). String values in DB.
- **Frontend state**: Zustand stores in `lib/stores/`. 12 stores: auth, booking, checkout, subscription, profile, anthropometry, nutrition, parq, physicalEvaluation, posturometry, pendingAssessments, trainer.
- **HTTP client**: Centralized in `lib/services/http.ts` using Axios. All API calls go through this.
- **Currency**: Default is `COP` (Colombian Pesos). Wompi amounts are in cents (multiply by 100).
- **Naming**: Backend uses snake_case, frontend uses camelCase. API responses are snake_case (DRF default).

---

## 3. Development Workflow

- **Virtual environment**: Always `source venv/bin/activate` before any backend command.
- **Fake data**: Use `python manage.py create_fake_data` for seeding. `delete_fake_data` for cleanup. Individual commands exist for granular seeding (e.g., `create_fake_bookings`, `create_fake_slots`).
- **Frontend build**: `npm run build` exports static files AND moves them to `backend/templates/`. This is destructive — it deletes the existing `templates/` directory first.
- **API proxy in dev**: Next.js rewrites `/api/*` to `http://localhost:8000/api/*` — no CORS issues in development.
- **Test execution**: Run specific files only, never full suites. Max 20 tests or 3 commands per cycle.
- **Pre-commit**: `.pre-commit-config.yaml` exists — linting runs before commits.

---

## 4. Testing Insights

- **Backend tests** organized by layer: `tests/models/`, `tests/views/`, `tests/serializers/`, `tests/services/`, `tests/tasks/`, `tests/commands/`, `tests/permissions/`, `tests/utils/`.
- **Frontend unit tests** in `app/__tests__/` mirroring component structure.
- **E2E tests** in `frontend/e2e/` split by `app/` (authenticated), `auth/`, `public/`.
- **conftest.py** at backend root has shared fixtures. Per-directory conftest files exist (e.g., `tests/commands/conftest.py`).
- **Quality gate**: `scripts/test_quality_gate.py` validates test quality. Run with `--semantic-rules strict`.
- **Coverage tools**: pytest-cov for backend, Jest coverage for frontend unit, monocart-reporter for E2E.
- **Flow definitions**: E2E tests tagged with `@flow:<flow-id>` matching `flow-definitions.json`.
- **jest.resetAllMocks > jest.clearAllMocks**: Always use `jest.resetAllMocks()` in `beforeEach` for Zustand store tests. `clearAllMocks` only clears call counts; it does NOT clear `mockResolvedValueOnce`/`mockReturnValueOnce` queues, causing mock leakage between tests.
- **Component test mocks must track imports**: When a component adds new store imports, the test file must add matching `jest.mock()` calls. Missing mocks cause silent rendering failures.
- **E2E: TimeSlotPicker defaults to 12h format** — slot labels use `hour12: true` (AM/PM). All `slotLabel` helpers in tests must use `hour12: true` to match.
- **E2E: Virtual slot system** — BookSessionPage generates slots client-side from `WEEKDAY_WINDOWS`, NOT from the API `availability-slots` endpoint. The API is only used for slot resolution at confirmation time. Calendar days Mon-Sat within 30-day horizon are enabled automatically.
- **E2E: 16h booking buffer** — `slotsForDate` filters out virtual slots starting within 16h of now. Mock slot times should use afternoon hours (e.g., `T17:00:00Z`) to avoid being filtered when tests run late in the day.
- **E2E: Never use `forceClickCalendarDay` hacks** — directly calling React `__reactProps$` onClick bypasses Playwright actionability checks and masks real bugs (disabled buttons). Use normal `page.getByRole('button', { name: dayNum, exact: true }).click()` instead.
- **E2E: `route.continue()` vs `route.fallback()`** — `route.continue()` sends to the real server (fails if no backend). `route.fallback()` defers to the next matching Playwright route handler. Use `route.fallback()` or explicit `route.fulfill()` for GET handlers in mock setups.
- **E2E: LIFO route ordering** — Playwright routes registered LAST have highest priority. When `loginAsTestUser` or `setupDefaultApiMocks` register routes internally, test-specific overrides must be registered AFTER those calls.
- **E2E: ProfileCompletionCTA overlay** — blocks all page interactions (z-index 60). Auth mocks must include `profile_completed: true` and `customer_profile` object. MoodCheckIn modal requires `today_mood` to be non-null.
- **E2E: subscription-expiry-reminder parallel flakiness** — SubscriptionExpiryReminder depends on `justLoggedIn` flag (set during login, cleared on page reload). Tests pass with `--workers=1` but can be flaky with parallel workers due to shared sessionStorage context.
- **E2E: Turbopack dev server instability under heavy test load** — The Next.js 16 Turbopack dev server degrades after ~8–10 rapid sequential page loads, causing empty page renders (HTML shell loads but React doesn't hydrate). Fix: use `--retries=1` for resilience, restart dev server between large test batches, prefer direct navigation (`injectAuthCookies` + `setupDefaultApiMocks` + `page.goto`) over multi-step navigation (dashboard-first then sidebar click).
- **E2E: Strict mode violations from duplicate text** — Playwright strict mode rejects `getByText('X')` when 'X' appears in multiple elements (e.g., user name in sidebar + main content, "Sesiones completadas" as stats label + section heading). Fix: scope assertions to a container using `heading.locator('..')` to get the parent card, then `card.getByText(...)`.
- **E2E: Trainer auth mock pattern** — Trainer-role tests use `injectTrainerAuthCookies` (sets `role: 'trainer'` cookie + `mockTrainerAuthProfile`) instead of `mockLoginAsTestUser`. The trainer layout at `(app)/` redirects trainers to `/trainer/dashboard`, so trainer tests must navigate to `/trainer/*` routes.

---

## 5. Deployment & Production

- **Domain**: `korehealths.com`
- **Server**: Ubuntu with Gunicorn (2 workers) behind Nginx (SSL termination).
- **Services**: 3 systemd units — `kore_project.service`, `kore_project.socket`, `kore-huey.service`.
- **Database**: MySQL 8+ in production, SQLite in development.
- **Deploy process**: Manual — `git pull origin master` → pip install → migrate → npm build → collectstatic → restart services.
- **Nginx caching**: `_next/static/` assets cached for 1 year.
- **SSL**: Let's Encrypt via certbot. `SECURE_PROXY_SSL_HEADER` configured in `settings_prod.py`.

---

## 6. System-Specific Knowledge

- **Wompi sandbox aliases**: The settings helper `_resolve_wompi_base_url()` accepts `test`, `sandbox`, `uat` — all resolve to sandbox URL.
- **Huey immediate mode**: Set `HUEY_IMMEDIATE=true` in dev to run tasks synchronously (no Redis needed).
- **Silk profiler**: Enable via `ENABLE_SILK=true`. Staff-only access. Has garbage collection management command.
- **Django admin customization**: `SubscriptionAdmin` has custom `save_model()` that syncs `sessions_total` from the package. This is a business rule enforced at the admin layer. 23 Admin classes total (22 ModelAdmin + 1 Form).
- **Redirects**: Old Spanish URLs (`/programas`, `/la-marca-kore`, `/calendario`) redirect to English equivalents in `next.config.ts`.
- **Slot schedule service**: `services/slot_schedule.py` centralizes weekly availability windows, booking horizon, rollover cap, and slot-generation function used by both management commands and maintenance tasks.
- **KORE General Index**: Composite score (0–100) aggregating all diagnostic modules. Weights: Anthropometry 20%, Metabolic risk 15%, Posture 20%, Physical condition 20%, Wellbeing 10%, Nutrition 15%. Served via `PendingAssessmentsView`.
- **Scientific references in docstrings**: All calculator services include scientific basis citations (ACSM, WHO, CSEP, Kendall, PAR-Q+ 2024, etc.) in their module docstrings.
- **Password reset**: Uses `PasswordResetCode` model with 6-digit code, 10-minute expiry. `create_for_user()` invalidates previous codes before creating new one.
- **Terms acceptance**: `TermsAcceptance` model with versioned consent, IP/user-agent audit trail, unique constraint on (user, terms_version). Current version defined as `CURRENT_TERMS_VERSION` constant.

---

## 7. User Preferences & Rules

### E2E Testing Rule: Real User Integration
- **Every E2E test must reflect a real user integration** - tests should simulate actual user behavior and journeys, not just technical functionality

### Documentation Language
- **All documentation must be written in English** - user preference for English documentation across the project

### Test Execution Rules
- **Maximum 20 tests per block, 3 commands per execution** - avoid running full test suites
- **Run only specific test files created or modified** - never execute `pytest gym_app/tests/` or similar full suite commands
- **Targeted regression tests only** - execute tests in small, focused blocks

### Frontend Design System & Responsiveness
- **Preserve established design system/styles** - any new styled component must follow project's existing design patterns
- **Full responsiveness required** - all new UI implementations must be fully responsive across devices

### Quality Gate — Deterministic Time Pattern
- **Never use bare `timezone.now()` in test code** — define a module-level `FIXED_NOW` constant and use `monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)` when production code also calls `timezone.now()` internally
- **`pytest.raises()` alone doesn't satisfy the quality gate `no_assertions` rule** — always add an explicit `assert` after the context manager (e.g., `assert exc_info.value`, count assertions)
- **`IntegrityError` inside `pytest.raises` breaks the DB transaction** — wrap the raising code in `transaction.atomic()` if you need subsequent DB queries
- **Quality gate `unverified_mock` rule** — every `MagicMock()` must have either `assert_called*()` verification or a `# quality: disable unverified_mock (reason)` comment
- **Quality gate `test_too_long` rule (>50 lines)** — extract setup helpers to module-level functions/classes to keep test functions concise

### User Navigation Flow Registration
- **Every new user navigation flow must be registered** in:
  - `docs/USER_FLOW_MAP.md`
  - `frontend/e2e/flow-definitions.json`
- **Avoid duplication** - check if flow already exists before creating new registration
