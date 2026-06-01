# Spec — Agenda del trainer: vistas Día / Semana / Mes

**Fecha:** 2026-05-20
**Rama:** `fix/20052026-release-april-may-fixes`
**Alcance:** Convertir la card "Agenda" del dashboard del trainer en una vista
con toggle Día / Semana / Mes, con modal de resumen al clickear un día.

## Problema

La card "Agenda · Hoy" del dashboard del trainer (`trainer/dashboard/page.tsx`)
sólo muestra las sesiones de **hoy**, en un timeline por hora. El trainer no
tiene forma de ver de un vistazo en qué días de la semana o del mes tiene
sesiones.

Además, la card se alimenta de `dashboardStats.upcoming_sessions`, que el
backend limita a las **próximas 5 sesiones** (`.order_by('starts_at')[:5]` en
`TrainerDashboardStatsView`). Eso es insuficiente incluso para "hoy" si el
trainer tiene más de 5 sesiones próximas, y no sirve para una semana o un mes.

## Diseño

### A. Backend — sesiones del trainer por rango de fechas

Endpoint nuevo: `GET /api/trainer/agenda/?from=YYYY-MM-DD&to=YYYY-MM-DD`.

- Vista `TrainerAgendaView` (APIView) en `core_app/views/trainer_client_views.py`,
  hermana de `TrainerDashboardStatsView`. Registrada en `api_urls.py` como
  `trainer-agenda`.
- Sólo para usuarios con perfil de trainer (mismo gate que las demás vistas
  trainer). Sin perfil de trainer → 403.
- `from` y `to` son fechas (`YYYY-MM-DD`) inclusive. Si faltan o son inválidas
  → 400. Rango máximo razonable: 62 días (cubre un mes con navegación); si se
  excede → 400.
- Devuelve las `Booking` del trainer en `[from 00:00, to 23:59:59]` con estado
  `PENDING` o `CONFIRMED`, ordenadas por `starts_at`, **sin límite de cantidad**.
- Cada item: `id, customer_id, customer_name, package_title, starts_at,
  ends_at, status` — la misma forma que `UpcomingSession` ya usada en el front.
- Respuesta: `{ "sessions": [ ... ] }`.

### B. Frontend — card Agenda con toggle Día / Semana / Mes

**Store** (`lib/stores/trainerStore.ts`):
- Estado nuevo: `agendaSessions: UpcomingSession[]`, `agendaLoading: boolean`.
- Acción nueva: `fetchAgendaSessions(from: string, to: string)` → llama al
  endpoint y guarda `agendaSessions`.

**Card Agenda** (`trainer/dashboard/page.tsx`, componente `AgendaTimeline` y
alrededores): el header gana una **pill** de 3 segmentos — Día · Semana · Mes —
con estado local `view: 'dia' | 'semana' | 'mes'` (default `'dia'`).

Al montar y al cambiar de vista/navegación, la card pide a `fetchAgendaSessions`
el rango de la vista activa:
- **Día:** rango = hoy. Render: el timeline por hora actual (sin cambios de
  diseño), pero alimentado por `agendaSessions` en vez de
  `dashboardStats.upcoming_sessions` — esto además levanta el límite de 5.
- **Semana:** rango = lunes a domingo de la semana visible. Render:
  `AgendaWeekStrip` — fila de 7 celdas (Lun–Dom), cada celda con número de día
  e indicador (punto + cantidad de sesiones) si tiene sesiones; el día de hoy
  resaltado. Flechas ‹ › para semana anterior / siguiente.
- **Mes:** rango = primer a último día del mes visible. Render:
  `AgendaMonthGrid` — grilla de calendario mensual (semana empieza lunes),
  cada día con indicador si tiene sesiones; hoy resaltado. Flechas ‹ › para
  mes anterior / siguiente.

`AgendaWeekStrip` y `AgendaMonthGrid` son componentes nuevos en
`app/components/trainer/`, a medida para "marcar días con sesiones + click en
día → callback `onSelectDay(date)`". No se reusa ni se modifica
`SessionMiniCalendar` (acoplado a `NotesTab`: un solo cliente y selección de
una sesión).

En Semana y Mes, click en un día → abre el modal de la Sección C con la fecha
seleccionada.

### C. Modal de resumen del día

Al seleccionar un día (en Semana o Mes): modal centrado.
- Encabezado: fecha larga ("Miércoles 20 de mayo") + "N sesiones".
- Cuerpo: lista de las sesiones de ese día — por fila `hora · cliente ·
  paquete · pill de estado`. Cada fila es un link a
  `/trainer/clients/client?id=<customer_id>`.
- Si el día no tiene sesiones: estado vacío ("Sin sesiones este día").
- Cierra con click en el backdrop y con un botón de cierre.
- Reusa el patrón de overlay/modal ya existente en el rol trainer
  (`ResponsiveSheet`): bottom sheet en `<xl`, modal centrado en `xl+`.

## Fuera de alcance

- Crear, editar o cancelar sesiones desde la agenda — es sólo visualización.
- Navegación de la vista Día (queda fija en hoy).
- Cambios al `SessionMiniCalendar` existente o a `NotesTab`.
- Drag & drop, vista de franja horaria semanal tipo grilla completa.

## Criterios de aceptación

1. La card Agenda muestra una pill Día / Semana / Mes; Día es la vista inicial.
2. En Día se ve el timeline por hora de hoy con **todas** las sesiones del día
   (ya no tope de 5).
3. En Semana se ven 7 celdas Lun–Dom con indicador de sesiones por día; las
   flechas ‹ › cambian de semana y refrescan los datos.
4. En Mes se ve el calendario del mes con indicador por día; las flechas ‹ ›
   cambian de mes y refrescan los datos.
5. Click en un día con sesiones (Semana o Mes) abre el modal con la lista
   `hora · cliente · paquete · estado`; cada fila navega al detalle del cliente.
6. Click en un día sin sesiones abre el modal con el estado vacío.
7. `GET /api/trainer/agenda/` responde 403 a no-trainers y 400 a rangos
   inválidos o que excedan 62 días.
8. En `<xl` el modal es bottom sheet; en `xl+` es modal centrado.

## Verificación

- `cd backend && pytest core_app/tests/views/` (slice del endpoint nuevo) —
  corre en CI.
- `cd frontend && npm run build` — compila el static export.
- Verificación manual en `/trainer/dashboard`: recorrer las 3 vistas, navegar
  semanas/meses, abrir el modal en días con y sin sesiones, a 375 / 768 /
  1280px.
- Tests en CI (unit + e2e) sin regresión.
