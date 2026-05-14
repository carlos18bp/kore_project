# Kore Project — Claude Compatibility Guide

## Source Of Truth
- The canonical repo guidance is maintained in the Codex-native surfaces: `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, `.agents/skills/*`, `.codex/config.toml`.
- This `CLAUDE.md` file is a compatibility mirror for mixed-tool teams and should stay aligned with the Codex guidance.
- Long-lived project context lives in `docs/methodology/` and `tasks/`.

## Project Overview
- **What it is**: KORE — a personal training and health platform with subscription-based session bookings, trainer-assigned biomechanical evaluations (anthropometry, posturometry, PARQ, nutrition), recurring billing, and a proprietary KORE Index health score.
- **Stack**: Django 6.0 + DRF (backend) / **Next.js 16.1.7 + React 19.2 + TypeScript** (frontend, App Router) / MySQL 8 / Redis / Huey / Wompi (payment gateway).
- **Single Django app**: `core_app`. **Django module name is `core_project`** (not `kore_project`!). Settings module: `core_project.settings_prod`.
- **Production path**: `/home/ryzepeck/webapps/kore_project`.
- **Domain**: `korehealths.com`.
- **Services**: `kore_project.service`, `kore_project.socket`, `kore-huey.service`. Custom Gunicorn config at `backend/gunicorn.conf.py` (2 workers, max_requests=800).
- The frontend uses Next.js **static export** (`output: 'export'` in `next.config.ts`) — `next build` emits SSG to `backend/templates/`. The Django backend serves those static HTML files.

## Architecture Invariants
- **Backend uses a mix of FBV and CBV** — both are valid:
  - FBV with `@api_view` for auth, profile, password reset, captcha (~18).
  - DRF ViewSets for resource CRUD (Package, Subscription, Booking, Payment, etc.) (~10+).
  - APIView for custom list/create endpoints (~6+).
  - Match the existing style in the file you are touching.
- **Service layer is large and real**: `core_app/services/` holds the business logic (anthropometry, posturometry, physical evaluation, KORE Index, nutrition, PARQ calculators, plus email, Wompi, booking rules, slot schedule, ICS generator, subscription cleanup). **Do not inline calculation logic into views.**
- **Auth is JWT-only for `/api/`** (SimpleJWT, 1d access, 7d refresh, no rotation, blacklist after rotation). Admin uses session + CSRF.
- **Roles**: `User.role` ∈ `{CUSTOMER, TRAINER, ADMIN}`. The Next.js `(app)` layout reads the role from the auth store and redirects: trainers → `/trainer/dashboard`, customers → `/dashboard`.
- **Frontend uses Next.js 16 + React 19 + App Router** (NOT Pages Router, NOT Vue, NOT Vite SPA).
- **State management is Zustand** (not Redux, not Context). Stores live in `frontend/lib/stores/` with camelCase filenames.
- **HTTP via Axios** wrapped in `frontend/lib/services/http.ts`. Token is stored in **httpOnly cookies** and re-injected via `Authorization: Bearer <token>`.
- **Auth hydration**: client components must call `useAuthStore.hydrate()` before reading auth state to avoid Next.js hydration mismatch.
- **Recurring billing**: a Huey periodic task runs daily at **08:00 UTC** to charge active subscriptions via Wompi.
- **i18n via `next-intl`** (ES/EN). Default locale is English.
- **No shadcn/ui, no Material UI** — components are custom-built. Icons via `lucide-react`. Animations via `framer-motion` + `gsap` + `swiper`.

## Working Rules
- Prefer existing project patterns over generic framework advice.
- Do not rename `core_project` or `core_app` to `kore_*` — keep the `core_*` naming.
- Do not change old migrations; add new migrations when schema changes are required.
- Keep security basics intact: validated serializer inputs, ORM-first queries, escaped rendering, secure cookies, no secrets in code.
- Do not edit files inside `backend/templates/` that come from `next build` — they are generated artifacts.
- New email types should be added as methods on `EmailService`, not inlined.
- Match the existing view style (FBV vs CBV) in the file you are touching.

## Commands
- Backend tests: `cd backend && source venv/bin/activate && pytest core_app/tests/path/to/test_file.py -v`
- Backend dev server: `cd backend && source venv/bin/activate && python manage.py runserver`
- Frontend dev server: `cd frontend && npm run dev` (Next.js, default :3000)
- Frontend unit tests (Jest): `cd frontend && npm test -- path/to/file.test.tsx`
- Frontend E2E (Playwright): `cd frontend && npx playwright test e2e/path/to/spec.ts`
- Frontend build: `cd frontend && npm run build` (static export to `../backend/templates/`)

## Testing Constraints
- Never run the full test suite.
- Maximum 20 tests per batch and 3 test commands per cycle.
- Run only the smallest backend, frontend unit, or E2E slice needed for the changed behavior.
- The biomechanical calculators deserve careful unit tests with golden-value fixtures.

## Memory Bank
- Core files: `docs/methodology/{product_requirement_docs,architecture,technical,error-documentation,lessons-learned}.md`, `tasks/{tasks_plan,active_context}.md`.
- Read `architecture.md` for the auth flows, data model, and Wompi integration.
- Read `tasks_plan.md` for the current backlog and known gaps (E2E payment coverage, posturometry performance).
- Update memory files when the user asks, or when you have verified a meaningful change to runtime surfaces, architecture, or recurring workflow guidance.
- Do not churn memory files after every routine code edit.
<!-- session-start-protocol:begin -->
## Session Start Protocol

Al inicio de **cada sesión y antes de editar archivos**, debes invocar la skill `git-sync` para este repo. Razón: el operador trabaja desde múltiples máquinas y procesos automatizados (cron, CI) pueden haber commiteado cambios que tu copia local no tiene; editar sobre una versión desactualizada genera conflictos o trabajo duplicado.

**Flujo:**
1. Un hook `SessionStart` (definido en `.claude/settings.json`) ejecuta `git fetch + git status` read-only y te inyecta el estado de este repo como contexto.
2. Si el reporte indica `behind > 0` o `dirty > 0`, **invoca la skill `git-sync`** antes de hacer cualquier cambio. `git-sync` hace rebase contra el parent branch y, si hay conflictos, te guía interactivamente por la resolución.
3. Si el reporte indica `behind=0 ahead=0 dirty=0`, el repo ya está sincronizado y puedes proceder.

**Importante:** Nunca uses `git pull --force`, `git reset --hard` ni stash automático para "resolver" el sync — usa siempre la skill `git-sync`, que es segura y reproducible.
<!-- session-start-protocol:end -->
<!-- e2e-user-flows-protocol:begin -->
## E2E User Flows Check

Cuando termines de implementar un cambio que afecte un **flujo de usuario en el frontend** — por ejemplo:
- Crear o editar un formulario (agregar/quitar campos)
- Nueva ruta, página o vista accesible al usuario
- Cambios en flujos de autenticación, checkout, onboarding, búsqueda, perfil
- Modificaciones a `docs/USER_FLOW_MAP.md` o `frontend/e2e/flow-definitions.json`

…debes invocar la skill `e2e-user-flows-check` como **paso final** antes de reportar la implementación como completa. Esa skill audita la cobertura E2E del flujo modificado y reporta brechas/riesgos.

**Por qué:** los flujos de usuario en frontend cambian las assumptions de los tests E2E. Sin auditoría, un campo eliminado deja tests "verdes" pero inválidos, y un form nuevo queda sin cobertura.

**No aplica para:** correcciones aisladas que no cambian el flujo (typos, refactors internos, estilos puros, dependency bumps), ni cambios solo en backend que no alteren UX.

**Recordatorio automático:** un hook `Stop` revisa al cierre del turno si hay cambios uncommitted bajo `frontend/src/`, `frontend/app/`, etc., y te lo inyecta como contexto. El hook es un recordatorio, no bloqueante — la regla aplica igual aunque el hook no dispare.
<!-- e2e-user-flows-protocol:end -->
