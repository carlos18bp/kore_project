# Trainer Agenda Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la card "Agenda" del dashboard del trainer en una vista con toggle Día / Semana / Mes, con modal de resumen al clickear un día.

**Architecture:** Endpoint backend nuevo `GET /api/trainer/agenda/?from=&to=` que devuelve las sesiones del trainer en un rango. El frontend agrega un componente `AgendaCard` que orquesta 3 vistas (timeline por hora / tira de 7 días / calendario mensual), un modal `AgendaDayModal`, y dos componentes presentacionales (`AgendaWeekStrip`, `AgendaMonthGrid`). Datos vía `trainerStore.fetchAgendaSessions`.

**Tech Stack:** Django 6 + DRF (backend), Next.js 16 + React 19 + TypeScript + Tailwind + Zustand (frontend), pytest + Jest (tests).

**Spec:** `docs/superpowers/specs/2026-05-20-trainer-agenda-views-design.md`

**Branch:** `fix/20052026-release-april-may-fixes` (ya activa).

> **Nota de workflow:** el operador NO corre suites de tests localmente — el CI de GitHub las corre en cada push. Cada tarea: escribir test, escribir implementación, verificar **compilación** local (`python manage.py check` / `npm run build`), commitear. Los tests se validan en CI. NO ejecutar `pytest` / `jest` localmente.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/core_app/views/trainer_client_views.py` | Modificar | Agregar `TrainerAgendaView` (sesiones por rango) |
| `backend/core_app/urls/api_urls.py` | Modificar | Registrar `trainer/agenda/` |
| `backend/core_app/tests/views/test_trainer_agenda_view.py` | Crear | Tests del endpoint |
| `frontend/lib/stores/trainerStore.ts` | Modificar | `agendaSessions` + `fetchAgendaSessions` |
| `frontend/lib/utils/agendaDates.ts` | Crear | Helpers de fechas (dateKey, semana, agrupar) |
| `frontend/app/components/trainer/AgendaDayModal.tsx` | Crear | Modal de resumen de un día |
| `frontend/app/components/trainer/AgendaWeekStrip.tsx` | Crear | Vista semana — tira de 7 días |
| `frontend/app/components/trainer/AgendaMonthGrid.tsx` | Crear | Vista mes — calendario |
| `frontend/app/components/trainer/AgendaCard.tsx` | Crear | Card orquestadora: toggle + 3 vistas + modal |
| `frontend/app/(app)/trainer/dashboard/page.tsx` | Modificar | Reemplazar `AgendaTimeline` por `<AgendaCard />` |
| `frontend/app/__tests__/components/trainer/AgendaDayModal.test.tsx` | Crear | Test del modal |
| `frontend/app/__tests__/components/trainer/AgendaWeekStrip.test.tsx` | Crear | Test de la tira semanal |
| `frontend/app/__tests__/components/trainer/AgendaMonthGrid.test.tsx` | Crear | Test del calendario |
| `frontend/app/__tests__/utils/agendaDates.test.ts` | Crear | Test de los helpers |

Comandos backend desde `backend/` (con venv); frontend desde `frontend/`; `git` desde la raíz.

---

## Task 1: Backend — endpoint de sesiones por rango

**Files:**
- Modify: `backend/core_app/views/trainer_client_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_trainer_agenda_view.py`

- [ ] **Step 1: Escribir el test**

Crear `backend/core_app/tests/views/test_trainer_agenda_view.py`:

```python
"""Tests for TrainerAgendaView — sesiones del trainer por rango de fechas."""

from datetime import datetime, timedelta
from datetime import timezone as dt_tz

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Booking, Package, TrainerProfile, User

FIXED_NOW = datetime(2026, 3, 1, 10, 0, tzinfo=dt_tz.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='trainer-ag@test.com', password='pass',
        first_name='Ana', last_name='Garcia', role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=user, location='Gym A')


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='customer-ag@test.com', password='pass',
        first_name='Carlos', last_name='Lopez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Plan Básico', sessions_count=8, validity_days=30, price='200000.00',
    )


def _booking(trainer, customer, package, day_offset, hour=9, status_=Booking.Status.CONFIRMED):
    start = FIXED_NOW + timedelta(days=day_offset, hours=hour - 10)
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=start, ends_at=start + timedelta(hours=1), status=status_,
    )


@pytest.mark.django_db
def test_returns_sessions_within_range(api_client, trainer, customer, package):
    _booking(trainer, customer, package, day_offset=1)   # 2026-03-02
    _booking(trainer, customer, package, day_offset=3)   # 2026-03-04
    _booking(trainer, customer, package, day_offset=40)  # fuera de rango
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-03-01', 'to': '2026-03-07'},
    )
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data['sessions']) == 2


@pytest.mark.django_db
def test_returns_all_sessions_no_limit(api_client, trainer, customer, package):
    for i in range(8):
        _booking(trainer, customer, package, day_offset=0, hour=8 + i)
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-03-01', 'to': '2026-03-01'},
    )
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data['sessions']) == 8  # sin tope de 5


@pytest.mark.django_db
def test_forbidden_for_non_trainer(api_client, customer):
    api_client.force_authenticate(user=customer)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-03-01', 'to': '2026-03-07'},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_bad_request_on_missing_params(api_client, trainer):
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(reverse('trainer-agenda'))
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_bad_request_on_range_too_large(api_client, trainer):
    api_client.force_authenticate(user=trainer.user)
    resp = api_client.get(
        reverse('trainer-agenda'), {'from': '2026-01-01', 'to': '2026-12-31'},
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
```

- [ ] **Step 2: Agregar `TrainerAgendaView`**

En `backend/core_app/views/trainer_client_views.py`, al final del archivo, agregar:

```python
class TrainerAgendaView(APIView):
    """Get the trainer's sessions within a date range.

    GET /api/trainer/agenda/?from=YYYY-MM-DD&to=YYYY-MM-DD
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        from datetime import datetime, time, timedelta
        from zoneinfo import ZoneInfo

        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response(
                {'detail': 'No se encontró perfil de entrenador.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        raw_from = request.query_params.get('from', '').strip()
        raw_to = request.query_params.get('to', '').strip()
        try:
            from_date = datetime.strptime(raw_from, '%Y-%m-%d').date()
            to_date = datetime.strptime(raw_to, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'Parámetros "from" y "to" requeridos (YYYY-MM-DD).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_date < from_date:
            return Response(
                {'detail': 'El rango "to" no puede ser anterior a "from".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (to_date - from_date).days > 62:
            return Response(
                {'detail': 'El rango no puede exceder 62 días.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tz = ZoneInfo('America/Bogota')
        range_start = datetime.combine(from_date, time.min, tzinfo=tz)
        range_end = datetime.combine(to_date, time.min, tzinfo=tz) + timedelta(days=1)

        bookings = (
            Booking.objects.filter(
                trainer=trainer_profile,
                starts_at__gte=range_start,
                starts_at__lt=range_end,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            )
            .select_related('customer', 'package')
            .order_by('starts_at')
        )

        sessions = [
            {
                'id': b.id,
                'customer_name': f'{b.customer.first_name} {b.customer.last_name}'.strip(),
                'customer_id': b.customer.id,
                'package_title': b.package.title if b.package else '',
                'starts_at': b.starts_at.isoformat() if b.starts_at else None,
                'ends_at': b.ends_at.isoformat() if b.ends_at else None,
                'status': b.status,
            }
            for b in bookings
        ]
        return Response({'sessions': sessions})
```

- [ ] **Step 3: Registrar la URL**

En `backend/core_app/urls/api_urls.py`: en el bloque de imports de views (donde está `TrainerDashboardStatsView`), agregar `TrainerAgendaView` a esa lista de import. Y en `urlpatterns`, debajo de la línea de `trainer/dashboard-stats/`, agregar:

```python
    path('trainer/agenda/', TrainerAgendaView.as_view(), name='trainer-agenda'),
```

- [ ] **Step 4: Verificar compilación**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/trainer_client_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_trainer_agenda_view.py
git commit -m "feat(trainer): endpoint GET /trainer/agenda/ — sesiones por rango"
```

---

## Task 2: Store — `fetchAgendaSessions`

**Files:**
- Modify: `frontend/lib/stores/trainerStore.ts`

Nota: el tipo `UpcomingSession` ya existe en `trainerStore.ts` y tiene la forma exacta que devuelve el endpoint (`id, customer_name, customer_id, package_title, starts_at, ends_at, status`). Se reutiliza.

- [ ] **Step 1: Agregar estado y tipos**

En `frontend/lib/stores/trainerStore.ts`, en el `type` del estado del store (donde están `dashboardStats`, `statsLoading`, `fetchDashboardStats`), agregar estas tres líneas junto a las demás:

```ts
  agendaSessions: UpcomingSession[];
  agendaLoading: boolean;
  fetchAgendaSessions: (from: string, to: string) => Promise<void>;
```

- [ ] **Step 2: Agregar el estado inicial**

En el objeto que crea el store (`create<...>((set) => ({ ... }))`), junto a `dashboardStats: null,` agregar:

```ts
  agendaSessions: [],
  agendaLoading: false,
```

- [ ] **Step 3: Agregar la acción**

En el mismo objeto del store, inmediatamente después de la acción `fetchDashboardStats: async () => { ... },`, agregar:

```ts
  fetchAgendaSessions: async (from: string, to: string) => {
    set({ agendaLoading: true });
    try {
      const { data } = await api.get('/trainer/agenda/', {
        headers: authHeaders(),
        params: { from, to },
      });
      set({ agendaSessions: data.sessions ?? [], agendaLoading: false });
    } catch {
      set({ agendaSessions: [], agendaLoading: false });
    }
  },
```

- [ ] **Step 4: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/trainerStore.ts
git commit -m "feat(trainer): trainerStore.fetchAgendaSessions"
```

---

## Task 3: Helpers de fecha + `AgendaDayModal`

**Files:**
- Create: `frontend/lib/utils/agendaDates.ts`
- Create: `frontend/app/components/trainer/AgendaDayModal.tsx`
- Test: `frontend/app/__tests__/utils/agendaDates.test.ts`
- Test: `frontend/app/__tests__/components/trainer/AgendaDayModal.test.tsx`

- [ ] **Step 1: Escribir el test de los helpers**

Crear `frontend/app/__tests__/utils/agendaDates.test.ts`:

```ts
import { dateKey, startOfWeek, addDays, sessionsByDay } from '@/lib/utils/agendaDates';

describe('agendaDates', () => {
  it('dateKey formats a Date as YYYY-MM-DD in local time', () => {
    expect(dateKey(new Date(2026, 4, 20))).toBe('2026-05-20');
    expect(dateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('startOfWeek returns the Monday of the week', () => {
    // 2026-05-20 is a Wednesday → Monday is 2026-05-18
    expect(dateKey(startOfWeek(new Date(2026, 4, 20)))).toBe('2026-05-18');
    // 2026-05-18 is already Monday
    expect(dateKey(startOfWeek(new Date(2026, 4, 18)))).toBe('2026-05-18');
    // 2026-05-24 is a Sunday → Monday is 2026-05-18
    expect(dateKey(startOfWeek(new Date(2026, 4, 24)))).toBe('2026-05-18');
  });

  it('addDays shifts a date by N days', () => {
    expect(dateKey(addDays(new Date(2026, 4, 20), 7))).toBe('2026-05-27');
    expect(dateKey(addDays(new Date(2026, 4, 20), -1))).toBe('2026-05-19');
  });

  it('sessionsByDay groups sessions by their local date key', () => {
    const sessions = [
      { id: 1, starts_at: '2026-05-20T09:00:00-05:00' },
      { id: 2, starts_at: '2026-05-20T11:00:00-05:00' },
      { id: 3, starts_at: '2026-05-21T08:00:00-05:00' },
    ];
    const map = sessionsByDay(sessions);
    expect(map.get('2026-05-20')?.length).toBe(2);
    expect(map.get('2026-05-21')?.length).toBe(1);
    expect(map.get('2026-05-22')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Crear los helpers**

Crear `frontend/lib/utils/agendaDates.ts`:

```ts
/** Utilidades de fecha para las vistas de agenda del trainer. */

/** Formatea una Date como `YYYY-MM-DD` en hora local. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Devuelve el lunes de la semana que contiene `d` (a medianoche local). */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (r.getDay() + 6) % 7; // 0 = lunes
  r.setDate(r.getDate() - offset);
  return r;
}

/** Devuelve una nueva Date desplazada `n` días. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Agrupa sesiones por su día local (`YYYY-MM-DD` → sesiones de ese día). */
export function sessionsByDay<T extends { starts_at: string | null }>(
  sessions: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const s of sessions) {
    if (!s.starts_at) continue;
    const key = dateKey(new Date(s.starts_at));
    const bucket = map.get(key);
    if (bucket) bucket.push(s);
    else map.set(key, [s]);
  }
  return map;
}
```

- [ ] **Step 3: Escribir el test del modal**

Crear `frontend/app/__tests__/components/trainer/AgendaDayModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaDayModal from '@/app/components/trainer/AgendaDayModal';
import type { UpcomingSession } from '@/lib/stores/trainerStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, prefetch: _p, ...rest }: { children: React.ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function makeSession(over: Partial<UpcomingSession> = {}): UpcomingSession {
  return {
    id: 1,
    customer_name: 'Ana Ruiz',
    customer_id: 10,
    package_title: 'Personalizada',
    starts_at: '2026-05-20T09:00:00-05:00',
    ends_at: '2026-05-20T10:00:00-05:00',
    status: 'confirmed',
    ...over,
  };
}

describe('AgendaDayModal', () => {
  it('renders the session list for the day', () => {
    render(
      <AgendaDayModal
        date={new Date(2026, 4, 20)}
        sessions={[makeSession(), makeSession({ id: 2, customer_name: 'Luis P.' })]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Luis P.')).toBeInTheDocument();
    expect(screen.getByText('2 sesiones')).toBeInTheDocument();
  });

  it('links each row to the client detail', () => {
    render(
      <AgendaDayModal
        date={new Date(2026, 4, 20)}
        sessions={[makeSession({ customer_id: 77 })]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Ana Ruiz').closest('a')).toHaveAttribute(
      'href', '/trainer/clients/client?id=77',
    );
  });

  it('shows an empty state when the day has no sessions', () => {
    render(<AgendaDayModal date={new Date(2026, 4, 20)} sessions={[]} onClose={() => {}} />);
    expect(screen.getByText('Sin sesiones este día')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = jest.fn();
    render(<AgendaDayModal date={new Date(2026, 4, 20)} sessions={[]} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Crear `AgendaDayModal`**

Crear `frontend/app/components/trainer/AgendaDayModal.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { UpcomingSession } from '@/lib/stores/trainerStore';
import ResponsiveSheet from './ResponsiveSheet';

type Props = {
  date: Date;
  sessions: UpcomingSession[];
  onClose: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  canceled: 'Cancelada',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AgendaDayModal({ date, sessions, onClose }: Props) {
  const longDate = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const ordered = [...sessions].sort((a, b) =>
    (a.starts_at ?? '').localeCompare(b.starts_at ?? ''),
  );

  return (
    <ResponsiveSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-6 xl:pt-5 space-y-4">
        <div>
          <div className="font-heading text-[16px] font-semibold text-kore-wine-dark capitalize">
            {longDate}
          </div>
          <div className="font-body text-[12px] text-kore-wine-dark/55 mt-0.5">
            {ordered.length} {ordered.length === 1 ? 'sesión' : 'sesiones'}
          </div>
        </div>

        {ordered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-kore-wine-dark/15 bg-kore-cream/50 px-4 py-8 text-center">
            <p className="font-body text-[13px] text-kore-wine-dark/55">
              Sin sesiones este día
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ordered.map((s) => (
              <Link
                key={s.id}
                href={`/trainer/clients/client?id=${s.customer_id}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-xl border border-kore-wine-dark/8 bg-kore-cream/50 px-3.5 py-3 transition-colors hover:bg-white"
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
                <span className="font-body text-[10px] font-bold uppercase tracking-wide text-kore-wine-dark/45 flex-shrink-0">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
```

- [ ] **Step 5: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/utils/agendaDates.ts frontend/app/components/trainer/AgendaDayModal.tsx frontend/app/__tests__/utils/agendaDates.test.ts frontend/app/__tests__/components/trainer/AgendaDayModal.test.tsx
git commit -m "feat(trainer): helpers de fecha de agenda + AgendaDayModal"
```

---

## Task 4: `AgendaWeekStrip` — vista semana

**Files:**
- Create: `frontend/app/components/trainer/AgendaWeekStrip.tsx`
- Test: `frontend/app/__tests__/components/trainer/AgendaWeekStrip.test.tsx`

- [ ] **Step 1: Escribir el test**

Crear `frontend/app/__tests__/components/trainer/AgendaWeekStrip.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaWeekStrip from '@/app/components/trainer/AgendaWeekStrip';
import type { UpcomingSession } from '@/lib/stores/trainerStore';

function makeSession(id: number, starts_at: string): UpcomingSession {
  return {
    id,
    customer_name: `Cliente ${id}`,
    customer_id: id,
    package_title: 'Plan',
    starts_at,
    ends_at: starts_at,
    status: 'confirmed',
  };
}

describe('AgendaWeekStrip', () => {
  // Semana del lunes 2026-05-18 al domingo 2026-05-24.
  const weekStart = new Date(2026, 4, 18);

  it('renders 7 day cells', () => {
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getAllByTestId('week-day-cell')).toHaveLength(7);
  });

  it('shows a session count on days that have sessions', () => {
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[
          makeSession(1, '2026-05-20T09:00:00-05:00'),
          makeSession(2, '2026-05-20T11:00:00-05:00'),
        ]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    // El miércoles 20 es la 3ª celda (Lun=18, Mar=19, Mié=20).
    const cells = screen.getAllByTestId('week-day-cell');
    expect(within(cells[2]).getByText('2')).toBeInTheDocument();
  });

  it('calls onSelectDay with the clicked day', async () => {
    const onSelectDay = jest.fn();
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[]}
        onSelectDay={onSelectDay}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    await userEvent.click(screen.getAllByTestId('week-day-cell')[2]);
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect((onSelectDay.mock.calls[0][0] as Date).getDate()).toBe(20);
  });

  it('calls onPrev and onNext from the nav arrows', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByLabelText('Semana anterior'));
    await userEvent.click(screen.getByLabelText('Semana siguiente'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Crear `AgendaWeekStrip`**

Crear `frontend/app/components/trainer/AgendaWeekStrip.tsx`:

```tsx
'use client';

import type { UpcomingSession } from '@/lib/stores/trainerStore';
import { addDays, dateKey, sessionsByDay } from '@/lib/utils/agendaDates';

type Props = {
  weekStart: Date; // lunes de la semana visible
  sessions: UpcomingSession[];
  onSelectDay: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function AgendaWeekStrip({
  weekStart,
  sessions,
  onSelectDay,
  onPrev,
  onNext,
}: Props) {
  const byDay = sessionsByDay(sessions);
  const todayKey = dateKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rangeLabel = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Semana anterior"
          onClick={onPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ‹
        </button>
        <span className="font-body text-[12px] font-semibold text-kore-wine-dark capitalize">
          {rangeLabel}
        </span>
        <button
          type="button"
          aria-label="Semana siguiente"
          onClick={onNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const key = dateKey(day);
          const count = byDay.get(key)?.length ?? 0;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              data-testid="week-day-cell"
              onClick={() => onSelectDay(day)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors ${
                isToday
                  ? 'border-kore-crimson/40 bg-kore-crimson/8'
                  : 'border-kore-wine-dark/8 bg-kore-cream/50 hover:bg-white'
              }`}
            >
              <span className="font-body text-[9px] font-bold uppercase tracking-wide text-kore-wine-dark/45">
                {WEEKDAYS[i]}
              </span>
              <span className="font-heading text-[15px] font-semibold text-kore-wine-dark">
                {day.getDate()}
              </span>
              {count > 0 ? (
                <span className="font-body text-[10px] font-bold text-kore-crimson">
                  {count}
                </span>
              ) : (
                <span className="font-body text-[10px] text-transparent">·</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/trainer/AgendaWeekStrip.tsx frontend/app/__tests__/components/trainer/AgendaWeekStrip.test.tsx
git commit -m "feat(trainer): AgendaWeekStrip — vista semana de la agenda"
```

---

## Task 5: `AgendaMonthGrid` — vista mes

**Files:**
- Create: `frontend/app/components/trainer/AgendaMonthGrid.tsx`
- Test: `frontend/app/__tests__/components/trainer/AgendaMonthGrid.test.tsx`

- [ ] **Step 1: Escribir el test**

Crear `frontend/app/__tests__/components/trainer/AgendaMonthGrid.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaMonthGrid from '@/app/components/trainer/AgendaMonthGrid';
import type { UpcomingSession } from '@/lib/stores/trainerStore';

function makeSession(id: number, starts_at: string): UpcomingSession {
  return {
    id,
    customer_name: `Cliente ${id}`,
    customer_id: id,
    package_title: 'Plan',
    starts_at,
    ends_at: starts_at,
    status: 'confirmed',
  };
}

describe('AgendaMonthGrid', () => {
  // Mes de referencia: mayo 2026.
  const monthRef = new Date(2026, 4, 1);

  it('renders a cell for every day of the month', () => {
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    // Mayo tiene 31 días. getAllByTestId acepta regex.
    expect(screen.getAllByTestId(/^month-day-\d+$/)).toHaveLength(31);
  });

  it('marks days that have sessions', () => {
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[makeSession(1, '2026-05-20T09:00:00-05:00')]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    const cell = screen.getByTestId('month-day-20');
    expect(within(cell).getByTestId('month-day-dot')).toBeInTheDocument();
  });

  it('calls onSelectDay with the clicked day', async () => {
    const onSelectDay = jest.fn();
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[]}
        onSelectDay={onSelectDay}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    await userEvent.click(screen.getByTestId('month-day-15'));
    expect((onSelectDay.mock.calls[0][0] as Date).getDate()).toBe(15);
  });

  it('calls onPrev and onNext from the nav arrows', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByLabelText('Mes anterior'));
    await userEvent.click(screen.getByLabelText('Mes siguiente'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Crear `AgendaMonthGrid`**

Crear `frontend/app/components/trainer/AgendaMonthGrid.tsx`:

```tsx
'use client';

import type { UpcomingSession } from '@/lib/stores/trainerStore';
import { dateKey, sessionsByDay } from '@/lib/utils/agendaDates';

type Props = {
  monthRef: Date; // cualquier fecha dentro del mes visible
  sessions: UpcomingSession[];
  onSelectDay: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
};

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function AgendaMonthGrid({
  monthRef,
  sessions,
  onSelectDay,
  onPrev,
  onNext,
}: Props) {
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // 0 = lunes
  const byDay = sessionsByDay(sessions);
  const todayKey = dateKey(new Date());
  const monthLabel = firstDay.toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={onPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ‹
        </button>
        <span className="font-body text-[12px] font-semibold text-kore-wine-dark capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={onNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-kore-wine-dark/55 hover:bg-kore-wine-dark/5 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={`h-${i}`}
            className="text-center font-body text-[9px] font-bold uppercase text-kore-wine-dark/40 pb-1"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const day = new Date(year, month, dayNum);
          const key = dateKey(day);
          const count = byDay.get(key)?.length ?? 0;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              data-testid={`month-day-${dayNum}`}
              onClick={() => onSelectDay(day)}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${
                isToday
                  ? 'bg-kore-crimson/10 text-kore-crimson font-bold'
                  : 'text-kore-wine-dark hover:bg-kore-wine-dark/5'
              }`}
            >
              <span className="font-body text-[12px] font-semibold">{dayNum}</span>
              {count > 0 && (
                <span
                  data-testid="month-day-dot"
                  className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-kore-crimson"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Cada celda lleva un único `data-testid={\`month-day-${dayNum}\`}` (p. ej. `month-day-20`). El test cuenta las celdas con el regex `/^month-day-\d+$/` y localiza días puntuales con `getByTestId('month-day-20')`.

- [ ] **Step 3: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/trainer/AgendaMonthGrid.tsx frontend/app/__tests__/components/trainer/AgendaMonthGrid.test.tsx
git commit -m "feat(trainer): AgendaMonthGrid — vista mes de la agenda"
```

---

## Task 6: `AgendaCard` — card orquestadora

**Files:**
- Create: `frontend/app/components/trainer/AgendaCard.tsx`

Nota: sin test unitario propio — `AgendaCard` integra store + 3 sub-componentes (ya testeados) + estado de vista. Un test de render exigiría mockear el store y los 3 hijos. Se valida con `npm run build` y la verificación manual de la Task 8. Es composición; la lógica con riesgo (fechas, agrupación, sub-vistas) ya está cubierta.

`AgendaCard` reemplaza al `AgendaTimeline` actual: la vista "Día" es el mismo timeline por hora, ahora alimentado por `agendaSessions` del store.

- [ ] **Step 1: Crear `AgendaCard`**

Crear `frontend/app/components/trainer/AgendaCard.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { UpcomingSession } from '@/lib/stores/trainerStore';
import { addDays, dateKey, startOfWeek, sessionsByDay } from '@/lib/utils/agendaDates';
import AgendaWeekStrip from './AgendaWeekStrip';
import AgendaMonthGrid from './AgendaMonthGrid';
import AgendaDayModal from './AgendaDayModal';

type View = 'dia' | 'semana' | 'mes';

const VIEW_LABEL: Record<View, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };

function fmtTime24(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** Timeline por hora de un día — la vista "Día". */
function DayTimeline({ sessions }: { sessions: UpcomingSession[] }) {
  const hours = Array.from({ length: 15 }, (_, i) => 7 + i);
  const byHour = useMemo(() => {
    const map: Record<number, UpcomingSession[]> = {};
    sessions.forEach((s) => {
      if (!s.starts_at) return;
      const h = new Date(s.starts_at).getHours();
      (map[h] ??= []).push(s);
    });
    return map;
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="font-body text-[13px] text-kore-wine-dark/55">
          Sin sesiones programadas hoy.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 400 }}>
      {hours.map((h) => {
        const slots = byHour[h] ?? [];
        if (slots.length === 0) return null;
        return (
          <div key={h} className="grid" style={{ gridTemplateColumns: '48px 1fr', minHeight: 40 }}>
            <div className="flex items-start justify-end pr-3.5 pt-2.5">
              <span className="font-body text-[11px] font-semibold text-kore-wine-dark/40">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
            <div className="border-l pb-3 pl-4" style={{ borderColor: 'rgba(103,15,34,0.12)' }}>
              <div className="flex flex-col gap-2 pt-1">
                {slots.map((s) => (
                  <Link
                    key={s.id}
                    href={`/trainer/clients/client?id=${s.customer_id}`}
                    prefetch={false}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] border border-kore-wine-dark/8 bg-white/65 transition-colors hover:bg-white"
                  >
                    <span className="font-heading text-sm font-semibold text-kore-wine-dark w-11 flex-shrink-0">
                      {s.starts_at ? fmtTime24(s.starts_at) : '—'}
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
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgendaCard() {
  const { agendaSessions, fetchAgendaSessions } = useTrainerStore();
  const [view, setView] = useState<View>('dia');
  // refDate: día de referencia para semana/mes. Para "día" siempre es hoy.
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Rango a pedir según la vista activa.
  const range = useMemo(() => {
    if (view === 'dia') {
      const today = new Date();
      return { from: dateKey(today), to: dateKey(today) };
    }
    if (view === 'semana') {
      const ws = startOfWeek(refDate);
      return { from: dateKey(ws), to: dateKey(addDays(ws, 6)) };
    }
    const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const last = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    return { from: dateKey(first), to: dateKey(last) };
  }, [view, refDate]);

  useEffect(() => {
    fetchAgendaSessions(range.from, range.to);
  }, [range.from, range.to, fetchAgendaSessions]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDay) return [];
    return sessionsByDay(agendaSessions).get(dateKey(selectedDay)) ?? [];
  }, [selectedDay, agendaSessions]);

  return (
    <div
      className="bg-white/65 rounded-[22px] overflow-hidden"
      style={{ border: '1px solid rgba(103,15,34,0.08)', boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}
    >
      <div
        className="flex items-center justify-between gap-4 px-6 py-5 flex-wrap"
        style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}
      >
        <p className="font-body text-[10px] font-bold tracking-[0.22em] uppercase text-kore-wine-dark/55">
          Agenda
        </p>
        <div className="flex gap-1 p-1 rounded-xl bg-kore-wine-dark/6">
          {(['dia', 'semana', 'mes'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg font-body text-[11px] font-semibold transition-all ${
                view === v
                  ? 'bg-white text-kore-wine-dark shadow-sm'
                  : 'text-kore-wine-dark/55 hover:text-kore-wine-dark'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {view === 'dia' && <DayTimeline sessions={agendaSessions} />}
      {view === 'semana' && (
        <AgendaWeekStrip
          weekStart={startOfWeek(refDate)}
          sessions={agendaSessions}
          onSelectDay={setSelectedDay}
          onPrev={() => setRefDate((d) => addDays(startOfWeek(d), -7))}
          onNext={() => setRefDate((d) => addDays(startOfWeek(d), 7))}
        />
      )}
      {view === 'mes' && (
        <AgendaMonthGrid
          monthRef={refDate}
          sessions={agendaSessions}
          onSelectDay={setSelectedDay}
          onPrev={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNext={() => setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        />
      )}

      {selectedDay && (
        <AgendaDayModal
          date={selectedDay}
          sessions={selectedDaySessions}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/trainer/AgendaCard.tsx
git commit -m "feat(trainer): AgendaCard — toggle Día/Semana/Mes de la agenda"
```

---

## Task 7: Montar `AgendaCard` en el dashboard

**Files:**
- Modify: `frontend/app/(app)/trainer/dashboard/page.tsx`

El dashboard hoy define un componente `AgendaTimeline` (la card "Agenda · Hoy") y lo renderiza. Se reemplaza por `<AgendaCard />`.

- [ ] **Step 1: Importar `AgendaCard`**

En `frontend/app/(app)/trainer/dashboard/page.tsx`, junto a los demás imports de la cabecera del archivo, agregar:

```tsx
import AgendaCard from '@/app/components/trainer/AgendaCard';
```

- [ ] **Step 2: Reemplazar el uso de `AgendaTimeline`**

Buscar dónde se renderiza `<AgendaTimeline ... />` en el JSX del dashboard y reemplazar esa línea/bloque por:

```tsx
            <AgendaCard />
```

- [ ] **Step 3: Eliminar el componente `AgendaTimeline`**

Borrar del archivo la función `function AgendaTimeline(...) { ... }` completa (ya no se usa). Si tras borrarla quedan imports sin usar (p. ej. `UpcomingSession` si ningún otro código del archivo lo usa, o `fmtTime24`), eliminarlos también.

- [ ] **Step 4: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`, sin warnings de variables/imports sin usar. La ruta `/trainer/dashboard` aparece en el listado.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(app)/trainer/dashboard/page.tsx"
git commit -m "feat(trainer): monta AgendaCard en el dashboard del trainer"
```

---

## Task 8: Verificación manual

**Files:** ninguno.

- [ ] **Step 1: Levantar el entorno**

El dev server del fleet ya corre en `192.168.56.10:3001` (frontend) y `:8001` (backend). Si no, levantarlos. Loguearse como trainer.

- [ ] **Step 2: Verificar las 3 vistas**

En `/trainer/dashboard`, en la card Agenda:
- La pill muestra Día / Semana / Mes; Día es la vista inicial con el timeline por hora de hoy.
- Cambiar a Semana: 7 celdas Lun–Dom con indicador de cantidad en los días con sesión; hoy resaltado. Las flechas ‹ › cambian de semana.
- Cambiar a Mes: calendario del mes con punto en los días con sesión; hoy resaltado. Las flechas ‹ › cambian de mes.

- [ ] **Step 3: Verificar el modal**

- Click en un día con sesiones (Semana o Mes) → modal con fecha + lista `hora · cliente · paquete · estado`; cada fila navega al detalle del cliente.
- Click en un día sin sesiones → modal con "Sin sesiones este día".
- A `<xl` el modal es bottom sheet; a `xl+` modal centrado.

- [ ] **Step 4: Consola y anchos**

Recorrer a 375 / 768 / 1280px. Sin errores en consola.

- [ ] **Step 5: Push y CI**

```bash
git push
```
Esperar el CI del PR #27: `backend-tests`, `frontend-unit-tests`, `frontend-e2e-tests` deben quedar verdes (corren los tests de `test_trainer_agenda_view.py`, `agendaDates`, `AgendaDayModal`, `AgendaWeekStrip`, `AgendaMonthGrid`).

---

## Self-Review

**Cobertura del spec:**
- Spec §A "Backend — endpoint por rango" → Task 1. ✓
- Spec §B "Store" (`agendaSessions`, `fetchAgendaSessions`) → Task 2. ✓
- Spec §B "Card con toggle, vista Día" → Task 6 (`AgendaCard` + `DayTimeline`). ✓
- Spec §B "vista Semana / `AgendaWeekStrip`" → Task 4. ✓
- Spec §B "vista Mes / `AgendaMonthGrid`" → Task 5. ✓
- Spec §B "montar en el dashboard" → Task 7. ✓
- Spec §C "modal de resumen del día" → Task 3 (`AgendaDayModal`). ✓
- Spec "Criterios de aceptación" 1-8 → Task 8 (manual) + tests de Tasks 1, 3-5. ✓
- Spec "Verificación" → Task 8 + steps de build por tarea. ✓

**Sin placeholders:** cada step de código muestra el archivo completo o el bloque exacto. La única indirección es la nota de ajuste de `data-testid` en Task 5, que está explicitada con el código final a aplicar.

**Consistencia de tipos:** `UpcomingSession` (de `trainerStore.ts`) es el tipo de sesión en todo el plan — el endpoint (Task 1) devuelve esa forma, `fetchAgendaSessions` (Task 2) la guarda, y `AgendaDayModal`/`AgendaWeekStrip`/`AgendaMonthGrid`/`AgendaCard` la consumen. Los helpers de `agendaDates.ts` (`dateKey`, `startOfWeek`, `addDays`, `sessionsByDay`) se definen en Task 3 y se usan con esas firmas en Tasks 4, 5, 6. Props de cada componente consistentes entre su definición y su uso en `AgendaCard`.

**Decisión registrada:** Task 6 (`AgendaCard`) no lleva test unitario — es composición de piezas ya testeadas; un test exigiría mockear store + 3 hijos para verificar wiring. Se cubre con build + verificación manual. Tasks 1, 3, 4, 5 sí llevan tests (corren en CI; el operador no corre tests localmente).
