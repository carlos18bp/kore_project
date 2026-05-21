# Spec — Responsive del tab Programa (detalle de cliente, trainer)

**Fecha:** 2026-05-20
**Rama:** `fix/20052026-release-april-may-fixes`
**Alcance:** Responsive del contenido del mini-tab "Programa" del detalle de
cliente del trainer + rediseño de la bitácora como minicalendario.

## Problema

El contenido del tab "Programa" (`app/components/trainer/ClientProgramTab.tsx`,
987 líneas) está construido 100% con `style={{}}` inline. Los estilos inline
**no admiten media queries**, así que las secciones con layout fijo se aplastan
o desbordan en pantallas angostas:

- **`ExerciseRow`** — la fila de vista es un grid inline de 6 columnas
  (`2fr 0.6fr 0.7fr 0.7fr auto auto`: nombre · series · reps · descanso · video
  · editar). En móvil las columnas se aplastan.
- **`AdherenceCard`** — la "Bitácora · N días" es una grilla de chips de día con
  la fecha debajo; poco legible y el trainer no la percibe como un registro de
  cumplimiento.
- **`WeekCard` / `DayRow`** — el header de semana y la fila de día se aprietan
  en móvil.
- El formulario de edición de ejercicio (inputs + buscador de catálogo) tiene
  layout fijo.

## Principios

- Se reescriben con **clases Tailwind** (layout + responsive) sólo los 4
  componentes afectados: `AdherenceCard`, `WeekCard`, `DayRow`, `ExerciseRow`.
  El resto de `ClientProgramTab` queda igual.
- Se reusan los tokens `kore-*` que ya equivalen a la paleta `T` local
  (`T.wine` → `kore-wine-dark`, etc.); valores arbitrarios de Tailwind donde no
  haya token.
- Breakpoint único de reflow: **`sm` (640px)**.
- CSS-responsive puro, sin JS de media-query.
- No se cambia la lógica de datos ni los endpoints — sólo presentación.

## Diseño

### A. Bitácora → minicalendario (`AdherenceCard`)

`AdherenceCard` recibe `logs: DailyLogDay[]` — una ventana de ~12 días recientes
con `date`, `day_type` y `training_adherence`. El estado por día ya se calcula
hoy: `rest`/`active_rest` → descanso; futuro → pendiente; pasado →
`training_adherence ≥ 0.5` ? cumplió : saltó.

Rediseño:

- Se conserva el **anillo de % de adherencia** (resumen) como está.
- Al lado, la bitácora pasa a **minicalendario alineado por día de semana**:
  - Cabecera de 7 columnas: `L M X J V S D`.
  - Celdas vacías al inicio para alinear el primer día de la bitácora a su día
    de semana. Los ~12 días ocupan 2 filas.
  - Cada celda: número de día, fondo coloreado por estado — verde = cumplió,
    rojo = saltó, sage tenue = descanso, gris tenue = pendiente. El día de hoy
    lleva un borde resaltado.
  - Leyenda debajo con los 4 estados (ya existe `LegendDot`).
- Layout: en móvil el anillo arriba y el minicalendario debajo (apilado); en
  `sm+`, lado a lado (`flex-col sm:flex-row`).

### B. Plan semanal (`WeekCard` / `DayRow`)

- **`WeekCard`** — el header (chip de número de semana + "Semana N" + rango de
  fechas + "N entrenamientos · M activos") se reflowea: el rango de fechas baja
  de línea cuando no entra, en vez de apretarse contra el título.
- **`DayRow`** — la fila (bloque día/fecha · `DayTypeChip` · "N ejercicios" ·
  chevron) se ajusta para móvil: el bloque día+fecha y el chip no se aplastan;
  el conteo de ejercicios puede bajar de línea en pantallas muy angostas.

### C. Fila de ejercicio + edición (`ExerciseRow`)

- **Fila de vista:**
  - `sm+`: se mantiene el grid de 6 columnas actual.
  - `< sm`: card apilada — nombre del ejercicio (con su nota/patrón) arriba;
    series / reps / descanso en una fila de 3 métricas; video + botón editar
    como fila de acciones.
- **Formulario de edición** (inputs de series/reps/descanso, toggle reps/tiempo,
  notas, buscador de catálogo): los inputs van full-width apilados en móvil y en
  grilla en `sm+`. El panel de resultados del catálogo conserva su scroll
  interno (`max-h`).

## Fuera de alcance

- Las demás secciones de `ClientProgramTab` (`ProgramHeader`,
  `FitnessLevelEditor`, `TrainerNotesBlock`, la lista de programas) — no las
  marcó el usuario; quedan igual.
- Los demás mini-tabs (Antropometría, etc.) — se abordan después, cada uno con
  su propio spec/plan.
- Cambios de lógica, datos o endpoints.

## Criterios de aceptación

1. En `< sm` (probar a 375px) la bitácora se ve como minicalendario alineado
   por día de semana, con celdas coloreadas por estado y leyenda; el anillo de
   % queda arriba.
2. En `sm+` el anillo y el minicalendario van lado a lado.
3. En `< sm` la fila de ejercicio se ve como card apilada legible, sin scroll
   horizontal ni columnas aplastadas; en `sm+` se ve como hoy (grid de 6 col).
4. El formulario de edición de ejercicio es usable en `< sm` (inputs apilados,
   sin desborde).
5. El header de semana y las filas de día no se aprietan ni desbordan en móvil.
6. Sin errores de hydration ni regresiones visuales en `sm+` respecto de hoy.

## Verificación

- `cd frontend && npm run build` — compila el static export.
- Verificación manual del tab Programa en el detalle de cliente a 375 / 768 /
  1280px.
- Tests en CI (unit + e2e) sin regresión. Si se agregan tests de componente
  para `AdherenceCard`/`ExerciseRow`, corren en CI.
