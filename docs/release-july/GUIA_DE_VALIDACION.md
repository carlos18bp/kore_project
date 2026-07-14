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

## Parte 2 — Experiencia del cliente: check-in, créditos visibles y cámara

### Funcionalidad 3: Check-in diario de 4 preguntas

#### 1. ¿Qué es y para qué sirve?

Al entrar a la app cada día, aparece una ventana que te pregunta cómo estás:
tu ánimo, tu energía, si tienes algún dolor y si estás listo para entrenar.
Son cuatro toques y toma menos de 30 segundos. Completarlo suma créditos, y
le da a tu entrenador una foto diaria de cómo llegas a entrenar.

#### 2. Antes de empezar

- Una cuenta de tipo **cliente** con la que puedas iniciar sesión.
- No haber registrado tu check-in hoy (aparece una sola vez al día).

#### 3. Paso a paso para probarlo

1. Inicia sesión como cliente. La ventana del check-in aparece sola.
2. Arriba verás la etiqueta **"Check-in de hoy · +X créditos"** — eso es lo que ganas al completarlo.
3. Toca tu ánimo del 1 al 10 → pasa solo a la siguiente pregunta.
4. Toca tu nivel de energía (Agotado … A tope).
5. Toca **"Sin dolor"** o **"Tengo dolor"** (si duele, puedes contarle al entrenador dónde).
6. Cierra con **"¡Listo para entrenar!"** o **"Hoy no"**.

#### 4. Cómo sabes que funcionó

- Aparece la confirmación "Registrado. ¡Gracias!" con tu puntaje.
- En el tablero, la fila "Check-in diario" del bloque **"Hoy ganas"** queda marcada como completada.

#### 5. Si algo no sale como esperabas

- **No aparece la ventana** → ya registraste tu check-in hoy, o la descartaste con "Ahora no" (vuelve a entrar o tócala desde "Hoy ganas").
- **No veo la etiqueta de créditos** → refresca la página; si persiste, avísale al equipo técnico.

---

### Funcionalidad 4: Bloque "Hoy ganas" en el tablero

#### 1. ¿Qué es y para qué sirve?

Es tu lista diaria de acciones que dan créditos: check-in, hidratación, comidas
con foto y la rutina. Cada fila muestra si ya la hiciste y cuántos créditos
vale — los valores son los que configure tu entrenador, así que siempre están
al día.

#### 2. Antes de empezar

- Cuenta de **cliente** con programa activo.

#### 3. Paso a paso para probarlo

1. Entra al tablero (pantalla principal).
2. Busca la tarjeta **"Hoy ganas"** (bajo tu rutina del día).
3. Revisa las cuatro filas y sus etiquetas "+X".
4. Toca una fila pendiente: el check-in abre su ventana; hidratación y comidas te llevan a tu nutrición; la rutina te lleva a entrenar.

#### 4. Cómo sabes que funcionó

- Las filas completadas muestran el círculo verde con el check.
- Los contadores avanzan en vivo (vasos 3/8, comidas 2/5, ejercicios 4/6).

#### 5. Si algo no sale como esperabas

- **No veo la tarjeta** → es solo para cuentas de cliente (no invitados).
- **Las etiquetas "+X" no aparecen** → la configuración aún está cargando; refresca la página.

---

### Funcionalidad 5: Validación de tu rutina con cámara

#### 1. ¿Qué es y para qué sirve?

Para que tu rutina diaria sume créditos, la app valida que realmente estás
entrenando: durante tus ejercicios se toma un video de verificación y tu
entrenador lo revisa para entregarte los créditos. Tú solo entrenas como
siempre — el teléfono ya está frente a ti reproduciendo el video del ejercicio.

#### 2. Antes de empezar

- Cuenta de **cliente** con rutina asignada para hoy.
- Un dispositivo con cámara frontal (celular o computador con webcam).

#### 3. Paso a paso para probarlo

1. Entra a tu rutina del día ("Entrenar ahora" desde el tablero).
2. La primera vez verás la pantalla **"Validación de tu rutina"** explicando la verificación. Toca **"Activar cámara"** y acepta el permiso del navegador.
3. Entrena normal: durante cada ejercicio verás la señal **"● Validando rutina"** parpadeando arriba a la derecha.
4. Al terminar, la pantalla de cierre te muestra **"Rutina en validación · +X créditos cuando tu entrenador la apruebe"**.

#### 4. Cómo sabes que funcionó

- La señal "Validando rutina" aparece en cada ejercicio.
- La luz de tu cámara se enciende solo mientras ejecutas un ejercicio y se apaga entre pausas — es intencional, solo valida cuando entrenas.
- A los 3 días (o cuando tu entrenador la apruebe antes) los créditos pasan a tu balance.

#### 5. Si algo no sale como esperabas

- **Toqué "Entrenar sin validar" y quiero activarla** → dentro del ejercicio, toca el aviso ámbar "Sin validación · no suma créditos" para reabrir la activación.
- **Negué el permiso del navegador** → habilita la cámara para el sitio en la configuración del navegador y reabre la rutina.
- **No aparece la pantalla de validación** → ya tomaste una decisión antes (quedó recordada); usa el aviso ámbar para cambiarla.
- Si persiste, avísale al equipo técnico con una captura de pantalla.

---

## Parte 3 — Balance, racha e historial del cliente

### Funcionalidad 6: Ver tus créditos, tu racha y tu historial

#### 1. ¿Qué es y para qué sirve?

Es tu billetera de créditos dentro de Kore Health. En un solo lugar ves cuántos
créditos tienes, cuántos días llevas de racha (y cuánto te falta para tu próximo
bono), y el detalle de cada crédito que has ganado o perdido. Ahora también los
ves de un vistazo en tu pantalla de inicio.

#### 2. Antes de empezar

- Una cuenta de tipo **cliente** con la que puedas iniciar sesión.
- Haber usado la app unos días ayuda a que tengas movimientos y racha para ver.

#### 3. Paso a paso para probarlo

1. Inicia sesión como cliente y entra al tablero.
2. Arriba verás una **etiqueta con tu saldo de créditos** y tu **racha** (el número de días con la llamita).
3. Toca el saldo — o entra por el menú a **"Mis créditos"** (en el menú lateral en computador, o en "Más" en el celular).
4. En esa pantalla verás tu **balance**, tu **racha** con el anillo y los días de la semana, y cuánto te falta para el siguiente bono.
5. Baja para ver tu **historial**: cada crédito ganado o perdido con su fecha y descripción. Sigue bajando y se cargan más.

#### 4. Cómo sabes que funcionó

- La etiqueta del saldo en el inicio muestra tu número de créditos y lleva a "Mis créditos" al tocarla.
- La tarjeta de balance muestra tu saldo dividido en "Disponibles" y "Por aprobar" (los que aún revisa tu entrenador).
- El anillo de racha muestra tus días y el texto "Faltan N días para tu bono de +X".
- El historial lista tus movimientos con colores: verde (ganado), rojo (perdido), ámbar (pendiente).

#### 5. Si algo no sale como esperabas

- **El saldo aparece como "—"** → espera un momento a que cargue o refresca; si sigue, avísale al equipo técnico.
- **La racha del inicio cambió respecto a antes** → es correcto: ahora la racha es la del sistema de créditos (la que te da bonos), calculada distinto a la anterior.
- **No veo movimientos** → aún no has ganado ni perdido créditos; completa tu check-in para empezar.
- Si persiste, avísale al equipo técnico con una captura de pantalla.

---

## Parte 4 — Tienda interna y canjes

### Funcionalidad 7: Canjear tus créditos por artículos de la tienda

#### 1. ¿Qué es y para qué sirve?

Es la tienda dentro de Kore Health donde cambias los créditos que ganaste por
artículos y beneficios (productos, servicios, sesiones adicionales o descuentos).
Solo puedes canjear con los créditos que ya te **aprobaron**; los que están "por
aprobar" todavía no cuentan para comprar.

#### 2. Antes de empezar

- Una cuenta de tipo **cliente** con créditos **disponibles** (aprobados).
- Que tu entrenador (o el equipo) haya publicado al menos un artículo en la tienda.

#### 3. Paso a paso para probarlo

1. Inicia sesión como cliente.
2. Entra a **"Tienda"** (menú lateral en computador, o "Más" en el celular).
3. Arriba a la derecha verás tu chip de **"X disponibles"** (tus créditos aprobados).
4. Elige un artículo que puedas pagar y toca **"Canjear"**. Si cuesta más de lo que tienes, el botón dirá **"Sin saldo"**.
5. Confirma en la ventana **"¿Canjear …?"** — se descontarán los créditos indicados.
6. Verás el mensaje **"¡Canje solicitado! Tu entrenador lo gestionará."**.
7. Entra a **"Mis créditos"**: el balance ahora aparece dividido en **Disponibles** y **Por aprobar**, y abajo en **"Mis canjes"** verás tu solicitud con su estado (Pendiente / Entregado / Rechazado).

#### 4. Cómo sabes que funcionó

- El chip "disponibles" baja en la cantidad del artículo que canjeaste.
- En "Mis créditos" el canje aparece en **"Mis canjes"** como **Pendiente**.
- En "Mis créditos" el balance se muestra en dos números: **Disponibles** y **Por aprobar**, con la nota "Solo puedes canjear con los créditos disponibles".
- Cuando tu entrenador lo entregue, el estado cambia a **Entregado**; si lo rechaza, cambia a **Rechazado** y te devuelven los créditos.

#### 5. Si algo no sale como esperabas

- **El botón dice "Sin saldo"** → el artículo cuesta más que tus créditos disponibles; recuerda que los "por aprobar" no cuentan aún.
- **Me dice que no tengo créditos suficientes al confirmar** → tu saldo disponible cambió; refresca la tienda y vuelve a intentar.
- **No veo artículos** → aún no hay productos publicados; pídele a tu entrenador que agregue alguno.
- Si persiste, avísale al equipo técnico con una captura de pantalla.

### Funcionalidad 8 (entrenador): Gestionar la tienda y las solicitudes de canje

#### 1. ¿Qué es y para qué sirve?

Es el panel del entrenador para publicar artículos en la tienda y atender los
canjes que piden los clientes: entregarlos o rechazarlos (devolviendo los créditos).

#### 2. Antes de empezar

- Una cuenta de tipo **entrenador**.
- Al menos un cliente con un canje solicitado (ver Funcionalidad 7).

#### 3. Paso a paso para probarlo

1. Inicia sesión como entrenador y entra a **"Tienda"** en el menú.
2. En **"Solicitudes de canje"** verás los canjes pendientes con el artículo, el cliente y los créditos.
3. Toca **"Entregar"** cuando ya le diste el artículo al cliente, o **"Rechazar"** si no puedes cumplirlo.
4. En **"Catálogo"** agrega un artículo nuevo (nombre, precio en créditos y tipo) y usa el botón de estado para activarlo o desactivarlo.
5. Para **editar** un artículo, toca **Editar**, cambia nombre/descr./precio/imagen y guarda.
6. Al **Entregar** un producto o servicio, el sistema **exige una foto** de verificación; súbela para confirmar. El cliente la verá como **"Ver comprobante"** en *Mis créditos → Mis canjes*.

#### 4. Cómo sabes que funcionó

- Al **Entregar** o **Rechazar**, la solicitud desaparece de la lista de pendientes.
- Al **Rechazar**, al cliente se le devuelven los créditos y le llega un aviso.
- El artículo nuevo aparece en el catálogo y, si está **Activo**, el cliente lo ve en su tienda.

#### 5. Si algo no sale como esperabas

- **No puedo crear el artículo** → revisa que tenga nombre y un precio mayor a 0.
- **No veo solicitudes** → puede que no haya canjes pendientes de tus clientes.
- **Sigo viendo un canje ya resuelto** → refresca la página.
- Si persiste, avísale al equipo técnico con una captura de pantalla.

---

## Parte 6 — Sesiones adicionales

### Funcionalidad 9: Canjear y usar sesiones adicionales

#### 1. ¿Qué es y para qué sirve?
Con tus créditos puedes canjear **sesiones adicionales** (fuera de tu plan). Se te acreditan al instante y las puedes reservar durante **1 mes**.

#### 2. Antes de empezar
- Cuenta **cliente** con créditos disponibles y un entrenador asignado.
- Un artículo de tipo "sesión adicional" publicado en la tienda.

#### 3. Paso a paso para probarlo
1. Entra a **Tienda** y canjea el artículo de sesión adicional.
2. Ve a **Mis créditos**: verás **"Sesiones adicionales"** con la cantidad y **"vencen el …"**.
3. Entra a **Reservar sesión**: elige **"Sesiones adicionales"** como origen y agenda un horario.

#### 4. Cómo sabes que funcionó
- El canje se marca **Entregado** de inmediato (sin intervención del entrenador).
- Aparece la tarjeta de sesiones adicionales con su vencimiento.
- Al reservar usando esa fuente, el contador de sesiones adicionales baja.

#### 5. Si algo no sale como esperabas
- **No veo la sesión adicional** → confirma que el canje se hizo y que no venció (dura 1 mes).
- **No me deja reservar** → revisa que el horario esté disponible con tu entrenador.
- Si persiste, avísale al equipo técnico con una captura.

---

## Parte 7 — Comprar créditos

### Funcionalidad 10: Comprar créditos con dinero

#### 1. ¿Qué es y para qué sirve?
Además de ganarlos, puedes **comprar créditos** con dinero (tarjeta / Nequi / Bancolombia) vía Wompi. Se acreditan apenas se aprueba el pago.

#### 2. Antes de empezar
- Cuenta **cliente**.
- Al menos un **paquete de créditos** publicado por el admin.

#### 3. Paso a paso para probarlo
1. En **Mis créditos**, toca **"Comprar créditos"**.
2. Elige un paquete y toca **"Comprar"** → te lleva al checkout de Wompi.
3. Paga (en sandbox usa los datos de prueba). Al volver, la página confirma el pago.

#### 4. Cómo sabes que funcionó
- Vuelves a **Comprar créditos** con el mensaje **"¡Pago aprobado!"**.
- Tu **saldo** en Mis créditos sube por la cantidad comprada.
- En el historial aparece **"Compraste N créditos"**.

#### 5. Si algo no sale como esperabas
- **Pagué pero no veo los créditos** → espera unos segundos (la confirmación llega por webhook) y refresca.
- **El pago fue rechazado** → verás un mensaje de error; intenta con otro método.
- Si persiste, avísale al equipo técnico con una captura.

---

## Parte 8 — Comprar nutrición

### Funcionalidad 11: Agregar nutrición a tu plan

#### 1. ¿Qué es y para qué sirve?
La nutrición ahora es un beneficio de pago. Si tu plan no la incluye, puedes **agregarla**; pagas solo lo que resta del mes (prorrateado) y desde la siguiente renovación se cobra junto con tu plan en un solo pago.

#### 2. Antes de empezar
- Cuenta **cliente** con un **plan activo** sin nutrición.
- El admin configuró el **precio de nutrición**.

#### 3. Paso a paso para probarlo
1. Entra a **Mi Nutrición**: verás un **candado** con el precio y el botón **"Agrega nutrición a tu plan"**.
2. Tócalo → te lleva al checkout de Wompi por el **monto prorrateado**.
3. Paga (sandbox). Al volver, la sección se **desbloquea**.

#### 4. Cómo sabes que funcionó
- Mi Nutrición muestra el contenido (plan, seguimiento) en vez del candado.
- Tu próxima renovación cobrará plan **+ nutrición** en un solo pago.

#### 5. Si algo no sale como esperabas
- **Sigo viendo el candado tras pagar** → espera unos segundos (confirma por webhook) y refresca.
- **No tengo plan activo** → primero necesitas un plan para agregar nutrición.
- Si persiste, avísale al equipo técnico con una captura.

---

## Extra — Hub de tareas del entrenador

### Funcionalidad 12 (entrenador): Revisar puntos y canjes desde "Tareas pendientes"

#### 1. ¿Qué es y para qué sirve?
Un nuevo módulo en el menú del entrenador, **"Tareas pendientes"**, reúne en un solo lugar todo lo que necesita tu decisión: los **puntos por revisar** (fotos de comida y **fotos de la cámara del entrenamiento**) y las **solicitudes de canje** de la tienda. Desde aquí apruebas o rechazas cada cosa, con una nota. **Importante:** ahora el punto del entrenamiento **ya no se acredita solo** — queda pendiente hasta que lo revises.

#### 2. Antes de empezar
- Cuenta **entrenador** con clientes asignados.
- Que algún cliente haya registrado comidas con foto y/o entrenado con capturas de cámara, o tenga un canje pendiente.

#### 3. Paso a paso para probarlo
1. En el menú lateral (o en "Más" en móvil) entra a **Tareas pendientes**. El ítem muestra un **contador** con lo que falta por revisar.
2. En la pestaña **Créditos** verás una tarjeta por cada punto pendiente: nombre del cliente, tipo (Comida / Entrenamiento), puntos y la **foto de evidencia**.
3. Toca **Aprobar** (se acredita el punto) o **Rechazar** (escribe el motivo y confirma). La tarjeta desaparece.
4. Cambia a la pestaña **Canjes** para **Entregar** (con foto de verificación) o **Rechazar** solicitudes de la tienda.
5. Desde el **detalle de un cliente** también verás una etiqueta **"Tareas pendientes (N)"** que te lleva al hub.

#### 4. Cómo sabes que funcionó
- Al aprobar, el punto pasa a confirmado y suma al balance del cliente.
- La tarjeta revisada desaparece y el contador del menú baja.
- Los pendientes atrasados muestran una etiqueta **"Atrasado"**.

#### 5. Si algo no sale como esperabas
- **No veo fotos de entrenamiento** → el cliente debe haber entrenado con capturas de cámara ese día.
- **El contador no baja** → refresca; el hub se recarga al entrar.
- Si persiste, avísale al equipo técnico con una captura.

---

## Próximas secciones (se agregarán al entregar cada parte)

- Calificación de sesiones · configuración de dificultad · analítica y KPIs.
