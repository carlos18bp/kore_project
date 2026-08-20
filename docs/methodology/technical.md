# Technical Documentation — KÓRE

## 1. Technology Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.12+ | Runtime |
| Django | 6.0.x | Web framework |
| Django REST Framework | 3.16.x | REST API |
| SimpleJWT | 5.5.x | JWT authentication |
| django-cors-headers | 4.9.x | CORS handling |
| python-decouple | 3.8.x | Environment variable management |
| Huey | 2.5.x | Task queue (periodic billing, email reminders) |
| Redis | 7.2.x | Huey broker |
| Gunicorn | 23.0.x | WSGI server (production) |
| mysqlclient | 2.2.x | MySQL driver (production) |
| SQLite | built-in | Development database |
| django-dbbackup | 4.0.x | Database backups |
| django-silk | 5.0.x | Optional profiling/query analysis |
| requests | 2.31.x | HTTP client (Wompi API) |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.7 | React framework (App Router) |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Zustand | 5.0.x | State management |
| Axios | 1.13.x | HTTP client |
| Framer Motion | 12.34.x | Animations |
| GSAP | 3.14.x | Scroll animations |
| Lucide React | 0.564.x | Icons |
| Swiper | 12.1.x | Touch slider/carousel |
| next-intl | 4.8.x | Internationalization |
| js-cookie | 3.0.x | Cookie management (JWT tokens) |
| react-google-recaptcha | 3.1.x | CAPTCHA integration |
| clsx / tailwind-merge | latest | Conditional class utilities |

### Testing

| Tool | Version | Scope |
|------|---------|-------|
| pytest | 9.0.x | Backend unit/integration tests |
| pytest-django | 4.12.x | Django test integration |
| pytest-cov / coverage | 7.x | Backend coverage |
| ruff | 0.15.x | Python linting |
| Jest | 30.x | Frontend unit/component tests |
| @testing-library/react | 16.3.x | React component testing |
| @testing-library/user-event | 14.5.x | User interaction simulation |
| Playwright | 1.60.x | End-to-end browser tests |
| monocart-reporter | 2.10.x | E2E coverage reporting |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Web server | Nginx (SSL termination, static file serving) |
| App server | Gunicorn (2 workers, Unix socket) |
| Task queue | Huey + Redis |
| Database (prod) | MySQL 8+ |
| Database (dev) | SQLite |
| Process manager | systemd (gunicorn, huey services) |
| SSL | Let's Encrypt (certbot) |
| OS | Ubuntu/Debian |

---

## 2. Development Setup

### Prerequisites
- Python 3.12+
- Node.js 22+
- Redis (for Huey tasks, optional in dev with `HUEY_IMMEDIATE=true`)

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # configure variables
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm ci
npm run dev
```

### Fake Data
```bash
cd backend
source venv/bin/activate
python manage.py create_fake_data   # creates users, trainers, packages, slots, bookings, etc.
python manage.py delete_fake_data   # cleans up fake data
```

### Running Tests
```bash
# Backend
cd backend && source venv/bin/activate
pytest core_app/tests/path/to/test_file.py -v

# Frontend unit
cd frontend
npm test -- path/to/test.test.tsx

# E2E
cd frontend
npx playwright test path/to/test.spec.ts
```

---

## 3. Environment Configuration

All secrets via environment variables (`python-decouple` on backend, `process.env` on frontend).

### Backend (.env)
| Variable | Purpose | Default |
|----------|---------|---------|
| `DJANGO_ENV` | Environment detection | `development` |
| `DJANGO_SECRET_KEY` | Django secret | change-me placeholder |
| `DJANGO_ALLOWED_HOSTS` | Allowed hosts CSV | `localhost,127.0.0.1` |
| `DB_ENGINE` | Database engine | `django.db.backends.sqlite3` |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | Database connection | SQLite defaults |
| `CORS_ALLOWED_ORIGINS` | CORS origins CSV | `http://localhost:3000,3001` |
| `JWT_ACCESS_TOKEN_LIFETIME_DAYS` | JWT access lifetime | `1` |
| `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | JWT refresh lifetime | `7` |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Gmail SMTP | empty |
| `WOMPI_ENVIRONMENT` | Payment gateway env | `test` |
| `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_INTEGRITY_KEY` / `WOMPI_EVENTS_KEY` | Wompi keys | empty |
| `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA | empty |
| `HUEY_REDIS_URL` | Redis URL for task queue | `redis://localhost:6379/0` |
| `HUEY_IMMEDIATE` | Sync task execution (dev) | `false` |
| `ENABLE_SILK` | Enable Silk profiler | `false` |

### Frontend (.env)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

---

## 4. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Static export (`output: 'export'`)** | Next.js builds to static HTML served by Django; no Node.js server in production |
| **Django serves frontend** | Single-server deployment; Gunicorn serves API + static Next.js pages |
| **Wompi as payment gateway** | Colombian market standard; supports card, Nequi, PSE, Bancolombia |
| **PaymentIntent pattern** | Decouples user checkout from payment confirmation (webhook-driven) |
| **Huey over Celery** | Lightweight task queue; 11 tasks (9 periodic + 2 on-demand: billing, reminders, day closes, alerts, credit events) |
| **Zustand over Redux** | Simpler API, smaller bundle, scales fine at 30 stores |
| **Email-based auth (no username)** | Business requirement; custom `AbstractBaseUser` with email as `USERNAME_FIELD` |
| **SingletonModel for SiteSettings** | Ensures exactly one row; `pk=1` enforced on save |
| **JWT in cookies (js-cookie)** | Stored client-side for SPA-like navigation in static export |

---

## 5. Design Patterns

| Pattern | Where Used |
|---------|-----------|
| **Service layer** | `services/` — 29 services in families: core ops (booking_rules, email_service, ics_generator, subscription_cleanup, wompi_service, slot_schedule), 6 diagnostic calculators, billing (billing_calendar, recurring_renewal, renewal_history_service, admin_subscription_service), credit economy (credit_engine, credit_day_close), nutrition (nutrition_access, nutrition_plan_generator, meal_suggestion_service), programs (program_generator, progress_service, adherence_calculator), intelligence (clinical/behavioral alert engines, risk_score_service, trainer_engagement_service, reports_service) |
| **Calculator services** | Pure-function calculators for each diagnostic module (anthropometry, posturometry, physical_evaluation, nutrition, parq, kore_index) — no DB access, receive data as args |
| **ViewSet + Router** | CRUD endpoints via DRF DefaultRouter (13 registered ViewSets) |
| **APIView for assessments** | Diagnostic module views use `APIView` (not ViewSets) for finer control over trainer vs. client endpoints |
| **Custom permissions** | `IsAdminRole`, `IsAdminOrReadOnly`, `IsTrainerRole` for role-based access |
| **Webhook-driven state machine** | PaymentIntent → Payment + Subscription on Wompi webhook |
| **Abstract base models** | `TimestampedModel` (created_at, updated_at), `SingletonModel` |
| **Auto-computed on save** | All diagnostic models compute indices in `save()` via their calculator service |
| **Cross-module integration** | PhysicalEvaluation pulls context from latest AnthropometryEvaluation and PosturometryEvaluation |
| **Cooldown pattern** | Assessment views enforce time-based limits (nutrition: 7 days, PAR-Q: 90 days) |
| **Route groups** | Next.js `(public)/`, `(app)/` and `admin-platform/` route groups for layout separation |
| **Store pattern (Zustand)** | 30 stores: auth, booking, checkout, subscription, profile, 5 assessment stores, pendingAssessments, trainer, program, progress, physicalTest, nutritionDaily, nutritionUpgrade, wallet, creditPurchase, creditValues, storeStore, sessionRating, trainerSettings, trainerTasks, trainerEngagement, adminUser, adminSubscription, adminPackage, adminNutrition, adminReports |
| **Composables** | `useScrollAnimations` for reusable scroll animation logic |

---

## 6. Project Structure

```
kore_project/
├── backend/
│   ├── core_project/          # Django project config (settings, urls, wsgi)
│   ├── core_app/              # Main Django app
│   │   ├── models/            # 46 model files → 63 model classes
│   │   ├── views/             # 40 view files
│   │   ├── serializers/       # 22 serializer files
│   │   ├── services/          # 29 service files (core ops, 6 calculators, billing, credit economy, nutrition, programs, intelligence)
│   │   ├── urls/              # 4 URL config files (126 patterns)
│   │   ├── management/commands/ # 29 management commands
│   │   ├── migrations/        # 68 migrations (latest: 0068_session_rating)
│   │   ├── tests/             # 182 test files
│   │   ├── templates/         # Email templates, admin overrides
│   │   ├── admin.py           # 39 Admin classes
│   │   ├── permissions.py     # Custom DRF permissions (IsAdminRole, IsAdminOrReadOnly, IsTrainerRole)
│   │   ├── tasks.py           # 11 Huey tasks (9 periodic + 2 on-demand)
│   │   └── forms.py           # Custom user forms
│   ├── conftest.py            # Root pytest config
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── app/
│   │   ├── (public)/          # 11 public pages (home, programs, checkout, login, register, faq, contact, kore-brand, terms, forgot-password, …)
│   │   ├── (app)/             # 35 authenticated pages (customer dashboard/assessments/credits/store/program + trainer views incl. tareas & configuración)
│   │   ├── admin-platform/    # 10 admin pages (dashboard, users, subscriptions, plans, nutrición, reports)
│   │   ├── change-password-required/ # 1 root-level page
│   │   ├── components/        # 131 React components (booking, checkout, dashboard, admin, trainer, program, nutrition-daily, layouts, profile, shared, subscription)
│   │   ├── composables/       # 1 composable (useScrollAnimations)
│   │   ├── __tests__/         # 202 unit/component test files
│   │   └── layout.tsx         # Root layout
│   ├── lib/
│   │   ├── stores/            # 30 Zustand stores
│   │   ├── services/          # HTTP client (axios)
│   │   └── constants.ts
│   ├── e2e/                   # 103 Playwright E2E spec files + flow-definitions.json (104 flows)
│   ├── package.json
│   ├── next.config.ts
│   └── playwright.config.ts
├── scripts/
│   ├── nginx/                 # Nginx config
│   ├── systemd/               # Gunicorn + Huey service files
│   ├── quality/               # Quality gate scripts
│   └── test_quality_gate.py   # Test quality audit tool
├── docs/                      # Documentation (methodology, release-july, standards)
├── tasks/                     # Task planning
└── .claude/ .agents/ .codex/   # AI ecosystem rules, skills & workflows
```

---

## 7. Constraints

- **No Node.js server in production** — frontend is statically exported
- **Single-server deployment** — Django serves everything behind Nginx
- **Colombian payment ecosystem** — Wompi-specific integrations (Nequi, PSE, Bancolombia)
- **Gmail SMTP** for email — subject to Google sending limits
- **SQLite in development** — MySQL in production (schema differences possible)
- **No real-time features** — polling-based, no WebSockets
