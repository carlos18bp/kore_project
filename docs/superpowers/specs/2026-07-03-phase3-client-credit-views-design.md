# Design — Phase 2 Part 3: Client Credit Views & Dashboard IA

Date: 2026-07-03
Branch: `feat/03072026-phase3-client-credit-views` (off `july-release`, includes PRs #44/#46/#47)
Related: `2026-07-02-phase2-client-checkin-camera-design.md`; dashboard IA memory `project-dashboard-ia-part3`

## Goal

Make the credit economy the engine has been silently accumulating **visible** to
the client: balance, streak with bonus progress, and a readable transaction
history — plus the approved dashboard information-architecture refactor (hero
absorbs the daily tasks as pills + balance/streak; next session becomes a
compact row).

## Decisions (confirmed with product owner)

1. **One official streak: the credits engine's** (`wallet.current_streak`). The
   dashboard's current streak badge — today fed by `progressStore.weeklySummary.streak`
   (weekly adherence) — migrates to `wallet.current_streak`. Rationale: it is the
   streak that grants bonuses and credits, so it must match what the client sees.
   **Visible change accepted**: the dashboard streak number will differ from
   today's because it is computed differently.
2. **Access to `/mis-creditos`**: the hero balance is tappable → `/mis-creditos`,
   PLUS a permanent "Mis créditos" link in the desktop sidebar (Cuenta group) and
   the mobile bottom-nav "Más" menu.
3. **Transaction history**: infinite-scroll list (backend already paginates via
   `limit`/`offset`), each movement with icon (earned/lost/pending), Spanish
   description, date and signed amount.
4. **Dashboard IA (approved)**: 3-tier hierarchy — hero (tasks as pills +
   balance/streak, one primary CTA "Iniciar rutina") → compact next-session row →
   progress/evals below. `TodayCreditsCard` is folded into the hero and removed as
   a standalone card. Nutrition stays as the hero's existing preview (not
   duplicated by the task pills). Do NOT cram nutrition + tasks + session all as
   hero pills ("busy storefront" failure mode).

## Backend

No changes. Endpoints exist (PR #44), payloads confirmed:
- `GET /api/credits/wallet/` → `{balance, pending_balance, current_streak, longest_streak, last_active_date, next_milestone: {days, bonus, remaining} | null}`.
- `GET /api/credits/transactions/?limit=&offset=` → `{count, results: [{id, action, amount, status, description, reference_type, reference_id, review_deadline, created_at}]}`.

## Frontend

**`walletStore`** (`lib/stores/walletStore.ts`, clone of `creditValuesStore`
pattern — `authHeaders()` cookie, `@/lib/services/http`, no persist):
- State: `wallet: WalletData | null`, `transactions: CreditTransaction[]`,
  `txCount`, `txLoading`, `walletLoaded`, `loading`, `error`.
- `fetchWallet()` (guarded by `walletLoaded` to avoid refetch; a `refresh()`
  variant forces it), `fetchTransactions({reset})` for infinite scroll
  (appends `results`, tracks offset from `transactions.length`, stops at `txCount`).

**Dashboard hero refactor** (`app/(app)/dashboard/page.tsx`, both mobile
~1657-1755 and desktop ~1865-1960 mounts):
- Hero top strip: **balance** (large `kore-gold` number, tappable `Link` to
  `/mis-creditos`) + **streak** (flame icon + `wallet.current_streak`, reading
  `walletStore`). The existing streak badge (`page.tsx:1594-1652` mobile /
  `1807-1858` desktop) switches its source from `progressStore` to `walletStore`.
- **Task pills**: extract the 4 rows from `TodayCreditsCard` into a compact
  pill/row strip rendered inside the hero (reuse its `Row`/`Chip`). Remove the
  standalone `TodayCreditsCard` mounts (`page.tsx:1773`, `1983-1987`); keep the
  component file but repurpose its `Row`/`Chip` (or inline a `HeroTaskPills`
  subcomponent). Chips stay dynamic from `creditValuesStore`.
- The hero's primary CTA ("Iniciar rutina") and nutrition preview stay.

**Next session compact row** — replace the tall `SessionCard` mounts
(`page.tsx:1759-1770` mobile / `1965-1973` desktop) with a slim single-line row:
"Próxima sesión · <fecha> <hora> →" that calls `onShowUpcoming` (opens the
existing upcoming-sessions modal). Drop the mobile GSAP accordion
(`page.tsx:1163-1196`, `sessionExpanded` state). When there is no upcoming
session, the row is hidden (as today).

**`/mis-creditos` page** (`app/(app)/mis-creditos/page.tsx`, `'use client'`,
container `px-4 py-6 max-w-xl mx-auto space-y-5`):
- **Balance card** (dark hero surface): big `kore-gold` balance + subtle
  `pending_balance` line ("+15 en validación por tu entrenador") when > 0.
- **Streak card**: `GlowRing` (`app/components/shared/GlowRing.tsx`) with
  `current_streak` days at center; a 7-dot week strip (kore-sage = fulfilled,
  muted = not); and a progress bar to the next bonus computed from
  `next_milestone` ("Faltan {remaining} días para +{bonus}"). If
  `next_milestone` is null (past the last milestone), show "¡Racha máxima!".
- **History list**: infinite scroll; each row = icon (earned → kore-sage,
  penalty → red, pending → amber), description, `created_at` (es-CO), signed
  amount. Empty state: "Aún no tienes movimientos. Completa tu check-in para
  empezar a ganar."

**Navigation**: add "Mis créditos" item to `Sidebar.tsx` navGroups (Cuenta group,
new inline SVG coin/star icon) and to `MobileBottomNav.tsx` `moreItems`.

## Testing

- Jest: `walletStore` (fetchWallet guard, transactions append/stop); a
  `StreakRing`/week-strip component test if extracted; hero task-pills render.
- Playwright: new `e2e/app/mis-creditos.spec.ts` (balance, streak ring, history,
  infinite scroll with mocked pages, empty state); update `e2e/app/dashboard.spec.ts`
  — the "Hoy ganas" `today-credits-card` asserts change (now hero pills;
  re-point to the hero balance/tasks), and the next-session assert (compact row).
  Mock `**/api/credits/wallet/**` and `**/api/credits/transactions/**` in both.
- Update `app/__tests__/views/DashboardPage.test.tsx` and
  `TodayCreditsCard.test.tsx` for the refactor (add `walletStore` mock).
- Flow triplet: `flow-definitions.json` v1.0.9 + new `customer-credits` flow +
  `flow-tags.ts` + `USER_FLOW_MAP.md`; validation guide gains a Parte 3 section.

## Out of scope

Store & redemptions (Part 4), post-session rating (Part 5), trainer panel /
credits-per-client / difficulty simulator (Part 6). No backend changes. The
dashboard file (`page.tsx`, ~2050 lines) is refactored in place, not split
(that restructure is out of scope for this part).
