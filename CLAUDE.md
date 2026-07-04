<!-- fleet-base:begin v=1 -->
# CLAUDE.md — Kore Project (`kore_project`)

Esta seccion es la **base comun del fleet** y se sincroniza desde
`vps-ops-toolkit/workflows/.claude/base/CLAUDE.md.tmpl`. No editar manualmente:
los cambios se pierden en el proximo sync. Para customizar este proyecto, usar
la seccion `project-specific` mas abajo.

## Convencion de lenguaje

- Documentacion, comentarios y mensajes de commit en **ingles**.
- Codigo, identificadores y nombres de variable en **ingles**.
- Mensajes de error visibles al usuario final en el idioma del proyecto.

<!-- session-start-protocol:begin -->
## Session Start Protocol

Al inicio de **cada sesión y antes de editar archivos**, debes invocar la skill `git-sync` para este repo. Razón: el operador trabaja desde múltiples máquinas y procesos automatizados (cron, CI) pueden haber commiteado cambios que tu copia local no tiene; editar sobre una versión desactualizada genera conflictos o trabajo duplicado.

**Flujo:**
1. Un hook `SessionStart` (definido en `.claude/settings.json`) ejecuta `git fetch + git status` read-only y te inyecta el estado de este repo como contexto.
2. Si el reporte indica `behind > 0` o `dirty > 0`, **invoca la skill `git-sync`** antes de hacer cualquier cambio. `git-sync` hace rebase contra el parent branch y, si hay conflictos, te guía interactivamente por la resolución.
3. Si el reporte indica `behind=0 ahead=0 dirty=0`, el repo ya está sincronizado y puedes proceder.

**Importante:** Nunca uses `git pull --force`, `git reset --hard` ni stash automático para "resolver" el sync — usa siempre la skill `git-sync`, que es segura y reproducible.
<!-- session-start-protocol:end -->

<!-- git-branch-protocol:begin -->
## Reglas de trabajo con Git: ramas y commits

**Nunca hagas commits directamente sobre `main` o `master`.** Estas ramas están protegidas y los pushes serán rechazados por GitHub.

**El default es REUTILIZAR una rama abierta, no crear una nueva.** La convención del fleet es **máximo 1 PR feature activo por proyecto**: todo el trabajo en curso — aunque sean features o arreglos distintos entre sí — se acumula como **commits sucesivos sobre esa misma rama** hasta que mergee. **Lo que identifica cada pieza de trabajo es el COMMIT, no una rama nueva.** Crear una rama por cada cambio fragmenta el trabajo en PRs paralelos y hace imposible un code review unificado. **Sólo se crea una rama cuando estás en `main`/`master` y NO hay ninguna rama abierta.** Antes de cualquier `git commit`, seguí este protocolo:

### 1. Verificar la rama actual

Antes de cualquier operación de escritura (add, commit, etc.), ejecuta:

```bash
git rev-parse --abbrev-ref HEAD
```

- **Si ya estás en una rama feature** (cualquier rama que no sea `main`/`master`): **quedate ahí y commiteá**, sin importar si el cambio actual es de un feature distinto al que originó la rama. NO crees una rama nueva — pasá directo a la sección 8 (commit).
- **Si estás en `main`/`master`**: seguí la sección 2 antes de commitear.

### 2. Si estás en `main` o `master`: primero buscá una rama abierta para reutilizar

**Antes de siquiera pensar en crear una rama**, buscá si ya hay una rama feature con PR abierto (o trabajo en curso) para este proyecto y reutilizala. Preferí los PRs abiertos — son literalmente "la rama abierta para revisar los cambios":

```bash
git fetch --quiet --prune
# Fuente preferida: PRs abiertos (rama + URL)
gh pr list --state open --json headRefName,url -q '.[] | "\(.headRefName)	\(.url)"' 2>/dev/null
# Fallback si gh no está disponible: ramas remotas que no son main/master/release-*/HEAD
git branch -r | grep -vE 'origin/(HEAD|main|master|release-)' | sed 's@^[[:space:]]*origin/@@' | sort -u
```

- **Si hay UNA rama abierta** (PR abierto o trabajo en curso): `git checkout <rama-existente>`, `git pull --rebase` si está atrás del remote, y **commiteá ahí — aunque tu cambio sea de otra naturaleza que el trabajo previo de esa rama**. No crees rama nueva. **No pidas permiso para el checkout**, sólo comunicalo: "Hay rama feature activa `<X>`, voy a commitear ahí."
- **Si hay VARIAS ramas abiertas**: preguntá al usuario en cuál commitear (no asumas).
- **Si NO hay ninguna rama abierta** (todas mergeadas/cerradas, o son ramas históricas abandonadas): recién ahí creá una rama nueva según el formato de la sección 3.

### 3. Formato obligatorio del nombre de rama

`<prefijo>/<DDMMYYYY>-<descripcion-corta>`

- **`<prefijo>`** según el tipo de cambio:
  - `feat` — nueva funcionalidad
  - `fix` — corrección de bug
  - `docs` — cambios en documentación
  - `refactor` — refactorización sin cambio funcional
  - `test` — añadir o modificar tests
  - `chore` — mantenimiento (dependencias, configs)
  - `style` — formato/estilo, sin cambio de lógica
  - `perf` — mejoras de rendimiento
  - `ci` — cambios en workflows o pipelines
  - `hotfix` — corrección urgente en producción

- **`<DDMMYYYY>`** debe ser la fecha actual del sistema obtenida con `date +%d%m%Y`. Nunca la asumas ni la inventes.

- **`<descripcion-corta>`** en kebab-case, máximo 5 palabras, en inglés o español según el idioma del proyecto.

### 4. Ejemplos de nombres válidos

- `feat/15052026-login-google-oauth`
- `fix/15052026-typo-readme`
- `refactor/15052026-extract-user-service`
- `docs/15052026-update-deploy-guide`
- `chore/15052026-bump-django-version`

### 5. Comandos exactos a ejecutar

```bash
# 1. Obtener la fecha del día (no asumirla)
TODAY=$(date +%d%m%Y)

# 2. Crear y moverse a la nueva rama
git checkout -b <prefijo>/${TODAY}-<descripcion-corta>

# 3. Recién entonces hacer add y commit
git add <archivos>
git commit -m "<mensaje siguiendo conventional commits>"
```

### 6. Inferencia del prefijo

Determina el prefijo a partir del contenido de los cambios:
- Archivos nuevos que añaden features → `feat`
- Cambios que arreglan comportamiento roto → `fix`
- Solo cambios en `*.md`, comentarios o JSDoc → `docs`
- Cambios en `package.json`, `requirements.txt`, configs → `chore`
- Cambios en `.github/workflows/*` → `ci`
- Archivos `*test*` / `*spec*` modificados o añadidos → `test`
- Reorganización sin alterar comportamiento → `refactor`

Si hay ambigüedad, pregunta al usuario una sola vez antes de crear la rama.

### 7. Excepciones

- Operaciones de solo lectura (`git status`, `git log`, `git diff`, `git pull`, `git fetch`) están permitidas en `main`/`master`.
- Si el usuario explícitamente pide quedarse en `main` para revisar algo sin commitear, respeta esa intención.
- Si ya estás en una rama feature válida (no `main`/`master`), **nunca** crees una rama paralela para un cambio "distinto" — seguí commiteando en la rama actual. Cada cambio es un commit más, no una rama más. **Convención por defecto: 1 rama / 1 PR feature activo por proyecto a la vez.**

### 8. Mensajes de commit

Sigue Conventional Commits, con el mismo prefijo de la rama cuando aplique:

```
feat: add Google OAuth login flow
fix: correct typo in deployment README
refactor: extract user validation into service
```

### 9. Reporte final: URL del PR

Después de cada `git push` que cree una rama nueva en el remote, **siempre** termina tu respuesta dando al usuario la URL "Create a pull request" que GitHub imprime en el output del push.

- Formato: `https://github.com/<owner>/<repo>/pull/new/<branch>`.
- Inclúyela como una de las **últimas líneas** del cierre de turno, etiquetada como `PR URL: <url>`.
- Si la rama ya existía y tiene un PR abierto, reporta la URL del PR existente (usa `gh pr view --json url -q .url` si la necesitas).
- Si por excepción se commiteó directo a `main`/`master` (sólo posible en proyectos sin esta regla), declara explícitamente: "PR URL: n/a (push directo a `main`)".
- Si hubo cambios en varios proyectos en el mismo turno, entrega una **lista** con un `PR URL:` por proyecto.
<!-- git-branch-protocol:end -->

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

## Ecosistemas IA paralelos

Este proyecto tiene tres ecosistemas activos en paralelo: Claude Code (este
archivo + `.claude/`), Codex (`AGENTS.md` + `.agents/skills/` + `.codex/config.toml`)
y Windsurf (`.windsurf/rules/` + `.windsurf/workflows/`). Los tres comparten el
mismo cuerpo de instrucciones general; el frontmatter y la estructura cambian
por ecosistema. La fuente de verdad es `vps-ops-toolkit/workflows/`.

<!-- fleet-base:end -->

<!-- project-specific:begin -->
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
<!-- project-specific:end -->
