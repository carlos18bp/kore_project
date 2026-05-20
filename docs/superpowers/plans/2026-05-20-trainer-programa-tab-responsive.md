# Trainer Programa Tab Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer responsive el contenido del mini-tab "Programa" del detalle de cliente del trainer, y rediseñar la bitácora como minicalendario alineado por día de semana.

**Architecture:** Se reescriben con clases Tailwind (layout + responsive, breakpoint `sm`) sólo 4 componentes de `ClientProgramTab.tsx` — `AdherenceCard`, `WeekCard`, `DayRow`, `ExerciseRow` — hoy construidos 100% con `style={{}}` inline (que no admite media queries). Los colores se mapean a `kore-wine-dark` (+ opacidad) y a valores arbitrarios para sage/amber/crimson, manteniéndose pixel-idénticos en `sm+`.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 4, Jest (tests en CI).

**Spec:** `docs/superpowers/specs/2026-05-20-trainer-programa-tab-responsive-design.md`

**Branch:** `fix/20052026-release-april-may-fixes` (ya activa).

> **Workflow:** el operador NO corre suites de tests localmente — el CI de GitHub las corre en cada push. Cada tarea verifica **compilación** (`npm run build`) y commitea. Los 4 componentes se reescriben preservando TODOS los textos y nombres de botón actuales ("Adherencia", "Semana N", "Repeticiones"/"Tiempo", "Tiempo (s)", "Cambiar ejercicio del catálogo", "Guardar", nombres de ejercicio), así que `app/__tests__/components/trainer/ClientProgramTab.test.tsx` debe seguir verde — lo valida el CI.

---

## Mapeo de colores (paleta `T` → Tailwind)

Al reescribir, usar estas equivalencias (`kore-wine-dark` = `#670F22` = `rgb(103,15,34)`):

| `T` / inline | Tailwind |
|---|---|
| `T.wine` `#670F22` | `kore-wine-dark` |
| `T.ivory` `#FFF8EC` | `kore-ivory` |
| `rgba(103,15,34,0.65)` (`textMed`) | `kore-wine-dark/65` |
| `rgba(103,15,34,0.55)` (`textSoft`) | `kore-wine-dark/55` |
| `rgba(103,15,34,0.10)` (`border`) | `kore-wine-dark/10` |
| `rgba(103,15,34,0.08)` (`borderSoft`) | `kore-wine-dark/8` |
| `T.textDark` `#2A1A1F` | `text-[#2A1A1F]` |
| `T.sageDeep` `#669959` · `T.sageDark` `#3F6B36` | `[#669959]` · `[#3F6B36]` |
| `T.amberDeep` `#A88A2E` | `[#A88A2E]` |
| crimson `#9A0526` | `[#9A0526]` |
| fuentes `Cinzel` / `Montserrat` | `font-heading` / `font-body` |

## File Structure

| Archivo | Acción | Tareas |
|---|---|---|
| `frontend/app/components/trainer/ClientProgramTab.tsx` | Modificar | Reescribir `AdherenceCard` (T1), `WeekCard`+`DayRow` (T2), `ExerciseRow` (T3) |

Todas las tareas modifican el mismo archivo, en regiones distintas. Comandos desde `frontend/`; `git` desde la raíz.

---

## Task 1: Bitácora → minicalendario (`AdherenceCard`)

**Files:**
- Modify: `frontend/app/components/trainer/ClientProgramTab.tsx` — reemplazar la función `AdherenceCard` (y dejar de usar `AdhDot`).

- [ ] **Step 1: Reemplazar la función `AdherenceCard`**

En `ClientProgramTab.tsx`, reemplazar TODA la función `function AdherenceCard({ logs }: { logs: DailyLogDay[] }) { ... }` (desde `// ─── Adherence card ───` hasta su `}` de cierre) por:

```tsx
// ─── Adherence card ────────────────────────────────────────────
const ADH_CELL: Record<AdhStatus, string> = {
  done:    'bg-[#669959] text-white',
  skipped: 'bg-[#9A0526]/15 text-[#9A0526]',
  rest:    'bg-[#A8C29C]/25 text-[#3F6B36]',
  pending: 'bg-kore-wine-dark/5 text-kore-wine-dark/40',
};

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function AdherenceCard({ logs }: { logs: DailyLogDay[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const cells = logs.map((d) => {
    const logDate = new Date(d.date + 'T12:00:00');
    logDate.setHours(0, 0, 0, 0);
    const isPast = logDate.getTime() <= todayTime;
    const dayNum = logDate.getDate();
    let status: AdhStatus;
    if (d.day_type === 'rest' || d.day_type === 'active_rest') status = 'rest';
    else if (!isPast) status = 'pending';
    else status = d.training_adherence >= 0.5 ? 'done' : 'skipped';
    return { dayNum, status, isToday: logDate.getTime() === todayTime };
  });

  const countable = cells.filter((c) => c.status === 'done' || c.status === 'skipped');
  const done = cells.filter((c) => c.status === 'done').length;
  const pct = countable.length > 0 ? Math.round((done / countable.length) * 100) : 0;
  const dasharray = 2 * Math.PI * 46;

  // Celdas vacías al inicio para alinear el primer día a su día de semana (L=0).
  const leadingBlanks = logs.length
    ? (new Date(logs[0].date + 'T12:00:00').getDay() + 6) % 7
    : 0;

  return (
    <div className="mb-[18px] flex flex-col gap-6 rounded-[22px] border border-kore-wine-dark/8 bg-white/65 p-6 shadow-[0_2px_12px_-8px_rgba(45,15,26,0.10)] sm:flex-row sm:items-start sm:gap-7">
      {/* Anillo de adherencia */}
      <div className="relative flex-shrink-0 self-center sm:self-start">
        <svg width="112" height="112" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(103,15,34,0.08)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="46" fill="none" stroke="url(#adhGrad)" strokeWidth="10"
            strokeDasharray={`${(pct / 100) * dasharray} ${dasharray}`}
            strokeLinecap="round" transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
          />
          <defs>
            <linearGradient id="adhGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A8C29C" />
              <stop offset="100%" stopColor="#3F6B36" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-heading text-[30px] font-semibold leading-none text-kore-wine-dark">
            {pct}%
          </div>
          <div className="mt-1 font-body text-[8px] font-bold uppercase tracking-[0.20em] text-kore-wine-dark/55">
            Adherencia
          </div>
        </div>
      </div>

      {/* Minicalendario */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-kore-wine-dark/55">
          Bitácora · {logs.length} días
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_HEADERS.map((h, i) => (
            <div
              key={`h-${i}`}
              className="text-center font-body text-[9px] font-bold uppercase text-kore-wine-dark/40"
            >
              {h}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`b-${i}`} />
          ))}
          {cells.map((c, i) => (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-lg font-heading text-[13px] font-semibold ${ADH_CELL[c.status]} ${
                c.isToday ? 'ring-2 ring-[#9A0526]/40' : ''
              }`}
            >
              {c.dayNum}
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-3 border-t border-kore-wine-dark/8 pt-3.5">
          <LegendDot color="#669959" label="Completado" />
          <LegendDot color="rgba(154,5,38,0.40)" label="Saltado" />
          <LegendDot color="rgba(168,194,156,0.45)" label="Descanso" />
          <LegendDot color="rgba(103,15,34,0.20)" label="Pendiente" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Borrar el componente `AdhDot` (ya sin uso)**

`AdhDot` sólo lo usaba `AdherenceCard`. Borrar la función `function AdhDot(...) { ... }` completa y su comentario `// ─── Adherence dot ───`. **Conservar** `type AdhStatus` y `ADH_CFG` NO — `ADH_CFG` también queda sin uso tras esto: borrar `ADH_CFG` también. **Conservar `type AdhStatus`** (lo usa el nuevo `ADH_CELL`). `LegendDot` se conserva (lo usa `AdherenceCard`).

Resultado: se mantiene `type AdhStatus`, se elimina `ADH_CFG` y `AdhDot`.

- [ ] **Step 3: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`, sin errores ni variables sin uso.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/trainer/ClientProgramTab.tsx
git commit -m "feat(trainer): bitácora del tab Programa como minicalendario"
```

---

## Task 2: Plan semanal responsive (`WeekCard` / `DayRow`)

**Files:**
- Modify: `frontend/app/components/trainer/ClientProgramTab.tsx` — reemplazar `WeekCard` y `DayRow`.

- [ ] **Step 1: Reemplazar `DayRow`**

Reemplazar TODA la función `function DayRow(...) { ... }` por:

```tsx
function DayRow({ day, programId, onExSaved }: { day: ProgramDay; programId: number; onExSaved: OnExSaved }) {
  const [open, setOpen] = useState(false);
  const isRest = day.day_type === 'rest';
  const weekday = new Date(day.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short' });
  const dateStr = fmtDay(day.date);

  return (
    <div className="border-t border-kore-wine-dark/8">
      <button
        onClick={() => !isRest && setOpen((o) => !o)}
        className={`flex w-full flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3.5 text-left sm:px-[22px] ${
          open ? 'bg-[#9A0526]/3' : 'bg-transparent'
        } ${isRest ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="min-w-[54px]">
          <div className="font-heading text-[12px] font-semibold capitalize text-kore-wine-dark">
            {weekday}
          </div>
          <div className="font-body text-[10px] text-kore-wine-dark/65">{dateStr}</div>
        </div>
        <DayTypeChip type={day.day_type} />
        <div className="min-w-0 flex-1 font-body text-[12px] text-kore-wine-dark/65">
          {isRest ? 'Recuperación · sin ejercicios' : `${day.exercises.length} ejercicios`}
        </div>
        {!isRest && (
          <span
            className="inline-block font-body text-[16px] leading-none text-kore-wine-dark/65 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          >
            ⌄
          </span>
        )}
      </button>
      {open && !isRest && day.exercises.length > 0 && (
        <div className="border-t border-kore-wine-dark/8 bg-white/55">
          {day.exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              last={i === day.exercises.length - 1}
              programId={programId}
              dayId={day.id}
              onSaved={onExSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `WeekCard`**

Reemplazar TODA la función `function WeekCard(...) { ... }` por:

```tsx
function WeekCard({
  weekNum, days, defaultOpen = false, programId, onExSaved,
}: {
  weekNum: number;
  days: ProgramDay[];
  defaultOpen?: boolean;
  programId: number;
  onExSaved: OnExSaved;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const trainCount = days.filter((d) => d.day_type === 'training').length;
  const activeCount = days.filter((d) => d.day_type === 'active_rest').length;
  const range = weekRange(days);

  return (
    <div className="mb-3.5 overflow-hidden rounded-[22px] border border-kore-wine-dark/8 bg-white/65 shadow-[0_2px_12px_-8px_rgba(45,15,26,0.10)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left sm:gap-[18px] sm:px-6"
      >
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] transition-all duration-150 ${
            open ? 'bg-gradient-to-br from-[#9A0526] to-[#5C2030]' : 'bg-[#9A0526]/6'
          }`}
        >
          <div className={`font-heading text-[18px] font-semibold ${open ? 'text-white' : 'text-kore-wine-dark'}`}>
            {weekNum}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <div className="font-heading text-[18px] font-semibold text-kore-wine-dark">
              Semana {weekNum}
            </div>
            <div className="font-body text-[11px] text-kore-wine-dark/65">{range}</div>
          </div>
          <div className="mt-0.5 font-body text-[11px] text-kore-wine-dark/55">
            {trainCount} entrenamientos{activeCount > 0 ? ` · ${activeCount} activos` : ''}
          </div>
        </div>
        <span
          className="inline-block flex-shrink-0 font-body text-[18px] leading-none text-kore-wine-dark/65 transition-transform duration-150"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          ⌄
        </span>
      </button>
      {open && days.map((d, i) => (
        <DayRow key={d.id ?? i} day={d} programId={programId} onExSaved={onExSaved} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/trainer/ClientProgramTab.tsx
git commit -m "fix(trainer): plan semanal del tab Programa responsive"
```

---

## Task 3: Fila de ejercicio responsive (`ExerciseRow`)

**Files:**
- Modify: `frontend/app/components/trainer/ClientProgramTab.tsx` — reemplazar el JSX `return (...)` de `ExerciseRow` (la lógica/hooks `useState`, `fetchExercises`, `handleSave`, `handleCancel` NO cambian).

- [ ] **Step 1: Reemplazar el `return` de `ExerciseRow`**

En `function ExerciseRow(...)`, dejar intactas todas las constantes y handlers (`isTimeBased`, los `useState`, `repsVal`, `repsUnit`, `fetchExercises`, `filtered`, `handleSave`, `handleCancel`). Reemplazar SÓLO el bloque `return ( ... );` final por:

```tsx
  return (
    <div className={last ? '' : 'border-b border-kore-wine-dark/8'}>
      {/* Fila de vista — grid de 6 col en sm+, card apilada en móvil */}
      <div className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[2fr_0.6fr_0.7fr_0.7fr_auto_auto] sm:items-center sm:gap-2.5 sm:px-[18px]">
        <div className="min-w-0">
          <div className="font-body text-[13px] font-semibold text-[#2A1A1F]">{ex.exercise.name}</div>
          {(ex.notes || ex.exercise.pattern) && (
            <div className="mt-0.5 font-body text-[10px] italic text-kore-wine-dark/65">
              {ex.notes || ex.exercise.pattern}
            </div>
          )}
        </div>

        {/* Métricas — fila de 3 en móvil, celdas sueltas del grid en sm+ */}
        <div className="flex gap-2.5 sm:contents">
          <div className="flex-1 text-center sm:flex-none">
            <div className="font-heading text-[14px] font-semibold text-kore-wine-dark">{ex.sets}</div>
            <div className="mt-px font-body text-[7px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
              Series
            </div>
          </div>
          <div className="flex-1 text-center sm:flex-none">
            <div className="font-heading text-[14px] font-semibold text-kore-wine-dark">{repsVal}</div>
            <div className="mt-px font-body text-[7px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
              {repsUnit}
            </div>
          </div>
          <div className="flex-1 text-center sm:flex-none">
            <div className="font-heading text-[14px] font-semibold text-kore-wine-dark">{ex.rest_seconds}s</div>
            <div className="mt-px font-body text-[7px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
              Descanso
            </div>
          </div>
        </div>

        {/* Acciones — fila en móvil, celdas del grid en sm+ */}
        <div className="flex gap-2 sm:contents">
          {ex.exercise.youtube_url ? (
            <a
              href={ex.exercise.youtube_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver demo"
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg border border-kore-wine-dark/10 bg-[#9A0526]/6 text-kore-wine-dark"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 12s0-3.7-.5-5.5c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5c-1 .3-1.7 1-2 2C1 8.3 1 12 1 12s0 3.7.5 5.5c.3 1 1 1.7 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5c1-.3 1.7-1 2-2 .5-1.8.5-5.5.5-5.5zM10 15.5v-7l6 3.5z" />
              </svg>
            </a>
          ) : (
            <div className="hidden w-[30px] sm:block" />
          )}
          <button
            onClick={() => (editing ? handleCancel() : setEditing(true))}
            title={editing ? 'Cancelar edición' : 'Editar ejercicio'}
            className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg border ${
              editing
                ? 'border-[#9A0526]/25 bg-[#9A0526]/10 text-[#9A0526]'
                : 'border-kore-wine-dark/8 bg-kore-wine-dark/4 text-kore-wine-dark/55'
            }`}
          >
            {editing ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Formulario de edición */}
      {editing && (
        <div className="bg-kore-wine-dark/2 px-4 pb-4 sm:px-[18px]">
          {/* Toggle reps / tiempo */}
          <div className="mb-3.5 flex items-center gap-2.5">
            <div className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
              Modo
            </div>
            <div className="flex rounded-lg bg-kore-wine-dark/6 p-0.5">
              {(['reps', 'time'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-150 ${
                    mode === m ? 'bg-kore-wine-dark text-white' : 'bg-transparent text-kore-wine-dark/65'
                  }`}
                >
                  {m === 'reps' ? 'Repeticiones' : 'Tiempo'}
                </button>
              ))}
            </div>
          </div>

          {/* Campos numéricos — apilados en móvil, grid en sm+ */}
          <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_1fr_2fr]">
            <div>
              <div className="mb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
                Series
              </div>
              <input
                type="number" min={1} value={sets}
                onChange={(e) => setSets(Number(e.target.value))}
                className="box-border w-full rounded-[9px] border border-kore-wine-dark/10 bg-white/85 px-2.5 py-2 font-heading text-[15px] font-semibold text-kore-wine-dark outline-none"
              />
            </div>
            {mode === 'reps' ? (
              <div>
                <div className="mb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
                  Reps
                </div>
                <input
                  type="number" min={1} value={reps ?? ''}
                  onChange={(e) => { setReps(e.target.value === '' ? null : Number(e.target.value)); setDur(null); }}
                  className="box-border w-full rounded-[9px] border border-kore-wine-dark/10 bg-white/85 px-2.5 py-2 font-heading text-[15px] font-semibold text-kore-wine-dark outline-none"
                />
              </div>
            ) : (
              <div>
                <div className="mb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
                  Tiempo (s)
                </div>
                <input
                  type="number" min={1} value={dur ?? ''}
                  onChange={(e) => { setDur(e.target.value === '' ? null : Number(e.target.value)); setReps(null); }}
                  className="box-border w-full rounded-[9px] border border-kore-wine-dark/10 bg-white/85 px-2.5 py-2 font-heading text-[15px] font-semibold text-kore-wine-dark outline-none"
                />
              </div>
            )}
            <div>
              <div className="mb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
                Descanso (s)
              </div>
              <input
                type="number" min={0} value={rest}
                onChange={(e) => setRest(Number(e.target.value))}
                className="box-border w-full rounded-[9px] border border-kore-wine-dark/10 bg-white/85 px-2.5 py-2 font-heading text-[15px] font-semibold text-kore-wine-dark outline-none"
              />
            </div>
            <div>
              <div className="mb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.18em] text-kore-wine-dark/55">
                Indicación (cue)
              </div>
              <input
                type="text" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicación técnica para el cliente…"
                className="box-border w-full rounded-[9px] border border-kore-wine-dark/10 bg-white/85 px-2.5 py-2 font-body text-[12px] text-[#2A1A1F] outline-none"
              />
            </div>
          </div>

          {/* Buscador de catálogo */}
          <div className="mb-3.5 border-t border-kore-wine-dark/8 pt-3">
            <button
              onClick={() => {
                const next = !showPicker;
                setShowPicker(next);
                if (next) { setSearch(''); fetchExercises(''); }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border border-kore-wine-dark/8 px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] ${
                showPicker ? 'bg-kore-wine-dark/8' : 'bg-kore-wine-dark/4'
              } ${picked ? 'text-kore-wine-dark' : 'text-kore-wine-dark/65'}`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              {picked ? `→ ${picked.name}` : 'Cambiar ejercicio del catálogo'}
            </button>

            {showPicker && (
              <div className="mt-2.5">
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); fetchExercises(e.target.value); }}
                  placeholder="Buscar por nombre… (por defecto muestra ejercicios similares)"
                  className="mb-2 box-border w-full rounded-[9px] border border-kore-wine-dark/10 bg-white/90 px-3 py-2 font-body text-[12px] text-[#2A1A1F] outline-none"
                />
                {catalogLoading ? (
                  <div className="py-3.5 text-center font-body text-[11px] text-kore-wine-dark/55">
                    Cargando catálogo…
                  </div>
                ) : (
                  <div className="max-h-[200px] overflow-y-auto rounded-[10px] border border-kore-wine-dark/8 bg-white/80">
                    {filtered.length === 0 ? (
                      <div className="p-3.5 text-center font-body text-[11px] text-kore-wine-dark/55">
                        Sin resultados
                      </div>
                    ) : (
                      filtered.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => { setPicked(item); setShowPicker(false); setSearch(''); }}
                          className={`flex w-full items-center justify-between gap-2.5 px-3.5 py-2.5 text-left ${
                            picked?.id === item.id ? 'bg-kore-wine-dark/6' : 'bg-transparent'
                          } ${i < filtered.length - 1 ? 'border-b border-kore-wine-dark/8' : ''}`}
                        >
                          <div className="min-w-0">
                            <div className="font-body text-[12px] font-semibold text-[#2A1A1F]">{item.name}</div>
                            {item.pattern && (
                              <div className="mt-0.5 font-body text-[10px] text-kore-wine-dark/55">{item.pattern}</div>
                            )}
                          </div>
                          {item.youtube_url && (
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-[#9A0526]/10 text-kore-wine-dark">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M23 12s0-3.7-.5-5.5c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5c-1 .3-1.7 1-2 2C1 8.3 1 12 1 12s0 3.7.5 5.5c.3 1 1 1.7 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5c1-.3 1.7-1 2-2 .5-1.8.5-5.5.5-5.5zM10 15.5v-7l6 3.5z" />
                              </svg>
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Acciones del form */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded-[9px] border border-kore-wine-dark/10 bg-transparent px-4 py-1.5 font-body text-[11px] font-semibold text-kore-wine-dark/65"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-[9px] border-none bg-gradient-to-br from-[#9A0526] to-[#AB0D2F] px-[18px] py-1.5 font-body text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
```

Nota técnica: en la fila de vista, los wrappers `<div className="... sm:contents">` usan `display: contents` en `sm+` para que sus hijos (las 3 métricas / las 2 acciones) participen directamente del grid de 6 columnas del padre; en `< sm` son `flex` y agrupan métricas y acciones en filas de la card apilada.

- [ ] **Step 2: Verificar compilación**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/trainer/ClientProgramTab.tsx
git commit -m "fix(trainer): fila de ejercicio del tab Programa responsive"
```

---

## Task 4: Verificación y push

**Files:** ninguno.

- [ ] **Step 1: Build final**

Run: `cd frontend && npm run build`
Expected: `Compiled successfully`, sin warnings de variables/imports sin uso (`AdhDot` y `ADH_CFG` ya eliminados).

- [ ] **Step 2: Verificación manual**

Con el dev server (`192.168.56.10:3001`), como trainer, abrir el detalle de un cliente → tab Programa. A 375 / 768 / 1280px:
- La bitácora se ve como minicalendario (cabecera L-M-X-J-V-S-D, días alineados por día de semana, celdas coloreadas por estado, hoy con borde); el anillo de % arriba en móvil, al lado en `sm+`.
- El header de semana y las filas de día no se aprietan ni desbordan.
- Una fila de ejercicio: en móvil card apilada (nombre / 3 métricas / acciones); en `sm+` el grid de 6 columnas como antes.
- Abrir el editor de un ejercicio: inputs apilados en móvil, en grilla en `sm+`; el buscador de catálogo usable.
- Sin scroll horizontal ni errores en consola.

- [ ] **Step 3: Push**

```bash
git push
```

Esperar el CI del PR #27. `frontend-unit-tests` debe quedar verde: `ClientProgramTab.test.tsx` sigue pasando porque los textos y nombres de botón ("Adherencia", "Semana 1"/"Semana 4", "Repeticiones"/"Tiempo", "Tiempo (s)", "Cambiar ejercicio del catálogo", "Guardar", nombres de ejercicio) se preservan. Si algún assertion falla, ajustarlo al markup nuevo.

---

## Self-Review

**Cobertura del spec:**
- Spec §A "Bitácora → minicalendario" (anillo + grilla L-M-X-J-V-S-D alineada por día de semana, celdas coloreadas, leyenda, apilado en móvil) → Task 1. ✓
- Spec §B "Plan semanal — `WeekCard`/`DayRow`" (header reflow, fila de día sin aplastarse) → Task 2. ✓
- Spec §C "Fila de ejercicio" (grid 6-col en `sm+`, card apilada en `< sm`) + formulario de edición (inputs apilados en móvil / grilla en `sm+`) → Task 3. ✓
- Spec "Principios" (Tailwind sólo en los 4 componentes, tokens `kore-*` + arbitrarios, breakpoint `sm`, sin cambios de lógica) → mapeo de colores documentado + Tasks 1-3. ✓
- Spec "Criterios de aceptación" 1-6 → Task 4 (verificación manual) + build. ✓

**Sin placeholders:** cada step de código muestra el bloque completo a reemplazar. La nota de `display: contents` en Task 3 explica el mecanismo, no es un placeholder.

**Consistencia de tipos:** `type AdhStatus` se conserva y lo consume el nuevo `ADH_CELL` (Task 1). `AdhDot`/`ADH_CFG` se eliminan juntos (Task 1 Step 2) — ninguna tarea posterior los referencia. `WeekCard`/`DayRow`/`ExerciseRow` conservan sus firmas de props exactas (`OnExSaved`, `ProgramDay`, `ProgramExercise`) — sólo se reescribe su JSX, los hooks y handlers de `ExerciseRow` quedan intactos. `LegendDot`, `DayTypeChip`, `fmtDay`, `weekRange` se conservan y se siguen usando con su firma actual.

**Decisión registrada:** sin tests nuevos — son reescrituras de layout (inline→Tailwind) que preservan textos/roles; el test existente `ClientProgramTab.test.tsx` cubre el comportamiento y lo valida el CI. Build local (`npm run build`) es la verificación de compilación por tarea; el operador no corre tests localmente.
