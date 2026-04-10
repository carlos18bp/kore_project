# Frontend Rules — Next.js 16 + React 19 + App Router (Kore Project)

## Stack

- **Next.js 16.1.7** with the **App Router** (NOT Pages Router)
- **React 19.2.3**, **TypeScript 5**
- **Tailwind CSS 4** + `@tailwindcss/postcss`
- **Zustand 5.0.11** for state management
- **Axios 1.13.4** wrapped by `lib/services/http.ts` (with token interceptors via cookies)
- **next-intl 4.8.2** for ES/EN bilingual support
- **lucide-react** for icons (NOT shadcn, NOT Material UI)
- **framer-motion 12.34**, **gsap 3.14**, **swiper 12.1.2** for animations and carousels
- **js-cookie 3.0.5** for cookie persistence of auth tokens
- **Tests**: **Jest 30** + Testing Library + jsdom for unit; **Playwright 1.42** for E2E
- **Coverage**: `monocart-reporter 2.10`

This is a **Next.js + React 19 + App Router project** — **NOT Vue**, **NOT Vite SPA**, **NOT Pages Router**.

## Static Export to Django

- `next.config.ts` uses `output: 'export'` so `next build` emits SSG to `backend/templates/`.
- The Django backend serves the static HTML files via a catch-all URL pattern.
- This means **Server Components are limited to build-time data**: any data that changes per request must be fetched **client-side** in `'use client'` components.
- **Do not introduce server actions or runtime SSR** — they will not work with the static export.

## Code Style and Structure

- **TypeScript-first**. Strict mode is on.
- Use **function components** with hooks. No class components.
- Use **`'use client'`** directives at the top of files that need client-side state, browser APIs, or interactive event handlers. The `(app)` group is heavily client-side because of the auth-protected layout.
- Server Components (the default in App Router) are still used for layouts and the (public) static pages.
- Co-locate types near where they are used; promote shared types to `types/` only when reused.

## Naming Conventions

- **Component files**: PascalCase (`Sidebar.tsx`, `MobileBottomNav.tsx`, `TrainerSidebar.tsx`).
- **Page files**: lowercase `page.tsx` per App Router convention.
- **Layout files**: lowercase `layout.tsx`.
- **Store files**: camelCase under `lib/stores/` (`authStore.ts`, `bookingStore.ts`, `checkoutStore.ts`, `subscriptionStore.ts`, `anthropometryStore.ts`, `posturometryStore.ts`, `physicalEvaluationStore.ts`, `nutritionStore.ts`, `parqStore.ts`, `trainerStore.ts`, `profileStore.ts`).
- **Utilities and services**: camelCase (`http.ts`, `utils.ts`).

## Routing — App Router with grouped routes

- Routes live under `app/`.
- **Grouped routes**:
  - `(public)/` — unauthenticated pages (home, login, register, pre-register, forgot-password, contact, faq, kore-brand, programs, terms).
  - `(app)/` — authenticated pages with role-based redirects (dashboard, profile, my-diagnosis, my-nutrition, my-physical-evaluation, my-posturometry, my-parq, book-session, calendar, subscription).
  - `(app)/trainer/` — trainer-only pages (trainer dashboard, my-clients, sessions, evaluations).
- Each group has its own `layout.tsx`. The `(app)` layout is the **auth gate**: it calls `useAuthStore.hydrate()`, redirects unauthenticated users to `/login`, and routes by role.
- **Do not introduce file-based routing tricks beyond what App Router provides.**

## State Management — Zustand

- All stores are in `lib/stores/`.
- Stores use the standard Zustand `create((set, get) => ({...}))` pattern.
- The `authStore` includes a `hydrate()` action that reads `accessToken` and `refreshToken` from cookies. **Always call `hydrate()` in client-side layouts** before accessing auth state — otherwise SSR-rendered HTML will mismatch the client.
- Stores responsible for evaluation data (anthropometry, posturometry, physical evaluation, nutrition, PARQ) cache the latest fetch and expose `fetchX(clientId)` actions.

## HTTP — Axios via `lib/services/http.ts`

- All HTTP goes through the single Axios instance in `frontend/lib/services/http.ts`.
- Base URL: `http://localhost:8000/api` in dev, `/api` in prod.
- **Token injection**: an interceptor reads `accessToken` from `js-cookie` and sets `Authorization: Bearer <token>` on every request.
- **Token refresh**: on 401, the interceptor attempts a refresh using the `refreshToken` cookie. If refresh fails, the user is redirected to `/login`.
- **Never call `fetch()` or raw `axios` directly** in components or stores. Always use the wrapped instance.

## i18n — `next-intl`

- `next-intl 4.8.2` provides ES/EN localization.
- Default locale is **English** (`en`); Spanish (`es`) is the alternate.
- Translations are organized per the next-intl convention.
- **Never hardcode user-facing strings** — every visible text goes through the next-intl `useTranslations()` hook.

## UI — custom components, no shadcn/MUI

- This project does **not** use shadcn/ui or Material UI. Components are custom-built in `app/components/`.
- **Icons**: `lucide-react`.
- **Animations**: `framer-motion 12.34` (`motion.div`, `useInView`), `gsap 3.14`, `swiper 12.1.2` (carousels).
- **Typography**: Cinzel and Montserrat fonts loaded in `app/layout.tsx`.

## Tailwind CSS 4

### Class Ordering
Layout → position → spacing → sizing → typography → visual → interactive.

### Responsive
Mobile-first. Breakpoint order: `sm:` → `md:` → `lg:` → `xl:` → `2xl:`.

### Avoid
- Never use `style=""` when a Tailwind class exists.
- Avoid arbitrary values (`text-[#1a1a2e]`); define design tokens in `tailwind.config.ts`.
- No `!important` (`!` prefix) unless overriding third-party styles.

## Testing — Jest + Playwright

### Jest (unit)
- Test files in `frontend/__tests__/` with `.test.tsx` or `.test.ts` extension.
- Run: `cd frontend && npm test -- path/to/file.test.tsx`
- Use **React Testing Library** + `user-event`. Prefer `screen.getByRole`, `screen.getByLabelText`, `screen.getByTestId`.
- The Jest config mocks `framer-motion`, `swiper`, and CSS modules. The environment is `jsdom`.
- Coverage excludes `.d.ts` and layouts.

### Playwright (E2E)
- Specs in `frontend/e2e/`.
- Run: `cd frontend && npx playwright test e2e/path/to/spec.ts`
- **Selector hierarchy**: `getByRole` > `getByTestId` > `locator('[data-testid=...]')`.
- **No `waitForTimeout()`** — use `toBeVisible()`, `waitForResponse()`, `waitForURL()`.

## Build → Django (static export)

- `next build` (with `output: 'export'`) emits to `backend/templates/`.
- Django serves the resulting HTML files via a catch-all URL pattern.
- **Do not edit files inside `backend/templates/`** that come from the export — they are build artifacts.

## What NOT to do

- Do **not** introduce Pages Router, server actions, or runtime SSR — the static export prevents these from working.
- Do **not** introduce shadcn/ui or Material UI — components are custom-built.
- Do **not** introduce Redux or Context API for state — Zustand is the convention.
- Do **not** call `fetch()` or raw `axios` outside of `lib/services/http.ts`.
- Do **not** hardcode user-facing strings — use `next-intl`.
- Do **not** access auth state without calling `useAuthStore.hydrate()` first in client components.
