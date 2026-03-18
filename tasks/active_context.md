# Active Context — KÓRE

## 1. Current State

The KÓRE platform is **fully functional in production** at `korehealths.com`. All core features are implemented and deployed:

- Authentication, packages, subscriptions, booking, payments (Wompi), notifications, content management, analytics, admin panel
- Backend: Django 6 + DRF + Huey (periodic tasks) + MySQL (prod)
- Frontend: Next.js 16 (static export) + Zustand + Tailwind CSS
- Deployment: Gunicorn + Nginx + systemd on Ubuntu

---

## 2. Recent Focus Areas

- **CI fix + coverage improvements** (latest):
  - Fixed `FileNotFoundError` in CI: `logs/` directory not present → added `mkdir` in `settings.py` + tracked `backend/logs/.gitkeep`
  - **Frontend coverage → ~100%**: Sidebar.tsx onClick handler + bookingStore.ts stale-request guards
  - **Backend coverage improvements**: admin.py SubscriptionAdminForm.clean + save_model (4 tests), wompi_service.py _extract_response_details + error paths (7 tests), create_fake_data.py already 100%
  - Committed as `c127e2c` on branch `kore_project-c-1`
- **Test coverage remediation** (previous): Implemented audit plan from `test-coverage-audit-b5c649.md`:
  - **Backend**: +3 serializer test files (wompi 42 tests, subscription 7 tests, trainer_profile 8 tests) + 1 permissions test file (19 tests) → 59 backend test files
  - **Frontend unit**: +4 component tests (NoSessionsModal, ForWhom, Problems, ConditionalWhatsApp) + 3 page tests (ContactPage, FAQPage, TermsPage) → 57 frontend test files
  - **E2E**: +4 new flow definitions (booking-cancel-flow, checkout-payment-status-polling, subscription-cancel-flow, auth-protected-routes) + 4 spec files → 38 E2E test files, 38 flow definitions
  - Grand total: **155 test files** (up from 154)
- **CI coverage workflows**: Added 3 coverage report artifacts + combined summary to GitHub Actions CI pipeline
- **Quality gates**: Test quality gate script (`scripts/test_quality_gate.py`) and quality standards documentation in place

---

## 3. Active Decisions & Considerations

| Decision | Context |
|----------|---------|
| Static export over SSR | Next.js `output: 'export'` — simplifies deployment (no Node.js in prod) but limits dynamic features |
| Wompi as sole payment provider | Colombian market — may need multi-provider support in future |
| Huey over Celery | Lightweight choice for 2 periodic tasks — may need re-evaluation if task complexity grows |
| SQLite for dev | Acceptable for now but creates risk of schema drift vs MySQL in production |
| Pre-registration with password in PaymentIntent | Needed for guest checkout → account creation flow; sensitive data concern noted |

---

## 4. Development Environment

| Component | Status |
|-----------|--------|
| Backend (Django 6 / Python 3.12) | ✅ Running |
| Frontend (Next.js 16 / Node 22) | ✅ Running |
| Database (SQLite dev) | ✅ Available |
| Redis (Huey broker) | ⚠️ Optional in dev (`HUEY_IMMEDIATE=true`) |
| Fake data commands | ✅ Available (16 management commands) |
| Testing tools | ✅ pytest, Jest, Playwright all configured |

---

## 5. Next Steps

1. **Push branch & verify CI passes**: Commit `c127e2c` fixes the backend logging crash; frontend tests should also pass with current code
2. **Complete i18n**: Finish Spanish/English translation implementation with next-intl
3. **Password reset flow**: Currently missing — needed for user self-service
4. **API rate limiting**: No throttling in place — security concern
5. **CI/CD automation**: CI now includes coverage reports; deployment still manual (TD-08 partially addressed)

---

## 6. Branch & Context

- **Current branch**: `kore_project-c-1`
- **Base branch**: `master`
- **Last significant change**: CI logging fix + test coverage improvements (commit `c127e2c`)
