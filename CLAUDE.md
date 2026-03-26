# Kore Healths — Claude Code Configuration

## Project Identity

- **Name**: Kore Healths
- **Domain**: `korehealths.com` / `www.korehealths.com`
- **Stack**: Django + DRF (backend) / Next.js 16 + React + TypeScript + Zustand (frontend) / MySQL 8 / Redis / Huey
- **Server path**: `/home/ryzepeck/webapps/kore_project`
- **Staging path**: `/home/ryzepeck/webapps/kore_project_staging`
- **Services**: `kore_project.service` (Gunicorn), `kore_project-huey.service`
- **Settings module**: `DJANGO_SETTINGS_MODULE=kore_project.settings_prod`

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
STRIPE_API_KEY = os.environ['STRIPE_SECRET_KEY']

# ❌ NEVER do this
SECRET_KEY = 'django-insecure-abc123xyz'
DATABASE_URL = 'mysql://root:password123@localhost/mydb'
```

```typescript
// ✅ Next.js / Nuxt — use env vars
const apiUrl = process.env.NEXT_PUBLIC_API_URL
const secretKey = process.env.API_SECRET_KEY  // server-only, no NEXT_PUBLIC_ prefix

// Nuxt
const config = useRuntimeConfig()
const apiKey = config.apiSecret  // server only
const publicUrl = config.public.apiBase  // client safe

// ❌ NEVER do this
const API_KEY = 'sk-live-abc123xyz'
fetch('https://api.stripe.com/v1/charges', {
  headers: { Authorization: 'Bearer sk-live-abc123xyz' }
})
```

### .env rules

- `.env` files MUST be in `.gitignore`. Always verify before committing
- Use `.env.example` with placeholder values for documentation
- Separate env files per environment: `.env.local`, `.env.staging`, `.env.production`
- Server secrets (API keys, DB passwords) NEVER go in client-side env vars
- In Next.js: only `NEXT_PUBLIC_*` vars are exposed to the browser
- In Nuxt: only `runtimeConfig.public.*` is exposed to the browser

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

#### React/Vue

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

// ✅ Vue auto-escapes with {{ }}
// <p>{{ userInput }}</p>

// ❌ NEVER use dangerouslySetInnerHTML with user input
return <div dangerouslySetInnerHTML={{ __html: userInput }} />

// ❌ NEVER use v-html with user input
// <div v-html="userInput" />

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
- [ ] No `dangerouslySetInnerHTML` / `v-html` with user data
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

This project uses a Memory Bank system to maintain context across sessions. The core files are:

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
    subgraph LIT[ docs/literature ]
        L1[...]
        L2[...]
    end
    subgraph RFC[ tasks/rfc/ ]
        R1[...]
        R2[...]
    end
    PC --o LIT
    TC --o RFC
```

### Core Files (Required)

| # | File | Purpose |
|---|------|---------|
| 1 | `docs/methodology/product_requirement_docs.md` | PRD: why this project exists, core requirements, scope |
| 2 | `docs/methodology/architecture.md` | System architecture, component relationships, Mermaid diagrams |
| 3 | `docs/methodology/technical.md` | Tech stack, dev setup, design patterns, technical constraints |
| 4 | `tasks/tasks_plan.md` | Task backlog, progress tracking, known issues |
| 5 | `tasks/active_context.md` | Current work focus, recent changes, next steps |
| 6 | `docs/methodology/error-documentation.md` | Known errors, their context, and resolutions |
| 7 | `docs/methodology/lessons-learned.md` | Project intelligence, patterns, preferences |

### Context Files (Optional)

- `docs/literature/` — Literature survey and research (LaTeX files)
- `tasks/rfc/` — RFCs for individual tasks (LaTeX files)

### When to Read Memory Files

- Before significant implementation tasks, read the relevant core files
- Before planning tasks, read `docs/methodology/` and `tasks/`
- When debugging, check `docs/methodology/error-documentation.md` for previously solved issues

### When to Update Memory Files

1. After discovering new project patterns
2. After implementing significant changes
3. When the user requests with **update memory files** (review ALL core files)
4. When context needs clarification
5. After a significant part of a plan is verified

Focus particularly on `tasks/active_context.md` and `tasks/tasks_plan.md` as they track current state. And `docs/methodology/architecture.md` has a section of current workflow that also gets updated by any code changes.

---

## Directory Structure

```mermaid
flowchart TD
    Root[Project Root]
    Root --> Backend[backend/]
    Root --> Frontend[frontend/]
    Root --> Docs[docs/]
    Root --> Tasks[tasks/]
    Root --> Scripts[scripts/]
    Root --> Claude[.claude/skills/]
    Root --> GitHub[.github/workflows/]

    Backend --> CoreApp[core_app/ — Django app]
    Backend --> BProject[kore_project/ — Django project]
    CoreApp --> Models[models/ — one file per domain]
    CoreApp --> Services[services/ — 12 service modules]

    Frontend --> FApp[app/ — Next.js App Router]
    FApp --> FPublic["(public)/ — unauthenticated routes"]
    FApp --> FAppGroup["(app)/ — authenticated routes"]
    Frontend --> FComponents[components/]
    Frontend --> FLib[lib/]
    FLib --> FStores[stores/ — 12 Zustand stores]
    FLib --> FServices[services/]
    Frontend --> FE2E[e2e/ — Playwright]

    Docs --> Methodology[methodology/]
    Tasks --> ActiveCtx[active_context.md]
    Tasks --> TasksPlan[tasks_plan.md]

    Claude --> CSkills[plan, implement, debug, deploy, git-commit, etc.]
```

---

## Testing Rules

### Execution Constraints

- **Never run the full test suite** — always specify files
- **Maximum per execution**: 20 tests per batch, 3 commands per cycle
- **Backend**: Always activate venv first: `source venv/bin/activate && pytest path/to/test_file.py -v`
- **Frontend unit**: `npm test -- path/to/file.spec.ts`
- **E2E**: max 2 files per `npx playwright test` invocation
- Use `E2E_REUSE_SERVER=1` when dev server is already running

### Quality Standards

Full reference: `docs/TESTING_QUALITY_STANDARDS.md`

- Each test verifies **ONE specific behavior**
- **No conjunctions** in test names — split into separate tests
- Assert **observable outcomes** (status codes, DB state, rendered UI)
- **No conditionals** in test body — use parameterization
- Follow **AAA pattern**: Arrange → Act → Assert
- Mock only at **system boundaries** (external APIs, clock, email)

---

## Lessons Learned — Kore Healths

### Architecture Patterns

#### Single Django App: `core_app`
- All models, views, serializers, and services live in the `core_app` app
- Modular subdirectories organize the codebase within the single app
- Model files: one per domain concept (`booking.py`, `payment.py`, etc.)

#### Base Model: TimestampedModel
- All timestamped models inherit `TimestampedModel`
- Status enums use Django `TextChoices` (string values stored in DB)

#### Service Layer Pattern
- 12 services in `core_app/services/`
- Business logic lives in services, not in views
- Calculator service pattern: pure-function calculators for diagnostic modules

#### Webhook-Driven State Machine for Payments
- Wompi webhook confirms payment → creates `Payment` + `Subscription` atomically
- Currency: COP (Colombian Pesos), Wompi amounts in cents (multiply by 100)
- Pre-registration flow: guest credentials stored in `PaymentIntent` (hashed password)

#### SingletonModel Pattern
- `SiteSettings` uses `pk=1` singleton pattern

### Frontend Patterns

#### Next.js App Router with Route Groups
- `(public)/` for unauthenticated routes
- `(app)/` for authenticated routes

#### Zustand State Management
- 12 Zustand stores in `lib/stores/`

#### Static Export + Django Serving
- Next.js builds to `out/` → moved to `backend/templates/`
- Django serves the statically exported Next.js pages

#### Virtual Slot System
- `BookSessionPage` generates slots client-side from `WEEKDAY_WINDOWS`
- 16h booking buffer: slots filtered out if starting within 16h of now

### Diagnostic System

#### Auto-Computed on Save
- All 5 diagnostic models compute indices in `save()`
- KORE General Index: 0-100 composite score with weights (Anthropometry 20%, etc.)

#### Cooldown Enforcement
- Assessment views check last submission before allowing new ones

### Endpoint Patterns

#### Trainer-vs-Client Endpoints
- Separate `APIView` classes for trainer and client access to the same resources

### Authentication & User Management

#### Password Reset
- `PasswordResetCode` model with 6-digit code, 10-minute expiry

#### Terms Acceptance
- `TermsAcceptance` model with versioned consent and audit trail

### Methodology Maintenance

- Memory Bank based on [rules_template](https://github.com/Bhartendu-Kumar/rules_template)
- Refresh memory files after adding a new Django app, significant test changes, or when file counts drift >10%

---

## Error Documentation — Kore Healths

### Known Issues

#### [ERROR-001] CheckoutClient reset() race condition with auto_login
- **Context**: `reset()` in `CheckoutClient` can race with `auto_login` after payment confirmation
- **Workaround**: Guard with payment status check before calling `reset()`

#### [ERROR-003] setupDefaultApiMocks LIFO conflicts
- **Context**: Multiple mock setups in tests create LIFO ordering conflicts
- **Workaround**: Add `exclude` parameter to `setupDefaultApiMocks` to prevent conflicts

### Resolved Issues

#### [ERROR-002] Playwright strict mode violations from duplicate text
- Duplicate text on page caused `getByText()` to match multiple elements
- **Resolution**: Use `.first()` or `{ exact: true }` to disambiguate

#### jest.clearAllMocks vs jest.resetAllMocks
- `jest.clearAllMocks()` does not clear the `mockResolvedValueOnce` queue
- **Resolution**: Use `jest.resetAllMocks()` when you need to fully reset mock return value queues

#### DashboardPage test missing store mocks after component refactor
- Component refactor introduced new store dependencies not present in existing tests
- **Resolution**: Add the required Zustand store mocks to the test setup
