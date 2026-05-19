# Kore Project — Codex AGENTS Configuration

## Project Identity

### Codex Runtime Surfaces
- **Primary instructions**: `AGENTS.md` (root scope) + `backend/AGENTS.md` + `frontend/AGENTS.md`
- **Skills (canonical)**: `.agents/skills/<skill>/SKILL.md` + `agents/openai.yaml`
- **Project config**: `.codex/config.toml`

- **Name**: Kore Project
- **Domain**: `korehealths.com` / `www.korehealths.com`
- **Stack**: Django 6.0+ + DRF (backend) / Next.js 16 + React 19 static export (frontend) / MySQL 8 / Redis / Huey
- **Server path**: `/home/ryzepeck/webapps/kore_project`
- **Services**: `kore_project.service` (Gunicorn), `kore_project.socket`, `kore-huey.service`
- **Settings module**: `DJANGO_SETTINGS_MODULE=core_project.settings_prod`
- **Nginx**: `/etc/nginx/sites-available/kore_project`
- **Static**: `/home/ryzepeck/webapps/kore_project/backend/staticfiles/`
- **Media**: `/home/ryzepeck/webapps/kore_project/backend/media/`
- **Resource limits**: MemoryMax=512M, CPUQuota=40%, OOMScoreAdjust=300

---

## General Rules

These should be respected ALWAYS:
1. Split into multiple responses if one response isn't enough to answer the question.
2. IMPROVEMENTS and FURTHER PROGRESSIONS:
- S1: Suggest ways to improve code stability or scalability.
- S2: Offer strategies to enhance performance or security.
- S3: Recommend methods for improving readability or maintainability.
- Recommend areas for further investigation

---

## Security Rules — OWASP / Secrets / Input Validation

### Secrets and Environment Variables

NEVER hardcode secrets. Always use environment variables.

```python
# ✅ Django — use env vars
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DATABASE_URL = os.environ['DATABASE_URL']
WOMPI_PRIVATE_KEY = os.environ['WOMPI_PRIVATE_KEY']

# ❌ NEVER do this
SECRET_KEY = 'django-insecure-abc123xyz'
DATABASE_URL = 'mysql://root:password123@localhost/mydb'
```

```typescript
// ✅ Next.js — use env vars
const apiUrl = process.env.NEXT_PUBLIC_API_URL
const secretKey = process.env.API_SECRET_KEY  // server-only, no NEXT_PUBLIC_ prefix

// ❌ NEVER do this
const API_KEY = 'sk-live-abc123xyz'
fetch('https://api.example.com/v1/charges', {
  headers: { Authorization: 'Bearer sk-live-abc123xyz' }
})
```

### .env rules

- `.env` files MUST be in `.gitignore`. Always verify before committing
- Use `.env.example` with placeholder values for documentation
- Separate env files per environment: `.env.local`, `.env.staging`, `.env.production`
- Server secrets (API keys, DB passwords) NEVER go in client-side env vars
- In Next.js: only `NEXT_PUBLIC_*` vars are exposed to the browser

### Input Validation

NEVER trust user input. Validate on both server AND client.

#### Django/DRF

```python
# ✅ Serializer validates input
class OrderSerializer(serializers.Serializer):
    email = serializers.EmailField()
    quantity = serializers.IntegerField(min_value=1, max_value=100)
    product_id = serializers.IntegerField()

    def validate_product_id(self, value):
        if not Product.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError('Product not found')
        return value

# ❌ Using raw request data
def create_order(request):
    product_id = request.data['product_id']  # no validation
    Order.objects.create(product_id=product_id)  # SQL injection risk
```

#### React

```typescript
// ✅ Validate before sending
import { z } from 'zod'

const orderSchema = z.object({
  email: z.string().email(),
  quantity: z.number().int().min(1).max(100),
  productId: z.number().int().positive(),
})

const handleSubmit = (data: unknown) => {
  const result = orderSchema.safeParse(data)
  if (!result.success) {
    setErrors(result.error.flatten().fieldErrors)
    return
  }
  await submitOrder(result.data)
}
```

### SQL Injection Prevention

```python
# ✅ Django ORM — always safe
users = User.objects.filter(email=user_input)

# ✅ If raw SQL is needed, use parameterized queries
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT * FROM users WHERE email = %s", [user_input])

# ❌ NEVER interpolate user input into SQL
cursor.execute(f"SELECT * FROM users WHERE email = '{user_input}'")
```

### XSS Prevention

```typescript
// ✅ React auto-escapes by default — JSX is safe
return <p>{userInput}</p>

// ❌ NEVER use dangerouslySetInnerHTML with user input
return <div dangerouslySetInnerHTML={{ __html: userInput }} />

// If you MUST render HTML, sanitize first
import DOMPurify from 'dompurify'
const clean = DOMPurify.sanitize(userInput)
```

### CSRF Protection

```python
# ✅ Django — CSRF middleware is on by default, keep it
MIDDLEWARE = [
    'django.middleware.csrf.CsrfViewMiddleware',  # NEVER remove
    ...
]

# ✅ DRF — use SessionAuthentication or JWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

# ❌ NEVER disable CSRF globally
@csrf_exempt  # only for webhooks from external services with signature verification
```

### Authentication and Authorization

```python
# ✅ Always check permissions
from rest_framework.permissions import IsAuthenticated

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can only see their own orders
        return Order.objects.filter(user=self.request.user)
```

### Sensitive Data Exposure

```python
# ✅ Exclude sensitive fields from serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name']
        # password, tokens, internal IDs are excluded

# ❌ Exposing everything
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'  # leaks password hash, tokens, etc.
```

### HTTP Security Headers (Django)

```python
# settings.py — enable all security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True  # in production
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
```

### Dependency Security

- Run `pip audit` (Python) and `npm audit` (Node) regularly
- Never use `*` for dependency versions — pin exact versions
- Review new dependencies before adding them
- Keep dependencies updated, especially security patches

### File Upload Security

```python
# ✅ Validate file type and size
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_upload(file):
    ext = Path(file.name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f'File type {ext} not allowed')
    if file.size > MAX_FILE_SIZE:
        raise ValidationError('File too large')
```

### Security Checklist — Before Every Deployment

- [ ] No secrets in code or git history
- [ ] `.env` is in `.gitignore`
- [ ] All user input is validated (server + client)
- [ ] No raw SQL with user input
- [ ] No `dangerouslySetInnerHTML` with user data
- [ ] CSRF protection enabled
- [ ] Authentication required on all sensitive endpoints
- [ ] Serializers exclude sensitive fields
- [ ] Security headers configured
- [ ] `pip audit` / `npm audit` clean
- [ ] File uploads validated
- [ ] DEBUG = False in production
- [ ] ALLOWED_HOSTS configured properly

---

## Memory Bank System

Kore Project maintains a Memory Bank under `docs/methodology/` and `tasks/`. Read these files before significant implementation, debugging, or planning work.

```mermaid
flowchart TD
    PB[product_requirement_docs.md] --> PC[technical.md]
    PB --> SP[architecture.md]
    SP --> TC[tasks_plan.md]
    PC --> TC
    PB --> TC
    TC --> AC[active_context.md]
    AC --> ER[error-documentation.md]
    AC --> LL[lessons-learned.md]
```

### Core Files

| # | File | Purpose |
|---|------|---------|
| 1 | `docs/methodology/product_requirement_docs.md` | Use cases, features, functional requirements |
| 2 | `docs/methodology/architecture.md` | System design, auth flows, data model, integrations (Wompi, email) |
| 3 | `docs/methodology/technical.md` | Stack details, deployment, CI/CD, troubleshooting |
| 4 | `docs/methodology/error-documentation.md` | Known errors, logs, debugging |
| 5 | `docs/methodology/lessons-learned.md` | Design decisions, tradeoffs, future improvements |
| 6 | `tasks/tasks_plan.md` | Roadmap, pending tasks, priorities |
| 7 | `tasks/active_context.md` | Current development context, recent changes, project state |

### When to Read

- Before significant implementation: read `architecture.md`, `technical.md`, and the relevant `lessons-learned.md` section.
- Before planning: read `tasks_plan.md` and `active_context.md`.
- When debugging: check `error-documentation.md` first.

### When to Update

1. After verifying a new project pattern (add to `lessons-learned.md`).
2. After implementing significant changes (update `tasks_plan.md`).
3. When the user requests with **update memory files** (review all core files).
4. After a significant part of a plan is verified (update `active_context.md`).

Do not churn memory files after every routine code edit.

---

## Directory Structure

```mermaid
flowchart TD
    Root[Project Root]
    Root --> Backend[backend/ — Django + DRF]
    Root --> Frontend[frontend/ — Next.js 16 + React 19 + App Router]
    Root --> Docs[docs/]
    Root --> Tasks[tasks/]
    Root --> Scripts[scripts/]
    Root --> AgentSkills[.agents/skills/]

    Backend --> BCoreApp[core_app/ — single business app: User, Subscription, Booking, Package, Trainer, Evaluations]
    Backend --> BCoreProj[core_project/ — Django project module]
    Backend --> BGunicornCfg[gunicorn.conf.py — 2 workers, max_requests=800]
    Backend --> BConftest[conftest.py + pytest.ini]
    Backend --> BMedia[media/ + staticfiles/]

    BCoreApp --> Models[models/ — User, Subscription, Booking, Package, TrainerProfile, AvailabilitySlot, Payment, PhysicalEvaluation, Posturometry, Anthropometry, Nutrition, PARQ, MoodEntry, WeightEntry, Notification, etc.]
    BCoreApp --> Views[views/ — mix of FBV @api_view and CBV ViewSets/APIView]
    BCoreApp --> Services[services/ — anthropometry/posturometry/physical_eval/kore_index/nutrition/parq calculators, email_service, wompi_service, booking_rules, slot_schedule, ics_generator]
    BCoreApp --> Serializers[serializers/]
    BCoreApp --> Tests[tests/ — pytest]

    Frontend --> FApp[app/ — Next.js App Router]
    FApp --> FPublic["(public)/ — home, login, register, pre-register, forgot-password, contact, faq, kore-brand, programs, terms"]
    FApp --> FApp2["(app)/ — protected: dashboard, profile, my-diagnosis, my-nutrition, my-physical-evaluation, my-posturometry, my-parq, book-session, calendar, subscription"]
    FApp --> FTrainer["(app)/trainer/ — trainer dashboard, my-clients, sessions, evaluations"]
    Frontend --> FComponents[components/ — Sidebar, MobileBottomNav, booking, checkout, dashboard, trainer, shared, profile]
    Frontend --> FLib[lib/]
    FLib --> FStores[stores/ — Zustand: authStore, bookingStore, checkoutStore, subscriptionStore, anthropometry, posturometry, etc.]
    FLib --> FServices[services/http.ts — Axios with baseURL]
    Frontend --> FTests[__tests__/ — Jest 30 + Testing Library]
    Frontend --> FE2E[e2e/ — Playwright 1.42]

    AgentSkills --> SkillSet[plan, implement, debug, deploy-and-check, deploy-staging, git-commit, etc.]
```

**Important note on naming**: the **Django project module is `core_project`** (not `kore_project`!), and the **Django app is `core_app`** (not `kore_app`!). The directory `kore_project/` houses these. Settings module is `core_project.settings_prod`. Do not rename these to `kore_*` — keep the `core_*` naming.

---

## Testing Rules

### Execution Constraints

- **Never run the full test suite** — always specify files.
- **Maximum per execution**: 20 tests per batch, 3 commands per cycle.
- **Backend**: `cd backend && source venv/bin/activate && pytest core_app/tests/path/to/test_file.py -v`. `pytest.ini` sets `DJANGO_SETTINGS_MODULE=core_project.settings`.
- **Frontend unit (Jest)**: `cd frontend && npm test -- path/to/file.test.tsx`. Config: `jest.config.cjs` + jsdom + Testing Library.
- **Frontend E2E (Playwright 1.42)**: `cd frontend && npx playwright test e2e/path/to/spec.ts` — max 2 files per invocation. Use `E2E_REUSE_SERVER=1` when a Next.js dev server is already running.

### Quality Standards

Full reference: `docs/TESTING_QUALITY_STANDARDS.md`

- Each test verifies **ONE specific behavior**
- **No conjunctions** in test names — split into separate tests
- Assert **observable outcomes** (status codes, DB state, rendered UI)
- **No conditionals** in test body — use parameterization
- Follow **AAA pattern**: Arrange → Act → Assert
- Mock only at **system boundaries** (external APIs, clock, email)

---

## Lessons Learned — Kore Project

### Architecture Patterns

#### Single business app: `core_app`
- All ~20+ models, views, serializers, and services live in `backend/core_app/`.
- The Django **module** is `core_project` (not `kore_project`) and the **app** is `core_app` (not `kore_app`). The directory `kore_project/` is just the repo location.
- Models are organized under `core_app/models/`: `User`, `Subscription`, `Booking`, `Package`, `TrainerProfile`, `AvailabilitySlot`, `Payment`, `PhysicalEvaluation`, `Posturometry`, `Anthropometry`, `Nutrition`, `PARQ`, `MoodEntry`, `WeightEntry`, `Notification`, `TermsAcceptance`, `AnalyticsEvent`, `FAQCategory`, `FAQItem`, `ContactMessage`, `SiteSettings`.

#### Mixed view pattern (FBV + ViewSets)
- Unlike most other projects in this ecosystem, Kore uses **both** function-based views and class-based views:
  - **~18 FBV with `@api_view`**: auth (`pre_register_user`, `register_user`, `login_user`, `verify_registration`, `resend_verification_code`, `get_user_profile`, `upload_avatar`, `change_password`), profile (`mood_view`, `weight_view`), password reset (`request_password_reset_code`, `verify_password_reset_code`, `reset_password_with_code`), captcha (`verify_recaptcha`).
  - **~10+ DRF ViewSets**: `PackageViewSet`, `TrainerProfileViewSet`, `SubscriptionViewSet`, `BookingViewSet`, `PaymentViewSet`, `NotificationViewSet`, `FAQCategoryViewSet`, `FAQItemViewSet`, `AnalyticsEventViewSet`, `AvailabilitySlotViewSet`, `ContactMessageViewSet`.
  - **~6+ APIView custom**: `TrainerAnthropometryListCreateView`, `ClientAnthropometryListView`, `SiteSettingsView`, `TermsAcceptanceCreateView`, `TermsAcceptanceStatusView`, etc.
- **Do not enforce a single style.** Match the existing pattern in the file you are touching.

#### Service layer is real and large
- `core_app/services/` holds the business logic for the health/wellness domain:
  - `anthropometry_calculator.py` — body composition indices (BMI, body fat %, water, muscle mass).
  - `posturometry_calculator.py` — segmental posture analysis.
  - `physical_evaluation_calculator.py` — integrates measurements + computes the KORE Index.
  - `kore_index_calculator.py` — proprietary integrated health score.
  - `nutrition_calculator.py` — dietary recommendations (JSON output).
  - `parq_calculator.py` — PAR-Q (Physical Activity Readiness Questionnaire).
  - `email_service.py` — registration, password reset, subscription, payment receipts.
  - `wompi_service.py` — Wompi payment gateway integration (transactions, references, webhooks).
  - `booking_rules.py` — booking validations (no overlaps, sessions available).
  - `slot_schedule.py` — slot management and session rollover.
  - `subscription_cleanup.py` — expired subscription cleanup.
  - `ics_generator.py` — iCalendar event generation for booked sessions.
- Views call services. Do not inline calculation logic into views.

#### Recurring billing via Huey + Wompi
- `core_app/tasks.py` defines `process_recurring_billing()` — a periodic Huey task running daily at **08:00 UTC**.
- The task scans `Subscription` rows with `is_recurring=True` and `next_billing_date <= today`, charges them via `wompi_service`, creates a `Payment` record, sends a receipt email, and resets the session counter.
- Email tasks are also async (registration confirmation, reminders, receipts).

#### Dual auth (JWT-only for API, session for admin)
- **`/api/`** uses **JWT via SimpleJWT** (`access: 1d`, `refresh: 7d`, `rotate=False`, `blacklist_after_rotation=True`). There is **no CSRF** on `/api/` because JWT is stateless.
- **`/admin/`** uses Django session + CSRF (default).
- The frontend stores the access token in **httpOnly cookies** (set via `js-cookie` from the `authStore`) and re-injects it via `Authorization: Bearer <token>` in the Axios client (`lib/services/http.ts`).

#### Roles: customer, trainer, admin
- The custom `User` model has a `role` field with `CUSTOMER`, `TRAINER`, and `ADMIN` choices.
- The Next.js `(app)` layout uses `useAuthStore.hydrate()` on mount and **redirects based on role**: trainers go to `/trainer/dashboard`, customers go to `/dashboard`.
- Role-based routing is enforced **client-side** in the layout. Server-side endpoint authorization is enforced via DRF permission classes.

### Code Style & Conventions

#### Backend
- Match the existing view style in the file you touch. New auth/profile endpoints → FBV with `@api_view`. New CRUD resources → ViewSets. New custom list/create endpoints → APIView.
- Pattern for FBV: deserialize → `serializer.is_valid(raise_exception=True)` → service call → `Response(...)`.
- Pattern for ViewSets: filter `get_queryset()` by the authenticated user; use `perform_create()` to set `customer=self.request.user`.

#### Frontend: Next.js 16 + React 19 + App Router
- **Stack**: Next.js 16.1.7, React 19.2.3, TypeScript 5, Tailwind 4.
- **App Router** in `frontend/app/` — **not** Pages Router. Routes are folder-based.
- **Grouped routes**: `(public)/` for unauthenticated pages and `(app)/` for authenticated pages. Each group has its own `layout.tsx`.
- **The `(app)` layout protects routes**: it calls `useAuthStore.hydrate()`, redirects to `/login` if not authenticated, and routes by role.
- **Static export**: `next.config.ts` uses `output: 'export'` so `next build` emits SSG to `backend/templates/`. The Django backend serves the static HTML and uses a catch-all Django URL for non-API routes.

#### Frontend: state management with Zustand
- Stores live in `frontend/lib/stores/` and use Zustand 5.0.
- Naming: camelCase store files (`authStore.ts`, `bookingStore.ts`, `checkoutStore.ts`, `subscriptionStore.ts`, `anthropometryStore.ts`, `posturometryStore.ts`, `physicalEvaluationStore.ts`, `nutritionStore.ts`, `parqStore.ts`, `trainerStore.ts`, `profileStore.ts`).
- The `authStore` includes a `hydrate()` action that reads tokens from cookies on the client. Always call `hydrate()` in client-side layouts before accessing auth state to avoid hydration mismatches.

#### Frontend: HTTP via Axios (`lib/services/http.ts`)
- The single Axios instance is in `frontend/lib/services/http.ts`.
- Base URL: `http://localhost:8000/api` in dev, `/api` in prod.
- Token injection happens via interceptors that read the `accessToken` from cookies.
- **Do not call `fetch()` or raw `axios` directly in components.** Always use the wrapped instance.

#### Frontend: i18n with `next-intl`
- `next-intl 4.8.2` provides ES/EN bilingual support.
- Locale strings live alongside the App Router structure (per next-intl conventions).
- The default locale is English (`en`) with Spanish (`es`) as the alternate.

#### Frontend: UI with Lucide + custom components
- **No shadcn/ui, no Material UI** in this project. Components are custom-built.
- Icons: `lucide-react`.
- Animations: `framer-motion 12.34`, `gsap 3.14`, `swiper 12.1.2` (carousels).
- The user-facing typography uses Cinzel and Montserrat (loaded in the root `app/layout.tsx`).

#### Naming
- Stores: camelCase (`authStore.ts`).
- Components: PascalCase (`Sidebar.tsx`, `MobileBottomNav.tsx`).
- Lib utilities: camelCase.
- TypeScript: `.ts` for utilities, `.tsx` for components.

### Development Workflow

#### venv lives in `backend/`
```bash
cd backend && source venv/bin/activate
```

#### Frontend dev server
```bash
cd frontend && npm install && npm run dev   # Next.js dev, default :3000
```
- ⚠️ **Port 3000 conflict**: a different terminal sometimes runs `npm run dev --port 3000` for this project. If port 3000 is occupied, use `npm run dev -- --port 3001` or kill the other process.

### Production Deployment

See `.agents/skills/deploy-and-check/SKILL.md`. Summary:
1. `git pull origin master`
2. Backend: `cd backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate`
3. Frontend: `cd frontend && npm ci && npm run build` (Next.js static export → `backend/templates/`)
4. Backend: `python manage.py collectstatic --noinput`
5. Restart: `sudo systemctl restart kore_project && sudo systemctl restart kore-huey`
6. Verify: `bash /home/ryzepeck/webapps/vps-ops-toolkit/scripts/deployment/post-deploy-check.sh kore_project`

#### `gunicorn.conf.py`
The repo includes a custom Gunicorn config at `backend/gunicorn.conf.py`:
```python
bind = 'unix:/run/kore_project.sock'
workers = 2                    # 2 worker processes
max_requests = 800             # restart worker every 800 requests
max_requests_jitter = 80       # ± 80 jitter
timeout = 30                   # request timeout 30s
graceful_timeout = 20          # graceful shutdown 20s
accesslog = '-'                # logs to stdout
errorlog = '-'
```
The systemd unit `kore_project.service` reads this config.

### Testing Insights

- **Backend**: pytest 9 + pytest-django 4.12 + pytest-cov 7. Tests under `backend/core_app/tests/`.
- **Frontend unit**: Jest 30 + Testing Library (React 16.3, DOM 10, user-event 14.5) + jsdom. Tests under `frontend/__tests__/`. Mocks for `framer-motion`, `swiper`, and CSS modules. Coverage excludes `.d.ts` and layouts.
- **Frontend E2E**: Playwright 1.42 in `frontend/e2e/`.
- **Multi-suite runner**: `scripts/run-tests-all-suites.py`.
- **Quality gate**: `scripts/test_quality_gate.py`.

### Tech Debt / Things to Be Aware Of

- E2E coverage gaps in payment and trainer evaluation flows.
- Posturometry calculator is computationally heavy — consider profiling if it becomes a bottleneck.
- CI/CD automation (deploy pipeline) is incomplete.
- External integration docs (Wompi webhooks, email bounces) are sparse.

---

## Error Documentation — Kore Project

### Known Issues

#### [KNOWN-001] Next.js dev server occupies port 3000
- **Context**: A terminal sometimes runs `npm run dev --port 3000` for this project, which respawns after being killed.
- **Workaround**: Run Next.js on port 3001 with `npm run dev -- --port 3001`, or kill the offending process before starting a new dev server.

### Resolved Issues

_No resolved issues recorded yet. When fixing a non-trivial bug, document the root cause and resolution here:_

```
#### [ERR-NNN] short title
- ...
- **Resolution**: ...
```
