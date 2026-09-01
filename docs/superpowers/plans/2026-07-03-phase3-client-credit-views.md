# Phase 2 Part 3 — Client Credit Views & Dashboard IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the credit economy to the client — balance, streak with bonus progress, transaction history — and refactor the dashboard hero to the approved 3-tier IA (tasks as pills + balance/streak; next session as a compact row).

**Architecture:** A new `walletStore` (clone of `creditValuesStore`) feeds a tappable balance badge, hero task pills, and a new `/mis-creditos` page. The monolithic dashboard is touched minimally by extracting small components (`CreditBalanceBadge`, `HeroTaskPills`, `NextSessionRow`) and doing a 2-line streak-source migration. No backend changes.

**Tech Stack:** Next.js 16 App Router + React 19 + TS, Zustand 5, Axios wrapper, Tailwind 4 (KORE tokens), `GlowRing` (shared SVG ring), Jest 30, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-03-phase3-client-credit-views-design.md`

## Global Constraints

- Branch: `feat/03072026-phase3-client-credit-views` (off `july-release`). Commit after every task.
- Spanish strings hardcoded in JSX (next-intl is not wired). Design system per `frontend/CLAUDE.md`: cards `rounded-2xl`, chips `rounded-full`, dark hero surface uses `kore-ivory`/`kore-gold` text, page container `px-4 py-6 max-w-xl mx-auto space-y-5`.
- Credit amounts never hardcoded — dynamic via `creditValuesStore`. Streak everywhere reads `walletStore` (engine), NOT `progressStore`.
- No backend changes. Endpoints (PR #44): `GET /api/credits/wallet/`, `GET /api/credits/transactions/?limit=&offset=`.
- Tests: Jest store/component locally one file at a time; Playwright locally serialized (`./node_modules/.bin/playwright test <file> --workers=1`); CI is the gate. Deterministic tests (`jest.useFakeTimers({now, doNotFake:[...]})`).
- Dev servers already up (backend :8001, frontend :3000 on 0.0.0.0).

## File map

- Create `frontend/lib/stores/walletStore.ts` — wallet + paginated transactions.
- Create `frontend/app/components/dashboard/CreditBalanceBadge.tsx` — tappable balance pill (header, mobile+desktop).
- Create `frontend/app/components/dashboard/HeroTaskPills.tsx` — 4 daily task rows on the dark hero (replaces `TodayCreditsCard`).
- Create `frontend/app/components/dashboard/NextSessionRow.tsx` — compact next-session row.
- Delete `frontend/app/components/dashboard/TodayCreditsCard.tsx` + its test (folded into hero).
- Create `frontend/app/(app)/mis-creditos/page.tsx` — balance + streak + history.
- Modify `frontend/app/(app)/dashboard/page.tsx` — streak source, badge/pills/row mounts.
- Modify `frontend/app/components/layouts/Sidebar.tsx`, `MobileBottomNav.tsx` — nav link.

---

### Task 1: `walletStore`

**Files:**
- Create: `frontend/lib/stores/walletStore.ts`
- Test: `frontend/app/__tests__/stores/walletStore.test.ts`

**Interfaces:**
- Produces: `useWalletStore` with `{ wallet: WalletData | null, transactions: CreditTransaction[], txCount: number, walletLoaded: boolean, txLoading: boolean, error: string, fetchWallet(force?: boolean): Promise<void>, fetchTransactions(reset?: boolean): Promise<void> }`.
- Types: `WalletData = { balance: number; pending_balance: number; current_streak: number; longest_streak: number; last_active_date: string | null; next_milestone: { days: number; bonus: number; remaining: number } | null }`; `CreditTransaction = { id: number; action: string; amount: number; status: 'pending' | 'confirmed' | 'rejected'; description: string; reference_type: string; reference_id: string | null; review_deadline: string | null; created_at: string }`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/walletStore.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useWalletStore } from '@/lib/stores/walletStore';

const WALLET = {
  balance: 55, pending_balance: 15, current_streak: 3, longest_streak: 9,
  last_active_date: '2026-07-03', next_milestone: { days: 7, bonus: 50, remaining: 4 },
};
const tx = (id: number) => ({
  id, action: 'checkin', amount: 5, status: 'confirmed', description: `Check-in ${id}`,
  reference_type: 'mood_entry', reference_id: `${id}`, review_deadline: null, created_at: '2026-07-03T10:00:00Z',
});

describe('walletStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWalletStore.setState({ wallet: null, transactions: [], txCount: 0, walletLoaded: false, txLoading: false, error: '' });
  });

  it('fetchWallet loads once, force refetches', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: WALLET });
    await useWalletStore.getState().fetchWallet();
    expect(useWalletStore.getState().wallet?.balance).toBe(55);
    expect(useWalletStore.getState().walletLoaded).toBe(true);
    await useWalletStore.getState().fetchWallet();       // no-op
    expect(api.get).toHaveBeenCalledTimes(1);
    await useWalletStore.getState().fetchWallet(true);    // forced
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('fetchTransactions appends pages and stops at count', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { count: 3, results: [tx(1), tx(2)] } });
    await useWalletStore.getState().fetchTransactions(true);
    expect(useWalletStore.getState().transactions).toHaveLength(2);
    expect(api.get).toHaveBeenLastCalledWith('/credits/transactions/', expect.objectContaining({ params: { limit: 20, offset: 0 } }));

    (api.get as jest.Mock).mockResolvedValueOnce({ data: { count: 3, results: [tx(3)] } });
    await useWalletStore.getState().fetchTransactions();
    expect(useWalletStore.getState().transactions).toHaveLength(3);
    expect(api.get).toHaveBeenLastCalledWith('/credits/transactions/', expect.objectContaining({ params: { limit: 20, offset: 2 } }));

    // all loaded → no further request
    const calls = (api.get as jest.Mock).mock.calls.length;
    await useWalletStore.getState().fetchTransactions();
    expect((api.get as jest.Mock).mock.calls.length).toBe(calls);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx jest app/__tests__/stores/walletStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/stores/walletStore.ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type WalletData = {
  balance: number;
  pending_balance: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  next_milestone: { days: number; bonus: number; remaining: number } | null;
};

export type CreditTransaction = {
  id: number;
  action: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  description: string;
  reference_type: string;
  reference_id: string | null;
  review_deadline: string | null;
  created_at: string;
};

type WalletState = {
  wallet: WalletData | null;
  transactions: CreditTransaction[];
  txCount: number;
  walletLoaded: boolean;
  txLoading: boolean;
  error: string;
  fetchWallet: (force?: boolean) => Promise<void>;
  fetchTransactions: (reset?: boolean) => Promise<void>;
};

const PAGE = 20;

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: null,
  transactions: [],
  txCount: 0,
  walletLoaded: false,
  txLoading: false,
  error: '',

  fetchWallet: async (force = false) => {
    if (get().walletLoaded && !force) return;
    try {
      const { data } = await api.get('/credits/wallet/', { headers: authHeaders() });
      set({ wallet: data, walletLoaded: true, error: '' });
    } catch {
      set({ error: 'No se pudo cargar tu balance de créditos.' });
    }
  },

  fetchTransactions: async (reset = false) => {
    const state = get();
    if (state.txLoading) return;
    const offset = reset ? 0 : state.transactions.length;
    // Stop when everything is already loaded (not a reset).
    if (!reset && state.txCount > 0 && offset >= state.txCount) return;
    set({ txLoading: true });
    try {
      const { data } = await api.get('/credits/transactions/', {
        headers: authHeaders(),
        params: { limit: PAGE, offset },
      });
      set((s) => ({
        transactions: reset ? data.results : [...s.transactions, ...data.results],
        txCount: data.count,
        txLoading: false,
      }));
    } catch {
      set({ txLoading: false, error: 'No se pudo cargar tu historial.' });
    }
  },
}));
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/stores/walletStore.test.ts`
Expected: 2 passed

```bash
git add frontend/lib/stores/walletStore.ts frontend/app/__tests__/stores/walletStore.test.ts
git commit -m "feat(credits): walletStore for balance, streak and paginated history"
```

---

### Task 2: `CreditBalanceBadge` (tappable header pill)

**Files:**
- Create: `frontend/app/components/dashboard/CreditBalanceBadge.tsx`
- Test: `frontend/app/__tests__/components/dashboard/CreditBalanceBadge.test.tsx`

**Interfaces:**
- Consumes: `useWalletStore` (Task 1).
- Produces: `<CreditBalanceBadge />` — a `Link` to `/mis-creditos` showing the balance with a gold coin/star glyph; self-fetches the wallet on mount; renders `—` until loaded.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/components/dashboard/CreditBalanceBadge.test.tsx
import { render, screen } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: null }), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(), extractApiError: jest.fn(),
}));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import { useWalletStore } from '@/lib/stores/walletStore';
import CreditBalanceBadge from '@/app/components/dashboard/CreditBalanceBadge';

describe('CreditBalanceBadge', () => {
  it('renders the balance and links to /mis-creditos', () => {
    useWalletStore.setState({
      wallet: { balance: 55, pending_balance: 0, current_streak: 0, longest_streak: 0, last_active_date: null, next_milestone: null },
      walletLoaded: true, fetchWallet: async () => {},
    } as never);
    render(<CreditBalanceBadge />);
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('créditos')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/mis-creditos');
  });

  it('shows a dash before the wallet loads', () => {
    useWalletStore.setState({ wallet: null, walletLoaded: false, fetchWallet: async () => {} } as never);
    render(<CreditBalanceBadge />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest app/__tests__/components/dashboard/CreditBalanceBadge.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```tsx
// frontend/app/components/dashboard/CreditBalanceBadge.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useWalletStore } from '@/lib/stores/walletStore';

export default function CreditBalanceBadge() {
  const { wallet, walletLoaded, fetchWallet } = useWalletStore();
  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  return (
    <Link
      href="/mis-creditos"
      aria-label="Ver mis créditos"
      className="block w-full cursor-pointer rounded-2xl px-2.5 py-1.5 transition-transform active:scale-95"
      style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(229,229,229,0.5)' }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Sparkles className="w-[14px] h-[14px] text-kore-gold-deep shrink-0" strokeWidth={2} />
        <span className="text-[11.5px] font-semibold text-kore-gray-dark truncate tabular-nums">
          {walletLoaded && wallet ? wallet.balance : '—'}{' '}
          <span className="font-normal text-kore-gray-dark/55">créditos</span>
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/components/dashboard/CreditBalanceBadge.test.tsx`
Expected: 2 passed

```bash
git add frontend/app/components/dashboard/CreditBalanceBadge.tsx frontend/app/__tests__/components/dashboard/CreditBalanceBadge.test.tsx
git commit -m "feat(credits): tappable credit balance badge for the dashboard header"
```

---

### Task 3: `HeroTaskPills` (daily tasks on the hero)

**Files:**
- Create: `frontend/app/components/dashboard/HeroTaskPills.tsx`
- Delete: `frontend/app/components/dashboard/TodayCreditsCard.tsx`, `frontend/app/__tests__/components/dashboard/TodayCreditsCard.test.tsx`
- Test: `frontend/app/__tests__/components/dashboard/HeroTaskPills.test.tsx`

**Interfaces:**
- Consumes: `useProfileStore` (todayMood, openMoodModal), `useNutritionDailyStore` (todayLog, fetchTodayLog), `useProgramStore` (todayData, fetchTodayData), `useCreditValuesStore` (value, waterGoalGlasses, fetchValues).
- Produces: `<HeroTaskPills />` — a compact dark-surface row of the 4 daily credit actions (check-in, hidratación, comidas con foto, rutina) with done/pending state and dynamic `+X` chips, sized for the wine hero. `data-testid="hero-task-pills"`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/components/dashboard/HeroTaskPills.test.tsx
import { render, screen } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: null }), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(), extractApiError: jest.fn(),
}));

import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import HeroTaskPills from '@/app/components/dashboard/HeroTaskPills';

describe('HeroTaskPills', () => {
  beforeEach(() => {
    useProfileStore.setState({ todayMood: { score: 8, notes: '', date: 'x' }, openMoodModal: () => {} } as never);
    useNutritionDailyStore.setState({
      todayLog: { id: 1, date: 'x', is_closed: false, water_glasses: [{}, {}], meal_entries: [{ id: 1, status: 'completed', photo_url: 'a.jpg' }] },
      fetchTodayLog: async () => {},
    } as never);
    useProgramStore.setState({
      todayData: { program_day: {}, daily_log: { id: 1, exercise_logs: [{ id: 1, status: 'completed' }, { id: 2, status: 'not_done' }] } },
      fetchTodayData: async () => {},
    } as never);
    useCreditValuesStore.setState({
      actionValues: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
      waterGoalGlasses: 8, loaded: true, fetchValues: async () => {},
    } as never);
  });

  it('renders the four task pills with dynamic chips', () => {
    render(<HeroTaskPills />);
    expect(screen.getByTestId('hero-task-pills')).toBeInTheDocument();
    expect(screen.getByText('Check-in')).toBeInTheDocument();
    expect(screen.getByText('Hidratación')).toBeInTheDocument();
    expect(screen.getByText('Comidas')).toBeInTheDocument();
    expect(screen.getByText('Rutina')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest app/__tests__/components/dashboard/HeroTaskPills.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```tsx
// frontend/app/components/dashboard/HeroTaskPills.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

function Pill({ label, done, amount, href, onClick }: {
  label: string; done: boolean; amount: number | null; href?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
        {done ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <span className="w-1 h-1 rounded-full bg-white/40" />}
      </span>
      <span className="text-[11px] font-semibold text-white/85">{label}</span>
      {amount !== null && <span className="text-[10px] font-bold text-kore-gold">+{amount}</span>}
    </>
  );
  const cls = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] transition-colors';
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <Link href={href ?? '#'} className={cls}>{inner}</Link>;
}

export default function HeroTaskPills() {
  const { todayMood, openMoodModal } = useProfileStore();
  const { todayLog, fetchTodayLog } = useNutritionDailyStore();
  const { todayData, fetchTodayData } = useProgramStore();
  const { value, waterGoalGlasses, fetchValues, loaded } = useCreditValuesStore();

  useEffect(() => { fetchValues(); }, [fetchValues]);
  useEffect(() => { if (!todayLog) fetchTodayLog(); }, [todayLog, fetchTodayLog]);
  useEffect(() => { if (!todayData) fetchTodayData(); }, [todayData, fetchTodayData]);

  const glasses = todayLog?.water_glasses?.length ?? 0;
  const mealsWithPhoto = (todayLog?.meal_entries ?? []).filter((m) => m.status === 'completed' && m.photo_url).length;
  const exerciseLogs = todayData?.daily_log?.exercise_logs ?? [];
  const exercisesDone = exerciseLogs.filter((e) => e.status === 'completed').length;

  return (
    <div className="mt-4 pt-3.5 border-t border-white/10" data-testid="hero-task-pills">
      <p className="text-[10px] text-white/40 uppercase tracking-[0.14em] font-semibold mb-2">Hoy ganas</p>
      <div className="flex flex-wrap gap-1.5">
        <Pill label="Check-in" done={!!todayMood} amount={value('checkin')} onClick={todayMood ? undefined : openMoodModal} href={todayMood ? '#' : undefined} />
        <Pill label="Hidratación" done={loaded && glasses >= waterGoalGlasses} amount={value('water_goal')} href="/my-nutrition" />
        <Pill label="Comidas" done={mealsWithPhoto >= 5} amount={value('meal_photo')} href="/my-nutrition" />
        <Pill label="Rutina" done={exerciseLogs.length > 0 && exercisesDone === exerciseLogs.length} amount={value('workout_day')} href="/mi-programa/rutina" />
      </div>
    </div>
  );
}
```

Delete the old card and its test:

```bash
rm frontend/app/components/dashboard/TodayCreditsCard.tsx frontend/app/__tests__/components/dashboard/TodayCreditsCard.test.tsx
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/components/dashboard/HeroTaskPills.test.tsx`
Expected: 1 passed

```bash
git add frontend/app/components/dashboard/HeroTaskPills.tsx frontend/app/__tests__/components/dashboard/HeroTaskPills.test.tsx frontend/app/components/dashboard/TodayCreditsCard.tsx frontend/app/__tests__/components/dashboard/TodayCreditsCard.test.tsx
git commit -m "feat(credits): HeroTaskPills replacing TodayCreditsCard, folded into the hero"
```

---

### Task 4: `NextSessionRow` (compact next-session row)

**Files:**
- Create: `frontend/app/components/dashboard/NextSessionRow.tsx`
- Test: `frontend/app/__tests__/components/dashboard/NextSessionRow.test.tsx`

**Interfaces:**
- Produces: `<NextSessionRow formattedDate={string | null} formattedTime={string} onShowUpcoming={() => void} />` — one slim button row "Próxima sesión · <fecha> <hora> →" that calls `onShowUpcoming`. `formattedDate` is `string | null` (the dashboard derives it as such); render a fallback when null. The dashboard mount is guarded by `upcomingReminder &&` so it is non-null in practice.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/components/dashboard/NextSessionRow.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import NextSessionRow from '@/app/components/dashboard/NextSessionRow';

describe('NextSessionRow', () => {
  it('shows the session summary and fires onShowUpcoming', () => {
    const onShow = jest.fn();
    render(<NextSessionRow formattedDate="vie 10 jul" formattedTime="10:00 a.m." onShowUpcoming={onShow} />);
    expect(screen.getByText(/Próxima sesión/)).toBeInTheDocument();
    expect(screen.getByText(/vie 10 jul/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onShow).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest app/__tests__/components/dashboard/NextSessionRow.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```tsx
// frontend/app/components/dashboard/NextSessionRow.tsx
'use client';

import { CalendarClock, ChevronRight } from 'lucide-react';

export default function NextSessionRow({ formattedDate, formattedTime, onShowUpcoming }: {
  formattedDate: string | null; formattedTime: string; onShowUpcoming: () => void;
}) {
  const dateLabel = formattedDate ?? 'Próximamente';
  return (
    <button
      type="button"
      onClick={onShowUpcoming}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm hover:bg-white/90 transition-colors active:scale-[0.99]"
    >
      <span className="w-8 h-8 rounded-full bg-kore-wine-dark/8 flex items-center justify-center flex-shrink-0">
        <CalendarClock className="w-4 h-4 text-kore-wine-dark/70" strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-kore-gray-dark/50">Próxima sesión</span>
        <span className="block text-[13px] font-semibold text-kore-gray-dark truncate">{dateLabel} · {formattedTime}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-kore-gray-dark/30 flex-shrink-0" strokeWidth={2} />
    </button>
  );
}
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/components/dashboard/NextSessionRow.test.tsx`
Expected: 1 passed

```bash
git add frontend/app/components/dashboard/NextSessionRow.tsx frontend/app/__tests__/components/dashboard/NextSessionRow.test.tsx
git commit -m "feat(credits): compact NextSessionRow component"
```

---

### Task 5: Wire the hero — streak source, badge, pills, session row

**Files:**
- Modify: `frontend/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useWalletStore`, `CreditBalanceBadge`, `HeroTaskPills`, `NextSessionRow`.

- [ ] **Step 1: Migrate the streak source**

At the top of `DashboardPage`, add the wallet store and fetch. Find where stores are read (near `const { weeklySummary } = useProgressStore();` and the streak derivation ~line 1434-1435):

```tsx
  const { wallet, fetchWallet } = useWalletStore();
  useEffect(() => { fetchWallet(); }, [fetchWallet]);
```

Add the import at the top: `import { useWalletStore } from '@/lib/stores/walletStore';`.

Replace the streak derivation (currently `const streakCount = weeklySummary?.streak?.current ?? 0;` / `const longestStreak = weeklySummary?.streak?.longest ?? 0;`) with:

```tsx
  // Streak now comes from the credits engine (the streak that grants bonuses),
  // not weekly adherence — one official streak across the app.
  const streakCount = wallet?.current_streak ?? 0;
  const longestStreak = wallet?.longest_streak ?? 0;
```

(Leave `weeklySummary` and its fetch alone — still used by ProgressTabsCard.)

- [ ] **Step 2: Mount `CreditBalanceBadge` in both header badge clusters**

Add the imports:

```tsx
import CreditBalanceBadge from '@/app/components/dashboard/CreditBalanceBadge';
import HeroTaskPills from '@/app/components/dashboard/HeroTaskPills';
import NextSessionRow from '@/app/components/dashboard/NextSessionRow';
```

MOBILE header cluster (`page.tsx:1594`, the `<div className="flex flex-col gap-1.5 w-[150px]">`): insert as the first child, above the "Fila 1 — Racha" button:

```tsx
            <CreditBalanceBadge />
```

DESKTOP header cluster: find the parallel badges block (~`page.tsx:1807-1858`, the streak/record/KORE cluster in the desktop layout) and insert `<CreditBalanceBadge />` as its first child too. (Mirror the mobile placement; check the exact wrapper there.)

- [ ] **Step 3: Fold task pills into the hero, remove the standalone card**

In the MOBILE hero (`hasRoutine` branch, after the nutrition `Link` block that ends ~line 1719, before the CTAs `<div className="mt-4 space-y-2">` at 1720): insert:

```tsx
              <HeroTaskPills />
```

In the DESKTOP hero (`hasRoutine` branch, ~line 1897-1925 left column, after the nutrition block, before its CTAs): insert `<HeroTaskPills />` at the matching spot.

Remove the standalone mounts:
- MOBILE: delete `{!isGuestDashboard && <TodayCreditsCard />}` at `page.tsx:1773` and its comment.
- DESKTOP: delete the `<TodayCreditsCard />` mount at `page.tsx:1983-1987` and its wrapper/comment.
- Remove the `import TodayCreditsCard ...` line.

- [ ] **Step 4: Replace `SessionCard` with `NextSessionRow`**

MOBILE (`page.tsx:1758-1770`): replace the `<SessionCard mobile ... />` block with:

```tsx
        {!isGuestDashboard && upcomingReminder && (
          <NextSessionRow
            formattedDate={formattedDate}
            formattedTime={formattedTime}
            onShowUpcoming={() => setShowUpcoming(true)}
          />
        )}
```

DESKTOP (`page.tsx:1965-1973`): replace the desktop `<SessionCard ... />` with the same `NextSessionRow` (keep it inside the same grid cell; if the cell was `col-span-4 h-full`, let the row size naturally — adjust the wrapper so it doesn't force full height).

Remove the now-unused `sessionExpanded` state (`page.tsx:1372`) and `setSessionExpanded` references, and the `SessionCard` component definition (`page.tsx:1136-1346`) + its `SessionCardProps` type if nothing else uses them (grep first: `grep -n "SessionCard" page.tsx`).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean (fix any leftover references to removed symbols)

- [ ] **Step 6: Verify in the running app**

Open `http://192.168.56.10:3000/dashboard` as `customer1@kore.com`: hero shows the balance badge, the "Hoy ganas" pills inside the hero, streak from the wallet, and a slim "Próxima sesión" row. No standalone "Hoy ganas" card below.

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/(app)/dashboard/page.tsx"
git commit -m "feat(credits): dashboard hero IA — balance badge, task pills, wallet streak, compact session row"
```

---

### Task 6: `/mis-creditos` — balance + streak cards

**Files:**
- Create: `frontend/app/(app)/mis-creditos/page.tsx`
- Test: covered by E2E in Task 9 (page composed of already-tested store + GlowRing)

**Interfaces:**
- Consumes: `useWalletStore`, `GlowRing` (`@/app/components/shared/GlowRing`).
- Produces: the `/mis-creditos` route with a balance card and a streak card (history added in Task 7).

- [ ] **Step 1: Implement the page (balance + streak; history placeholder wired in Task 7)**

```tsx
// frontend/app/(app)/mis-creditos/page.tsx
'use client';

import { useEffect } from 'react';
import { Flame } from 'lucide-react';
import GlowRing from '@/app/components/shared/GlowRing';
import { useWalletStore } from '@/lib/stores/walletStore';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function StreakWeekDots({ streak }: { streak: number }) {
  // Light the last `streak` days up to 7 (visual only — the streak count is the source of truth).
  const filled = Math.min(streak, 7);
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {WEEK.map((d, i) => {
        const on = i >= 7 - filled;
        return (
          <span key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${on ? 'bg-kore-sage/30 text-kore-sage-deep' : 'bg-kore-gray-dark/[0.06] text-kore-gray-dark/30'}`}>
            {d}
          </span>
        );
      })}
    </div>
  );
}

export default function MisCreditosPage() {
  const { wallet, walletLoaded, fetchWallet } = useWalletStore();
  useEffect(() => { fetchWallet(true); }, [fetchWallet]);

  const ms = wallet?.next_milestone ?? null;
  const bonusProgress = ms ? Math.round(((ms.days - ms.remaining) / ms.days) * 100) : 100;

  return (
    <div className="px-4 py-6 max-w-xl mx-auto space-y-5" data-testid="mis-creditos">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Mis créditos</h1>

      {/* Balance */}
      <div className="rounded-2xl p-6 shadow-lg text-center" style={{ background: 'linear-gradient(135deg, #2D0F1A 0%, #4A1828 55%, #670F22 100%)' }}>
        <p className="text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#E7C8A0' }}>Balance</p>
        <p className="font-heading font-black tabular-nums mt-2" style={{ color: '#FFF8EC', fontSize: 'clamp(44px, 14vw, 64px)' }}>
          {walletLoaded && wallet ? wallet.balance : '—'}
        </p>
        <p className="text-[13px]" style={{ color: '#FFE9DC', opacity: 0.75 }}>créditos disponibles</p>
        {wallet && wallet.pending_balance > 0 && (
          <p className="text-[12px] mt-2 inline-block px-3 py-1 rounded-full" style={{ background: 'rgba(231,200,160,0.15)', color: '#E7C8A0' }}>
            +{wallet.pending_balance} en validación por tu entrenador
          </p>
        )}
      </div>

      {/* Streak */}
      <div className="bg-white rounded-2xl p-6 border border-kore-gray-light/40 shadow-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-4">Tu racha</p>
        <GlowRing value={ms ? bonusProgress : 100} size={132} stroke={10} gradientFrom="#E7C8A0" gradientTo="#E00000" glowColor="rgba(224,0,0,0.35)" trackColor="rgba(103,15,34,0.10)">
          <div className="flex flex-col items-center">
            <Flame className="w-5 h-5 text-kore-red mb-0.5" strokeWidth={2} />
            <span className="font-heading text-[30px] font-black text-kore-wine-dark leading-none tabular-nums">{wallet?.current_streak ?? 0}</span>
            <span className="text-[10px] text-kore-gray-dark/50 font-semibold uppercase tracking-wide">días</span>
          </div>
        </GlowRing>
        <StreakWeekDots streak={wallet?.current_streak ?? 0} />
        {ms ? (
          <p className="text-[13px] text-kore-gray-dark/70 mt-4">
            Faltan <span className="font-bold text-kore-wine-dark">{ms.remaining}</span> {ms.remaining === 1 ? 'día' : 'días'} para tu bono de <span className="font-bold text-kore-red">+{ms.bonus}</span>
          </p>
        ) : (
          <p className="text-[13px] text-kore-gray-dark/70 mt-4">¡Racha máxima! Sigue así para mantenerla.</p>
        )}
        {wallet && wallet.longest_streak > 0 && (
          <p className="text-[11px] text-kore-gray-dark/40 mt-1">Tu récord: {wallet.longest_streak} días</p>
        )}
      </div>

      {/* History mounts here in Task 7 */}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

Open `http://192.168.56.10:3000/mis-creditos` as `customer1`: balance card + streak ring with week dots and bonus progress render.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/mis-creditos/page.tsx"
git commit -m "feat(credits): mis-creditos page — balance and streak with bonus progress"
```

---

### Task 7: `/mis-creditos` — transaction history with infinite scroll

**Files:**
- Modify: `frontend/app/(app)/mis-creditos/page.tsx`

**Interfaces:**
- Consumes: `useWalletStore` (transactions, txCount, txLoading, fetchTransactions).

- [ ] **Step 1: Add the history section**

Add these imports and a `useRef`/`useEffect` for the infinite-scroll sentinel, plus a `TxRow` component. Replace the `{/* History mounts here in Task 7 */}` comment with the history block.

At the top of the file add to imports:

```tsx
import { useRef } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { useWalletStore } from '@/lib/stores/walletStore';
```

(the `useWalletStore` import already exists — keep one). Add a `TxRow` above the page component:

```tsx
function TxRow({ tx }: { tx: import('@/lib/stores/walletStore').CreditTransaction }) {
  const pending = tx.status === 'pending';
  const positive = tx.amount >= 0;
  const Icon = pending ? Clock : positive ? ArrowUpRight : ArrowDownLeft;
  const tone = pending ? 'bg-amber-100 text-amber-600' : positive ? 'bg-kore-sage/20 text-kore-sage-deep' : 'bg-red-100 text-red-600';
  const date = new Date(tx.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-kore-gray-dark truncate">{tx.description}</p>
        <p className="text-[11px] text-kore-gray-dark/40">{date}{pending ? ' · en validación' : ''}</p>
      </div>
      <span className={`text-[14px] font-bold tabular-nums flex-shrink-0 ${positive ? 'text-kore-sage-deep' : 'text-red-600'}`}>
        {positive ? '+' : ''}{tx.amount}
      </span>
    </div>
  );
}
```

Inside the page component, add the transactions state + sentinel:

```tsx
  const { transactions, txCount, txLoading, fetchTransactions } = useWalletStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTransactions(true); }, [fetchTransactions]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchTransactions();
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [fetchTransactions]);
```

Replace the placeholder comment with:

```tsx
      <div className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-1 px-1">Historial</p>
        {transactions.length === 0 && !txLoading ? (
          <p className="text-[13px] text-kore-gray-dark/40 py-6 text-center">
            Aún no tienes movimientos. Completa tu check-in para empezar a ganar.
          </p>
        ) : (
          <div className="divide-y divide-kore-gray-light/40">
            {transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
        {txLoading && <p className="text-[12px] text-kore-gray-dark/40 py-3 text-center">Cargando…</p>}
        <div ref={sentinelRef} className="h-1" />
      </div>
```

- [ ] **Step 2: Typecheck + verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

Verify as `customer1`: the history lists the movements we generated earlier (workout_day pending, no_show_penalty, etc.); scrolling loads more if there are >20.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/mis-creditos/page.tsx"
git commit -m "feat(credits): transaction history with infinite scroll on mis-creditos"
```

---

### Task 8: Navigation links

**Files:**
- Modify: `frontend/app/components/layouts/Sidebar.tsx`
- Modify: `frontend/app/components/layouts/MobileBottomNav.tsx`

**Interfaces:**
- Produces: a "Mis créditos" entry in the desktop sidebar (Cuenta group) and the mobile bottom-nav "Más" menu, linking to `/mis-creditos`.

- [ ] **Step 1: Sidebar link**

In `Sidebar.tsx`, add an inline SVG icon near the other icons (`Sidebar.tsx:27-72`), e.g.:

```tsx
  const CreditsIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" /><path d="M12 8v8M9.5 10.5a2.5 2 0 0 1 5 0c0 1.5-2.5 1.3-2.5 3" />
    </svg>
  );
```

Then add an item to the Cuenta group in `navGroups` (near "Mi Suscripción", `Sidebar.tsx:123-128`):

```tsx
        { key: 'credits', label: 'Mis créditos', href: '/mis-creditos', icon: CreditsIcon },
```

- [ ] **Step 2: Bottom-nav link**

In `MobileBottomNav.tsx`, add to `moreItems` (`:106-149`):

```tsx
    { key: 'credits', label: 'Mis créditos', href: '/mis-creditos' },
```

(mirror the shape of the existing `moreItems` entries — if they require an `icon`, add a small inline SVG like the sidebar's.)

- [ ] **Step 3: Typecheck, verify, commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

Verify the link appears in the desktop sidebar and the mobile "Más" menu and navigates to `/mis-creditos`.

```bash
git add frontend/app/components/layouts/Sidebar.tsx frontend/app/components/layouts/MobileBottomNav.tsx
git commit -m "feat(credits): mis-creditos nav links in sidebar and mobile bottom-nav"
```

---

### Task 9: E2E + dashboard test updates + flow triplet + guide

**Files:**
- Create: `frontend/e2e/app/mis-creditos.spec.ts`
- Modify: `frontend/e2e/app/dashboard.spec.ts`
- Modify: `frontend/app/__tests__/views/DashboardPage.test.tsx`
- Modify: `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`, `docs/release-july/GUIA_DE_VALIDACION.md`

- [ ] **Step 1: DashboardPage unit test** — add a `walletStore` mock (the hero now reads it) alongside the existing store mocks:

```tsx
jest.mock('@/lib/stores/walletStore', () => ({
  useWalletStore: () => ({
    wallet: { balance: 55, pending_balance: 0, current_streak: 3, longest_streak: 9, last_active_date: null, next_milestone: null },
    walletLoaded: true, transactions: [], txCount: 0, txLoading: false,
    fetchWallet: jest.fn(), fetchTransactions: jest.fn(),
  }),
}));
```

Run: `npx jest app/__tests__/views/DashboardPage.test.tsx` → PASS (fix any assertions that referenced the removed standalone "Hoy ganas" card / SessionCard).

- [ ] **Step 2: `mis-creditos.spec.ts`** (mirror auth + mocks from `dashboard.spec.ts`):

```typescript
import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const WALLET = {
  balance: 55, pending_balance: 15, current_streak: 3, longest_streak: 9,
  last_active_date: '2026-07-03', next_milestone: { days: 7, bonus: 50, remaining: 4 },
};
const TX = {
  count: 2,
  results: [
    { id: 1, action: 'workout_day', amount: 15, status: 'pending', description: 'Completaste tu entrenamiento del 2026-07-03', reference_type: 'daily_log', reference_id: '1', review_deadline: null, created_at: '2026-07-03T10:00:00Z' },
    { id: 2, action: 'no_show_penalty', amount: -40, status: 'confirmed', description: 'No asististe a tu sesión del 2026-07-02', reference_type: 'booking', reference_id: '2', review_deadline: null, created_at: '2026-07-02T23:57:00Z' },
  ],
};

test.describe('Mis créditos', { tag: [...FlowTags.CUSTOMER_CREDITS, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/credits/wallet/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WALLET) }));
    await page.route('**/api/credits/transactions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TX) }));
  });

  test('shows balance, streak and history', async ({ page }) => {
    await page.goto('/mis-creditos');
    await expect(page.getByTestId('mis-creditos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('55')).toBeVisible();
    await expect(page.getByText('+15 en validación por tu entrenador')).toBeVisible();
    await expect(page.getByText(/Faltan\s+4\s+días para tu bono/)).toBeVisible();
    await expect(page.getByText('Completaste tu entrenamiento del 2026-07-03')).toBeVisible();
    await expect(page.getByText('No asististe a tu sesión del 2026-07-02')).toBeVisible();
  });

  test('empty history shows the starter message', async ({ page }) => {
    await page.route('**/api/credits/transactions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await page.goto('/mis-creditos');
    await expect(page.getByText(/Aún no tienes movimientos/)).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 3: Update `dashboard.spec.ts`** — the "Hoy ganas" test now targets the hero pills. Add a `**/api/credits/wallet/**` route mock in the file's setup, and change the credits assertion to:

```typescript
  test('hero shows the credit balance badge and task pills', async ({ page }) => {
    await page.route('**/api/credits/wallet/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ balance: 55, pending_balance: 0, current_streak: 3, longest_streak: 9, last_active_date: null, next_milestone: null }) }));
    await page.route('**/api/credits/values/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ action_values: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 }, streak_bonuses: {}, water_goal_glasses: 8, meal_review_days: 3, require_workout_captures: true }) }));
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Ver mis créditos' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('hero-task-pills').first()).toBeVisible();
    await expect(page.getByText('Hoy ganas').first()).toBeVisible();
  });
```

Remove/replace the old `today-credits-card` assertion. If a next-session test asserted the old SessionCard, point it at the new row text "Próxima sesión".

- [ ] **Step 4: Flow triplet** — `flow-definitions.json`: version `1.0.9`, add:

```json
    "customer-credits": {
      "name": "Cliente — Mis créditos",
      "module": "app",
      "priority": "P2",
      "roles": ["user"],
      "description": "El cliente ve su balance de créditos, racha con progreso al siguiente bono e historial de transacciones."
    },
```

`flow-tags.ts`: `CUSTOMER_CREDITS: ['@flow:customer-credits', '@module:app', '@priority:P2'],`. `USER_FLOW_MAP.md`: new `### customer-credits` entry (Route `/mis-creditos`, steps: abrir desde saldo del hero o menú → ver balance/pendiente → racha y progreso al bono → historial con scroll) and add to `dashboard-overview` a branch for the hero balance badge + task pills + compact session row.

- [ ] **Step 5: Validation guide** — append a "Parte 3" section to `docs/release-july/GUIA_DE_VALIDACION.md` (5-block format): ver el saldo y la racha en el home, entrar a "Mis créditos", leer el balance con lo pendiente, la racha con el progreso al bono, y el historial. Update the "Próximas secciones" list (remove Parte 3).

- [ ] **Step 6: Run specs serialized, commit**

Run: `./node_modules/.bin/playwright test e2e/app/mis-creditos.spec.ts e2e/app/dashboard.spec.ts --workers=1`
Expected: PASS (CI re-verifies)

```bash
git add frontend/e2e/ frontend/app/__tests__/views/DashboardPage.test.tsx docs/USER_FLOW_MAP.md docs/release-july/GUIA_DE_VALIDACION.md
git commit -m "test(credits): e2e for mis-creditos, dashboard hero updates + flow triplet"
```

---

### Task 10: Wrap-up — audit, push, PR

- [ ] **Step 1**: invoke the `e2e-user-flows-check` skill for the touched flows (`customer-credits`, `dashboard-overview`); close any P1/P2 gap.
- [ ] **Step 2**: `cd frontend && npx tsc --noEmit` (clean) and a quick `grep -rn "TodayCreditsCard\|SessionCard\|sessionExpanded" "frontend/app/(app)/dashboard/page.tsx"` returns nothing stale.
- [ ] **Step 3**: `git push -u origin feat/03072026-phase3-client-credit-views`, create the PR to base `july-release` titled `feat(credits): Phase 2 Part 3 — client credit views & dashboard IA`, summarizing the wallet store, hero refactor (balance/pills/streak/session row), `/mis-creditos`, and the one-official-streak migration (visible streak-number change noted). CI runs everything. Report the PR URL.
