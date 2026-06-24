# Suscripción única por cliente + historial de renovaciones

**Fecha:** 2026-06-22
**Estado:** Diseño aprobado — pendiente de plan de implementación
**Autor:** gustavop-dev (con Claude)

## Problema

Hoy una persona puede acumular muchos registros de `Subscription` a lo largo del
tiempo. En `/admin-platform/subscriptions` el admin ve **N filas para el mismo
cliente** (una por cada término), lo cual es confuso. Al renovar manualmente una
suscripción expirada/cancelada, el sistema **crea una fila nueva y deja la vieja
expirada** — así que "después de renovar sigue expirada" y aparece otra
suscripción más. Lo mismo se filtra al rol cliente, que incluso ve un selector de
píldoras multi-suscripción.

El objetivo: a ojos del usuario (admin y cliente) **hay una sola suscripción por
cliente** (su membresía), y las renovaciones son un **historial de periodos**
dentro de ese detalle ("renovó del periodo X al Y").

## Hallazgos del código actual

| Camino | Comportamiento hoy | Archivo |
|---|---|---|
| Compra inicial (webhook Wompi) | Crea fila `Subscription` | `core_app/views/wompi_views.py` ~230-391 |
| Facturación recurrente (Huey 08:00 UTC) | **Renueva EN SITIO**: empuja `expires_at`, avanza `next_billing_date`, resetea sesiones con rollover | `core_app/tasks.py` 31-162 |
| Renovación manual admin (`admin-renew`) | **Crea fila nueva** + marca la vieja `expired` ❌ | `core_app/views/subscription_views.py` 1271-1317 |
| Cambio de plan (`evolve`) | Muta el `package` en la **misma fila** | `core_app/services/admin_subscription_service.py` 39-167 |

Conclusión clave: la fila de `Subscription` **ya funciona como membresía
persistente** para recurrente y evolve. El único que rompe la ilusión es la
renovación manual, más los datos viejos con varias filas y el selector de
píldoras del cliente.

FKs que impiden un colapso físico de filas (por eso NO se hace refactor profundo):
`Booking.subscription`, `Payment.subscription`, `SubscriptionGuest`, todos
apuntan a la fila concreta de cada término y son `PROTECT`.

## Decisiones de diseño

1. **Identidad:** una membresía por cliente. La fila `Subscription` es la
   membresía estable (ya lo es de facto).
2. **Alcance:** punto medio quirúrgico, NO refactor profundo de modelo. Se evita
   repuntar FKs y migraciones destructivas.
3. **Historial:** timeline completo (compra inicial + renovaciones manuales/
   automáticas + cambios de plan).
4. **Renovar:** se mantiene la restricción actual — el admin solo puede renovar
   si la suscripción está `expired` o `canceled`.
5. **Datos legacy:** en staging se re-seedea con `fake-data-refresh` al final.
   En prod, una eventual migración de datos queda fuera de alcance.

## Arquitectura de la solución

### 1. Renovación manual → extender EN SITIO

Reescribir `admin_renew` (`subscription_views.py` 1271-1317) para que, en vez de
crear una fila nueva, **mute la suscripción existente** replicando la lógica de
la facturación recurrente:

- `status = ACTIVE`
- `starts_at = now` (inicio del nuevo periodo)
- `expires_at = now + package.validity_days`
- rollover de sesiones: `rollover = min(max(sessions_total - sessions_used, 0), MAX_ROLLOVER_SESSIONS)`;
  `sessions_total = package.sessions_count + rollover`; `sessions_used = 0`
- `billing_failed_at = None`
- Se sigue creando el `Payment` CASH (igual que hoy), atado a la **misma**
  suscripción.
- **Nuevo:** se escribe un registro en `SubscriptionRenewal` (ver abajo).

Precondición sin cambios: solo si `status ∈ {expired, canceled}` (403/400 en otro
caso). La respuesta devuelve la **misma** suscripción (ya no un 201 con fila nueva).

### 2. Tabla additiva `SubscriptionRenewal` (historial)

Modelo nuevo, **append-only**, que nada del sistema lee salvo la vista de detalle
nueva (cero riesgo para la lógica existente):

```
SubscriptionRenewal(TimestampedModel)
    subscription   FK -> Subscription (related_name='renewals', on_delete=CASCADE)
    kind           CharField choices: INITIAL, MANUAL, AUTOMATIC, PLAN_CHANGE
    period_start   DateTimeField
    period_end     DateTimeField
    sessions_granted  PositiveIntegerField
    payment        FK -> Payment (null=True, on_delete=SET_NULL)
    package        FK -> Package (on_delete=PROTECT)   # plan vigente en ese periodo
    actor_email    CharField(blank=True)               # admin que la ejecutó (manual/plan_change)
    note           CharField(blank=True)
    created_at / updated_at (de TimestampedModel)
    Meta: ordering = ('-period_start',)
```

Se escribe un `SubscriptionRenewal` en:
- **Compra inicial** (webhook Wompi APPROVED) → `kind=INITIAL`
- **Renovación manual** (`admin_renew`) → `kind=MANUAL`
- **Renovación automática** (task recurrente, charge APPROVED) → `kind=AUTOMATIC`
- **Cambio de plan** (`evolve_subscription_for_admin`) → `kind=PLAN_CHANGE`

Migración: solo crea la tabla nueva. No altera tablas existentes.

### 3. Lista admin = una entrada por cliente

`subscription_views.py` list (admin): devolver **una membresía por cliente**.
Estrategia: por cada cliente, elegir la suscripción "canónica" = la `active` más
reciente; si no hay activa, la más reciente por `created_at`. Las demás filas del
cliente NO se borran — quedan disponibles como periodos pasados en el detalle.

- Implementación: anotar/agrupar por `customer_id` y quedarse con la canónica.
  Mantener filtros existentes (search, status, category) operando sobre la
  canónica. Mantener `category-counts` coherente (contar clientes, no filas).
- El frontend (`app/admin-platform/subscriptions/page.tsx` + `SubRow.tsx`) deja
  de mostrar `#{id}` por término; muestra el cliente como entidad única.

### 4. Detalle admin = membresía + timeline

`SubscriptionDetailPage.tsx`:
- El hero y "Ajustes administrativos" siguen operando sobre la suscripción
  canónica (status, sesiones, vencimiento) — sin cambios funcionales.
- Nueva sección **"Historial de renovaciones"**: timeline que combina
  (a) los `SubscriptionRenewal` de la membresía y (b) los términos legacy del
  cliente (filas viejas con `starts_at`/`expires_at`/sesiones) como periodos
  pasados. Cada item: tipo (compra/renovación/cambio de plan), periodo desde→
  hasta, sesiones, paquete, pago, quién.
- Nuevo endpoint: `GET /subscriptions/{id}/renewal-history/` que arma y devuelve
  ese timeline ordenado desc por `period_start`.
- "Renovación manual" (DarkActionCard) sin cambios de UI; cambia solo el copy del
  mensaje de éxito (ya no "se creó una nueva", sino "se extendió el periodo").

### 5. Vista cliente = una suscripción

`app/(app)/subscription/page.tsx`:
- Quitar el selector de píldoras multi-suscripción para el caso normal.
- Mostrar **un** hero (membresía actual) + sección "Historial de renovaciones"
  (consumiendo el mismo endpoint de timeline, alcance del propio cliente).
- Excepción: si el cliente es **invitado** (`is_guest`) en el plan de otra
  persona, eso sí es una suscripción distinta y se mantiene como tarjeta aparte.
- `subscriptionStore.fetchSubscriptions`: devolver la membresía propia + (si
  aplica) la(s) suscripción(es) donde es invitado, sin listar términos pasados
  como suscripciones separadas.

### 6. Datos legacy / fake data

Al cerrar la implementación, re-seedear staging con `fake-data-refresh` para que
los datos reflejen el nuevo modelo (una membresía + renovaciones). El comando de
fake data puede actualizarse para generar algunos `SubscriptionRenewal` de
ejemplo.

## Endpoints afectados

| Endpoint | Cambio |
|---|---|
| `POST /subscriptions/{id}/admin-renew/` | Extiende en sitio; ya no crea fila; escribe `SubscriptionRenewal` |
| `GET /subscriptions/` (admin) | Una entrada por cliente (canónica) |
| `GET /subscriptions/category-counts/` | Contar clientes, no filas |
| `GET /subscriptions/{id}/renewal-history/` | **NUEVO** — timeline de la membresía |
| `GET /subscriptions/` (cliente) | Membresía propia + subs de invitado; sin términos pasados |
| webhook Wompi / task recurrente / evolve | Escriben `SubscriptionRenewal` (additivo) |

## Testing (mínimo, por la regla de no correr suite completa)

- **Backend (golden/comportamiento):**
  - `admin_renew` extiende en sitio (misma PK), status→active, expiry+validity,
    rollover correcto, crea Payment CASH y un `SubscriptionRenewal(kind=MANUAL)`.
  - `admin_renew` sigue rechazando si la sub está `active`.
  - list admin devuelve una entrada por cliente con la canónica correcta.
  - `renewal-history` arma timeline (legacy + renovaciones) ordenado.
- **Frontend unit:** detalle renderiza sección de historial; vista cliente sin
  pills para caso de una membresía.
- **E2E:** flujo admin renovar → detalle muestra historial; cliente ve una sola
  suscripción. (Invocar `e2e-user-flows-check` al final.)

## Fuera de alcance

- Refactor profundo de modelo (Membership/Period + repuntar FKs).
- Migración de datos legacy en producción.
- Permitir renovación anticipada (estando activa).

## Riesgos y mitigaciones

- **Agrupación en lista oculta términos:** mitigado porque el detalle muestra el
  timeline completo; ninguna fila/pago/reserva se borra.
- **Doble fuente de historial (legacy rows + SubscriptionRenewal):** la vista de
  timeline las normaliza a un mismo shape; re-seed en staging reduce el legacy.
- **Coherencia de counts/filtros tras agrupar:** cubierto con tests de la lista.
