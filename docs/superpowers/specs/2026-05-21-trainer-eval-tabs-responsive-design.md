# Spec — Responsive de las subtabs Antropometría y Posturometría (trainer)

**Fecha:** 2026-05-21
**Rama:** `fix/20052026-release-april-may-fixes`
**Alcance:** Responsive del contenido de los mini-tabs "Antropometría" y
"Posturometría" del detalle de cliente del trainer, más las primitivas de
formulario compartidas en `shared.tsx` de las que dependen.

## Problema

Los componentes de evaluación (`app/components/trainer/evals/`) están
construidos 100% con `style={{}}` inline. Los estilos inline **no admiten
media queries**, así que las grillas de columnas fijas, las filas flex sin
wrap y los anchos en píxeles se desbordan o se aplastan en pantallas
angostas ("todo salido").

Los formularios de Antropometría y Posturometría se arman con primitivas de
`shared.tsx` (`FormSection`, `Field`, `BilateralPair`, etc.). La raíz del
problema es `FormSection`: renderiza `gridTemplateColumns: repeat(columns,
1fr)` con `columns` fijo (2 o 4) sin lógica de breakpoint, así que en móvil
mantiene 2-4 columnas de inputs.

Inventario de constructos que rompen (referencia para el plan):

**`shared.tsx`**
- `FormHero` — fila flex (`gap:24`) título + score, sin wrap.
- `FormSection` — grid `repeat(columns,1fr)` fijo.
- `Field` / `ChipSelect` — `gridColumn: span N` fijo.
- `BilateralPair`, `RatingScale` — `gridColumn: span 2` fijo.
- `StickyFooter`, `EvalSectionHeader` — filas flex `space-between` sin wrap.

**`EvalAntropTab.tsx`**
- `MetricStrip` — flex con `minWidth:110` por celda.
- `MeasurementsTable` — grid `1fr 1fr` (Perímetros / Pliegues lado a lado).
- Tablas Perímetros / Pliegues / `AntropTimeline` — columnas fijas; el
  timeline ya tiene `overflowX:auto` + `minWidth:500`.
- `FormSection columns={4}` (ComputedCards, Perímetros, Pliegues) y
  `columns={2}` (medidas básicas).

**`EvalPosturTab.tsx`**
- `RadarChart` — SVG de tamaño fijo 280/260px.
- `RegionCard` — grid `1fr 1fr` para descripción.
- `ViewCard` — grid de fotos `1fr 1fr 1fr` / `1fr 1fr`.
- `ResultsHero` — grid `1fr auto` con `minWidth:200`.
- `PosturTimeline` — grid `120px 1fr`; thumb `120x160`; métricas
  `repeat(4,1fr)`.
- Tabs de vista (Anterior/Lateral/Posterior) — fila flex sin wrap.
- Grid de foto+segmentos del formulario — `220px 1fr`.
- `FormSection columns={4}` (ComputedCards).

## Principios

- Se reescriben a **clases Tailwind** sólo los **contenedores de layout que
  rompen** (grids, filas flex, anchos fijos). El resto del estilo inline
  (colores, tipografía, padding) queda igual.
- **CSS puro, sin JS de media-query** — evita el hydration mismatch que ya
  costó esta sesión. Sin `useMediaQuery`.
- Breakpoint primario de reflow: **`sm` (640px)**. Para grids de 4 columnas
  se usa además **`xl` (1280px)** como paso intermedio (1 → 2 → 4).
- No se cambia lógica de datos, cálculos ni endpoints — sólo presentación.

## Diseño

### A. Primitivas compartidas (`shared.tsx`)

- **`FormSection`** — el grid pasa a Tailwind responsive según `columns`:
  - `columns=1` → `grid-cols-1`
  - `columns=2` → `grid-cols-1 sm:grid-cols-2`
  - `columns=4` → `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`
  - Mapa estático `COLS_CLASS` (Tailwind necesita clases literales).
- **`Field`** — `span` → clase: `span 1` = `col-span-1`; `span 2` =
  `col-span-1 sm:col-span-2`.
- **`BilateralPair`, `RatingScale`** — pasan a `col-span-1 sm:col-span-2`.
- **`ChipSelect`** — `span` con el mismo mapa que `Field`.
- **`FormHero`** — la fila interna pasa a `flex-col sm:flex-row`; el score
  baja debajo del título en móvil.
- **`StickyFooter`** — `flex-col sm:flex-row` con `gap`; en móvil el texto
  arriba y los botones full-width debajo.
- **`EvalSectionHeader`** — `flex-wrap` para que "+ Nueva" baje de línea.

Beneficio colateral: las otras 3 tabs de evaluación (Física, Nutrición,
PARQ) usan las mismas primitivas y heredan el fix de formularios.

### B. `EvalAntropTab.tsx`

- `MetricStrip` — se mantiene el scroll horizontal (patrón válido para tira
  de métricas densas); se reduce `minWidth` para que entren ~3 en 375px.
- `MeasurementsTable` — el grid `1fr 1fr` pasa a `grid-cols-1
  lg:grid-cols-2` (las dos tablas se apilan en móvil/tablet).
- Tablas Perímetros / Pliegues — se envuelven en contenedor
  `overflow-x-auto` para scroll horizontal interno cuando no caben.
- `AntropTimeline` — conserva su scroll horizontal (ya lo tiene).

### C. `EvalPosturTab.tsx`

- `RadarChart` — el `<svg>` pasa a `width:'100%'`, `height:'auto'`,
  `maxWidth` igual al `size` actual; el `viewBox` ya lo hace escalable.
- `RegionCard` descripción — grid `1fr 1fr` → `grid-cols-1 sm:grid-cols-2`.
- `ViewCard` fotos — grid → `grid-cols-2 sm:grid-cols-3` cuando hay 3 fotos,
  `grid-cols-1 sm:grid-cols-2` cuando hay 2.
- `ResultsHero` — `1fr auto` → `flex-col xl:flex-row`; el bloque
  índice+radar arriba y las fotos antes/después debajo en móvil/tablet.
- `PosturTimeline` — `120px 1fr` → `flex-col sm:flex-row`; el thumb pasa a
  ancho fluido con `maxWidth`. Métricas `repeat(4,1fr)` → `grid-cols-2
  sm:grid-cols-4`.
- Tabs de vista — `flex-wrap` para que las 4 entren en dos filas en móvil.
- Grid foto+segmentos del formulario — `220px 1fr` → `grid-cols-1
  sm:grid-cols-[220px_1fr]`.

## Fuera de alcance

- Los layouts tab-específicos de Física, Nutrición y PARQ (heredan sólo el
  fix de `shared.tsx`; sus bloques propios no se auditan aquí).
- Cambios de lógica, datos, cálculos o endpoints.
- Rediseño visual — sólo reflow responsive.

## Criterios de aceptación

1. En `<sm` (375px) los formularios de ambas tabs muestran una sola columna
   de inputs, sin desborde ni columnas aplastadas.
2. En `sm`–`xl` los grids de 4 columnas se ven a 2 columnas; en `xl+` a 4.
3. El `RadarChart` escala con el ancho disponible sin recortarse.
4. Las tablas densas (Perímetros, Pliegues, timelines) no rompen el ancho
   de la página: scrollean horizontalmente dentro de su tarjeta.
5. `FormHero`, `StickyFooter` y los tabs de vista no se aplastan ni
   desbordan en móvil.
6. Sin errores de hydration ni regresiones visuales en `xl+` respecto de
   hoy. Las otras 3 tabs de evaluación siguen viéndose bien.

## Verificación

- `cd frontend && npm run build` — compila el static export.
- Tests de CI (unit + e2e) sin regresión.
- Verificación manual de ambas tabs a 375 / 768 / 1280px.
