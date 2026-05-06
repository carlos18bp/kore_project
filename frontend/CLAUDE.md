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

---

## Design System — KORE Visual Language

The reference aesthetic is **Apple Health / Fitness + Cal AI**: clean, data-forward, minimal chrome, premium without being decorative. Every decision should make the data feel trustworthy and the interaction feel effortless.

### Core Philosophy
- **Data first**: the number or metric is the hero. Typography and layout exist to make that metric feel significant, not to decorate around it.
- **Restraint**: if an element doesn't carry meaning, remove it. Whitespace is a design element, not wasted space.
- **Consistency over creativity**: use the same card shape, the same radius, the same motion curve everywhere. Surprise should come from content, not from inconsistent chrome.

### Typography Hierarchy
- **Hero metric**: `text-4xl` or `text-5xl font-black tracking-tight` — for ring centers, score displays, main KPIs.
- **Section header**: `text-lg font-bold text-kore-gray-dark` — page titles, card group titles.
- **Label**: `text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50` — above charts, above card groups.
- **Body**: `text-sm text-kore-gray-dark/80 leading-relaxed` — descriptions, subtitles.
- **Caption**: `text-xs text-kore-gray-dark/40` — dates, secondary metadata.
- Never mix `font-semibold` and `font-medium` at the same level in one view. Pick one weight per hierarchy level and hold it.

### Color Usage
- **Single accent**: `kore-red` — primary actions, active tabs, progress fill, key metric color. Use sparingly.
- **Surface palette**: `bg-kore-cream` page bg → `bg-white` card → `bg-white/70 backdrop-blur-sm` floating/overlay card. That is the only three-level surface stack.
- **Dark hero surface**: `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900` for ring cards, workout heroes, metric spotlights. Text inside: `text-white`, labels: `text-white/50`.
- **Status colors** (data meaning only, never decorative): teal/emerald = positive/completed, amber = warning/partial, rose = negative/decline, gray = neutral/empty.
- **Opacity scale**: `/80` for primary text on light bg, `/50` for secondary, `/40` for tertiary/captions, `/20` for borders on white cards, `/10` for tinted backgrounds.
- No random gradients. Gradients are allowed only on dark hero cards and the WhatsApp/CTA button.

### Surfaces & Cards
- **Standard card**: `bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm`
- **Solid card** (no transparency needed): `bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm`
- **Dark hero card**: `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 shadow-lg`
- **Pill / chip**: `rounded-full px-3 py-1 text-xs font-semibold` — use for status badges, day labels.
- Border radius is always `rounded-2xl` (16px) for cards, `rounded-xl` (12px) for inputs/buttons/inner elements, `rounded-full` for badges/avatars/progress rings.

### Data Visualization
- **Circular arc rings**: SVG with `strokeDasharray` / `strokeDashoffset`. No chart library. Stroke width 8–12px, `strokeLinecap="round"`, track at 10% opacity of accent color.
- **Bar/progress**: `h-2` or `h-1.5`, `rounded-full`, `bg-kore-red/10` track, accent fill with `transition-all duration-700`.
- **Number always first**: display the bold metric number before showing the chart. The chart contextualizes; the number is the message.
- **Axes and labels**: minimal. Only show if removing them creates ambiguity.

### Spacing & Layout
- Page container: `px-4 py-6 max-w-xl mx-auto space-y-5` — consistent across all (app) pages.
- Card internal padding: `p-4` (compact), `p-5` (standard), `p-6` (form/rich content).
- Gap between cards in a group: `space-y-3` (tight list), `space-y-4` (default), `space-y-5` (sections).
- Section spacing: `space-y-5` at the page level.

### Interactive Elements
- **Primary button**: `bg-kore-red text-white rounded-xl py-3 font-medium hover:bg-kore-red-dark transition-colors`
- **Secondary/ghost button**: `bg-white/60 border border-white/60 rounded-xl text-kore-gray-dark/50 hover:bg-white/80`
- **Active tab pill**: `bg-kore-red text-white rounded-xl` vs inactive `bg-white/60 text-kore-gray-dark/50 border border-white/60`
- **Touch targets**: minimum 44px height for tappable elements on mobile.
- **Hover states**: color shift only — never layout shift or size change on hover.

### Motion
- Duration: `150ms` for micro (hover, state change), `300ms` for reveals, `500–700ms` for data viz (progress bars filling, ring animating).
- Easing: `ease-out` default. `ease-in-out` for reveals.
- Never animate layout (width/height shifts reflow). Animate `opacity`, `transform`, `strokeDashoffset`.
- Framer Motion for enter/exit animations. CSS `transition-` for hover/state changes.
- A component that has no animation is better than one with a clumsy animation.

### Icons
- Lucide only. Stroke width: `strokeWidth={1.5}` for decorative/contextual, `strokeWidth={2}` for actions/navigation.
- Size: `w-4 h-4` inline with text, `w-5 h-5` standalone action icon, `w-6 h-6` card header icon.
- Never mix strokeWidth values within the same card.

### Empty States
- Centered, brief, helpful. One emoji or icon (optional), one short sentence explaining why it's empty, one clear action link if available.
- Do not design decorative empty state illustrations — keep it typographic.

### What to Avoid
- Drop shadows heavier than `shadow-md` — use borders + glassmorphism instead.
- More than two font weights in a single component.
- Coloring text red/green for anything other than health-data meaning (no red error text styled the same as kore-red accent).
- Full-bleed images without an overlay — always a gradient overlay for legibility.
- Loaders that block the whole page — prefer skeleton-like dimming or per-section spinners.
