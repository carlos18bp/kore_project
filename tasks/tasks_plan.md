# Tasks Plan — KÓRE

## 1. Feature Status

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
| **Notifications** (email, status tracking) | ✅ Complete | 9 notification types |
| **Content** (SiteSettings, FAQ, ContactMessage) | ✅ Complete | Singleton settings, admin-managed |
| **Analytics Events** (tracking) | ✅ Complete | 4 event types |
| **Admin Panel** (all models registered) | ✅ Complete | 23 Admin classes (22 ModelAdmin + 1 Form) for 24 models |
| **Google reCAPTCHA** | ✅ Complete | Site key + verification endpoints |
| **Trainer Profiles** | ✅ Complete | 1:1 with User (role=trainer) |
| **Customer Profiles** | ✅ Complete | 1:1 with User (role=customer), avatar, goals, ID, profile completion |
| **Diagnostic Engine — Anthropometry** | ✅ Complete | BMI, waist-hip ratio, body fat %, lean mass, asymmetries; auto-computed on save |
| **Diagnostic Engine — Posturometry** | ✅ Complete | 4-view postural observations, photos, global/regional indices |
| **Diagnostic Engine — Physical Evaluation** | ✅ Complete | 8 fitness tests, age/sex baremos, cross-module alerts |
| **Diagnostic Engine — Nutrition Habits** | ✅ Complete | 8 dietary habit variables, habit score (0–10), 7-day cooldown |
| **Diagnostic Engine — PAR-Q+ Assessment** | ✅ Complete | 7 health questions, risk classification, 90-day cooldown |
| **KORE General Index** | ✅ Complete | Composite score (0–100) from all diagnostic modules |
| **Trainer Client Management** | ✅ Complete | Client list, detail, sessions, dashboard stats, per-client assessments |
| **Mood & Weight Tracking** | ✅ Complete | Daily mood (1–10) and weight (kg) logs, one per day |
| **Password Reset** | ✅ Complete | 6-digit code via email, 10-min expiry, forgot-password page |
| **Terms & Conditions Acceptance** | ✅ Complete | Versioned acceptance with IP/user-agent audit trail |
| **Pending Assessments Dashboard** | ✅ Complete | Aggregator endpoint + store for client dashboard notifications |
| **Landing Page** (Hero, Programs, Pricing, etc.) | ✅ Complete | Public pages with animations |
| **Dashboard** (customer area) | ✅ Complete | Session overview, upcoming reminder, pending assessments |
| **Calendar View** | ✅ Complete | Booking calendar for customers |
| **Checkout Page** (Wompi widget) | ✅ Complete | Multiple payment methods |
| **Trainer Dashboard & Client Views** | ✅ Complete | 8 trainer-specific pages |
| **Deployment** (Gunicorn + Nginx + systemd) | ✅ Complete | Production on korehealths.com |
| **Backups** (django-dbbackup) | ✅ Complete | Compressed SQL, configurable retention |
| **Silk Profiling** (optional) | ✅ Complete | Conditional middleware, staff-only access |
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
| TD-06 | ~~No password reset flow implemented~~ | Medium | ✅ Resolved — 6-digit code flow + forgot-password page |
| TD-07 | next-intl installed but translations not fully implemented | Low | Open |
| TD-08 | No automated CI deployment (manual git pull + restart) | Low | Open |
| TD-09 | ~~Diagnostic assessment E2E tests not yet implemented~~ | Medium | ✅ Resolved — Wave 2+3 cover all 5 assessment modules |
| TD-10 | ~~Trainer client management E2E tests not yet implemented~~ | Medium | ✅ Resolved — trainer-clients-list (9 tests) + trainer-client-detail (11 tests) |

---

## 3. Testing Status

### Backend (pytest)

| Category | Test Files | Coverage Area |
|----------|-----------|---------------|
| Models | 14 | All 24 models (incl. customer_profile, password_reset_code, subscription_model) |
| Views | 22 | All 20 view modules + admin forms + admin index sections |
| Serializers | 11 | 11 serializer modules |
| Services | 11 | All 12 services (incl. 6 calculators, slot_schedule, kore_index) |
| Tasks | 2 | Recurring billing + expiry reminders |
| Commands | 8 | Management commands (incl. backfill, maintain_slots, mgmt_core_flows) |
| Permissions | 1 | Custom permissions (IsAdminRole, IsAdminOrReadOnly, IsTrainerRole) |
| Utils | 2 | Forms + test suite runner |
| Helpers | 1 | Test helpers module |
| **Total** | **72 files** | |

### Frontend Unit (Jest)

| Category | Test Files | Coverage Area |
|----------|-----------|---------------|
| Components | 32 | All components (booking, checkout, faq, layouts, subscription, profile) |
| Stores | 12 | All 12 Zustand stores (auth, booking, checkout, subscription, profile, anthropometry, nutrition, parq, physicalEvaluation, posturometry, pendingAssessments, trainer) |
| Views/Pages | 17 | All page-level tests (incl. MySessionsPage, ProgramDetailPage) |
| Services | 1 | HTTP client |
| Composables | 1 | useScrollAnimations |
| Styles | 1 | Cursor styles |
| Reporters | 1 | Flow reporter |
| Scripts | 1 | E2E module CLI |
| **Total** | **66 files** | |

### E2E (Playwright)

| Category | Test Files | Coverage Area |
|----------|-----------|---------------|
| App (authenticated) | 22 | Dashboard, calendar, booking, subscription, sessions, cancel flows, profile |
| Auth | 4 | Login, logout, persistence, protected routes |
| Public | 14 | Home, programs, checkout, contact, FAQ, register, navbar, terms, brand, payment polling, forgot-password |
| Trainer | 8 | Trainer dashboard, clients list, client detail, anthropometry, nutrition, parq, physical-eval, posturometry |
| **Total** | **55 files** | |

### Grand Total: 180 test files
### Flow Definitions: 55 flows (0 uncovered, 55 covered by existing specs)

### E2E Coverage Gaps (0 uncovered flows — all waves complete)

| Wave | Priority | Flows | Status |
|------|----------|-------|--------|
| Wave 1 | P1 | auth-forgot-password, profile-management, trainer-clients-list, trainer-client-detail | ✅ Complete |
| Wave 1.5 | P1 | trainer-dashboard | ✅ Complete (8 tests) |
| Wave 2 | P2 | profile-password-change, customer-diagnosis, customer-nutrition, customer-parq, customer-physical-evaluation, customer-posturometry | ✅ Complete (38 tests) |
| Wave 3 | P2 | trainer-client-anthropometry, trainer-client-nutrition, trainer-client-physical-eval, trainer-client-posturometry, trainer-client-parq | ✅ Complete (25 tests) |
| Wave 4 | P3 | customer-pending-assessments | ✅ Complete (4 tests) |

---

## 4. Documentation Status

| Document | Location | Status |
|----------|----------|--------|
| PRD | `docs/methodology/product_requirement_docs.md` | ✅ Created |
| Technical | `docs/methodology/technical.md` | ✅ Created |
| Architecture | `docs/methodology/architecture.md` | ✅ Created |
| Tasks Plan | `tasks/tasks_plan.md` | ✅ Created |
| Active Context | `tasks/active_context.md` | ✅ Created |
| Error Documentation | `.windsurf/rules/methodology/error-documentation.md` | ✅ Template ready |
| Lessons Learned | `.windsurf/rules/methodology/lessons-learned.md` | ✅ Populated |
| Deployment Guide | `docs/deployment-guide.md` | ✅ Existing |
| Testing Quality Standards | `docs/TESTING_QUALITY_STANDARDS.md` | ✅ Existing |
| User Flow Map | `docs/USER_FLOW_MAP.md` | ✅ Existing |

---

## 5. Potential Improvements

| Priority | Improvement | Impact |
|----------|-------------|--------|
| ~~Critical~~ | ~~Write E2E specs for 13 remaining uncovered flows~~ | ✅ Done — all 55 flows covered |
| High | Add API rate limiting (django-ratelimit or DRF throttling) | Security |
| ~~High~~ | ~~E2E tests for diagnostic engine (anthropometry, posturometry, physical eval, nutrition, PAR-Q)~~ | ✅ Done (Wave 2) |
| ~~High~~ | ~~E2E tests for trainer client management flows~~ | ✅ Done (Wave 3) |
| Medium | Complete i18n with next-intl (Spanish/English) | Market reach |
| Medium | Add CI/CD pipeline for automated deployment | DevOps efficiency |
| Medium | Migrate dev database to MySQL for parity with production | Reliability |
| ~~Medium~~ | ~~E2E tests for password reset flow~~ | ✅ Done (12 tests) |
| Low | Add WebSocket notifications for real-time booking updates | UX polish |
| Low | Implement admin dashboard with analytics charts | Business intelligence |
| Low | Add Sentry or similar error tracking in production | Observability |
