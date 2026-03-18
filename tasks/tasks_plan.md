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
| **Availability Slots** (CRUD, blocking) | ✅ Complete | Trainer-owned, unique constraint |
| **Payments** (Wompi integration, webhook) | ✅ Complete | Card, Nequi, PSE, Bancolombia |
| **PaymentIntent** (checkout flow) | ✅ Complete | Pre-payment state tracking |
| **Notifications** (email, status tracking) | ✅ Complete | 9 notification types |
| **Content** (SiteSettings, FAQ, ContactMessage) | ✅ Complete | Singleton settings, admin-managed |
| **Analytics Events** (tracking) | ✅ Complete | 4 event types |
| **Admin Panel** (all models registered) | ✅ Complete | 13 ModelAdmin classes |
| **Google reCAPTCHA** | ✅ Complete | Site key + verification endpoints |
| **Trainer Profiles** | ✅ Complete | 1:1 with User (role=trainer) |
| **Landing Page** (Hero, Programs, Pricing, etc.) | ✅ Complete | Public pages with animations |
| **Dashboard** (customer area) | ✅ Complete | Session overview, upcoming reminder |
| **Calendar View** | ✅ Complete | Booking calendar for customers |
| **Checkout Page** (Wompi widget) | ✅ Complete | Multiple payment methods |
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
| TD-06 | No password reset flow implemented | Medium | Open |
| TD-07 | next-intl installed but translations not fully implemented | Low | Open |
| TD-08 | No automated CI deployment (manual git pull + restart) | Low | Open |

---

## 3. Testing Status

### Backend (pytest)

| Category | Test Files | Coverage Area |
|----------|-----------|---------------|
| Models | 12 | All 14 models |
| Views | 16 | All 12 view modules + extended + admin + admin forms |
| Serializers | 11 | All 11 serializer modules |
| Services | 5 | All 5 services |
| Tasks | 2 | Recurring billing + expiry reminders |
| Commands | 7 | Management commands |
| Permissions | 1 | Custom permissions (is_admin_user, IsAdminRole, IsAdminOrReadOnly) |
| Utils | 2 | Forms + test suite runner |
| **Total** | **60 files** | |

### Frontend Unit (Jest)

| Category | Test Files | Coverage Area |
|----------|-----------|---------------|
| Components | 32 | All components (incl. NoSessionsModal, ForWhom, Problems, ConditionalWhatsApp) |
| Stores | 4 | All 4 Zustand stores |
| Views/Pages | 17 | All page-level tests (incl. ContactPage, FAQPage, TermsPage) |
| Services | 1 | HTTP client |
| Composables | 1 | useScrollAnimations |
| Styles | 1 | Cursor styles |
| Reporters | 1 | Flow reporter |
| **Total** | **57 files** | |

### E2E (Playwright)

| Category | Test Files | Coverage Area |
|----------|-----------|---------------|
| App (authenticated) | 21 | Dashboard, calendar, booking, subscription, sessions, cancel flows |
| Auth | 4 | Login, logout, persistence, protected routes |
| Public | 13 | Home, programs, checkout, contact, FAQ, register, navbar, terms, brand, payment polling |
| **Total** | **38 files** | |

### Grand Total: 155 test files
### Flow Definitions: 38 flows (34 original + 4 new)

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
| High | Implement password reset flow | User experience |
| High | Add API rate limiting (django-ratelimit or DRF throttling) | Security |
| Medium | Complete i18n with next-intl (Spanish/English) | Market reach |
| Medium | Add CI/CD pipeline for automated deployment | DevOps efficiency |
| Medium | Migrate dev database to MySQL for parity with production | Reliability |
| Low | Add WebSocket notifications for real-time booking updates | UX polish |
| Low | Implement admin dashboard with analytics charts | Business intelligence |
| Low | Add Sentry or similar error tracking in production | Observability |
