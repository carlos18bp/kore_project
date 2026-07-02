# Release July — Fase 2 Kore Health (Economía de Créditos y Gamificación)

Ruta de alto nivel de la Fase 2. Todos los módulos se construyen **sobre los datos y señales de Fase 1** — no hay refactorizaciones: solo nuevos listeners, nuevos modelos y nuevas vistas.

> **Rama base:** `july-release`. Cada parte se desarrolla en su propia rama `feat/<DDMMYYYY>-phase2-<parte>` con PR hacia `july-release` (convención: 1 PR activo a la vez, partes secuenciales por dependencia).
>
> **Documentos estructurados:** cada parte tendrá su documento detallado en esta carpeta (`01-motor-creditos.md`, `02-checkin-habitos.md`, …) que se redacta al iniciar esa parte. Este README es la ruta maestra.

---

## Mapa de partes y dependencias

| # | Parte | Depende de | Estado |
|---|-------|-----------|--------|
| 1 | Motor de Créditos Core (backend) | Señales Fase 1 | 🔨 En desarrollo |
| 2 | Check-in Diario + Hábitos | Parte 1 | ⏳ Pendiente |
| 3 | Vistas Cliente de Créditos | Parte 1 | ⏳ Pendiente |
| 4 | Tienda Interna | Parte 1 | ⏳ Pendiente |
| 5 | Calificación Post-Sesión | Parte 1 (créditos por calificar) | ⏳ Pendiente |
| 6 | Panel Trainer de Configuración | Partes 1 y 4 | ⏳ Pendiente |
| 7 | Analítica + KPIs | Partes 1–5 (datos acumulados) | ⏳ Pendiente |

---

## Parte 1 — Motor de Créditos Core (backend)

La fundación: modelos y lógica que todas las demás partes consumen.

- **Modelos**: balance de créditos por cliente, transacciones (ganancia/pérdida con acción origen, cantidad, fecha, descripción legible), configuración de valores por acción.
- **Reglas de ganancia**: asignación automática de créditos al detectar acciones completadas — entrenamiento del día, comidas registradas, check-in, hábitos, asistencia a sesión, hitos semanales. Se engancha sobre las señales existentes de Fase 1 sin modificarlas.
- **Reglas de pérdida**: descuento por inasistencia a sesión agendada (al cierre del día si el trainer no confirmó asistencia antes de las 23:55) y por reprogramación fuera de la ventana de anticipación definida por el trainer.
- **Sistema de rachas con bonos progresivos**: detección de días consecutivos activos usando el `ProgramProgress` de Fase 1; bonos automáticos al cruzar hitos de 3, 7, 14, 21 y 28 días, con mensaje visible para el cliente.
- **Configuraciones de dificultad predefinidas**: Fácil (créditos altos, descuentos bajos), Medio (balance estándar), Difícil (créditos moderados, descuentos significativos). El trainer selecciona una base y puede ajustar valores individuales.
- **Detección de inasistencia y reprogramación tardía**: tarea periódica (Huey) que evalúa al cierre del día; la reprogramación tardía se detecta al momento de reprogramar.
- **API**: endpoints de balance, historial de transacciones y configuración — base para las vistas de las partes 3 y 6.

## Parte 2 — Check-in Diario + Visibilidad de Créditos + Cámara de Rutina

- **Check-in diario enriquecido**: nivel de energía, ánimo, presencia de dolor y disposición para entrenar. Respuestas por tap, completable en menos de 30 segundos; otorga créditos al completarlo (evoluciona el registro de ánimo existente).
- **Visibilidad de créditos**: cada acción que otorga créditos muestra su "+X" dinámico, leído de la configuración del motor (personalizable por el trainer/admin; UI en Parte 6).
- **Bloque "Hoy ganas" en dashboard**: sección compacta con las acciones de crédito del día (check-in, hidratación, comidas, rutina), su estado y los créditos disponibles.
- **Flujo de cámara de rutina**: gate de consentimiento + capturas aleatorias por ejercicio con carga diferida; activa `require_workout_captures`.
- ⚠️ **Descope acordado (2026-07-02)**: hábitos de sueño y movilidad quedan fuera — sin PWA/wearables no hay forma de verificarlos y serían el único auto-reporte sin evidencia de la economía. La hidratación permanece (verificada con foto). Retomar junto al módulo PWA si se contrata.

## Parte 3 — Vistas Cliente de Créditos

- **Balance de créditos y racha**: vista principal del estado gamificado — créditos acumulados, racha actual, próximo bono y progreso hacia la siguiente recompensa de la tienda.
- **Historial de transacciones**: registro cronológico legible ("Completaste tu entrenamiento del martes", "No asististe a tu sesión del jueves").
- **Widget de créditos y racha en dashboard "Hoy"**: tarjeta compacta con saldo, racha y próximo bono; se actualiza al registrar cualquier acción.
- **Indicador visual de racha**: días de la semana con íconos de estado, contador de días consecutivos y barra de progreso hacia el siguiente hito.

## Parte 4 — Tienda Interna

- **Catálogo cliente**: productos y servicios canjeables con créditos — imagen, descripción, precio en créditos, saldo disponible; solicitud de canje con un clic y seguimiento del estado.
- **Tarjeta de ítem de tienda**: componente con imagen, nombre, descripción corta, precio, disponibilidad y botón de canje; indica claramente si el saldo alcanza.
- **Gestión del catálogo (trainer)**: crear, editar y desactivar ítems — nombre, descripción, imagen, precio en créditos, stock y tipo (servicio, producto físico, sesión adicional, descuento).
- **Aprobación de canjes (trainer)**: lista de solicitudes pendientes; aprobar o rechazar con nota explicativa; al aprobar, los créditos se descuentan automáticamente.

## Parte 5 — Calificación Post-Sesión

- **Flujo cliente**: tras la confirmación de asistencia por el trainer, prompt en el dashboard con tres preguntas rápidas por tap — energía al terminar (1-5), satisfacción general (1-5) y comentario opcional.
- **Widget modal**: aparece cuando hay una sesión reciente sin calificar, con fricción mínima.
- **Panel de calificaciones (trainer)**: rating promedio por mes, calificación por cliente, tendencia de satisfacción (subiendo/estable/bajando) y comentarios; clientes con tendencia decreciente marcados para atención prioritaria.

## Parte 6 — Panel Trainer de Configuración

- **Configuración de dificultad**: selección de base (Fácil/Medio/Difícil) con ajuste individual por acción; incluye **simulador** de créditos que acumularía un cliente tipo en un mes.
- **Ventana de reprogramación**: horas mínimas de anticipación para reprogramar sin penalización.
- **Vista de créditos por cliente**: balance e historial de transacciones por cliente — identifica saldos altos listos para canjear y pérdidas frecuentes por inasistencia.

## Parte 7 — Analítica + KPIs

- **Analítica de créditos y engagement**: ranking de créditos por cliente, inasistencias y pérdidas del período, historial de canjes aprobados, rachas activas con duración, satisfacción promedio con evolución semanal y detalle por cliente.
- **KPIs de la economía**: créditos emitidos vs canjeados, tasa de inasistencia del mes, número y % de clientes con racha ≥ 7 días, NPS de sesiones del mes.

---

## Fuera de alcance (módulos adicionales no seleccionados)

Los siguientes módulos llegaron en la propuesta con `selected: false` y **no se desarrollan en este release** salvo activación explícita del cliente:

PWA instalable con push, Módulo de Inteligencia Avanzada (IA), Integración con herramientas de marketing, Facturación electrónica DIAN, Pasarela internacional (Stripe), Pasarela regional para pago mixto, Email marketing (resumen semanal / racha en riesgo), Reportes y alertas vía correo/Telegram, Multi-idioma de tienda, Gift cards, Dark mode, Chat en vivo first-party.
