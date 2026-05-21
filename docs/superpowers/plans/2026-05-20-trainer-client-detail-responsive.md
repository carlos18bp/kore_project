# Trainer Client Detail Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptar a escritorio la vista de detalle de cliente del trainer — contenedor con tope de ancho, las 9 mini-tabs como rail vertical en `xl+`, y los bottom sheets como modal centrado.

**Architecture:** CSS-responsive puro (breakpoint `xl`), shell-only. `TabBar` se reescribe para renderizar strip horizontal `<xl` y rail vertical `xl+`. Un nuevo `ResponsiveSheet` encapsula el patrón sheet↔modal. `client/page.tsx` recibe un grid de 2 columnas en `xl+`. Los 9 tab components no se tocan.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind, Zustand, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-20-trainer-client-detail-responsive-design.md`

**Branch:** `fix/20052026-release-april-may-fixes` (ya activa).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/app/components/trainer/TabBar.tsx` | Reescribir | Strip horizontal `<xl` + rail vertical `xl+`, misma API |
| `frontend/app/components/trainer/ResponsiveSheet.tsx` | Crear | Wrapper sheet↔modal: bottom sheet `<xl`, modal centrado `xl+` |
| `frontend/app/(app)/trainer/clients/client/page.tsx` | Modificar | Contenedor con tope de ancho + grid `[220px_1fr]`; migrar 2 sheets inline |
| `frontend/app/components/trainer/PostSessionMessageSheet.tsx` | Modificar | Adoptar `ResponsiveSheet` |
| `frontend/app/__tests__/components/trainer/TabBar.test.tsx` | Crear | Cobertura de ambas variantes |
| `frontend/app/__tests__/components/trainer/ResponsiveSheet.test.tsx` | Crear | Cobertura del wrapper |

Comandos desde `frontend/` salvo `git`. Color del trainer: `#670F22` = token `kore-wine-dark` (verificado en `globals.css`).

---

## Task 1: `TabBar` responsive

**Files:**
- Modify (reescritura completa): `frontend/app/components/trainer/TabBar.tsx`
- Test: `frontend/app/__tests__/components/trainer/TabBar.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/components/trainer/TabBar.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from '@/app/components/trainer/TabBar';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'programa', label: 'Programa' },
  { id: 'notas', label: 'Notas' },
];

/** TabBar renderiza dos variantes (strip + rail); las queries se acotan. */
function strip() {
  return within(screen.getByTestId('tabbar-strip'));
}
function rail() {
  return within(screen.getByTestId('tabbar-rail'));
}

describe('TabBar', () => {
  it('renders both the horizontal strip and the vertical rail', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    expect(screen.getByTestId('tabbar-strip')).toBeInTheDocument();
    expect(screen.getByTestId('tabbar-rail')).toBeInTheDocument();
  });

  it('renders every tab label in each variant', () => {
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={() => {}} />);
    for (const t of TABS) {
      expect(strip().getByText(t.label)).toBeInTheDocument();
      expect(rail().getByText(t.label)).toBeInTheDocument();
    }
  });

  it('calls onChange with the tab id when a strip tab is clicked', async () => {
    const onChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={onChange} />);
    await userEvent.click(strip().getByText('Programa'));
    expect(onChange).toHaveBeenCalledWith('programa');
  });

  it('calls onChange with the tab id when a rail tab is clicked', async () => {
    const onChange = jest.fn();
    render(<TabBar tabs={TABS} activeTab="resumen" onChange={onChange} />);
    await userEvent.click(rail().getByText('Notas'));
    expect(onChange).toHaveBeenCalledWith('notas');
  });

  it('marks the active tab as font-bold in the rail', () => {
    render(<TabBar tabs={TABS} activeTab="programa" onChange={() => {}} />);
    expect(rail().getByText('Programa')).toHaveClass('font-bold');
    expect(rail().getByText('Resumen')).not.toHaveClass('font-bold');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/components/trainer/TabBar.test.tsx`
Expected: FALLA — `Unable to find an element by: [data-testid="tabbar-strip"]` (el TabBar actual no emite esos testids).

- [ ] **Step 3: Reescribir `TabBar.tsx`**

Reemplazar TODO el contenido de `frontend/app/components/trainer/TabBar.tsx` por:

```tsx
'use client';

import { useRef, useEffect } from 'react';

type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
};

export default function TabBar({ tabs, activeTab, onChange }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  return (
    <>
      {/* Móvil/tablet — strip horizontal con scroll */}
      <div
        data-testid="tabbar-strip"
        className="xl:hidden relative border-b border-kore-wine-dark/10"
      >
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const sel = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                ref={sel ? activeRef : undefined}
                onClick={() => onChange(tab.id)}
                className={`flex-shrink-0 -mb-px border-b-2 px-[18px] py-3.5 font-body text-[11px] uppercase tracking-[0.10em] whitespace-nowrap transition-all duration-100 ${
                  sel
                    ? 'border-kore-wine-dark text-kore-wine-dark font-bold'
                    : 'border-transparent text-kore-wine-dark/55 font-medium'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop — rail vertical */}
      <nav data-testid="tabbar-rail" className="hidden xl:flex xl:flex-col xl:gap-0.5">
        {tabs.map((tab) => {
          const sel = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`border-l-2 rounded-r-lg px-3.5 py-2.5 text-left font-body text-[12px] tracking-[0.04em] transition-all duration-100 ${
                sel
                  ? 'border-kore-wine-dark bg-kore-wine-dark/6 text-kore-wine-dark font-bold'
                  : 'border-transparent text-kore-wine-dark/55 hover:bg-kore-wine-dark/4 font-medium'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/components/trainer/TabBar.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/trainer/TabBar.tsx frontend/app/__tests__/components/trainer/TabBar.test.tsx
git commit -m "feat(trainer): TabBar responsive — strip horizontal y rail vertical"
```

---

## Task 2: Componente `ResponsiveSheet`

**Files:**
- Create: `frontend/app/components/trainer/ResponsiveSheet.tsx`
- Test: `frontend/app/__tests__/components/trainer/ResponsiveSheet.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/components/trainer/ResponsiveSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResponsiveSheet from '@/app/components/trainer/ResponsiveSheet';

describe('ResponsiveSheet', () => {
  it('renders its children', () => {
    render(
      <ResponsiveSheet onClose={() => {}}>
        <p>contenido del sheet</p>
      </ResponsiveSheet>,
    );
    expect(screen.getByText('contenido del sheet')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = jest.fn();
    render(
      <ResponsiveSheet onClose={onClose}>
        <p>cuerpo</p>
      </ResponsiveSheet>,
    );
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the panel body is clicked', async () => {
    const onClose = jest.fn();
    render(
      <ResponsiveSheet onClose={onClose}>
        <p>cuerpo</p>
      </ResponsiveSheet>,
    );
    await userEvent.click(screen.getByText('cuerpo'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders a drag handle hidden on desktop (xl:hidden)', () => {
    render(
      <ResponsiveSheet onClose={() => {}}>
        <p>cuerpo</p>
      </ResponsiveSheet>,
    );
    expect(screen.getByTestId('sheet-handle')).toHaveClass('xl:hidden');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/components/trainer/ResponsiveSheet.test.tsx`
Expected: FALLA — `Cannot find module '@/app/components/trainer/ResponsiveSheet'`.

- [ ] **Step 3: Crear el componente**

Crear `frontend/app/components/trainer/ResponsiveSheet.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';

type Props = {
  onClose: () => void;
  children: ReactNode;
};

/**
 * Contenedor overlay responsive. En `<xl` se ancla abajo como bottom sheet
 * full-width; en `xl+` se centra como modal angosto. El click en el backdrop
 * cierra. El handle de arrastre sólo se ve en móvil.
 */
export default function ResponsiveSheet({ onClose, children }: Props) {
  return (
    <>
      <div
        data-testid="sheet-backdrop"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-end xl:items-center xl:justify-center xl:p-4">
        <div className="pointer-events-auto flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl xl:w-full xl:max-w-md xl:rounded-3xl">
          <div data-testid="sheet-handle" className="flex justify-center pt-3 pb-1 xl:hidden">
            <div className="h-1 w-10 rounded-full bg-kore-wine-dark/15" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/components/trainer/ResponsiveSheet.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/trainer/ResponsiveSheet.tsx frontend/app/__tests__/components/trainer/ResponsiveSheet.test.tsx
git commit -m "feat(trainer): componente ResponsiveSheet (bottom sheet / modal)"
```

---

## Task 3: Layout desktop en `client/page.tsx`

**Files:**
- Modify: `frontend/app/(app)/trainer/clients/client/page.tsx`

Nota: esta tarea no lleva test unitario — la página depende de `useSearchParams`, `useTrainerStore`, `Suspense` y `useHeroAnimation`; un test de render exigiría un andamiaje de mocks desproporcionado para verificar clases de layout. Se valida con `npm run build` (compila TS/JSX) y la verificación manual de la Task 5. Los cambios son estructura JSX + clases Tailwind.

- [ ] **Step 1: Tope de ancho en el contenedor**

En `frontend/app/(app)/trainer/clients/client/page.tsx`, localizar el `div` contenedor:

```tsx
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-4">
```

Reemplazarlo por:

```tsx
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-4 xl:max-w-[1080px] xl:mx-auto">
```

- [ ] **Step 2: Envolver TabBar + contenido en el grid de 2 columnas**

En el mismo archivo, localizar este bloque:

```tsx
        {/* ── Tab bar ── */}
        <TabBar tabs={TABS} activeTab={activeTab} onChange={id => setActiveTab(id as TabId)} />

        {/* ── Tab content ── */}
        <div className="space-y-4 pt-5">
```

Reemplazarlo por:

```tsx
        {/* ── Tabs + contenido ── */}
        <div className="xl:grid xl:grid-cols-[220px_1fr] xl:gap-8">
          {/* ── Tab bar / rail ── */}
          <div className="xl:sticky xl:top-8 xl:self-start">
            <TabBar tabs={TABS} activeTab={activeTab} onChange={id => setActiveTab(id as TabId)} />
          </div>

          {/* ── Tab content ── */}
          <div className="min-w-0 space-y-4 pt-5 xl:pt-0">
```

- [ ] **Step 3: Cerrar el grid wrapper**

El bloque de contenido del tab termina así (cierre del `div` de contenido, antes del cierre del contenedor de página):

```tsx
        </div>
      </div>

      {/* ── Resolve Alert Sheet ── */}
```

Reemplazarlo por (se agrega un `</div>` extra para cerrar el grid wrapper abierto en el Step 2):

```tsx
          </div>
        </div>
      </div>

      {/* ── Resolve Alert Sheet ── */}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sin errores de JSX/TS. La ruta `/trainer/clients/client` aparece en el listado de rutas.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(app)/trainer/clients/client/page.tsx"
git commit -m "feat(trainer): layout desktop del detalle de cliente — rail + contenido"
```

---

## Task 4: Migrar los 3 sheets a `ResponsiveSheet`

**Files:**
- Modify: `frontend/app/(app)/trainer/clients/client/page.tsx` (2 sheets inline)
- Modify (reescritura completa): `frontend/app/components/trainer/PostSessionMessageSheet.tsx`

Nota: sin test unitario nuevo — `ResponsiveSheet` ya está cubierto (Task 2). Se valida con `npm run build` y la verificación manual de la Task 5.

- [ ] **Step 1: Importar `ResponsiveSheet` en `client/page.tsx`**

En `frontend/app/(app)/trainer/clients/client/page.tsx`, localizar:

```tsx
import NotesTab from '@/app/components/trainer/NotesTab';
```

Agregar debajo:

```tsx
import ResponsiveSheet from '@/app/components/trainer/ResponsiveSheet';
```

- [ ] **Step 2: Migrar el sheet "Resolver alerta" — apertura**

Localizar este bloque:

```tsx
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setResolveSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(103,15,34,0.15)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
```

Reemplazarlo por:

```tsx
        <ResponsiveSheet onClose={() => setResolveSheet(null)}>
            <div className="px-4 pt-2 pb-8 xl:pt-5 space-y-4">
```

- [ ] **Step 3: Migrar el sheet "Resolver alerta" — cierre**

Localizar este bloque (el cierre del sheet de resolver alerta):

```tsx
                  {resolvingAlertId ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
```

Reemplazarlo por:

```tsx
                  {resolvingAlertId ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
        </ResponsiveSheet>
      )}
```

- [ ] **Step 4: Migrar el sheet "Pausar programa" — apertura**

Localizar este bloque:

```tsx
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setShowPauseSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(103,15,34,0.15)' }} />
            </div>
            <div className="px-4 pt-2 pb-8 space-y-4">
```

Reemplazarlo por:

```tsx
        <ResponsiveSheet onClose={() => setShowPauseSheet(false)}>
            <div className="px-4 pt-2 pb-8 xl:pt-5 space-y-4">
```

- [ ] **Step 5: Migrar el sheet "Pausar programa" — cierre**

Localizar este bloque (el cierre del sheet de pausar programa):

```tsx
                  {programActionLoading ? 'Pausando...' : 'Confirmar pausa'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
```

Reemplazarlo por:

```tsx
                  {programActionLoading ? 'Pausando...' : 'Confirmar pausa'}
                </button>
              </div>
            </div>
        </ResponsiveSheet>
      )}
```

- [ ] **Step 6: Reescribir `PostSessionMessageSheet.tsx`**

Reemplazar TODO el contenido de `frontend/app/components/trainer/PostSessionMessageSheet.tsx` por:

```tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import SectionLabel from '@/app/components/shared/SectionLabel';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import ResponsiveSheet from './ResponsiveSheet';

type Props = {
  customerId: number;
  customerName: string;
  sessionId: number;
  onClose: () => void;
};

const QUICK_SUGGESTIONS = [
  '¡Buen trabajo en la sesión de hoy!',
  'Recuerda hidratarte bien mañana.',
  'La próxima sesión trabajaremos un poco más fuerza.',
  'Excelente esfuerzo. Sigue así.',
];

export default function PostSessionMessageSheet({ customerId, customerName, sessionId, onClose }: Props) {
  const { sendTrainerMessage } = useTrainerStore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await sendTrainerMessage(customerId, message.trim(), 'post_session', sessionId);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveSheet onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-4 xl:pt-5">
        <div>
          <SectionLabel className="mb-1">Mensaje post-sesión</SectionLabel>
          <p className="text-base font-semibold text-kore-gray-dark flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            {customerName}
          </p>
          <p className="text-xs text-kore-gray-dark/50 mt-1 leading-relaxed">
            El cliente verá este mensaje destacado en su dashboard, vinculado a esta sesión.
          </p>
        </div>

        <div>
          <SectionLabel className="mb-2">Sugerencias rápidas</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-kore-cream text-kore-gray-dark/70 hover:bg-kore-cream/70 active:scale-95 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Escribe tu mensaje..."
          className="w-full rounded-xl border border-kore-gray-light/60 bg-kore-cream/50 px-3 py-2.5 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>
      <div className="px-4 pt-2 pb-6 xl:pb-4 flex gap-3 border-t border-kore-gray-light/20">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-kore-cream text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || sending}
          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium active:scale-95 transition-transform duration-100 disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </ResponsiveSheet>
  );
}
```

- [ ] **Step 7: Verificar que compila y los tests siguen verdes**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sin errores.

Run: `npm test -- app/__tests__/components/trainer/TabBar.test.tsx app/__tests__/components/trainer/ResponsiveSheet.test.tsx app/__tests__/components/trainer/ClientNutritionTab.test.tsx app/__tests__/components/trainer/ClientProgramTab.test.tsx`
Expected: PASS — los nuevos tests verdes y los tab components (no modificados) sin regresión.

- [ ] **Step 8: Commit**

```bash
git add "frontend/app/(app)/trainer/clients/client/page.tsx" frontend/app/components/trainer/PostSessionMessageSheet.tsx
git commit -m "feat(trainer): sheets del detalle de cliente como modal centrado en desktop"
```

---

## Task 5: Verificación manual en navegador

**Files:** ninguno.

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev`
Expected: Next.js arranca en `:3000`.

- [ ] **Step 2: Verificar a 375px y 768px (sin regresión)**

Autenticado como trainer, abrir `/trainer/clients/client?id=<n>`. Confirmar que se ve y comporta como antes: header, `TabBar` horizontal con scroll, contenido en una columna, y los 3 sheets (resolver alerta, pausar programa, mensaje post-sesión) anclados abajo con handle de arrastre.

- [ ] **Step 3: Verificar a 1280px+ (desktop)**

A 1280px+:
- El contenedor no excede ~1080px y queda centrado.
- Las 9 tabs se ven como rail vertical a la izquierda; el tab activo resaltado.
- Al cambiar de tab, el contenido de la derecha cambia sin recargar.
- Al hacer scroll de contenido largo, el rail permanece visible (sticky).
- Los 3 sheets abren como modal centrado angosto (no barra inferior); el handle de arrastre no se ve; el click en el backdrop cierra.

- [ ] **Step 4: Consola sin errores**

Confirmar que no hay errores de hydration ni warnings de React al cargar la vista a cualquier ancho.

---

## Self-Review

**Cobertura del spec:**
- Spec §A "Layout del shell" (tope de ancho, grid `[220px_1fr]`, rail sticky, columna de contenido) → Task 3. ✓
- Spec §B "`TabBar` responsive" (strip `<xl` / rail `xl+`, misma API, Tailwind) → Task 1. ✓
- Spec §C "Bottom sheets → modal" (`ResponsiveSheet`, 2 sheets inline + `PostSessionMessageSheet`) → Task 2 (componente) + Task 4 (migración). ✓
- Spec "Criterios de aceptación" 1-6 → Task 5 (manual) + tests de Tasks 1-2. ✓
- Spec "Verificación" (dev server, Jest, build) → Task 5 + steps de build/test en Tasks 3-4. ✓

**Sin placeholders:** cada step de código muestra el contenido completo del archivo o el bloque exacto a reemplazar; comandos y resultados esperados explícitos.

**Consistencia de tipos:** `ResponsiveSheet` se define en Task 2 con props `{ onClose: () => void; children: ReactNode }` y se consume con esa firma exacta en Task 4 (3 call sites). `TabBar` conserva su API `{ tabs, activeTab, onChange }` — Task 1 no cambia la firma, así que el call site en `client/page.tsx` (Task 3) sigue válido sin tocarlo. Los `data-testid` (`tabbar-strip`/`tabbar-rail`, `sheet-backdrop`/`sheet-handle`) que emiten los componentes coinciden con los que consultan sus tests.

**Decisión registrada:** Tasks 3 y 4 no llevan test unitario — `client/page.tsx` es una página con `Suspense` + `useSearchParams` + `useTrainerStore` + `useHeroAnimation`; un test de render exigiría un andamiaje de mocks desproporcionado para verificar estructura de layout. Se cubren con `npm run build` (compilación TS/JSX) + verificación manual (Task 5). Los componentes nuevos/reescritos sí llevan TDD (Tasks 1-2).
