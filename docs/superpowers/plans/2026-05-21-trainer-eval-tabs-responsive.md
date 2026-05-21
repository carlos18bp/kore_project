# Responsive de las subtabs Antropometría y Posturometría — Plan

> **For agentic workers:** ejecutar con superpowers:executing-plans, tarea por tarea.

**Goal:** Hacer responsive el contenido de los mini-tabs Antropometría y
Posturometría del detalle de cliente (trainer) y las primitivas de
formulario compartidas.

**Architecture:** Reescribir a clases Tailwind sólo los contenedores de
layout que rompen (grids fijos, filas flex sin wrap, anchos en px). CSS puro,
sin JS de media-query. Breakpoints `sm` (640) y `xl` (1280).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4.

---

## Task 1: Primitivas responsive en `shared.tsx`

**Files:** Modify `frontend/app/components/trainer/evals/shared.tsx`

- [ ] **Step 1: `FormSection` — grid responsive**

Añadir mapa estático y usarlo en el `div` del grid (reemplaza el `style`
`display:grid` por `className`):

```tsx
const COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
};
```

El contenedor del grid:
`<div className={\`grid \${COLS_CLASS[columns] ?? COLS_CLASS[2]}\`} style={{ gap }}>`

- [ ] **Step 2: `Field` — span responsive**

Reemplazar `style={{ gridColumn: \`span \${span}\` }}` por
`className={span >= 2 ? 'col-span-1 sm:col-span-2' : 'col-span-1'}`.

- [ ] **Step 3: `BilateralPair` y `RatingScale` — span responsive**

Ambos tienen `gridColumn: 'span 2'` fijo en el `div` raíz → reemplazar por
`className="col-span-1 sm:col-span-2"`.

- [ ] **Step 4: `ChipSelect` — span responsive**

Reemplazar `style={{ gridColumn: \`span \${span}\` }}` por
`className={span >= 2 ? 'col-span-1 sm:col-span-2' : 'col-span-1'}`.

- [ ] **Step 5: `FormHero` — apilar en móvil**

La fila interna `display:'flex', alignItems:'center', gap:24` (el div que
envuelve título + score) → `className="flex flex-col gap-4 sm:flex-row
sm:items-center sm:gap-6"` (quitar esas props del `style`). El bloque del
score: quitar `textAlign:'right'` fijo → `text-left sm:text-right`.

- [ ] **Step 6: `StickyFooter` — apilar en móvil**

El contenedor: `display:'flex', justifyContent:'space-between'` →
`className="flex flex-col gap-3 sm:flex-row sm:items-center
sm:justify-between"`. El grupo de botones: añadir `w-full sm:w-auto` y que
los botones crezcan (`flex-1 sm:flex-none`) para ser tappables en móvil.

- [ ] **Step 7: `EvalSectionHeader` — wrap**

El contenedor `display:'flex', justifyContent:'space-between'` → añadir
`flex-wrap` y `gap` (className `flex flex-wrap items-start justify-between
gap-3`).

- [ ] **Step 8: Build**

Run: `cd frontend && npm run build` — Expected: `Compiled successfully`.

- [ ] **Step 9: Commit**

`fix(trainer): primitivas de formulario de evaluación responsive`

---

## Task 2: `EvalAntropTab.tsx`

**Files:** Modify `frontend/app/components/trainer/evals/EvalAntropTab.tsx`

- [ ] **Step 1: `MeasurementsTable` — apilar las dos tablas**

El grid `gridTemplateColumns:'1fr 1fr'` que pone Perímetros y Pliegues lado
a lado → `className="grid grid-cols-1 lg:grid-cols-2"` con `gap` inline.

- [ ] **Step 2: Tablas Perímetros y Pliegues — scroll horizontal**

Envolver cada `<table>` en `<div className="overflow-x-auto">` para que
scrollee dentro de la tarjeta sin romper el ancho de página.

- [ ] **Step 3: `MetricStrip` — reducir minWidth**

Bajar `minWidth` de cada celda de `110` a `92` para que entren ~3 en 375px;
conservar `overflowX:'auto'`.

- [ ] **Step 4: Verificar `AntropTimeline`**

Ya tiene `overflowX:'auto'` + `minWidth:500` — dejar igual.

- [ ] **Step 5: Build**

Run: `cd frontend && npm run build` — Expected: `Compiled successfully`.

- [ ] **Step 6: Commit**

`fix(trainer): tab Antropometría responsive`

---

## Task 3: `EvalPosturTab.tsx`

**Files:** Modify `frontend/app/components/trainer/evals/EvalPosturTab.tsx`

- [ ] **Step 1: `RadarChart` — SVG fluido**

El `<svg>` usa `width={size} height={size}` fijos pero ya tiene `viewBox`.
Cambiar a `style={{ width:'100%', height:'auto', maxWidth:size }}` (quitar
los atributos `width`/`height` numéricos o ponerlos como `'100%'`).

- [ ] **Step 2: `RegionCard` descripción — grid responsive**

El grid `1fr 1fr` de las dos cajas de texto → `className="grid grid-cols-1
sm:grid-cols-2"` con `gap` inline.

- [ ] **Step 3: `ViewCard` grid de fotos**

`gridTemplateColumns: first ? '1fr 1fr 1fr' : '1fr 1fr'` → className
condicional: `first ? 'grid grid-cols-2 sm:grid-cols-3' : 'grid grid-cols-1
sm:grid-cols-2'`.

- [ ] **Step 4: `ResultsHero` — apilar**

Grid `1fr auto` → `className="flex flex-col gap-6 xl:flex-row
xl:items-center"`. Quitar `minWidth:200` del bloque de fotos; darle
`w-full xl:w-auto`. El grid interno de fotos antes/después `1fr 1fr` queda
igual (dos fotos chicas lado a lado está bien).

- [ ] **Step 5: `PosturTimeline` — apilar fila y métricas**

Fila `gridTemplateColumns:'120px 1fr'` → `className="flex flex-col gap-3
sm:flex-row"`. El thumb `width:120,height:160` → `style` con
`width:'100%', maxWidth:120` (o `sm:w-[120px]`). Métricas
`repeat(4,1fr)` → `className="grid grid-cols-2 sm:grid-cols-4"`.

- [ ] **Step 6: `PosturResults` region cards — grid responsive**

Grid `1fr 1fr` de las dos `RegionCard` → `grid-cols-1 sm:grid-cols-2`.

- [ ] **Step 7: Tabs de vista — wrap**

La fila flex de los 4 botones (Anterior/Lateral der/Lateral izq/Posterior)
→ añadir `flex-wrap`.

- [ ] **Step 8: Grid foto+segmentos del formulario**

`gridTemplateColumns:'220px 1fr'` → `className="grid grid-cols-1
sm:grid-cols-[220px_1fr]"` con `gap` inline.

- [ ] **Step 9: Build**

Run: `cd frontend && npm run build` — Expected: `Compiled successfully`.

- [ ] **Step 10: Commit**

`fix(trainer): tab Posturometría responsive`

---

## Task 4: Verificación y push

- [ ] **Step 1: Build final** — `cd frontend && npm run build`.
- [ ] **Step 2: Push** — `git push`.
- [ ] **Step 3: Vigilar CI** del PR #27 hasta verde.
- [ ] **Step 4:** Nota de verificación manual pendiente (375/768/1280px en
  ambas tabs, autenticado como trainer).
