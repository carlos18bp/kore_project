# Backend Rules — Kore Project

## Stack And Scope
- Django 6.0 + DRF 3.16, Python 3.x.
- **Single business app**: `core_app` — contains all ~20+ models, views (FBV + CBV), serializers, services, and tests for the KORE health/wellness platform.
- **Django project module**: `core_project` (not `kore_project`!). Settings module: `core_project.settings_prod`.
- Database: **MySQL 8** (production), **SQLite** (dev). Cache + queue: Redis.
- Auth: **JWT via SimpleJWT** for `/api/`, session for admin.
- Payments: **Wompi** (Colombian gateway).
- Custom Gunicorn config: `backend/gunicorn.conf.py` (2 workers, max_requests=800, bind to `/run/kore_project.sock`).

## Project Conventions
- Views are a **mix of FBV and CBV**. Both are valid:
  - **FBV with `@api_view`** (~18) — auth, profile, password reset, captcha.
  - **DRF ViewSets** (~10+) — Package, Subscription, Booking, Payment, Notification, FAQ, Analytics, AvailabilitySlot, TrainerProfile, ContactMessage.
  - **APIView** (~6+) — TrainerAnthropometryListCreateView, ClientAnthropometryListView, SiteSettingsView, TermsAcceptanceCreateView, etc.
- **Match the existing style** in the file you are touching. Do not enforce a single pattern.
- **Service layer is real and large**: `core_app/services/` holds the calculation logic for the health domain — `anthropometry_calculator`, `posturometry_calculator`, `physical_evaluation_calculator`, `kore_index_calculator`, `nutrition_calculator`, `parq_calculator`. Plus integrations: `email_service`, `wompi_service`, `booking_rules`, `slot_schedule`, `subscription_cleanup`, `ics_generator`. **Do not inline calculation logic into views.**
- The `User` model has `role` choices: `CUSTOMER`, `TRAINER`, `ADMIN`. ViewSets filter `get_queryset()` by `request.user`.
- Recurring billing: a Huey periodic task in `core_app/tasks.py` (`process_recurring_billing`) runs daily at **08:00 UTC** and charges renewals via `wompi_service`.
- Prefer Django ORM. Raw SQL only when strictly necessary, always parameterized.

## Auth And Security
- **`/api/` uses JWT via SimpleJWT** — `access: 1d`, `refresh: 7d`, `rotate=False`, `blacklist_after_rotation=True`. There is **no CSRF** on `/api/` because JWT is stateless.
- **`/admin/` uses Django session + CSRF**.
- `settings_prod.py` enforces HSTS (1y), `SECURE_SSL_REDIRECT=True`, secure cookies, NOSNIFF, `X_FRAME_OPTIONS=DENY`, and a `SECURE_PROXY_SSL_HEADER` for nginx → gunicorn.
- `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` are env-driven.
- File uploads are capped at 5MB (the frontend compresses to 150–400KB before upload).
- reCAPTCHA is verified server-side via the `verify_recaptcha` helper.
- Validate input in DRF serializers. Never disable CSRF or hardcode secrets.

## Commands
- Activate venv from `backend/`: `cd backend && source venv/bin/activate`
- Run backend tests: `pytest core_app/tests/path/to/test_file.py -v`
- Run a focused backend check: `python manage.py check`
- Run dev server: `python manage.py runserver`
- Make migrations: `python manage.py makemigrations core_app && python manage.py migrate`

## Testing Rules
- Run only the changed test file or a tight regression slice.
- Never run the full backend suite.
- Keep test names focused on one observable behavior.
- Prefer deterministic tests: freeze time, seed data explicitly, and avoid hidden global state.
- The custom calculators (anthropometry, posturometry, KORE index) deserve careful unit tests with golden-value fixtures.
