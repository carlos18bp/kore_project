# Notas semanales de programa y nutrición — Diseño

**Fecha:** 2026-05-22
**Estado:** Aprobado (diseño)
**Área:** Trainer · Detalle de cliente · Sección "Notas" (subtabs Programa y Nutrición)

## 1. Problema

En la vista de detalle del cliente del entrenador (`/trainer/clients/client?id=<id>`),
sección **Notas**, los subtabs **Programa** y **Nutrición** permiten hoy dejar **una
sola nota** por ciclo:

- **Programa:** un ciclo de 28 días (`MonthlyProgram`) con un único campo
  `trainer_notes`.
- **Nutrición:** planes semanales sueltos (`WeeklyNutritionPlan`), cada uno con su
  propio `trainer_notes`.

El entrenador necesita dejar **una nota por semana**. El ciclo de 28 días está
seccionado en 4 semanas. La nota debe entregarse de forma **guiada y progresiva**:
se muestra la semana 1, al guardarla se desbloquea la semana 2, y así sucesivamente.
Las semanas completadas se apilan como historial. La nutrición también funciona en
ciclos de 28 días = 4 semanas y debe comportarse igual.

## 2. Decisiones tomadas

| Decisión | Resolución |
|---|---|
| Ancla del ciclo de nutrición | Nutrición tiene su **ciclo propio** (no comparte el ciclo del programa). |
| Nota general del programa | Las 4 notas semanales **reemplazan** la nota única del ciclo. |
| Desbloqueo progresivo | La semana N+1 se desbloquea al guardar la semana N con contenido; las semanas ya guardadas **siguen siendo editables**. |
| Visibilidad para el cliente | El cliente **también ve** las notas semanales en su app. |

## 3. Modelo de datos

Dos modelos nuevos en `backend/core_app/models/`. No se modifican migraciones
existentes; se añade una migración nueva.

### 3.1 `ProgramWeekNote`

Ancla: `MonthlyProgram` ya es el ciclo de 28 días, así que la nota semanal cuelga
de él directamente.

```
ProgramWeekNote (TimestampedModel)
  program        FK → MonthlyProgram, related_name='week_notes', on_delete=CASCADE
  week_number    PositiveSmallIntegerField   # 1–4
  notes          TextField(blank=True)
  Meta:
    unique_together = [('program', 'week_number')]
    ordering = ['week_number']
```

Archivo: `backend/core_app/models/program_week_note.py` (o añadido a
`monthly_program.py`, junto a su ancla — se decide en el plan de implementación).

### 3.2 `NutritionWeekNote`

Nutrición no tiene modelo de ciclo de 28 días. Se crea un ciclo **sintético**
identificado por un entero por cliente.

```
NutritionWeekNote (TimestampedModel)
  customer       FK → User (limit_choices_to role=customer), related_name='nutrition_week_notes'
  cycle_number   PositiveSmallIntegerField   # ≥ 1, por cliente
  cycle_start    DateField                   # fecha de inicio del ciclo (para mostrar rangos)
  week_number    PositiveSmallIntegerField   # 1–4
  notes          TextField(blank=True)
  Meta:
    unique_together = [('customer', 'cycle_number', 'week_number')]
    ordering = ['-cycle_number', 'week_number']
```

`cycle_start` se fija al crear la semana 1 de un ciclo (por defecto la fecha de hoy);
las semanas 2–4 del mismo ciclo heredan el mismo `cycle_start`. El rango de cada
semana se deriva en el frontend: `semana M = cycle_start + 7·(M−1)`.

### 3.3 Campo deprecado

`MonthlyProgram.trainer_notes` se **conserva** en la base de datos (no se borran
migraciones ni se elimina el campo). Deja de editarse desde la UI. Las superficies
del cliente que lo leían pasan a leer las notas semanales (ver §6).

## 4. Endpoints (backend)

Patrón existente del proyecto: `APIView` (FBV-style), `request.data.get()`, permiso
trainer/admin para escritura. Se registran en `core_app/urls/api_urls.py`.

### 4.1 Programa

- **`PATCH /api/monthly-programs/<program_id>/week-notes/<week_number>/`**
  - Body: `{ "notes": "<texto>" }`. `week_number` ∈ 1–4.
  - Upsert: crea o actualiza el `ProgramWeekNote`. `notes` vacío conserva la fila
    con `notes=''` (consistente con el patrón actual de "eliminar nota" = guardar
    string vacío; la lógica de desbloqueo solo mira si `notes` tiene contenido, así
    que la existencia de la fila es indiferente).
  - Respuesta: `{ id, program_id, week_number, notes, updated_at }`.
  - Permiso: trainer/admin.
- **Listado embebido:** el serializer de la lista de programas que ya consume
  `fetchClientMonthlyPrograms` (`CustomerProgramListView`) añade
  `week_notes: [{ week_number, notes, updated_at }]`. No se crea GET nuevo.

### 4.2 Nutrición

- **`GET /api/nutrition-week-notes/customer/<customer_id>/`**
  - Respuesta: lista plana de `NutritionWeekNote` ordenada por `-cycle_number,
    week_number`. El frontend agrupa por `cycle_number`.
  - Item: `{ id, cycle_number, cycle_start, week_number, notes, updated_at }`.
  - Permiso: trainer/admin.
- **`PATCH /api/nutrition-week-notes/customer/<customer_id>/<cycle_number>/<week_number>/`**
  - Body: `{ "notes": "<texto>", "cycle_start": "YYYY-MM-DD" (opcional) }`.
  - Upsert. Si `cycle_number` no existe aún, se crea (esto materializa el
    "Nuevo ciclo" disparado desde el frontend). `cycle_start` se usa solo al crear
    la primera semana del ciclo; por defecto la fecha de hoy.
  - Respuesta: `{ id, cycle_number, cycle_start, week_number, notes, updated_at }`.
  - Permiso: trainer/admin.

### 4.3 Reglas de validación

- `week_number` debe estar entre 1 y 4 → 400 si no.
- El backend **no** impone el desbloqueo progresivo (es una guía de UX); el frontend
  lo gobierna. El backend solo valida rango y existencia del ciclo/programa.
- Escribir la semana N de un ciclo cuyo `cycle_number = max(actual) + 1` es la forma
  de iniciar un ciclo nuevo. No se permite saltar números de ciclo (N+2): 400 si el
  `cycle_number` solicitado es mayor que `max(actual) + 1`.

## 5. Frontend — sección Notas (`NotesTab.tsx`)

Se reescriben dos secciones de `frontend/app/components/trainer/NotesTab.tsx`:
`ProgramaSection` y `NutricionSection`. Se reutilizan los componentes existentes
`Composer` y `HistoryCard`. Se añade un componente `LockedWeekCard` para la semana
bloqueada.

### 5.1 Regla de desbloqueo (compartida)

Dada una lista de 4 semanas de un ciclo:

- Semana 1 siempre desbloqueada.
- Semana N (N>1) desbloqueada ⇔ la semana N−1 tiene `notes` no vacío guardado.
- "Semana actual a llenar" = la semana de menor número que está desbloqueada y aún
  sin contenido. Es la que se muestra en el `Composer`.
- Semanas con contenido = `HistoryCard` (clic → vuelven al `Composer` para editar,
  según patrón actual de `PaginatedSection`).
- Semanas bloqueadas = `LockedWeekCard` (gris, texto "Se desbloquea al guardar la
  semana anterior", no editable).

### 5.2 Subtab Programa

Dos niveles de navegación:

1. **Selector de ciclo de 28 días:** se mantiene el selector entre los
   `MonthlyProgram` reales del cliente (conserva fechas, objetivo y estado
   draft/published — el contexto actual del subtab).
2. **Panel de 4 semanas** del ciclo seleccionado: una fila de 4 cards
   (`GRID_CLASS`, 1 col móvil / 2 tablet / 4 desktop) con Semana 1–4. Cada card es
   `Composer` (semana actual), `HistoryCard` (semana hecha) o `LockedWeekCard`.
   El composer muestra kicker "Semana N de 4" y, como meta, el rango de fechas de
   esa semana (derivado de `program.start_date + 7·(N−1)`).

`updateMonthlyProgramNote` deja de usarse para el ciclo completo; se reemplaza por
`updateProgramWeekNote(clientId, programId, weekNumber, notes)`.

### 5.3 Subtab Nutrición

Estructura paralela:

1. **Selector de ciclo de nutrición:** ciclos sintéticos
   ("Ciclo 1 · 22 may", "Ciclo 2 · …") ordenados por `cycle_number` desc, más un
   botón **"Nuevo ciclo"**. El botón "Nuevo ciclo" solo se habilita cuando el ciclo
   más reciente tiene sus 4 semanas con contenido; al pulsarlo, el frontend apunta a
   `cycle_number = max + 1`, `week_number = 1` (el ciclo se materializa en el PATCH).
2. **Panel de 4 semanas** idéntico al del programa.

El bloque existente de **planes semanales de comidas** y el de **evaluación de
hábitos** se mantienen sin cambios; lo que se reemplaza es únicamente la sección de
notas semanales de nutrición.

### 5.4 Store (`trainerStore.ts`)

Métodos nuevos:

- `fetchClientProgramWeekNotes` — innecesario si las notas vienen embebidas en
  `fetchClientMonthlyPrograms`; el tipo `ClientMonthlyProgram` añade
  `week_notes: { week_number: number; notes: string; updated_at: string }[]`.
- `updateProgramWeekNote(customerId, programId, weekNumber, notes)` →
  `PATCH /api/monthly-programs/<programId>/week-notes/<weekNumber>/`.
- `fetchClientNutritionWeekNotes(customerId)` →
  `GET /api/nutrition-week-notes/customer/<customerId>/`; guarda en
  `clientNutritionWeekNotes[customerId]`.
- `updateNutritionWeekNote(customerId, cycleNumber, weekNumber, notes, cycleStart?)`
  → `PATCH /api/nutrition-week-notes/customer/<customerId>/<cycleNumber>/<weekNumber>/`.

Tipo nuevo `ClientNutritionWeekNote = { id, cycle_number, cycle_start, week_number,
notes, updated_at }`.

## 6. Vista del cliente

### 6.1 Programa — `app/(app)/mi-programa/page.tsx`

Hoy renderiza `activeProgram.trainer_notes` (línea ~267). El serializer
`MonthlyProgramSerializer` (`nutrition_daily_serializers.py`) añade:

- `week_notes`: array `[{ week_number, notes }]`.
- `current_week_note`: string calculado — la nota de la semana vigente según
  `today` vs `start_date` (`week = ceil((today − start_date + 1) / 7)`, acotado 1–4).

La página del cliente pasa a mostrar `current_week_note` en lugar de
`trainer_notes`.

### 6.2 Nutrición — `app/(app)/my-nutrition/page.tsx`

El campo `trainer_nutrition_note` del log diario (`get_trainer_nutrition_note` en
`nutrition_daily_serializers.py`) hoy devuelve la nota del **programa** (un cruce
incorrecto). Pasa a devolver la **nota de la semana de nutrición vigente**: del
ciclo de nutrición más reciente del cliente, la semana correspondiente a la fecha de
hoy respecto a `cycle_start`. El frontend `my-nutrition` no cambia (sigue leyendo
`todayLog.trainer_nutrition_note`); el cambio es solo en el serializer.

## 7. Pruebas

Según las reglas de testing del proyecto (lotes pequeños, nunca la suite completa).

- **Backend (pytest):**
  - `ProgramWeekNote` / `NutritionWeekNote`: creación, `unique_together`, upsert vía
    endpoint, limpieza con string vacío.
  - Validación: `week_number` fuera de 1–4 → 400; salto de `cycle_number` → 400.
  - Permisos: customer no puede hacer PATCH (403).
  - `current_week_note` / `get_trainer_nutrition_note`: cálculo de la semana vigente
    con fechas fijas (freeze time / fechas explícitas).
- **Frontend unit (Jest):**
  - Lógica de desbloqueo: dada una lista de 4 semanas, calcular la semana activa y
    las bloqueadas.
  - `trainerStore`: `updateProgramWeekNote` / `updateNutritionWeekNote` actualizan
    el estado optimistamente.
- **E2E (Playwright):** flujo del entrenador — escribir semana 1, verificar que la
  semana 2 se desbloquea, que la 3 sigue bloqueada y que la 1 aparece en historial.

## 8. Fuera de alcance

- Notificar al cliente cuando se publica una nota semanal.
- Notas a nivel de día (existe `ProgramExercise.notes` para eso).
- Migrar el contenido histórico de `MonthlyProgram.trainer_notes` a las nuevas notas
  semanales (el campo queda como estaba; las notas nuevas empiezan vacías).
- Cambiar la generación de `WeeklyNutritionPlan` o `MonthlyProgram`.
