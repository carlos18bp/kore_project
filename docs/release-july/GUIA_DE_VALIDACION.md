# Guía de validación — Fase 2 Kore Health

Este documento reúne, en lenguaje sencillo, los flujos que puedes probar tú mismo
para validar cada funcionalidad nueva de la Fase 2. Lo iremos ampliando a medida
que se entreguen las siguientes partes, y al final tendrás aquí la recopilación
completa para revisar todo el sistema de créditos de principio a fin.

> **Cómo usar esta guía:** cada funcionalidad tiene su propia sección con cinco
> bloques: qué es, qué necesitas antes de empezar, el paso a paso, cómo saber que
> funcionó y qué hacer si algo no sale como esperabas.

---

## Parte 1 — Panel del entrenador

### Funcionalidad 1: Confirmar asistencia de una sesión

#### 1. ¿Qué es y para qué sirve?

Es la forma en que tú, como entrenador, le dices al sistema si tu cliente asistió
o no a su sesión de entrenamiento. Es como pasar lista al final del día: si el
cliente asistió, gana créditos; si no asistió, pierde algunos. Si se te olvida
confirmar, el sistema asume al final del día que el cliente no asistió — pero
tranquilo: si confirmas después, la penalización se le devuelve automáticamente.

#### 2. Antes de empezar

- Una cuenta de tipo **entrenador** con la que puedas iniciar sesión.
- Al menos un cliente con una sesión agendada que **ya haya pasado su hora de inicio**
  (las sesiones futuras no se pueden confirmar todavía, y eso es intencional).
- Cualquier navegador en computador o celular.

#### 3. Paso a paso para probarlo

**Opción A — Desde tu agenda (el flujo de todos los días):**

1. Inicia sesión con tu cuenta de entrenador.
2. En tu pantalla de inicio, busca la tarjeta **Agenda**.
3. Cambia a la vista **"Semana"** y haz clic en el día de hoy.
4. Se abre una ventana con las sesiones de ese día. En las sesiones que ya
   empezaron verás dos botones: **✓ Asistió** y **✗ No asistió**.
5. Haz clic en el que corresponda.

**Opción B — Desde la ficha del cliente (para corregir días anteriores):**

1. Entra a **Mis Clientes** y abre la ficha del cliente.
2. En el resumen, baja hasta **"Sesiones recientes"**.
3. Las sesiones pasadas sin confirmar muestran los mismos dos botones — haz clic
   en el que corresponda.

#### 4. Cómo sabes que funcionó

- Los botones desaparecen y en su lugar queda una etiqueta de color: verde
  **"Asistió"** o roja **"No asistió"**.
- Si entras después a la ficha del cliente, la sesión conserva su etiqueta.
- El cliente recibe sus créditos por asistir (lo puede ver en su balance cuando
  esa pantalla se entregue en la siguiente parte).

#### 5. Si algo no sale como esperabas

- **No veo los botones en una sesión** → revisa que la sesión ya haya empezado;
  las sesiones futuras no muestran botones a propósito.
- **La sesión aparece como "No asistió" y el cliente sí fue** → haz clic donde
  está la sesión y márcala como asistida desde la ficha del cliente: el sistema
  devuelve los créditos descontados automáticamente.
- **No aparece ninguna sesión hoy** → confirma que el cliente tenga una sesión
  agendada para hoy en la agenda.
- Si persiste, avísale al equipo técnico con una captura de pantalla.

---

### Funcionalidad 2: Registrar el test físico quincenal

#### 1. ¿Qué es y para qué sirve?

Cada dos semanas puedes evaluar en persona el progreso de tu cliente y registrar
si aprobó o no su test físico. Es tu forma de verificar que el cliente realmente
está entrenando: si aprueba, el sistema le entrega una buena cantidad de créditos.
Piensa en ello como el examen que confirma que la rutina está dando resultados.

#### 2. Antes de empezar

- Una cuenta de tipo **entrenador**.
- Un cliente asignado a ti (solo puedes registrar tests de tus propios clientes).

#### 3. Paso a paso para probarlo

1. Inicia sesión con tu cuenta de entrenador.
2. Entra a **Mis Clientes** y abre la ficha del cliente.
3. Haz clic en la pestaña **"Ev. Física"**.
4. Arriba de todo verás la sección **"Test quincenal"**. Haz clic en el botón
   **"Registrar test"**.
5. Elige la fecha (viene marcada con hoy), toca **"Aprobado"** o **"No aprobado"**,
   y si quieres escribe una nota corta.
6. Haz clic en **"Guardar test"**.

#### 4. Cómo sabes que funcionó

- El formulario se cierra y aparece la línea **"Último test:"** con la fecha y una
  etiqueta verde ("Aprobado") o roja ("No aprobado").
- Si ya había tests anteriores, aparece el enlace **"Ver historial"** con la lista
  completa.
- Si el test fue aprobado, el cliente recibe sus créditos automáticamente.

#### 5. Si algo no sale como esperabas

- **No encuentro la sección** → asegúrate de estar en la pestaña "Ev. Física" de
  la ficha del cliente; la sección está en la parte superior.
- **Me sale un mensaje de error al guardar** → revisa que el cliente sea uno de
  tus clientes asignados y que la fecha no sea futura.
- **Guardé con el resultado equivocado** → por ahora el registro no se edita;
  avísale al equipo técnico para corregirlo.
- Si persiste, avísale al equipo técnico con una captura de pantalla.

---

## Próximas secciones (se agregarán al entregar cada parte)

- **Parte 2** — Check-in diario y hábitos del cliente (con la validación por cámara de la rutina).
- **Parte 3** — Balance de créditos, racha e historial del cliente.
- **Parte 4** — Tienda interna y canjes.
- **Parte 5** — Calificación de sesiones.
- **Parte 6** — Configuración de dificultad y revisión de fotos del entrenador.
- **Parte 7** — Analítica y KPIs de la economía de créditos.
