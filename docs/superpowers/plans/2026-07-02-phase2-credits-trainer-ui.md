# Phase 2 Part 1 — Trainer UI for the Credits Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two trainer features the merged credits engine needs to operate: attendance confirmation (agenda day modal + client detail sessions) and biweekly physical test registration (inside the existing "Ev. Física" tab).

**Architecture:** Additive backend serializer fields; Zustand store actions following existing patterns (`bookingStore.confirmAttendance`, new `physicalTestStore`, `trainerStore.markSessionAttendance` in-place updater); one shared `AttendanceActions` component reused in both surfaces; one `PhysicalTestSection` component at the top of `EvalFisicaTab`. Inline error banners, no toasts, Spanish strings in JSX.

**Tech Stack:** Next.js 16 App Router + React 19 + TS, Zustand 5, Axios wrapper `lib/services/http.ts`, Tailwind 4 (KORE design system), Jest 30 + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-02-phase2-credits-trainer-ui-design.md`

## Global Constraints

- Branch: `feat/02072026-phase2-credits-trainer-ui` (off `july-release`). Commit after every task.
- Frontend strings: hardcoded Spanish in JSX (next-intl is NOT wired — follow existing views).
- Design system per `frontend/CLAUDE.md`: pills `rounded-full px-2 py-1 text-[10px] font-bold`, cards `rounded-2xl`, single accent, no toasts, no layout-shift hovers.
- HTTP only via `api` from `@/lib/services/http`; store actions follow the `set({loading}) → try/catch → set({error})` pattern with local `authHeaders()`.
- Tests: run ONLY the file you just wrote (`cd frontend && npm test -- path`, `cd backend && pytest path -v`). Never full suites. CI is the final gate; the Test Quality Gate rejects non-deterministic tests — use `jest.useFakeTimers({ now: ... })` / the backend `frozen_now` fixture whenever "now" matters.
- Backend changes are additive only; never edit old migrations (no new migrations needed here).
- Dev servers are already running on 0.0.0.0 (backend :8001, frontend :3000, logs in `/tmp/kore_project-dev/`).

---

### Task 1: Backend — expose attendance fields + `?customer=` filter on physical tests

**Files:**
- Modify: `backend/core_app/views/trainer_client_views.py` (two payload dicts: `TrainerClientSessionsView.get` ~line 268, `TrainerAgendaView.get` ~line 495)
- Modify: `backend/core_app/views/physical_test_views.py` (`get_queryset`)
- Test: `backend/core_app/tests/views/test_trainer_sessions_attendance_fields.py`

**Interfaces:**
- Produces: both trainer session payloads gain `attendance_status` (`'unset'|'attended'|'no_show'`) and `attendance_confirmed_at` (ISO string | null); `GET /api/trainer/physical-tests/?customer=<id>` filters by customer.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_trainer_sessions_attendance_fields.py
from datetime import timedelta

import pytest

from core_app.models import Booking, Package, TrainerProfile, User


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer@example.com', password='x',
        first_name='T', last_name='R', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.get_or_create(user=user)
    return user


@pytest.fixture
def client_booking(existing_user, trainer_user, frozen_now):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    package = Package.objects.create(title='P')
    return Booking.objects.create(
        customer=existing_user, package=package,
        trainer=trainer_user.trainer_profile,
        starts_at=frozen_now - timedelta(hours=2), ends_at=frozen_now - timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_client_sessions_payload_includes_attendance(api_client, trainer_user, client_booking, existing_user):
    api_client.force_authenticate(trainer_user)
    resp = api_client.get(f'/api/trainer/my-clients/{existing_user.pk}/sessions/')
    assert resp.status_code == 200
    row = resp.json()[0]
    assert row['attendance_status'] == 'unset'
    assert row['attendance_confirmed_at'] is None


@pytest.mark.django_db
def test_agenda_payload_includes_attendance(api_client, trainer_user, client_booking, frozen_now):
    api_client.force_authenticate(trainer_user)
    day = frozen_now.date().isoformat()
    resp = api_client.get(f'/api/trainer/agenda/?from={day}&to={day}')
    assert resp.status_code == 200
    session = resp.json()['sessions'][0]
    assert session['attendance_status'] == 'unset'
    assert session['attendance_confirmed_at'] is None
```

Note: the agenda view converts the range to America/Bogota — with `frozen_now` at 15:00 UTC the booking (13:00-14:00 UTC = 08:00-09:00 Bogota) falls inside the same Bogota calendar day, so `from=to=frozen date` finds it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/views/test_trainer_sessions_attendance_fields.py -v`
Expected: FAIL with `KeyError: 'attendance_status'`

- [ ] **Step 3: Add the fields**

In `TrainerClientSessionsView.get`, extend the `results.append({...})` dict (after `'canceled_reason'`):

```python
                'attendance_status': b.attendance_status,
                'attendance_confirmed_at': b.attendance_confirmed_at.isoformat() if b.attendance_confirmed_at else None,
```

In `TrainerAgendaView.get`, extend the `sessions = [{...}]` dict (after `'status'`):

```python
                'attendance_status': b.attendance_status,
                'attendance_confirmed_at': b.attendance_confirmed_at.isoformat() if b.attendance_confirmed_at else None,
```

In `backend/core_app/views/physical_test_views.py`, replace `get_queryset` with:

```python
    def get_queryset(self):
        qs = PhysicalTest.objects.select_related('customer', 'trainer')
        if not is_admin_user(self.request.user):
            trainer_profile = getattr(self.request.user, 'trainer_profile', None)
            qs = qs.filter(customer__assigned_trainer=trainer_profile)
        customer_param = self.request.query_params.get('customer')
        if customer_param:
            qs = qs.filter(customer_id=customer_param)
        return qs
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest core_app/tests/views/test_trainer_sessions_attendance_fields.py -v`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/trainer_client_views.py backend/core_app/views/physical_test_views.py backend/core_app/tests/views/test_trainer_sessions_attendance_fields.py
git commit -m "feat(credits): expose attendance fields in trainer session payloads + customer filter on physical tests"
```

---

### Task 2: `bookingStore.confirmAttendance` + attendance fields in types

**Files:**
- Modify: `frontend/lib/stores/bookingStore.ts` (`BookingData` type ~line 69; state type where `cancelBooking` is declared; action after `cancelBooking` ~line 341)
- Test: `frontend/app/__tests__/stores/bookingStore.attendance.test.ts`

**Interfaces:**
- Produces: `confirmAttendance(bookingId: number, attended: boolean): Promise<BookingData | null>`; `BookingData` gains `attendance_status: 'unset' | 'attended' | 'no_show'` and `attendance_confirmed_at: string | null`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/bookingStore.attendance.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useBookingStore } from '@/lib/stores/bookingStore';

describe('bookingStore.confirmAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBookingStore.setState({ error: null });
  });

  it('posts the decision and returns the updated booking', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 5, attendance_status: 'attended', attendance_confirmed_at: '2026-07-15T15:00:00Z' },
    });
    const res = await useBookingStore.getState().confirmAttendance(5, true);
    expect(api.post).toHaveBeenCalledWith(
      '/bookings/5/confirm-attendance/',
      { attended: true },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(res?.attendance_status).toBe('attended');
  });

  it('stores the API detail message on failure and returns null', async () => {
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'La sesión aún no ha iniciado.' } },
    });
    const res = await useBookingStore.getState().confirmAttendance(5, true);
    expect(res).toBeNull();
    expect(useBookingStore.getState().error).toBe('La sesión aún no ha iniciado.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- app/__tests__/stores/bookingStore.attendance.test.ts`
Expected: FAIL — `confirmAttendance is not a function`

- [ ] **Step 3: Implement**

Add to `BookingData` (after `canceled_reason: string;`):

```typescript
  attendance_status: 'unset' | 'attended' | 'no_show';
  attendance_confirmed_at: string | null;
```

Add the signature to the store's state/actions type, next to where `cancelBooking` is declared (search `cancelBooking:` in the type block):

```typescript
  confirmAttendance: (bookingId: number, attended: boolean) => Promise<BookingData | null>;
```

Add the action right after the `cancelBooking` implementation:

```typescript
  confirmAttendance: async (bookingId, attended) => {
    set({ error: null });
    try {
      const { data } = await api.post<BookingData>(
        `/bookings/${bookingId}/confirm-attendance/`,
        { attended },
        { headers: authHeaders() },
      );
      if (get().bookingDetail?.id === bookingId) {
        set({ bookingDetail: data });
      }
      return data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        'No se pudo registrar la asistencia.';
      set({ error: typeof msg === 'string' ? msg : 'No se pudo registrar la asistencia.' });
      return null;
    }
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/__tests__/stores/bookingStore.attendance.test.ts`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/bookingStore.ts frontend/app/__tests__/stores/bookingStore.attendance.test.ts
git commit -m "feat(credits): confirmAttendance action and attendance fields in bookingStore"
```

---

### Task 3: `trainerStore` — attendance in session types + `markSessionAttendance`

**Files:**
- Modify: `frontend/lib/stores/trainerStore.ts` (`ClientSession` ~line 86, `UpcomingSession` ~line 99, state type, actions)
- Test: `frontend/app/__tests__/stores/trainerStore.attendance.test.ts`

**Interfaces:**
- Produces: both session types gain `attendance_status?: 'unset' | 'attended' | 'no_show'` and `attendance_confirmed_at?: string | null`; `markSessionAttendance(bookingId: number, status: 'attended' | 'no_show'): void` patches `agendaSessions` and `clientSessions` in place (no refetch).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/trainerStore.attendance.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { useTrainerStore } from '@/lib/stores/trainerStore';

describe('trainerStore.markSessionAttendance', () => {
  it('patches the matching session in agenda and client lists', () => {
    useTrainerStore.setState({
      agendaSessions: [
        { id: 7, customer_name: 'Ana', customer_id: 1, package_title: 'P', starts_at: 'x', ends_at: 'y', status: 'confirmed', attendance_status: 'unset' },
      ] as never,
      clientSessions: [
        { id: 7, status: 'confirmed', package_title: 'P', starts_at: 'x', ends_at: 'y', notes: '', canceled_reason: '', session_objective: '', session_notes_for_customer: '', created_at: 'z', attendance_status: 'unset' },
      ] as never,
    });
    useTrainerStore.getState().markSessionAttendance(7, 'attended');
    expect(useTrainerStore.getState().agendaSessions[0].attendance_status).toBe('attended');
    expect(useTrainerStore.getState().clientSessions[0].attendance_status).toBe('attended');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/__tests__/stores/trainerStore.attendance.test.ts`
Expected: FAIL — `markSessionAttendance is not a function`

- [ ] **Step 3: Implement**

Add to BOTH `ClientSession` and `UpcomingSession` types:

```typescript
  attendance_status?: 'unset' | 'attended' | 'no_show';
  attendance_confirmed_at?: string | null;
```

Add to the store's state/actions type (next to `fetchAgendaSessions`):

```typescript
  markSessionAttendance: (bookingId: number, status: 'attended' | 'no_show') => void;
```

Add the action (after `fetchAgendaSessions` implementation):

```typescript
  markSessionAttendance: (bookingId: number, status: 'attended' | 'no_show') =>
    set((state) => ({
      agendaSessions: state.agendaSessions.map((s) =>
        s.id === bookingId ? { ...s, attendance_status: status } : s,
      ),
      clientSessions: state.clientSessions.map((s) =>
        s.id === bookingId ? { ...s, attendance_status: status } : s,
      ),
    })),
```

- [ ] **Step 4: Run test, commit**

Run: `npm test -- app/__tests__/stores/trainerStore.attendance.test.ts`
Expected: 1 PASS

```bash
git add frontend/lib/stores/trainerStore.ts frontend/app/__tests__/stores/trainerStore.attendance.test.ts
git commit -m "feat(credits): attendance fields and markSessionAttendance in trainerStore"
```

---

### Task 4: `AttendanceActions` shared component

**Files:**
- Create: `frontend/app/components/trainer/AttendanceActions.tsx`
- Test: `frontend/app/__tests__/components/trainer/AttendanceActions.test.tsx`

**Interfaces:**
- Produces: `<AttendanceActions session={{ id, starts_at, status, attendance_status }} />` — renders nothing for future or canceled sessions; ✓/✗ pill buttons for started sessions with `attendance_status` unset/missing; a badge once attendance is set. On click: `bookingStore.confirmAttendance` then `trainerStore.markSessionAttendance`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/components/trainer/AttendanceActions.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import AttendanceActions from '@/app/components/trainer/AttendanceActions';

const FROZEN = new Date('2026-07-15T15:00:00Z');

beforeAll(() => jest.useFakeTimers({ now: FROZEN }));
afterAll(() => jest.useRealTimers());

const base = { id: 9, status: 'confirmed' as const };

describe('AttendanceActions', () => {
  it('renders nothing for future sessions', () => {
    const { container } = render(
      <AttendanceActions session={{ ...base, starts_at: '2026-07-16T10:00:00Z', attendance_status: 'unset' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders confirm buttons for a started, unconfirmed session', () => {
    render(<AttendanceActions session={{ ...base, starts_at: '2026-07-15T13:00:00Z', attendance_status: 'unset' }} />);
    expect(screen.getByRole('button', { name: /Asistió/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No asistió/ })).toBeInTheDocument();
  });

  it('shows a badge when attendance is already set', () => {
    render(<AttendanceActions session={{ ...base, starts_at: '2026-07-15T13:00:00Z', attendance_status: 'attended' }} />);
    expect(screen.getByText('Asistió')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('posts the decision and swaps to the badge', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 9, attendance_status: 'attended', attendance_confirmed_at: FROZEN.toISOString() },
    });
    render(<AttendanceActions session={{ ...base, starts_at: '2026-07-15T13:00:00Z', attendance_status: 'unset' }} />);
    fireEvent.click(screen.getByRole('button', { name: /✓ Asistió/ }));
    await waitFor(() => expect(screen.getByText('Asistió')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/bookings/9/confirm-attendance/', { attended: true }, expect.any(Object));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/__tests__/components/trainer/AttendanceActions.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the component**

```tsx
// frontend/app/components/trainer/AttendanceActions.tsx
'use client';

import { useState } from 'react';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';

export type AttendanceSessionInput = {
  id: number;
  starts_at: string | null;
  status: string;
  attendance_status?: 'unset' | 'attended' | 'no_show';
};

/**
 * Attendance confirmation for a session that already started.
 * The credits engine penalizes unconfirmed sessions at day close (23:55),
 * so the trainer confirms from here; a late "Asistió" reverses the penalty.
 */
export default function AttendanceActions({ session }: { session: AttendanceSessionInput }) {
  const confirmAttendance = useBookingStore((s) => s.confirmAttendance);
  const markSessionAttendance = useTrainerStore((s) => s.markSessionAttendance);
  const [submitting, setSubmitting] = useState<boolean | null>(null);
  const [localStatus, setLocalStatus] = useState(session.attendance_status ?? 'unset');

  const started = !!session.starts_at && new Date(session.starts_at) <= new Date();
  if (!started || session.status === 'canceled') return null;

  if (localStatus === 'attended') {
    return (
      <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-kore-sage/20 text-kore-sage-deep">
        Asistió
      </span>
    );
  }
  if (localStatus === 'no_show') {
    return (
      <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-red-100 text-red-600">
        No asistió
      </span>
    );
  }

  async function handle(attended: boolean) {
    setSubmitting(attended);
    const data = await confirmAttendance(session.id, attended);
    if (data) {
      const status = attended ? 'attended' : 'no_show';
      setLocalStatus(status);
      markSessionAttendance(session.id, status);
    }
    setSubmitting(null);
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        type="button"
        onClick={() => handle(true)}
        disabled={submitting !== null}
        className="font-body text-[10px] font-bold px-2 py-1 rounded-full active:scale-95 transition-colors disabled:opacity-50"
        style={{ color: '#669959', background: 'rgba(168,194,156,0.18)' }}
      >
        {submitting === true ? 'Guardando…' : '✓ Asistió'}
      </button>
      <button
        type="button"
        onClick={() => handle(false)}
        disabled={submitting !== null}
        className="font-body text-[10px] font-bold px-2 py-1 rounded-full active:scale-95 transition-colors disabled:opacity-50"
        style={{ color: '#9A0526', background: 'rgba(154,5,38,0.08)' }}
      >
        {submitting === false ? 'Guardando…' : '✗ No asistió'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test, commit**

Run: `npm test -- app/__tests__/components/trainer/AttendanceActions.test.tsx`
Expected: 4 PASS

```bash
git add frontend/app/components/trainer/AttendanceActions.tsx frontend/app/__tests__/components/trainer/AttendanceActions.test.tsx
git commit -m "feat(credits): AttendanceActions shared component"
```

---

### Task 5: Attendance in the agenda day modal

**Files:**
- Modify: `frontend/app/components/trainer/AgendaDayModal.tsx` (session rows, lines ~172-196)

**Interfaces:**
- Consumes: `AttendanceActions` (Task 4); `UpcomingSession.attendance_status` (Tasks 1+3).

- [ ] **Step 1: Restructure the session row**

The row is currently a single `<Link>`; buttons cannot nest inside a link. Replace the `ordered.map(...)` block with:

```tsx
            {ordered.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-kore-wine-dark/8 bg-kore-cream/50 px-3.5 py-3 transition-colors hover:bg-white"
              >
                <Link
                  href={`/trainer/clients/client?id=${s.customer_id}`}
                  prefetch={false}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <span className="font-heading text-[13px] font-semibold text-kore-wine-dark w-12 flex-shrink-0">
                    {fmtTime(s.starts_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[13px] font-semibold text-kore-gray-dark truncate">
                      {s.customer_name}
                    </p>
                    <p className="font-body text-[11px] text-kore-wine-dark/55 truncate">
                      {s.package_title}
                    </p>
                  </div>
                </Link>
                <AttendanceActions
                  session={{ id: s.id, starts_at: s.starts_at, status: s.status, attendance_status: s.attendance_status }}
                />
                <span className="font-body text-[10px] font-bold uppercase tracking-wide text-kore-wine-dark/45 flex-shrink-0">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
            ))}
```

Add the import at the top:

```tsx
import AttendanceActions from './AttendanceActions';
```

- [ ] **Step 2: Verify in the running app**

The dev servers are up. Open `http://192.168.56.10:3000/trainer/dashboard`, open a day with a past session in the agenda, and confirm the ✓/✗ buttons appear and swap to a badge on click. (Needs a trainer login + a past session — use existing fake data or `/fake-data-refresh`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/trainer/AgendaDayModal.tsx
git commit -m "feat(credits): attendance confirmation in agenda day modal"
```

---

### Task 6: Attendance in the client detail session rows

**Files:**
- Modify: `frontend/app/(app)/trainer/clients/client/page.tsx` (`SessionRow`, lines ~721-790)

**Interfaces:**
- Consumes: `AttendanceActions`; `ClientSession.attendance_status` flows through `clientSessions` (already fetched at `trainerStore.fetchClientSessions`).

- [ ] **Step 1: Extend `SessionRow`**

Add `attendance_status?: 'unset' | 'attended' | 'no_show';` to the inline `session` prop type of `SessionRow` (line ~727). Then, right before the closing status `<span>` (after the "Mensaje" button block), insert:

```tsx
      <AttendanceActions
        session={{ id: session.id, starts_at: session.starts_at, status: session.status, attendance_status: session.attendance_status }}
      />
```

Add the import at the top of the page:

```tsx
import AttendanceActions from '@/app/components/trainer/AttendanceActions';
```

(`AttendanceActions` renders nothing for upcoming/canceled rows, so no conditional is needed; the existing "Mensaje" button for past confirmed sessions stays.)

- [ ] **Step 2: Verify in the running app**

Open a client with past sessions (`/trainer/clients/client?id=X` → Resumen → Sesiones recientes) and confirm buttons/badges render per state.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/trainer/clients/client/page.tsx"
git commit -m "feat(credits): attendance confirmation in client detail session rows"
```

---

### Task 7: `physicalTestStore`

**Files:**
- Create: `frontend/lib/stores/physicalTestStore.ts`
- Test: `frontend/app/__tests__/stores/physicalTestStore.test.ts`

**Interfaces:**
- Produces: `usePhysicalTestStore` with `tests: PhysicalTest[]`, `loading`, `submitting`, `error`, `fetchTests(clientId)` (GET `/trainer/physical-tests/?customer=<id>`), `createTest(clientId, {performed_at, result, notes})` (POST with `customer` in body, prepends result).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/physicalTestStore.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { usePhysicalTestStore } from '@/lib/stores/physicalTestStore';

const TEST_ROW = {
  id: 1, customer: 3, trainer: 2, performed_at: '2026-07-15',
  result: 'passed', notes: 'Buen progreso', created_at: '2026-07-15T15:00:00Z',
};

describe('physicalTestStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePhysicalTestStore.setState({ tests: [], loading: false, submitting: false, error: '' });
  });

  it('fetchTests requests the customer filter and stores the list', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [TEST_ROW] });
    await usePhysicalTestStore.getState().fetchTests(3);
    expect(api.get).toHaveBeenCalledWith('/trainer/physical-tests/', expect.objectContaining({
      params: { customer: 3 },
    }));
    expect(usePhysicalTestStore.getState().tests).toHaveLength(1);
  });

  it('createTest posts customer + form data and prepends the result', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: TEST_ROW });
    const created = await usePhysicalTestStore.getState().createTest(3, {
      performed_at: '2026-07-15', result: 'passed', notes: 'Buen progreso',
    });
    expect(api.post).toHaveBeenCalledWith('/trainer/physical-tests/', {
      customer: 3, performed_at: '2026-07-15', result: 'passed', notes: 'Buen progreso',
    }, expect.any(Object));
    expect(created?.id).toBe(1);
    expect(usePhysicalTestStore.getState().tests[0].id).toBe(1);
  });

  it('createTest stores the extracted error on failure', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('boom'));
    const created = await usePhysicalTestStore.getState().createTest(3, {
      performed_at: '2026-07-15', result: 'failed', notes: '',
    });
    expect(created).toBeNull();
    expect(usePhysicalTestStore.getState().error).toBe('No se pudo registrar el test físico.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/__tests__/stores/physicalTestStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the store**

```typescript
// frontend/lib/stores/physicalTestStore.ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type PhysicalTest = {
  id: number;
  customer: number;
  trainer: number | null;
  performed_at: string;
  result: 'passed' | 'failed';
  notes: string;
  created_at: string;
};

export type PhysicalTestFormData = {
  performed_at: string;
  result: 'passed' | 'failed';
  notes: string;
};

type PhysicalTestState = {
  tests: PhysicalTest[];
  loading: boolean;
  submitting: boolean;
  error: string;
  fetchTests: (clientId: number) => Promise<void>;
  createTest: (clientId: number, data: PhysicalTestFormData) => Promise<PhysicalTest | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const usePhysicalTestStore = create<PhysicalTestState>((set) => ({
  tests: [],
  loading: false,
  submitting: false,
  error: '',

  fetchTests: async (clientId: number) => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/physical-tests/', {
        headers: authHeaders(),
        params: { customer: clientId },
      });
      const list: PhysicalTest[] = Array.isArray(data) ? data : data.results ?? [];
      set({ tests: list, loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los tests físicos.', loading: false });
    }
  },

  createTest: async (clientId: number, formData: PhysicalTestFormData) => {
    set({ submitting: true, error: '' });
    try {
      const { data } = await api.post(
        '/trainer/physical-tests/',
        { customer: clientId, ...formData },
        { headers: authHeaders() },
      );
      set((state) => ({ tests: [data, ...state.tests], submitting: false }));
      return data;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo registrar el test físico.'), submitting: false });
      return null;
    }
  },
}));
```

- [ ] **Step 4: Run test, commit**

Run: `npm test -- app/__tests__/stores/physicalTestStore.test.ts`
Expected: 3 PASS

```bash
git add frontend/lib/stores/physicalTestStore.ts frontend/app/__tests__/stores/physicalTestStore.test.ts
git commit -m "feat(credits): physicalTestStore for biweekly test registration"
```

---

### Task 8: `PhysicalTestSection` inside `EvalFisicaTab`

**Files:**
- Create: `frontend/app/components/trainer/evals/PhysicalTestSection.tsx`
- Modify: `frontend/app/components/trainer/evals/EvalFisicaTab.tsx` (render the section at the top of the tab's return)

**Interfaces:**
- Consumes: `usePhysicalTestStore` (Task 7).
- Produces: `<PhysicalTestSection clientId={number} />` — last-test summary + collapsible history + inline "Registrar test" form (date default today, Aprobado/No aprobado toggle, notes). Self-contained design-system markup (do not depend on `evals/shared.tsx` props).

- [ ] **Step 1: Implement the component**

```tsx
// frontend/app/components/trainer/evals/PhysicalTestSection.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePhysicalTestStore } from '@/lib/stores/physicalTestStore';

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function ResultBadge({ result }: { result: 'passed' | 'failed' }) {
  return result === 'passed' ? (
    <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full bg-kore-sage/20 text-kore-sage-deep">
      Aprobado
    </span>
  ) : (
    <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
      No aprobado
    </span>
  );
}

/**
 * Biweekly credit test registration. A passed test awards credits via the
 * engine (PhysicalTest post_save signal on the backend).
 */
export default function PhysicalTestSection({ clientId }: { clientId: number }) {
  const { tests, loading, submitting, error, fetchTests, createTest } = usePhysicalTestStore();
  const [formOpen, setFormOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [performedAt, setPerformedAt] = useState(todayISO());
  const [result, setResult] = useState<'passed' | 'failed'>('passed');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchTests(clientId);
  }, [clientId, fetchTests]);

  const last = tests[0] ?? null;

  async function handleSave() {
    const created = await createTest(clientId, { performed_at: performedAt, result, notes });
    if (created) {
      setFormOpen(false);
      setNotes('');
      setResult('passed');
      setPerformedAt(todayISO());
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3" data-testid="physical-test-section">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">
            Test quincenal
          </p>
          <p className="text-sm text-kore-gray-dark/80 mt-0.5">
            Aprobarlo otorga créditos al cliente.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="bg-kore-red text-white rounded-xl px-3.5 py-2 text-[12px] font-medium hover:bg-kore-red-dark transition-colors flex-shrink-0"
          >
            Registrar test
          </button>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2" role="alert">{error}</p>
      )}

      {formOpen && (
        <div className="rounded-xl border border-kore-gray-light/40 bg-kore-cream/30 p-4 space-y-3" data-testid="physical-test-form">
          <div className="flex flex-wrap gap-3">
            <label className="text-[12px] text-kore-gray-dark/80">
              <span className="block text-[11px] font-semibold text-kore-gray-dark/50 mb-1">Fecha</span>
              <input
                type="date"
                value={performedAt}
                max={todayISO()}
                onChange={(e) => setPerformedAt(e.target.value)}
                className="rounded-xl border border-kore-gray-light/60 bg-white px-3 py-2 text-[13px] text-kore-gray-dark focus:outline-none focus:border-kore-red/40"
              />
            </label>
            <div>
              <span className="block text-[11px] font-semibold text-kore-gray-dark/50 mb-1">Resultado</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setResult('passed')}
                  className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
                    result === 'passed'
                      ? 'bg-kore-sage/25 text-kore-sage-deep'
                      : 'bg-white/60 text-kore-gray-dark/50 border border-white/60'
                  }`}
                >
                  Aprobado
                </button>
                <button
                  type="button"
                  onClick={() => setResult('failed')}
                  className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
                    result === 'failed'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-white/60 text-kore-gray-dark/50 border border-white/60'
                  }`}
                >
                  No aprobado
                </button>
              </div>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas del test (opcional)…"
            className="w-full rounded-xl border border-kore-gray-light/60 bg-white px-3 py-2 text-[13px] text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:border-kore-red/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
              className="flex-1 rounded-xl bg-white/60 border border-white/60 py-2 text-[12px] font-semibold text-kore-gray-dark/50 hover:bg-white/80 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 rounded-xl bg-kore-red text-white py-2 text-[12px] font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
            >
              {submitting ? 'Guardando…' : 'Guardar test'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-kore-gray-dark/40">Cargando tests…</p>
      ) : last ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px] text-kore-gray-dark/80">
            <span className="font-semibold">Último test:</span>
            <span>{fmtDate(last.performed_at)}</span>
            <ResultBadge result={last.result} />
          </div>
          {last.notes && <p className="text-xs text-kore-gray-dark/40">{last.notes}</p>}
          {tests.length > 1 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-[11px] font-semibold text-kore-red hover:text-kore-red-dark transition-colors"
            >
              {showHistory ? 'Ocultar historial' : `Ver historial (${tests.length})`}
            </button>
          )}
          {showHistory && (
            <ul className="space-y-1.5">
              {tests.slice(1).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[12px] text-kore-gray-dark/60">
                  <span>{fmtDate(t.performed_at)}</span>
                  <ResultBadge result={t.result} />
                  {t.notes && <span className="truncate text-kore-gray-dark/40">{t.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-kore-gray-dark/40">
          Sin tests registrados aún. El primero define la línea base del cliente.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `EvalFisicaTab`**

In `frontend/app/components/trainer/evals/EvalFisicaTab.tsx`: add the import and render `<PhysicalTestSection clientId={clientId} />` as the FIRST element inside the component's outermost returned container (above the results/form modes), so it is always visible in the tab. Find the main `return (` of the default export and wrap if needed:

```tsx
import PhysicalTestSection from './PhysicalTestSection';
```

```tsx
  return (
    <div className="space-y-4">
      <PhysicalTestSection clientId={clientId} />
      {/* existing tab content unchanged below */}
      ...
    </div>
  );
```

(If the component already returns a single container, insert the section as its first child instead of wrapping.)

- [ ] **Step 3: Verify in the running app**

Open `/trainer/clients/client?id=X` → tab "Ev. Física": section renders with empty state; register a passed test; confirm it appears as "Último test" and (backend) the customer's wallet gains 100 credits (`GET /api/credits/wallet/` as that customer, or check the admin).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/trainer/evals/PhysicalTestSection.tsx frontend/app/components/trainer/evals/EvalFisicaTab.tsx
git commit -m "feat(credits): biweekly physical test section inside Ev. Física tab"
```

---

### Task 9: E2E specs + flow triplet

**Files:**
- Modify: `frontend/e2e/trainer/trainer-client-detail.spec.ts` (attendance on session rows)
- Create: `frontend/e2e/trainer/trainer-client-physical-tests.spec.ts`
- Modify: `frontend/e2e/flow-definitions.json` (new flow + version bump to 1.0.7)
- Modify: `frontend/e2e/helpers/flow-tags.ts` (new tag)
- Modify: `docs/USER_FLOW_MAP.md` (attendance steps in `trainer-dashboard` and `trainer-client-detail`; new `trainer-client-physical-tests` entry)

**Interfaces:**
- Consumes: existing fixtures `injectTrainerAuthCookies` and mocking patterns — MIRROR `frontend/e2e/trainer/trainer-client-physical-eval.spec.ts` for route mocks and tags before writing.

- [ ] **Step 1: flow-definitions.json**

Bump `"version"` to `"1.0.7"` and add inside `flows` (alphabetical placement near the other `trainer-client-*` entries):

```json
    "trainer-client-physical-tests": {
      "name": "Trainer registra test físico quincenal",
      "module": "trainer",
      "priority": "P2",
      "roles": ["trainer"],
      "description": "El trainer registra el resultado del test físico quincenal (aprobado/no aprobado) desde la tab Ev. Física; un test aprobado otorga créditos al cliente."
    },
```

- [ ] **Step 2: flow-tags.ts**

Add next to `TRAINER_CLIENT_PHYSICAL_EVAL`:

```typescript
  TRAINER_CLIENT_PHYSICAL_TESTS: ['@flow:trainer-client-physical-tests', '@module:trainer', '@priority:P2'],
```

- [ ] **Step 3: E2E — physical tests spec**

Mirror the structure of `trainer-client-physical-eval.spec.ts` (auth fixture + route mocks). Core scenarios:

```typescript
// frontend/e2e/trainer/trainer-client-physical-tests.spec.ts
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Trainer — test físico quincenal', { tag: [...FlowTags.TRAINER_CLIENT_PHYSICAL_TESTS, RoleTags.TRAINER] }, () => {
  test.beforeEach(async ({ context, page }) => {
    await injectTrainerAuthCookies(context);
    // Mirror the client-detail mocks from trainer-client-physical-eval.spec.ts
    // (client info + KPIs) so the page renders, then:
    await page.route('**/api/trainer/physical-tests/?customer=*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
  });

  test('registra un test aprobado y lo muestra como último test', async ({ page }) => {
    await page.route('**/api/trainer/physical-tests/', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1, customer: 3, trainer: 2, performed_at: '2026-07-15',
            result: 'passed', notes: 'Buen progreso', created_at: '2026-07-15T15:00:00Z',
          }),
        });
      }
      return route.fallback();
    });

    await page.goto('/trainer/clients/client?id=3');
    await page.getByRole('button', { name: 'Ev. Física' }).click();
    await expect(page.getByTestId('physical-test-section')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar test' }).click();
    await page.getByRole('button', { name: 'Aprobado', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar test' }).click();
    await expect(page.getByText('Último test:')).toBeVisible();
    await expect(page.getByText('Aprobado', { exact: true })).toBeVisible();
  });
});
```

- [ ] **Step 4: E2E — attendance in client detail**

Add to `trainer-client-detail.spec.ts` (reusing that file's existing mocks for client + sessions; extend the sessions mock rows with `attendance_status: 'unset'` and a past `starts_at`):

```typescript
  test('confirma asistencia de una sesión pasada', async ({ page }) => {
    await page.route('**/api/bookings/*/confirm-attendance/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 7, attendance_status: 'attended', attendance_confirmed_at: '2026-07-15T15:00:00Z' }),
      }),
    );
    await page.goto('/trainer/clients/client?id=3');
    await expect(page.getByRole('button', { name: '✓ Asistió' })).toBeVisible();
    await page.getByRole('button', { name: '✓ Asistió' }).click();
    await expect(page.getByText('Asistió', { exact: true })).toBeVisible();
  });
```

- [ ] **Step 5: USER_FLOW_MAP.md**

- Under `### trainer-dashboard`: add a step "Desde el modal del día, confirma asistencia (✓ asistió / ✗ no asistió) de las sesiones ya iniciadas" and a branch "Sesión sin confirmar al cierre del día → el sistema la marca como inasistencia y descuenta créditos; confirmarla después revierte la penalización".
- Under `### trainer-client-detail`: add a step for attendance on "Sesiones recientes".
- New entry `### trainer-client-physical-tests` following the existing format (Module: trainer / Priority: P2 / Route: `/trainer/clients/client?id=<id>` tab Ev. Física / Roles: trainer / E2E Coverage: `trainer-client-physical-tests.spec.ts`), with steps: abrir tab → Registrar test → elegir resultado y fecha → guardar → ver último test e historial.

- [ ] **Step 6: Run the two spec files, commit**

Run: `cd frontend && npx playwright test e2e/trainer/trainer-client-physical-tests.spec.ts e2e/trainer/trainer-client-detail.spec.ts`
Expected: PASS (if the local run needs the dev server, CI is the final gate — do not run more than these two files)

```bash
git add frontend/e2e/ docs/USER_FLOW_MAP.md
git commit -m "test(credits): e2e coverage for attendance and physical tests + flow triplet"
```

---

### Task 10: Wrap-up — flows audit, push, PR

- [ ] **Step 1: Run the E2E flows audit** — invoke the `e2e-user-flows-check` skill (CLAUDE.md requires it after user-flow changes). Address any P1 gaps it reports for the touched flows.

- [ ] **Step 2: Sanity + push**

Run: `cd frontend && npx tsc --noEmit` (or `npm run build` if tsc isn't configured standalone)
Expected: no type errors

```bash
git push -u origin feat/02072026-phase2-credits-trainer-ui
```

- [ ] **Step 3: Create the PR** to base `july-release`, titled `feat(credits): Phase 2 Part 1 — trainer UI (attendance + biweekly physical test)`, summarizing: attendance in agenda day modal + client detail (with penalty-reversal note), physical test section in Ev. Física, backend payload additions, tests. CI runs the suites. Report the PR URL.
