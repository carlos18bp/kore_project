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
| Next.js | 16.1.6 | React framework (App Router) |
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
| Jest | 29.7.x | Frontend unit/component tests |
| @testing-library/react | 16.3.x | React component testing |
| @testing-library/user-event | 14.5.x | User interaction simulation |
| Playwright | 1.42.x | End-to-end browser tests |
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
pytest backend/tests/path/to/test_file.py -v

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
| **Huey over Celery** | Lightweight task queue; sufficient for 2 periodic tasks (billing + reminders) |
| **Zustand over Redux** | Simpler API, smaller bundle, sufficient for 4 stores |
| **Email-based auth (no username)** | Business requirement; custom `AbstractBaseUser` with email as `USERNAME_FIELD` |
| **SingletonModel for SiteSettings** | Ensures exactly one row; `pk=1` enforced on save |
| **JWT in cookies (js-cookie)** | Stored client-side for SPA-like navigation in static export |

---

## 5. Design Patterns

| Pattern | Where Used |
|---------|-----------|
| **Service layer** | `services/` — 12 services: booking_rules, email_service, ics_generator, subscription_cleanup, wompi_service, slot_schedule, + 6 calculators |
| **Calculator services** | Pure-function calculators for each diagnostic module (anthropometry, posturometry, physical_evaluation, nutrition, parq, kore_index) — no DB access, receive data as args |
| **ViewSet + Router** | CRUD endpoints via DRF DefaultRouter (11 registered ViewSets) |
| **APIView for assessments** | Diagnostic module views use `APIView` (not ViewSets) for finer control over trainer vs. client endpoints |
| **Custom permissions** | `IsAdminRole`, `IsAdminOrReadOnly`, `IsTrainerRole` for role-based access |
| **Webhook-driven state machine** | PaymentIntent → Payment + Subscription on Wompi webhook |
| **Abstract base models** | `TimestampedModel` (created_at, updated_at), `SingletonModel` |
| **Auto-computed on save** | All diagnostic models compute indices in `save()` via their calculator service |
| **Cross-module integration** | PhysicalEvaluation pulls context from latest AnthropometryEvaluation and PosturometryEvaluation |
| **Cooldown pattern** | Assessment views enforce time-based limits (nutrition: 7 days, PAR-Q: 90 days) |
| **Route groups** | Next.js `(public)/` and `(app)/` route groups for layout separation |
| **Store pattern (Zustand)** | 12 stores: auth, booking, checkout, subscription, profile, anthropometry, nutrition, parq, physicalEvaluation, posturometry, pendingAssessments, trainer |
| **Composables** | `useScrollAnimations` for reusable scroll animation logic |

---

## 6. Project Structure

```
kore_project/
├── backend/
│   ├── core_project/          # Django project config (settings, urls, wsgi)
│   ├── core_app/              # Main Django app
│   │   ├── models/            # 22 model files (21 domain + 1 base) → 24 models
│   │   ├── views/             # 20 view files
│   │   ├── serializers/       # 12 serializer files
│   │   ├── services/          # 12 service files (5 core + 6 calculators + 1 schedule)
│   │   ├── urls/              # 4 URL config files
│   │   ├── management/commands/ # 18 management commands
│   │   ├── tests/             # 72 test files
│   │   ├── templates/         # Email templates, admin overrides
│   │   ├── admin.py           # 23 Admin classes (22 ModelAdmin + 1 Form)
│   │   ├── permissions.py     # Custom DRF permissions (IsAdminRole, IsAdminOrReadOnly, IsTrainerRole)
│   │   ├── tasks.py           # Huey periodic tasks
│   │   └── forms.py           # Custom user forms
│   ├── conftest.py            # Root pytest config
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── app/
│   │   ├── (public)/          # 10 public pages (home, programs, checkout, login, register, faq, contact, kore-brand, terms, forgot-password)
│   │   ├── (app)/             # 20 authenticated pages (customer dashboard + assessments + trainer views)
│   │   ├── components/        # 36 React components
│   │   │   ├── booking/       # 8 booking components
│   │   │   ├── checkout/      # 5 payment form components
│   │   │   ├── faq/           # 1 FAQ component
│   │   │   ├── layouts/       # 6 layout components (incl. TrainerSidebar)
│   │   │   ├── profile/       # 4 profile components (MoodCheckIn, PasswordResetModal, ProfileCompletionCTA, ProfileIcons)
│   │   │   └── subscription/  # 2 subscription components
│   │   ├── composables/       # 1 composable (useScrollAnimations)
│   │   ├── __tests__/         # 66 unit/component test files
│   │   └── layout.tsx         # Root layout
│   ├── lib/
│   │   ├── stores/            # 12 Zustand stores
│   │   ├── services/          # HTTP client (axios)
│   │   └── constants.ts
│   ├── e2e/                   # 38 Playwright E2E spec files
│   ├── package.json
│   ├── next.config.ts
│   └── playwright.config.ts
├── scripts/
│   ├── nginx/                 # Nginx config
│   ├── systemd/               # Gunicorn + Huey service files
│   ├── quality/               # Quality gate scripts
│   └── test_quality_gate.py   # Test quality audit tool
├── docs/                      # Documentation
├── tasks/                     # Task planning
└── .windsurf/                 # IDE rules & workflows
```

---

## 7. Constraints

- **No Node.js server in production** — frontend is statically exported
- **Single-server deployment** — Django serves everything behind Nginx
- **Colombian payment ecosystem** — Wompi-specific integrations (Nequi, PSE, Bancolombia)
- **Gmail SMTP** for email — subject to Google sending limits
- **SQLite in development** — MySQL in production (schema differences possible)
- **No real-time features** — polling-based, no WebSockets
