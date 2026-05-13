# Frontend Rules — Kore Project

## Stack And Scope
- **Next.js 16.1.7 + React 19.2 + TypeScript** with the **App Router** (NOT Pages Router, NOT Vue, NOT Vite SPA).
- **Static export** (`output: 'export'` in `next.config.ts`) — `next build` emits SSG to `../backend/templates/`. There is no runtime SSR.
- **State management**: **Zustand 5.0** (NOT Redux, NOT Context API for global state). Stores in `lib/stores/`.
- **HTTP**: **Axios 1.13** wrapped in `lib/services/http.ts` with cookie-based JWT injection.
- **i18n**: **next-intl 4.8** (ES/EN, default English).
- **Styling**: Tailwind CSS 4 + `@tailwindcss/postcss`.
- **UI components**: custom-built (NOT shadcn, NOT Material UI). Icons via `lucide-react`. Animations via `framer-motion` + `gsap` + `swiper`.
- **Tests**: **Jest 30** + Testing Library + jsdom for unit; **Playwright 1.42** for E2E.

## Project Conventions
- **TypeScript-first**. Strict mode. Function components with hooks.
- Use **`'use client'`** at the top of files that need interactivity, browser APIs, or auth state. Pure server components are still used for layouts and (public) static pages.
- **Static export constraints**: data that changes per request must be fetched **client-side**. Do not introduce server actions or SSR routes.
- **Grouped routes**:
  - `(public)/` — unauthenticated landing pages (home, login, register, faq, contact, etc.).
  - `(app)/` — authenticated, role-protected. The `(app)/layout.tsx` calls `useAuthStore.hydrate()`, redirects unauthenticated users, and routes by `User.role`.
  - `(app)/trainer/` — trainer-only routes.
- **Auth hydration**: client components must call `useAuthStore.hydrate()` before reading auth state to avoid Next.js hydration mismatches. The store reads `accessToken` / `refreshToken` from cookies.
- **HTTP via `lib/services/http.ts`**: never call `fetch()` or raw `axios` directly. The wrapped instance handles token injection, refresh on 401, and base URL switching.
- **Filename conventions**:
  - Stores → camelCase (`authStore.ts`, `bookingStore.ts`).
  - Components → PascalCase (`Sidebar.tsx`, `MobileBottomNav.tsx`, `TrainerSidebar.tsx`).
  - Pages → `page.tsx`. Layouts → `layout.tsx`.
  - Utilities and services → camelCase.
- **Bilingual strings**: every visible text goes through `next-intl`'s `useTranslations()` hook. Never hardcode user-facing text.

## UX And Routing
- App Router is the only routing mechanism. Do **not** introduce Pages Router or file-based routing tricks.
- The `(app)` layout enforces auth and role-based redirects. Trainers go to `/trainer/dashboard`, customers to `/dashboard`.
- For Playwright and async UI work, prefer **role-based locators** and **explicit element waits**.
- Do **not** use `networkidle` for Next.js dev flows.

## Commands
- Dev server: `cd frontend && npm run dev` (Next.js, default :3000)
- Unit tests (Jest): `cd frontend && npm test -- path/to/file.test.tsx`
- E2E (Playwright): `cd frontend && npx playwright test e2e/path/to/spec.ts`
- Build: `cd frontend && npm run build` (static export to `../backend/templates/`)

## Testing Rules
- Never run the full frontend unit or E2E suite.
- Maximum 20 tests per batch and 3 commands per cycle.
- Assert user-visible behavior, not implementation details.
- Use stable locators in E2E (`getByRole` > `getByTestId`).
- Jest mocks `framer-motion`, `swiper`, and CSS modules.

## Known Quirk
- Port 3000 is sometimes occupied by another `next dev` process for this project. If the port is busy, run `npm run dev -- --port 3001` or kill the offending process.
