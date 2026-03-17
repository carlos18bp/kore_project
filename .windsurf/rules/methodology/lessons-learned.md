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
- **Service layer**: Business logic lives in `core_app/services/`, not in views or serializers. Views orchestrate; services decide.
- **SingletonModel pattern**: `SiteSettings` uses `pk=1` enforcement. Use `SiteSettings.load()` to fetch, never `.objects.create()`.
- **Route groups**: Next.js `(public)/` for unauthenticated pages, `(app)/` for authenticated pages. Each group has its own `layout.tsx`.
- **Pre-registration flow**: Guest users have their credentials stored in `PaymentIntent` (hashed password). User account created only after successful Wompi webhook.

---

## 2. Code Style & Conventions

- **Backend**: Single Django app (`core_app`) with modular subdirectories (models/, views/, serializers/, services/, urls/).
- **Model files**: One file per domain concept (e.g., `booking.py`, `payment.py`). Exception: `content.py` has 4 related models (SiteSettings, FAQCategory, FAQItem, ContactMessage).
- **Base model**: All timestamped models inherit `TimestampedModel` (created_at, updated_at auto-fields).
- **Status enums**: All status fields use Django `TextChoices` (not IntegerChoices). String values in DB.
- **Frontend state**: Zustand stores in `lib/stores/`. 4 stores: auth, booking, checkout, subscription.
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
- **Django admin customization**: `SubscriptionAdmin` has custom `save_model()` that syncs `sessions_total` from the package. This is a business rule enforced at the admin layer.
- **Redirects**: Old Spanish URLs (`/programas`, `/la-marca-kore`, `/calendario`) redirect to English equivalents in `next.config.ts`.
