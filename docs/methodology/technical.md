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
| **Service layer** | `services/` — booking_rules, email_service, ics_generator, subscription_cleanup, wompi_service |
| **ViewSet + Router** | All CRUD endpoints via DRF DefaultRouter |
| **Custom permissions** | `IsAdminRole`, `IsAdminOrReadOnly` for role-based access |
| **Webhook-driven state machine** | PaymentIntent → Payment + Subscription on Wompi webhook |
| **Abstract base models** | `TimestampedModel` (created_at, updated_at), `SingletonModel` |
| **Route groups** | Next.js `(public)/` and `(app)/` route groups for layout separation |
| **Store pattern (Zustand)** | `authStore`, `bookingStore`, `checkoutStore`, `subscriptionStore` |
| **Composables** | `useScrollAnimations` for reusable scroll animation logic |

---

## 6. Project Structure

```
kore_project/
├── backend/
│   ├── core_project/          # Django project config (settings, urls, wsgi)
│   ├── core_app/              # Main Django app
│   │   ├── models/            # 12 model files (11 domain + 1 base)
│   │   ├── views/             # 12 view files
│   │   ├── serializers/       # 11 serializer files
│   │   ├── services/          # 5 service files
│   │   ├── urls/              # 4 URL config files
│   │   ├── management/commands/ # 16 management commands
│   │   ├── tests/             # 55 test files
│   │   ├── templates/         # Email templates, admin overrides
│   │   ├── admin.py           # 13 registered ModelAdmin classes
│   │   ├── permissions.py     # Custom DRF permissions
│   │   ├── tasks.py           # Huey periodic tasks
│   │   └── forms.py           # Custom user forms
│   ├── conftest.py            # Root pytest config
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── app/
│   │   ├── (public)/          # Public pages (home, programs, checkout, login, register, etc.)
│   │   ├── (app)/             # Authenticated pages (dashboard, calendar, book-session, etc.)
│   │   ├── components/        # 30 React components
│   │   │   ├── booking/       # 8 booking components
│   │   │   ├── checkout/      # 5 payment form components
│   │   │   ├── faq/           # 1 FAQ component
│   │   │   ├── layouts/       # 5 layout components
│   │   │   └── subscription/  # 1 subscription component
│   │   ├── composables/       # 1 composable (useScrollAnimations)
│   │   ├── __tests__/         # 50 unit/component test files
│   │   └── layout.tsx         # Root layout
│   ├── lib/
│   │   ├── stores/            # 4 Zustand stores
│   │   ├── services/          # HTTP client (axios)
│   │   └── constants.ts
│   ├── e2e/                   # 34 Playwright E2E spec files
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
