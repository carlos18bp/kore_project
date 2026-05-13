# Diseño — Disponibilidad calculada (eliminar `AvailabilitySlot`)

- **Fecha:** 2026-05-13
- **Autor:** brainstorming Codex/Claude + gustavop-dev
- **Estado:** aprobado para escribir plan de implementación
- **Rama de trabajo:** se decide al planear (este refactor NO incluye el hotfix intermedio; ver "Decisiones tomadas").

---

## 1. Problema

El módulo de agendamiento materializa una fila de base de datos por cada slot de 15 minutos por cada entrenador (`AvailabilitySlot`), y la tabla tiene un `UniqueConstraint(('starts_at', 'ends_at'))` **global, sin incluir `trainer`**. Consecuencias:

1. **Corrección (el bug reportado):** un segundo entrenador no puede tener slots a las mismas horas que el primero. Al sembrar a "Carlos Mendoza" (trainer id=3), sus filas Lun–Vie chocaron con las del entrenador 1 vía `get_or_create(starts_at, ends_at, ...)` y solo le quedaron los sábados. Resultado: `guperezp@unal.edu.co` (asignado a ese entrenador) ve horarios entre semana en el frontend que no existen en el backend; al confirmar, la resolución de slot falla con `"El horario ya no está disponible. Intenta con otro."`
2. **Escalabilidad:** ~1.100 filas materializadas por entrenador en todo momento (las 6.134 del entrenador 1 son porque nunca se podaron las pasadas — abarca Nov-2025 → Sep-2026), más un cron diario `maintain_slots` que las poda y rellena. Crece linealmente con N entrenadores y no representa ningún dato real.
3. **Mantenibilidad:** el horario de trabajo está duplicado en tres sitios — `slot_schedule.WEEKLY_SCHEDULE`, el `WEEKDAY_WINDOWS` del frontend (`book-session/page.tsx`), y los args de los comandos. El frontend re-implementa la generación de slots → drift → el bug de arriba. Además hay un bug de zona horaria: el frontend construye horas con `new Date('2026-05-16T06:00:00')` en la zona del navegador, no en `America/Bogota`.

## 2. Objetivo

Reemplazar la disponibilidad materializada por **disponibilidad calculada**: el horario de trabajo es una única definición central; el backend calcula al vuelo los horarios libres de un entrenador (restando reservas activas ± buffer de viaje, y los cortes de pasado / 16h de anticipación / 30 días de horizonte); el frontend solo pide, pinta y postea la elección. Se elimina `AvailabilitySlot`, el cron de mantenimiento y la duplicación del horario.

## 3. Decisiones tomadas (durante el brainstorming)

- **Un solo horario fijo global** para todos los entrenadores (no configurable por entrenador). Lo único propio de cada entrenador son sus reservas.
- **Sin bloqueos ad-hoc por ahora** (vacaciones / día libre): la disponibilidad = horario fijo − reservas activas ± buffer − cortes. Si luego se necesita bloquear rangos, se agrega una tabla de excepciones sin romper nada. (YAGNI.)
- **Enfoque C — refactor completo a disponibilidad calculada, sin hotfix intermedio.** Producción queda con el bug del 2º entrenador hasta que esto aterrice (decisión confirmada: no se mete el hotfix del `UniqueConstraint` como primer commit; vamos directo al refactor).
- **La API devuelve horas de inicio discretas**, no intervalos. Un día tiene ≤46 candidatas; no pesa, y mantiene toda la lógica (ventanas, duración, paso, buffer, 16h, 30d) en el backend.
- **`/api/availability/` devuelve solo los días que tienen al menos una hora libre** (no se incluyen días vacíos con `[]`): si un día no aparece en `days`, no hay disponibilidad ese día.
- **Anti-doble-reserva: cinturón Y tirantes** — un `UniqueConstraint` parcial en `Booking` + `select_for_update` con re-chequeo de disponibilidad dentro de la transacción.
- **`/api/availability/` sin `?trainer=`** usa el entrenador asignado del customer (el front igual lo pasa explícito).
- **No se renombra el archivo** `core_app/services/slot_schedule.py` (para no mover imports); su contenido se reescribe.
- **Granularidad de inicio:** se mantiene el paso de 15 minutos (7:15, 7:30, 7:45…). El cliente solo elige de la lista que el backend ya filtró; no elige duración (la duración la pone el entrenador, default 60 min). La fragmentación de agenda que esto produce es comportamiento actual y se mantiene; reducirla (p.ej. solo inicios en hora cerrada) queda anotado como decisión de producto futura, fuera de alcance.

## 4. Arquitectura objetivo

```
┌─ Fuente de verdad: core_app/services/slot_schedule.py (reescrito) ───────────┐
│  WEEKLY_SCHEDULE = {0:[(5,13),(16,21)], …, 5:[(6,13)]}   ← compartido por todos │
│  SESSION_MINUTES (default 60; se usa trainer.session_duration_minutes si existe)│
│  SLOT_STEP_MINUTES = 15                                                        │
│  MIN_ADVANCE_HOURS = 16                                                        │
│  BOOKING_HORIZON_DAYS = 30                                                     │
│  TRAVEL_BUFFER_MINUTES = 45                                                    │
│  BUSINESS_TZ = ZoneInfo('America/Bogota')                                       │
│                                                                                │
│  compute_available_start_times(trainer, date_from, date_to, *, now=None)       │
│      → dict[date, list[datetime]]   (datetimes en UTC, aware)                   │
│  is_start_time_available(trainer, starts_at, *, now=None) -> bool               │
│  session_window(trainer, starts_at) -> (starts_at, ends_at)                     │
└────────────────────────────────────────────────────────────────────────────────┘
        │ expand(WEEKLY_SCHEDULE, [date_from, date_to]) en BUSINESS_TZ
        ▼
   candidatas: [t0, t1, t2, …]  ──restar──▶  Booking (PENDING|CONFIRMED) del trainer
        │  - quitar: ends ≤ now ; starts < now+16h ; starts ≥ now+30d            ── ±45m buffer ──
        │  - quitar: candidata que solape [b.starts_at − 45m, b.ends_at + 45m]
        ▼
   GET /api/availability/?trainer=&from=&to=  →  { trainer_id, session_minutes, days: {fecha: [iso,…]} }

   POST /api/bookings/  { trainer_id, starts_at, subscription_id, package_id }
        → tx: select_for_update(TrainerProfile)
               assert is_start_time_available(trainer, starts_at)
               assert subscription.sessions_remaining > 0  (si hay sub)
               crear Booking(starts_at, ends_at=starts_at+SESSION_MINUTES, trainer, …)
               decrementar sub ; encadenar booking del invitado (duo) ; emails + .ics
```

`AvailabilitySlot` desaparece por completo. `Booking` guarda su propia ventana.

## 5. Modelo de datos

### 5.1 `Booking` (`core_app/models/booking.py`)

- **Quitar:** `slot = models.ForeignKey(AvailabilitySlot, on_delete=PROTECT, related_name='bookings')`.
- **Agregar:**
  ```python
  starts_at = models.DateTimeField(db_index=True)
  ends_at   = models.DateTimeField(db_index=True)
  ```
- `trainer` se mantiene como está (`ForeignKey('core_app.TrainerProfile', on_delete=SET_NULL, null=True, blank=True)`) por compatibilidad con reservas legacy; toda reserva nueva lo setea.
- **Constraints nuevas en `Meta`:**
  ```python
  models.CheckConstraint(condition=Q(ends_at__gt=F('starts_at')), name='booking_ends_after_starts'),
  models.UniqueConstraint(
      fields=('trainer', 'starts_at', 'customer'),
      condition=~Q(status='canceled'),
      name='unique_active_trainer_session_per_customer',
  ),
  ```
  Se incluye `customer` en la constraint para no romper las reservas duo (anfitrión e invitado comparten `trainer` + `starts_at`). La regla "un entrenador no puede tener dos clientes distintos no-duo a la misma hora" se garantiza en el servicio bajo `select_for_update` (la constraint es solo el cinturón contra duplicados exactos del mismo cliente / condiciones de carrera).
- `ordering` puede pasar a `('-starts_at',)` o quedarse en `('-created_at',)` — decisión menor, se deja `('-created_at',)` para no alterar APIs que dependan del orden actual.

### 5.2 `AvailabilitySlot` (`core_app/models/availability.py`)

- Se **elimina** el modelo y el archivo (junto con sus constraints `slot_ends_after_starts` y `unique_slot_window`). Se quita de `core_app/models/__init__.py`.

## 6. Servicio — `core_app/services/slot_schedule.py` (reescrito, mismo nombre de archivo)

- Mantiene `WEEKLY_SCHEDULE` (igual), `BOOKING_HORIZON_DAYS = 30`, `MAX_ROLLOVER_SESSIONS` (si lo usa subscription_cleanup, se conserva).
- Nuevas constantes: `SESSION_MINUTES = 60`, `SLOT_STEP_MINUTES = 15`, `MIN_ADVANCE_HOURS = 16`, `TRAVEL_BUFFER_MINUTES = 45`, `BUSINESS_TZ = ZoneInfo('America/Bogota')`.
- **Borrar:** `generate_slots_for_trainer`, `SLOT_MAINTENANCE_FILL_DAYS`.
- **Nuevas funciones (puras, testeables):**
  - `_expand_schedule(date_from, date_to, *, step_minutes, session_minutes, tz) -> Iterator[datetime]` — despliega `WEEKLY_SCHEDULE` sobre el rango y emite cada hora de inicio candidata (en UTC) tal que `[start, start+session]` cabe dentro de su franja.
  - `_session_minutes_for(trainer) -> int` — `getattr(trainer, 'session_duration_minutes', None) or SESSION_MINUTES`.
  - `compute_available_start_times(trainer, date_from, date_to, *, now=None) -> dict[date, list[datetime]]` — candidatas menos: `ends ≤ now`, `starts < now + MIN_ADVANCE_HOURS`, `starts ≥ now + BOOKING_HORIZON_DAYS`, y candidatas que solapen `[b.starts_at − buffer, b.ends_at + buffer]` para cada `Booking` activo (`PENDING`/`CONFIRMED`) del trainer en el rango. **Una sola query** a `Booking`. Agrupa por fecha local (`BUSINESS_TZ`).
  - `is_start_time_available(trainer, starts_at, *, now=None) -> bool` — `starts_at` debe (a) ser exactamente una de las candidatas que `_expand_schedule` produce para ese día, (b) pasar los cortes, (c) no solapar reservas activas ± buffer. Reusa la misma lógica que `compute_available_start_times`.
  - `session_window(trainer, starts_at) -> tuple[datetime, datetime]` — `(starts_at, starts_at + _session_minutes_for(trainer))`.

### 6.1 `core_app/services/booking_rules.py`

- `has_trainer_travel_buffer_conflict(slot, trainer=None, exclude_booking_id=None)` → reescribir a `has_trainer_travel_buffer_conflict(trainer, starts_at, ends_at, *, exclude_booking_id=None)`. Se mantiene `ACTIVE_BOOKING_STATUSES` y `TRAVEL_BUFFER_MINUTES` (o se importa de slot_schedule, evitar duplicar).
- `resolve_effective_trainer_id`, `build_trainer_buffer_slot_conflict_q` → se **borran** (ya no hay slots).

## 7. API

### 7.1 `GET /api/availability/` (reemplaza `AvailabilitySlotViewSet`)

- Vista nueva: `AvailabilityView(APIView)`, `permission_classes = [IsAuthenticated]`.
- Query params: `trainer` (int, opcional → si falta y el usuario es customer, usa su entrenador asignado; si no hay → 400), `from` (YYYY-MM-DD, opcional → hoy), `to` (YYYY-MM-DD, opcional → `from + 30d`). El rango se acota a un máximo de `BOOKING_HORIZON_DAYS` días; fechas malformadas → 400.
- Respuesta 200:
  ```json
  {
    "trainer_id": 3,
    "session_minutes": 60,
    "days": {
      "2026-05-16": ["2026-05-16T11:00:00Z", "2026-05-16T11:15:00Z", "..."],
      "2026-05-23": ["..."]
    }
  }
  ```
  **Solo se incluyen los días con al menos una hora libre** — un día sin disponibilidad simplemente no aparece como clave en `days`. (El front deriva los días seleccionables del calendario de las claves de `days`.)
- Se **borran:** `AvailabilitySlotViewSet`, `AvailabilitySlotSerializer`, el registro del router `availability-slots` en `core_app/urls/api_urls.py`, `AvailabilitySlotAdmin`. El admin de Django pierde la gestión de slots (ya no hay nada que gestionar).

### 7.2 `POST /api/bookings/` (`BookingSerializer`, `core_app/serializers/booking_serializers.py`)

- **Write fields:** `package_id`, `starts_at` (DateTimeField), `trainer_id` (opcional → si el customer tiene asignado, se usa ese y se ignora/valida el enviado), `subscription_id` (opcional).
- **Read:** exponer `starts_at`, `ends_at`, `trainer` (nested), `package` (nested), `subscription_id_display`, `program_day_exercises`, `status`, etc. — **quitar** el `slot` nested.
- `program_day_exercises`: cambiar `obj.slot.starts_at.date()` → `obj.starts_at.date()`.
- `validate()` reescrito:
  1. Si el usuario es customer: si no tiene `assigned_trainer` → `NoTrainerAssignedException` (se conserva, con su `code: 'no_trainer_assigned'`); si tiene, `attrs['trainer'] = assigned`.
  2. `is_start_time_available(trainer, starts_at)` → si no, `ValidationError({'starts_at': '<mensaje claro>'})`. (Esto cubre: fuera de horario, en el pasado, < 16h, ≥ 30d, ya ocupado, choca buffer/overlap.)
  3. Si hay `subscription` y `sessions_remaining <= 0` → `ValidationError({'subscription_id': '...'})`.
  4. Setear `attrs['ends_at']` vía `session_window`.
- `create()` reescrito:
  ```python
  with transaction.atomic():
      TrainerProfile.objects.select_for_update().get(pk=trainer.pk)   # cierra la puerta sobre el entrenador
      if not is_start_time_available(trainer, starts_at, now=timezone.now()):
          raise ValidationError({'starts_at': 'Ese horario ya no está disponible.'})
      if subscription:
          sub = Subscription.objects.select_for_update().get(pk=subscription.pk)
          if sub.sessions_remaining <= 0: raise ValidationError({'subscription_id': '...'})
          sub.sessions_used = F('sessions_used') + 1; sub.save(update_fields=['sessions_used'])
          validated_data['subscription'] = sub
      booking = Booking.objects.create(customer=customer, status=PENDING, starts_at=starts_at,
                                       ends_at=ends_at, **validated_data)
  ```
  (`_maybe_create_guest_booking` se invoca como hoy, desde la vista o el create, manteniendo el comportamiento duo.)

### 7.3 `core_app/views/booking_views.py`

- `cancel`: quitar el bloque que hace `slot.is_blocked = False`; basta con marcar `status = CANCELED` (+ `_cancel_guest_booking_for_slot`, renombrado conceptualmente — sigue cancelando la del invitado por `trainer`+`starts_at`). La hora vuelve a estar libre por cálculo.
- `reschedule`: body pasa de `{"new_slot_id": int}` a `{"new_starts_at": "<iso>"}`. Lógica:
  1. validar que la sesión actual está a ≥24h (igual que hoy, usando `booking.starts_at`);
  2. `with transaction.atomic(): select_for_update(TrainerProfile)`; cancelar la reserva vieja; `assert is_start_time_available(trainer, new_starts_at)`; crear la nueva (`subscription` igual, sin tocar el contador); encadenar duo.
  3. Mensajes de error claros (fuera de horario / ya ocupado / >30d / <24h).
- `upcoming_reminder`, cualquier `order_by('slot__starts_at')`, `filter(slot__starts_at__gt=...)`, `select_related('slot')` → cambiar a `starts_at` directo.
- `occupied_day` (`GET /api/bookings/occupied-day/`): se **elimina** — el frontend ya no lo necesita (la API de disponibilidad devuelve solo lo libre). Verificar que ningún otro consumidor lo use antes de borrarlo.

### 7.4 Otros consumidores backend

- `core_app/services/ics_generator.py`: `slot.starts_at` / `slot.ends_at` → `booking.starts_at` / `booking.ends_at` (quitar `slot = booking.slot`).
- `core_app/services/subscription_cleanup.py`: `slot__starts_at__gte=now` → `starts_at__gte=now`; quitar el side-effect de desbloquear slots; quitar el import de `AvailabilitySlot`.
- `core_app/admin.py`: quitar `AvailabilitySlotAdmin` y el import; en `BookingAdmin`, quitar `slot` de `list_display`/`autocomplete_fields` y añadir `starts_at`.
- `core_app/serializers/__init__.py`, `core_app/views/__init__.py`, `core_app/models/__init__.py`: quitar los exports de `AvailabilitySlot*`.

## 8. Frontend

- `app/(app)/book-session/page.tsx`:
  - **Quitar:** `WEEKDAY_WINDOWS`, `slotsForDate` (generación de slots virtuales), `hasTravelBufferConflict`, `toDateKey` (si solo lo usaba eso), `AVAILABILITY_HORIZON_DAYS`/`SLOT_STEP_MINUTES`/`TRAVEL_BUFFER_MINUTES`/`DEFAULT_SESSION_DURATION_MINUTES` locales, y todo el bloque de "resolución de slot virtual → real" en `handleConfirm` (con su mensaje `'El horario ya no está disponible. Intenta con otro.'`).
  - **Añadir:** al montar / al resolver `trainer.id`, `fetchAvailability(trainerId, from, to)`; derivar `availableDates` (fechas con horas) y la lista de horas del día seleccionado de esa respuesta; el calendario y `TimeSlotPicker` pintan eso.
  - `handleConfirm`: `createBooking({ package_id, starts_at: selectedSlot.starts_at, trainer_id, subscription_id })`; en error 400, mostrar `detail` y re-`fetchAvailability`.
  - Reschedule: `rescheduleBooking(bookingId, newStartsAt)`.
  - Bug de TZ: resuelto — la API devuelve timestamps absolutos (UTC `Z`); el front solo formatea a hora Bogotá para mostrar (`toLocaleString('es-CO', { timeZone: 'America/Bogota' })` donde aplique).
  - El `showRescheduleNoAvailability` y el aviso de "no hay disponibilidad" siguen, pero alimentados por la respuesta de `fetchAvailability` del entrenador de la reserva.
- `lib/stores/bookingStore.ts`: `fetchSlots` → `fetchAvailability` (guarda `availabilityByDay: Record<string, string[]>`); `fetchTrainerDayBookings` → **eliminar**; `createBooking`/`rescheduleBooking` mandan `starts_at` / `new_starts_at`; el tipo `Slot` se reduce o se reemplaza por `{ starts_at: string; ends_at: string; trainer_id: number | null }` derivado.
- Componentes que leen `booking.slot.starts_at` / `.ends_at` → `booking.starts_at` / `booking.ends_at`: barrer `TimeSlotPicker`, `BookingConfirmation`, `BookingSuccess`, `UpcomingSessionsCard`, `UpcomingSessionReminder`, `SessionDetailModal`, y los usos en dashboard. (Cambio mecánico, pero hay que recorrerlo todo — incluir un grep en el plan.)
- i18n: quitar las claves de mensajes que dejan de usarse; no añadir nuevas (los errores del backend se muestran tal cual, como hoy).

## 9. Migración de datos y limpieza

### 9.1 Migración (irreversible en la práctica)

1. **Pre-limpieza recomendada (manual, en una ventana de bajo tráfico antes de migrar):** purgar las filas de slots pasados / huérfanas del entrenador 1 (~6.000) que nunca se podaron, para que la migración sea trivial. Verificar primero si existen reservas activas con `slot` inconsistente o sin `slot`.
2. Migración 1: añadir `Booking.starts_at` / `Booking.ends_at` como **nullable**.
3. Migración 2 (data migration): para cada `Booking`, `starts_at = slot.starts_at`, `ends_at = slot.ends_at`. (Reservas sin `slot` — si las hay tras la verificación — se manejan caso a caso; idealmente no quedan.)
4. Migración 3: volver `starts_at` / `ends_at` **NOT NULL**; quitar el campo `slot`; añadir las constraints nuevas de `Booking`.
5. Migración 4: `DeleteModel(AvailabilitySlot)` (se va con sus constraints).
6. **No tocar migraciones antiguas** (regla del repo); todo va en migraciones nuevas.

### 9.2 Qué se borra

- Comandos: `core_app/management/commands/create_fake_slots.py`, `create_trainer_weekday_slots.py`, `maintain_slots.py`.
- La tarea periódica que invocaba `maintain_slots` (revisar `core_app/tasks.py` / config de huey / cron del servidor) — quitarla, o fallará a diario buscando un comando inexistente.
- `AvailabilitySlotAdmin`, `AvailabilitySlotSerializer`, ruta `availability-slots` del router.
- `core_app/models/availability.py` (archivo entero).

### 9.3 Qué se actualiza (no se borra)

- `create_fake_bookings.py`: ya no crea ni "bloquea" slots; crea `Booking` con `starts_at` derivado de `WEEKLY_SCHEDULE` (puede reusar `_expand_schedule`).
- `create_test_users.py`: quitar `_create_slots`; el resto igual.
- `delete_fake_data.py`: quitar la línea que borra `AvailabilitySlot`.
- `create_fake_diagnostics.py` y cualquier otro comando: revisar si referencian slots; ajustar.

## 10. Pruebas (en lotes pequeños — máx. 20 tests / 3 comandos por ciclo; nunca la suite completa)

- **Servicio `slot_schedule` (golden values):**
  - Semana limpia: `compute_available_start_times` para una semana sin reservas devuelve exactamente las cantidades esperadas (46 horas Lun–Vie, 25 sábado, 0 domingo), con las horas correctas (primera y última de cada franja).
  - Con una reserva en medio: la reserva 7:15→8:15 + buffer 45m tacha las candidatas en `(5:30, 9:00)` → starts 5:45…8:45 fuera de la lista.
  - Corte de 16h: una candidata a `now + 15h` no aparece; a `now + 17h` sí.
  - Horizonte de 30d: candidata en el día 30 no aparece; en el día 29 sí.
  - Dos entrenadores: una reserva del entrenador A no afecta la disponibilidad del entrenador B (el caso del bug).
  - `is_start_time_available`: True para una hora válida; False para una fuera de grilla (7:07), pasada, dentro de 16h, o que choca con una reserva.
- **Endpoint `GET /api/availability/`:** respuesta con `days` correcto; sin `trainer` y usuario customer con asignado → usa el asignado; sin `trainer` y sin asignado → 400; rango > 30d → acotado; no autenticado → 401; fecha malformada → 400.
- **Reserva:** crear con hora válida (201, sesión descontada, `ends_at` = inicio + 60); hora ya ocupada → 400; hora fuera de horario → 400; sin sesiones en el plan → 400; customer sin entrenador → `no_trainer_assigned`; cancelar → la hora vuelve a aparecer en `/availability/`; reprogramar válido (201, sin tocar contador); reprogramar < 24h → 400; doble reserva concurrente impedida (test del `select_for_update` + constraint).
- **Migración de datos:** con reservas existentes pre-migración, tras migrar `starts_at`/`ends_at` quedan iguales a las del slot; conteo de reservas activas con hora válida == pre-migración.
- **Frontend:** la página de booking pinta lo que devuelve `/availability/` y postea `starts_at`; el store (`fetchAvailability`, `createBooking`); un par de componentes que ahora leen `booking.starts_at`. (Slice tocado, no suite completa, no E2E completo.)

## 11. Riesgos

- **Reservas duo:** la `UniqueConstraint` debe incluir `customer` (lo hace) para no rechazar la reserva paralela del invitado. Verificar el flujo duo en pruebas.
- **Reservas legacy sin `slot` o con `slot` inconsistente:** detectar antes de migrar; si existen, decidir caso a caso.
- **Sin hotfix intermedio:** producción sigue con el bug del 2º entrenador hasta que esto aterrice (decisión confirmada: no se mete hotfix; se va directo al refactor). Mitigación operativa mientras tanto: si urge, un admin puede reasignar manualmente a los clientes afectados al entrenador 1, que sí tiene disponibilidad completa.
- **Consumidores ocultos de `AvailabilitySlot` o de `occupied-day`:** grep exhaustivo en el plan antes de borrar; incluir frontend (`bookingStore`, componentes) y cualquier test.
- **Zona horaria:** la API debe devolver siempre datetimes aware en UTC; el frontend nunca debe volver a construir fechas "locales" sin `timeZone`.
- **Orden de migraciones / despliegue:** el deploy debe correr migraciones antes de servir el nuevo código (el `Booking.slot` desaparece). Coordinar.

## 12. Fuera de alcance

- Horarios configurables por entrenador.
- Bloqueos ad-hoc (vacaciones / día libre).
- Cambiar la granularidad de inicio (p.ej. solo horas cerradas) para reducir fragmentación — anotado como decisión de producto futura.
- El hotfix intermedio del `UniqueConstraint` — descartado; se va directo al refactor.
