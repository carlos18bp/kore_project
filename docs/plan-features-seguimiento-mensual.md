# Plan: Implementación de Features Faltantes — Programa de Seguimiento Mensual

## Context

El sistema Kore tiene un programa mensual de 28 días con ejercicios diarios, evaluaciones biomecánicas, suscripciones y bookings. Falta completar las funcionalidades de seguimiento continuo del cliente: nutrición diaria con sugerencias inteligentes, resumen semanal/mensual, proyección dinámica, y detalle de sesión.

El programa corre INDEPENDIENTE de las sesiones compradas — el cliente tiene contenido todos los días.

**Principio clave de nutrición:** Los usuarios NO saben de macros/micronutrientes. La app les DICE qué comer (sugerencias basadas en TODAS sus evaluaciones), y ellos suben foto de lo que realmente comieron.

**Descubrimiento:** El overlay de bookings en el calendario YA ESTÁ IMPLEMENTADO en `ProgramCalendar.tsx` (dot azul + leyenda "Sesión"). Solo necesita un fix menor de visibilidad.

---

## Resumen de Trabajo (8 Features, ordenadas por prioridad)

| # | Feature | Esfuerzo | Tipo |
|---|---------|----------|------|
| 1 | Fix `close_daily_logs` | Bajo | Bug fix backend |
| 2 | Booking overlay visibilidad | Mínimo | CSS tweak |
| 3 | Catálogo de Alimentos (importación datos) | Medio | Data pipeline + modelo |
| 4 | Plan Nutricional Diario con Sugerencias | Alto | Full stack nuevo |
| 5 | Resumen Semanal de Progreso | Medio | Backend service + frontend page |
| 6 | Proyección Dinámica | Medio | Backend service + dashboard widget |
| 7 | Detalle Próxima Sesión | Medio | Migration + API + UI |
| 8 | Resumen Mensual / Cierre Hitos | Medio | Backend service + frontend page |

---

## Feature 1: Fix `close_daily_logs` Task

**Archivo:** `backend/core_app/tasks.py` (líneas 358-376)

**Problema:** Si el cliente nunca abre la app ese día, no se crea DailyLog ni ExerciseLogs. La tarea solo cierra logs existentes.

**Solución:**
1. Fase 1: Cerrar DailyLogs abiertos (existente)
2. Fase 2: Buscar ProgramDays de hoy en programas PUBLISHED sin DailyLog → crear DailyLog + ExerciseLogs (NOT_DONE) → cerrar inmediatamente

**Archivos a modificar:**
- `backend/core_app/tasks.py` — reescribir `close_daily_logs()`

**Modelos involucrados:** `DailyLog`, `ExerciseLog`, `ProgramDay`, `MonthlyProgram`

---

## Feature 2: Booking Overlay (Mejora de visibilidad)

**Ya implementado en:** `frontend/app/components/program/ProgramCalendar.tsx` línea 148

**Cambio:** Remover condición `!isToday` para mostrar el dot también hoy, aumentar tamaño de 1.5→2px, agregar ring blanco para contraste.

**Archivo a modificar:**
- `frontend/app/components/program/ProgramCalendar.tsx` — 1 línea

---

## Feature 3: Catálogo de Alimentos (Data Pipeline)

### Fuentes de Datos

El catálogo combina dos fuentes complementarias, auto-alojadas como CSV importado a la BD:

| Fuente | Qué aporta | Idioma | Items | Formato |
|--------|-----------|--------|-------|---------|
| **TACO Brasil** (GitHub) | Alimentos frescos/crudos (pollo, arroz, frijol, plátano, aguacate) | Portugués→Español | 597 | CSV listo |
| **Open Food Facts Colombia** | Productos empacados + Nutri-Score + NOVA | Español | ~6,868 | CSV (filtrado) |

**Total:** ~7,400 alimentos con info nutricional completa en español.

### Campos clave de Open Food Facts para la lógica automática:

| Campo | Uso en KORE |
|-------|-------------|
| `energy-kcal_100g` | Cálculo calórico |
| `proteins_100g` | Balance de macros |
| `carbohydrates_100g` | Balance de macros |
| `fat_100g` | Balance de macros |
| `fiber_100g` | Calidad de la comida |
| `nova_group` (1-4) | Filtrar: solo NOVA 1-2 para recomendaciones saludables |
| `nutrition_grades` (A-E) | Filtrar: solo A-B-C para sugerencias |
| `food_groups_tags` | Categorización (frutas, carnes, lácteos, granos) |
| `product_name_es` | Nombre visible al usuario |
| `ingredients_text_es` | Ingredientes en español |

### Modelo Backend

**Nuevo archivo:** `backend/core_app/models/food.py`

```
Food (TimestampedModel):
  - name (CharField) — nombre en español
  - category (choices: proteina, carbohidrato, grasa_saludable, fruta, verdura, lacteo, snack, bebida)
  - subcategory (CharField, blank) — detalle: "pollo", "res", "cerdo"
  - calories_per_100g (DecimalField)
  - protein_per_100g (DecimalField)
  - carbs_per_100g (DecimalField)
  - fat_per_100g (DecimalField)
  - fiber_per_100g (DecimalField, null)
  - nova_group (IntegerField, 1-4, null) — nivel de procesamiento
  - nutri_score (CharField, A-E, blank) — calificación nutricional
  - source (choices: taco, openfoodfacts, curated)
  - is_active (BooleanField, default=True)
```

### Management Command de Importación

**Nuevo archivo:** `backend/core_app/management/commands/import_food_catalog.py`

- Lee CSV de TACO Brasil → traduce nombres PT→ES → inserta en Food
- Lee CSV de Open Food Facts (pre-filtrado Colombia) → mapea campos → inserta en Food
- Idempotente (upsert por nombre + source)

### Preparación de datos

1. Descargar TACO: `git clone https://github.com/machine-learning-mocha/taco` → usar `tabelas/taco-centra.csv`
2. Open Food Facts: descargar CSV completo, filtrar `countries_tags` con "colombia", exportar subset
3. Guardar ambos CSVs en `backend/data/` (gitignored por peso, pero documentar proceso)

---

## Feature 4: Plan Nutricional Diario con Sugerencias Inteligentes

### Concepto UX

```
┌─────────────────────────────────────────────────┐
│  🥗 Desayuno                                    │
│                                                 │
│  Sugerencia: "Arepa con huevo y aguacate"       │
│  Alimentos clave: arepa, huevo, aguacate        │
│  ~380 kcal | Proteína ✓ | Grasa saludable ✓    │
│                                                 │
│  [✅ Comí esto] [⏭️ Omití]                      │
│  [📷 Subir foto]                                │
│                                                 │
│  📝 Nota: "Cambié aguacate por queso"           │
└─────────────────────────────────────────────────┘
```

**NO es:** receta paso a paso con foto profesional y tiempos de preparación.
**SÍ es:** guía de qué debe incluir cada comida + tracking de cumplimiento con foto.

### Modelo de Sugerencias

**Nuevo archivo:** `backend/core_app/models/meal_suggestion.py`

```
MealSuggestion (TimestampedModel):
  - title (CharField) — "Arepa con huevo y aguacate"
  - meal_block (choices: desayuno, media_manana, almuerzo, merienda, cena)
  - description (TextField, blank) — descripción corta opcional
  - foods (M2M → Food) — alimentos que componen esta sugerencia
  - calories_estimate (IntegerField) — estimado calórico total
  - goal_tags (JSONField) — ["fat_loss", "muscle_gain", "general_health"]
  - fitness_level_min (IntegerField, 1-5, default=1)
  - fitness_level_max (IntegerField, 1-5, default=5)
  - nova_max (IntegerField, 1-4, default=2) — máximo nivel de procesamiento aceptado
  - is_active (BooleanField, default=True)
```

### Lógica de Selección de Sugerencias

**Nuevo archivo:** `backend/core_app/services/meal_suggestion_service.py`

```python
def get_daily_suggestions(customer) -> dict[str, MealSuggestion]:
    """Selecciona una sugerencia por cada meal_block basado en TODAS las evaluaciones."""
```

**Inputs (usa TODO del sistema):**
1. `customer_profile.primary_goal` → filtra por `goal_tags`
2. `physical_evaluation.general_index` → filtra por `fitness_level_min/max`
3. `anthropometry.weight_kg, body_fat_pct` → ajusta calorías target
4. `nutrition_habit.habit_score` → si score bajo, sugiere comidas más simples
5. `parq_assessment.risk_classification` → si hay restricciones, filtra alimentos

**Algoritmo simplificado:**
1. Filtrar MealSuggestions por: goal, fitness_level, is_active
2. Para cada meal_block, seleccionar una sugerencia (rotación diaria con seed=date)
3. Ajustar si la suma calórica del día está fuera del rango target
4. Retornar dict: {desayuno: suggestion, almuerzo: suggestion, ...}

### Modelos de Tracking Diario

**Nuevo archivo:** `backend/core_app/models/nutrition_daily_log.py`

```
NutritionDailyLog (TimestampedModel):
  - customer (FK → User)
  - date (DateField, indexed)
  - is_closed (BooleanField, default=False)
  - closed_at (DateTimeField, null)
  - notes (TextField, blank)
  - Unique: (customer, date)

MealEntry (TimestampedModel):
  - daily_log (FK → NutritionDailyLog, related='meal_entries')
  - meal_block (choices: desayuno, media_manana, almuerzo, merienda, cena)
  - suggestion (FK → MealSuggestion, null, blank) — lo que se le sugirió
  - status (choices: completed, skipped, not_done — default not_done)
  - notes (TextField, blank) — "Cambié X por Y"
  - photo (ImageField, upload_to='nutrition/{customer_id}/{date}/{filename}')
  - Unique: (daily_log, meal_block)
```

### Endpoints

| Método | URL | Propósito |
|--------|-----|-----------|
| GET | `/api/my-nutrition-daily/today/` | Get/create log de hoy + 5 MealEntries con sugerencias asignadas |
| PATCH | `/api/my-nutrition-daily/<log_id>/meals/<meal_id>/` | Actualizar status + notes |
| POST | `/api/my-nutrition-daily/<log_id>/meals/<meal_id>/photo/` | Subir foto |
| GET | `/api/my-nutrition-daily/history/` | Historial últimos 30 días |

### Archivos a crear/modificar (Backend)

- `backend/core_app/models/food.py` — modelo Food
- `backend/core_app/models/meal_suggestion.py` — modelo MealSuggestion
- `backend/core_app/models/nutrition_daily_log.py` — NutritionDailyLog + MealEntry
- `backend/core_app/services/meal_suggestion_service.py` — lógica de selección
- `backend/core_app/views/nutrition_daily_views.py` — 4 endpoints
- `backend/core_app/management/commands/import_food_catalog.py` — importar CSV
- `backend/core_app/management/commands/seed_meal_suggestions.py` — seed 150-200 sugerencias
- `backend/core_app/models/__init__.py` — agregar imports
- `backend/core_app/urls/api_urls.py` — registrar URLs
- `backend/core_app/tasks.py` — extender close_daily_logs para nutrición
- `backend/core_app/admin.py` — registrar admin

### Frontend

**Nuevos archivos:**
- `frontend/lib/stores/nutritionDailyStore.ts` — Zustand store
- `frontend/app/(app)/mi-nutricion-diaria/page.tsx` — Página principal
- `frontend/app/components/nutrition-daily/MealBlockCard.tsx` — Card por comida con sugerencia
- `frontend/app/components/nutrition-daily/MealPhotoUpload.tsx` — Upload con compresión
- `frontend/app/components/nutrition-daily/NutritionDailyProgress.tsx` — Barra X/5 completadas

**Patrones a reusar:**
- `programStore.ts` → patrón de store con fetchToday + updateStatus
- `compressImage.ts` → compresión de foto antes de upload (1600px, 80% JPEG)
- `mi-programa/dia/[date]/page.tsx` → patrón de checklist con status toggle
- `AvatarUploadSerializer` → validación de imagen (5MB, jpeg/png/webp)

---

## Feature 5: Resumen Semanal de Progreso

### Backend

**Nuevos archivos:**
- `backend/core_app/services/adherence_calculator.py` — Lógica pura de cálculo
- `backend/core_app/services/progress_service.py` — Orquestación con queries
- `backend/core_app/views/progress_views.py` — Endpoint

**Servicio adherence_calculator.py:**
```python
compute_daily_adherence(exercise_logs, day_type) -> float (0.0-1.0)
compute_nutrition_adherence(meal_entries) -> float (0.0-1.0)
compute_streak(daily_data) -> {current, longest, start_date}
compute_week_adherence(daily_data) -> [{date, training_adherence, nutrition_adherence, combined}]
```

**Fórmula de adherencia:**
- Training days: completed_exercises / total_exercises
- Nutrition: completed_meals / 5 (por día)
- Active rest days: completed / total (si hay ejercicios, sino 1.0)
- Rest days: siempre 1.0 para training (nutrición siempre cuenta)
- Combined: (0.6 * training) + (0.4 * nutrition)
- Streak: día cuenta si combined ≥ 70%

**Endpoint:**

| Método | URL | Propósito |
|--------|-----|-----------|
| GET | `/api/my-program/weekly-summary/?week=N` | Datos de barra por día + streak + promedio |

**Response:**
```json
{
  "week_number": 2,
  "days": [
    {
      "date": "2026-05-01",
      "day_type": "training",
      "training_adherence": 0.83,
      "nutrition_adherence": 0.80,
      "combined_adherence": 0.82,
      "exercises_completed": 5,
      "exercises_total": 6,
      "meals_completed": 4,
      "meals_total": 5
    }
  ],
  "week_average": 0.85,
  "streak": {"current": 5, "longest": 12, "start_date": "2026-04-30"}
}
```

### Frontend

**Nuevos archivos:**
- `frontend/lib/stores/progressStore.ts` — Zustand store
- `frontend/app/(app)/mi-programa/progreso/page.tsx` — Página semanal
- `frontend/app/components/program/WeeklyBarChart.tsx` — Barras SVG con GSAP
- `frontend/app/components/program/StreakBadge.tsx` — Badge con racha

**Visualización:** Barras SVG nativas (NO recharts) con GSAP scaleY animation + dual color (training + nutrition). Patrón existente en `my-diagnosis/page.tsx`.

---

## Feature 6: Proyección Dinámica

### Backend

**Agregar a:** `backend/core_app/services/adherence_calculator.py`

```python
project_program_outcome(daily_adherences, days_remaining, weight_entries) -> {
    projected_final_adherence, weight_projection, trend, confidence, recommendation
}
```

**Algoritmo:**
- Rolling 7-day average como base de proyección
- Trend: comparar primera mitad vs segunda mitad (improving/stable/declining)
- Weight: regresión lineal simple sobre WeightEntries del período
- Confidence: high (>=14 días data), medium (>=7), low (<7)
- Recommendation: texto motivacional basado en trend

**Endpoint:**

| Método | URL | Propósito |
|--------|-----|-----------|
| GET | `/api/my-program/projection/` | Proyección actual para dashboard widget |

### Frontend

**Nuevo componente:**
- `frontend/app/components/program/ProjectionWidget.tsx` — Card con SVG circular progress + trend arrow

**Integración:** Agregar en `dashboard/page.tsx` entre la sección de programa y evaluaciones.

---

## Feature 7: Detalle Próxima Sesión

### Backend

**Archivos a modificar:**
- `backend/core_app/models/booking.py` — Agregar 2 campos
- `backend/core_app/serializers/booking_serializers.py` — Agregar campos + SerializerMethodField
- `backend/core_app/views/booking_views.py` — Agregar action `session-prep`

**Nuevos campos en Booking:**
```python
session_objective = models.TextField(blank=True)
session_notes_for_customer = models.TextField(blank=True)
```

**Nuevo SerializerMethodField:** `program_day_exercises` — busca ProgramDay para la fecha del booking y retorna ejercicios planificados.

**Nuevo endpoint:** `PATCH /api/bookings/{id}/session-prep/` — Trainer define objetivo y notas pre-sesión.

### Frontend

**Archivos a modificar:**
- `frontend/lib/stores/bookingStore.ts` — Agregar tipos nuevos
- `frontend/app/components/booking/SessionDetailModal.tsx` — Agregar sección objetivo + ejercicios
- `frontend/app/components/booking/UpcomingSessionReminder.tsx` — Preview del objetivo
- `frontend/app/(app)/dashboard/page.tsx` — Mostrar objetivo en card de próxima sesión

---

## Feature 8: Resumen Mensual / Cierre de Hitos

### Backend

**Agregar a:** `backend/core_app/services/progress_service.py`

```python
get_monthly_summary(user, program_id) -> {
    overall_adherence, training_adherence, nutrition_adherence,
    comparisons: {anthropometry, physical, kore_index},
    mood_average: {first_week, last_week},
    weight_trend: {start, end, delta},
    streak_best
}
```

**Lógica:** Compara evaluación más reciente ANTES del start_date vs más reciente ANTES/EN end_date para cada módulo.

**Endpoint:**

| Método | URL | Propósito |
|--------|-----|-----------|
| GET | `/api/my-program/monthly-summary/` | Comparativa completa inicio vs fin |

**Huey task:** `complete_finished_programs()` — corre diario a medianoche, marca programas pasados como `completed`.

### Frontend

**Nuevos archivos:**
- `frontend/app/(app)/mi-programa/resumen/page.tsx` — Página de cierre mensual
- `frontend/app/components/program/ComparisonCard.tsx` — Card antes/después por módulo

**Datos mostrados:**
- Adherencia total: training + nutrición (separadas y combinada)
- Deltas: peso, grasa corporal, IMC, KORE Index
- Mejora en evaluación física (general_index)
- Mood promedio primera semana vs última
- Best streak

---

## Orden de Implementación

```
Sprint 1 — Quick wins (1-2 días):
  1. Fix close_daily_logs ← backend only, sin migration
  2. Booking overlay CSS ← 1 línea

Sprint 2 — Data foundation (3-4 días):
  3. Modelo Food + import CSV (TACO + Open Food Facts)
  4. Modelo MealSuggestion + seed 150-200 sugerencias colombianas
  5. meal_suggestion_service.py (lógica de selección)

Sprint 3 — Nutrición diaria (4-5 días):
  6. NutritionDailyLog + MealEntry modelos + migration
  7. Endpoints (today, update, photo, history)
  8. Frontend store + page + components
  9. Integrar close_daily_logs con nutrición

Sprint 4 — Progreso y proyección (3-4 días):
  10. adherence_calculator service (incluye nutrición en la fórmula)
  11. Weekly summary endpoint + frontend page
  12. Projection endpoint + dashboard widget

Sprint 5 — Sesión y cierre (3-4 días):
  13. Booking session detail (migration + API + UI)
  14. Monthly summary endpoint + frontend page
```

---

## Verificación

**Backend:**
- `pytest core_app/tests/tasks/test_close_daily_logs.py -v`
- `pytest core_app/tests/models/test_food.py -v`
- `pytest core_app/tests/services/test_meal_suggestion_service.py -v`
- `pytest core_app/tests/views/test_nutrition_daily_views.py -v`
- `pytest core_app/tests/services/test_adherence_calculator.py -v`
- `pytest core_app/tests/views/test_progress_views.py -v`
- `pytest core_app/tests/views/test_booking_session_prep.py -v`

**Frontend:**
- `npm test -- nutritionDailyStore.test.ts`
- `npm test -- progressStore.test.ts`
- `npx playwright test e2e/app/customer-nutrition-daily.spec.ts`

**Manual:**
- Abrir `/mi-nutricion-diaria` → verificar 5 meal cards CON sugerencias
- Las sugerencias deben cambiar según el goal del usuario
- Subir foto → verificar compresión y preview
- Abrir `/mi-programa/progreso` → verificar barras semanales (training + nutrition)
- Abrir `/dashboard` → verificar projection widget
- Login trainer → PATCH session-prep → login customer → verificar objetivo en sesión

---

## Archivos Críticos (Referencia Rápida)

| Área | Archivo |
|------|---------|
| DailyLog pattern | `backend/core_app/models/monthly_program.py` |
| Photo upload pattern | `backend/core_app/views/posturometry_views.py` |
| Image validation | `backend/core_app/serializers/profile_serializers.py:106` |
| Close task | `backend/core_app/tasks.py:358` |
| URL registry | `backend/core_app/urls/api_urls.py` |
| Program generator | `backend/core_app/services/program_generator.py` |
| KORE Index calc | `backend/core_app/services/kore_index_calculator.py` |
| Anthropometry calc | `backend/core_app/services/anthropometry_calculator.py` |
| Nutrition calculator | `backend/core_app/services/nutrition_calculator.py` |
| Program store | `frontend/lib/stores/programStore.ts` |
| Nutrition store | `frontend/lib/stores/nutritionStore.ts` |
| Calendar component | `frontend/app/components/program/ProgramCalendar.tsx` |
| Exercise checklist | `frontend/app/(app)/mi-programa/dia/[date]/page.tsx` |
| Image compression | `frontend/lib/utils/compressImage.ts` |
| Dashboard | `frontend/app/(app)/dashboard/page.tsx` |
