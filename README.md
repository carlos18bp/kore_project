# KÓRE Health

**Comprehensive wellness and personalized training platform.**

KÓRE Health connects people with mindful movement programs — personalized, semi-personalized, and therapeutic sessions — through a complete flow: program discovery, session scheduling, online payment, and ongoing tracking. The project includes an admin panel to manage packages, availability, bookings, payments, site content, and conversion analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Django 4.2 + Django REST Framework + SimpleJWT |
| **Frontend** | Next.js 16 + React 19 + TypeScript + Zustand + Tailwind CSS |
| **Animations** | GSAP + ScrollTrigger |
| **Backend Testing** | pytest + pytest-django + pytest-cov + coverage |
| **Frontend Testing** | Jest + React Testing Library (unit) · Playwright (E2E) |
| **Database** | SQLite (development) |

---

## Domain Models (Backend)

The backend is organized under `core_app` with the following models:

| Model | Purpose |
|---|---|
| **User** | Custom user with email-based authentication. Roles: `customer`, `admin`. |
| **Package** | Session package with price, duration, validity period, and policies. |
| **AvailabilitySlot** | Schedulable time block (with lock support). |
| **Booking** | Booking that links a customer + package + slot. States: `pending`, `confirmed`, `canceled`. |
| **Payment** | Payment record with traceability. Providers: Wompi, PayU, ePayco, PayPal. States: `pending`, `confirmed`, `failed`, `canceled`, `refunded`. |
| **Notification** | Booking confirmation, payment, and receipt email notifications. |
| **SiteSettings** | Global site configuration (singleton): contact info, social media, footer. |
| **FAQItem** | FAQ entries manageable from the admin panel. |
| **AnalyticsEvent** | Conversion events: WhatsApp click, package view, booking created, payment confirmed. |

All models (except User and SiteSettings) inherit from `TimestampedModel`, which provides `created_at` and `updated_at`.

---

## Main Views (Frontend)

| Route | View | Purpose |
|---|---|---|
| `/` | Home | Landing page with Hero, Philosophy, Programs, Pricing, Process, and Gallery sections. |
| `/kore-brand` | Brand | Brand story, pillars (interactive flower), diagnostic process, programs, and tracking. |
| `/programs` | Programs | Interactive program and plan selection with pricing and booking CTA. |
| `/login` | Login | Authentication form with validation and password visibility toggle. |
| `/dashboard` | Dashboard | Customer panel: active program, remaining sessions, next appointment, quick actions, and recent activity. |
| `/calendar` | Calendar | Compatibility route that redirects to the scheduling flow at `/book-session`. |

---

## Environment Setup

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser --email admin@kore.com
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local

# Install browsers for Playwright (E2E)
npx playwright install chromium
```

---

## Running the Servers

### Backend (API)

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

API base URL: `http://localhost:8000/api/`  
Admin panel: `http://localhost:8000/admin/`

### Frontend

```bash
cd frontend
npm run dev
```

Frontend URL: `http://localhost:3000`

---

## Test Data (Fake Data)

### Create test data

Generates users, packages, slots, bookings, payments, notifications, FAQs, and analytics events:

```bash
cd backend
source venv/bin/activate
python manage.py create_fake_data
```

Available options:

| Flag | Description | Default |
|---|---|---|
| `--customers N` | Number of customers to create | 10 |
| `--password PWD` | Password for customers | `customer123456` |
| `--admin-email EMAIL` | Admin email | `admin@kore.com` |
| `--admin-password PWD` | Admin password | `admin123456` |
| `--days N` | Days of availability to generate | 14 |
| `--bookings N` | Number of bookings | 20 |
| `--payments N` | Number of payments | 20 |
| `--skip-users` | Skip user creation | — |
| `--skip-packages` | Skip package creation | — |
| `--skip-slots` | Skip slot creation | — |

Individual commands can also be run:

```bash
python manage.py create_fake_users --customers 5
python manage.py create_fake_packages
python manage.py create_fake_slots --days 7
python manage.py create_fake_bookings --num 10
python manage.py create_fake_payments --num 10
python manage.py create_fake_notifications --num 10
python manage.py create_fake_analytics_events --num 30
python manage.py create_fake_content
```

### Delete test data

```bash
cd backend
source venv/bin/activate
python manage.py delete_fake_data --confirm
```

> Superusers and protected emails (`admin@kore.com`, `admin@example.com`) are **not** deleted. Use `--keep-users` to preserve all users.

---

## Tests

### Backend (pytest)

> **Important:** To get coverage reports, enable `coverage` instrumentation **before** running the tests using the `--cov` flag.

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run tests with coverage
pytest --cov=core_app --cov-report=term-missing

# Run tests for a specific module
pytest core_app/tests/models/
pytest core_app/tests/views/
pytest core_app/tests/serializers/
pytest core_app/tests/commands/
pytest core_app/tests/permissions/

# Run a specific test file
pytest core_app/tests/models/test_user.py
pytest core_app/tests/views/test_auth_views.py

# Coverage with HTML report
pytest --cov=core_app --cov-report=html
# Open htmlcov/index.html in the browser
```

**Backend test structure:**

```
core_app/tests/
├── models/          # Model and domain logic tests
├── serializers/     # DRF serializer tests
├── views/           # API endpoint tests
├── commands/        # Management command tests
└── permissions/     # Permission and access tests
```

### Frontend — Unit Tests (Jest)

```bash
cd frontend

# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run a specific file
npx jest app/__tests__/stores/authStore.test.ts
npx jest app/__tests__/components/Hero.test.tsx
```

**Frontend unit test structure:**

```
app/__tests__/
├── stores/          # Zustand stores (authStore)
├── services/        # HTTP services (axios)
├── composables/     # Custom hooks (useScrollAnimations)
├── components/      # UI components (Hero, Philosophy, Programs, etc.)
│   └── layouts/     # Layouts (Navbar, Footer, Sidebar)
└── views/           # Pages/views (Home, Login, Dashboard, etc.)
```

### Frontend — E2E Tests (Playwright)

By default, all E2E tests run across **three viewports**: Desktop Chrome, Mobile Chrome (Pixel 5), and Tablet (iPad Mini).

```bash
cd frontend

# Run all E2E tests (all viewports)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run with coverage report (all viewports)
npm run e2e:coverage

# Filter by viewport
npm run e2e:desktop          # Desktop Chrome only
npm run e2e:mobile           # Mobile Chrome (Pixel 5) only
npm run e2e:tablet           # Tablet (iPad Mini) only

# Combine viewport filter with a specific spec
npm run e2e:desktop -- e2e/auth/login.spec.ts
npm run e2e:mobile -- e2e/public/home.spec.ts

# Clean E2E test artifacts
npm run e2e:clean

# List available E2E modules (from flow-definitions.json)
npm run e2e:modules

# Run a single E2E module
npm run e2e:module -- auth

# Run module-scoped coverage (manual grep)
clear && npm run e2e:clean && npm run e2e:coverage -- --grep @module:auth

# Helper alias for module-scoped coverage
npm run e2e:coverage:module -- auth

# Run a specific spec (all viewports)
npx playwright test e2e/public/home.spec.ts
npx playwright test e2e/auth/login.spec.ts
```

> `--grep @module:<name>` only runs tests tagged with that module. The flow coverage report will still list other modules as missing because the subset was not executed.

> `npm run e2e:module` and `npm run e2e:coverage:module` use `flow-definitions.json` to validate module names.

**Frontend E2E test structure:**

```
e2e/
├── fixtures.ts      # Base test fixture with auth and mock helpers
├── public/          # Public pages (home, kore-brand, programs)
├── auth/            # Authentication flows (login, logout)
└── app/             # Authenticated pages (dashboard, calendar)
```

### Run All Test Suites (Sequential Default)

The `scripts/run-tests-all-suites.py` script runs backend (pytest), frontend unit (Jest), and E2E (Playwright) tests with a unified final report. Coverage output is **opt-in** via `--coverage`, which enables the per-suite coverage tables in the console and the coverage lines in the final summary. It defaults to **sequential** execution (verbose output) and can be switched to parallel mode (quiet output with progress summaries by default).

#### Usage examples

```bash
# Run all three suites sequentially (default)
python scripts/run-tests-all-suites.py

# Run in parallel
python scripts/run-tests-all-suites.py --parallel

# Resume only failed/unknown suites
python scripts/run-tests-all-suites.py --resume

# Include coverage summaries (backend, unit, E2E flow coverage)
python scripts/run-tests-all-suites.py --coverage

# Force output verbosity (mutually exclusive flags)
python scripts/run-tests-all-suites.py --parallel --verbose
python scripts/run-tests-all-suites.py --quiet

# Skip specific suites
python scripts/run-tests-all-suites.py --skip-e2e
python scripts/run-tests-all-suites.py --skip-backend --skip-unit

# Forward extra args to individual runners
python scripts/run-tests-all-suites.py --backend-args="-k test_auth" --e2e-args="--grep @flow:auth"

# Control worker counts
python scripts/run-tests-all-suites.py --unit-workers=2 --e2e-workers=1

# Custom report directory
python scripts/run-tests-all-suites.py --report-dir=custom-reports
```

#### CLI options

| Flag | Description | Default |
|---|---|---|
| `--skip-backend` | Skip backend pytest suite | — |
| `--skip-unit` | Skip frontend unit tests (Jest) | — |
| `--skip-e2e` | Skip E2E tests (Playwright) | — |
| `--parallel` | Run suites in parallel instead of sequentially | `false` |
| `--resume` | Re-run failed/unknown suites using `last-run.json` | `false` |
| `--coverage` | Show per-suite coverage reports in the final summary | `false` |
| `--verbose` | Force verbose output (even in parallel mode) | `false` |
| `--quiet` | Force quiet output (even in sequential mode) | `false` |
| `--backend-markers EXPR` | pytest marker expression (`-m`) | — |
| `--backend-args ARGS` | Extra args forwarded to pytest | — |
| `--unit-args ARGS` | Extra args forwarded to Jest | — |
| `--e2e-args ARGS` | Extra args forwarded to Playwright | — |
| `--unit-workers N` | Jest `--maxWorkers` value | auto |
| `--e2e-workers N` | Playwright `--workers` value | per config |
| `--report-dir DIR` | Directory for per-suite log files + resume metadata | `test-reports` |

> `--verbose` and `--quiet` are mutually exclusive (only one can be used at a time).

#### Output modes

- **Sequential default**: verbose output (live command output in the console).
- **Parallel default**: quiet output (console shows progress + final summary, per-suite logs capture full output).
- Use `--verbose` to force live output even when running in parallel (the progress block is disabled for readability).
- Use `--quiet` to keep output minimal even in sequential mode.
- Coverage tables + summary lines are shown **only** with `--coverage`.

#### Logs and resume metadata

Log files are written to the report directory (default: `test-reports/`, one per suite: `backend.log`, `frontend-unit.log`, `frontend-e2e.log`). The last run summary is stored at `test-reports/last-run.json` with per-suite metadata plus a `run_id`.

Behavior by mode:

- **Fresh run (no `--resume`)**: clears log files and deletes any existing `last-run.json`.
- **Resume (`--resume`)**: re-runs only failed/unknown suites; logs append and include a header with run ID, timestamp, suite name, and command for each appended run.
- **Missing resume file**: runs all suites and creates a new `last-run.json`.
- **All suites previously OK**: exits early with the message `"Todas las suites ya pasaron. Si deseas ejecutarlas de nuevo, ejecuta el comando sin --resume."`
- **Status resolution**: the runner trusts an explicit `status` field (`ok`/`failed`) first, then falls back to `returncode`, otherwise treats the suite as `unknown` and re-runs it.

Sample resume format:

```json
{
  "schema_version": 1,
  "run_id": "a1b2c3d4e5f6",
  "updated_at": "2026-02-24T20:00:00Z",
  "suites": {
    "backend": {
      "suite": "backend",
      "status": "ok",
      "returncode": 0,
      "duration": 38.2,
      "command": ["python", "-m", "pytest"],
      "timestamp": "2026-02-24T20:00:00Z",
      "log_path": "test-reports/backend.log"
    }
  }
}
```

---

## Quick Reference Commands

| Command | Description |
|---|---|
| `python manage.py runserver` | Start the backend server |
| `python manage.py migrate` | Run database migrations |
| `python manage.py expire_subscriptions` | Run the daily subscription expiration task |
| `python manage.py create_fake_data` | Create a full set of test data |
| `python manage.py delete_fake_data --confirm` | Delete test data |
| `npm run dev` | Start the frontend server |
| `npm test` | Run unit tests (Jest) |
| `npm run test:coverage` | Unit tests with coverage |
| `npm run test:e2e` | Run E2E tests — all viewports (Playwright) |
| `npm run e2e:coverage` | E2E tests with coverage report |
| `npm run e2e:desktop` | E2E tests — Desktop Chrome only |
| `npm run e2e:mobile` | E2E tests — Mobile Chrome (Pixel 5) only |
| `npm run e2e:tablet` | E2E tests — Tablet (iPad Mini) only |
| `npm run e2e:clean` | Clean E2E artifacts |
| `npm run e2e:modules` | List E2E modules from flow-definitions.json |
| `npm run e2e:module` | Run a single E2E module via @module tag |
| `npm run e2e:coverage:module` | Run module-scoped E2E coverage |
| `python scripts/run-tests-all-suites.py` | Run all test suites sequentially |
| `python scripts/run-tests-all-suites.py --parallel` | Run all test suites in parallel |
| `python scripts/run-tests-all-suites.py --resume` | Re-run failed/unknown suites |
| `python scripts/run-tests-all-suites.py --coverage` | Include coverage output in console + final summary |

---

## Automation

To expire subscriptions automatically, schedule the daily command via cron:

```bash
0 0 * * * cd /path/to/kore_project/backend && source venv/bin/activate && python manage.py expire_subscriptions
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django secret key | — |
| `DJANGO_DEBUG` | Debug mode | `true` |
| `DJANGO_ALLOWED_HOSTS` | Allowed hosts | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `JWT_ACCESS_TOKEN_LIFETIME_DAYS` | Access token lifetime | `1` |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | Refresh token lifetime | `7` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | API base URL | `http://localhost:8000/api` |
| `PLAYWRIGHT_BASE_URL` | Base URL for E2E tests | `http://localhost:3000` |