# Spec — Responsive desktop del detalle de cliente (trainer)

**Fecha:** 2026-05-20
**Rama:** `fix/20052026-release-april-may-fixes`
**Alcance:** Adaptar a escritorio la vista de detalle de cliente del rol trainer.

## Problema

El rol trainer fue construido mobile-first y ya es responsive en casi todo: la
navegación (`TrainerSidebar` + `TrainerMobileBottomNav`), la lista de clientes
(patrón `xl:hidden` cards / `hidden xl:block` tabla), el dashboard, métricas,
alertas y el catálogo de nutrición.

La única vista sin adaptación de escritorio es **`app/(app)/trainer/clients/client/page.tsx`**
— el detalle de cliente con sus 9 mini-tabs:

- El contenedor es `px-5 xl:px-10` sin `max-w` ni grid: en pantallas anchas el
  contenido se estira a todo el ancho disponible (la hero oscura del índice
  KÓRE, los KPIGrid, las cards de sesiones — todo estirado).
- El `TabBar` de 9 tabs hace scroll horizontal: correcto en móvil, pobre en
  desktop donde sobra ancho.
- Los bottom sheets (resolver alerta, pausar programa, mensaje post-sesión)
  quedan anclados abajo a todo el ancho: en desktop un sheet full-width se ve
  mal.

## Aclaración de alcance

Las 9 mini-tabs (Resumen, Programa, Antropometría, Posturometría, Ev. Física,
PAR-Q+, Nutrición, Alertas, Notas) son **estado in-page** (`useState`), NO rutas.
Existen rutas separadas homónimas (`.../anthropometry/page.tsx`, etc.) pero esta
vista renderiza el contenido de cada tab inline vía componentes
(`EvalAntropTab`, `ClientProgramTab`, `NotesTab`, …). El trabajo es a nivel de
**shell** — contenedor, header, TabBar y encuadre del contenido. Los 9 tab
components (~7.000 líneas en total) NO se modifican.

## Principios

- **CSS-responsive puro.** Variantes de breakpoint de Tailwind. Sin
  `useMediaQuery` ni detección JS (sin riesgo de hydration en el static export).
- **Breakpoint único `xl` (1280px)** — la frontera que ya usa todo el sistema.
- **No tocar el interior de los tab components.** Sólo el encuadre.
- El shell nuevo se escribe con clases Tailwind (consistente con el resto del
  sistema), no con `style={{}}` inline. No se reescriben los estilos inline
  preexistentes del header — quedan como están, sólo se reencuadran.

## Diseño

### A. Layout del shell — `app/(app)/trainer/clients/client/page.tsx`

**Móvil/tablet (<xl):** sin cambios. Back link, header de cliente, `TabBar`
horizontal, contenido del tab en una columna.

**Desktop (xl+):**

- El `<div>` contenedor (hoy `px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-4`)
  gana tope de ancho: `xl:max-w-[1080px] xl:mx-auto`.
- El back link, el bloque de error y el **header de cliente** (avatar + nombre
  + metadata + stats strip) quedan arriba, a todo el ancho del contenedor. Sin
  cambios internos — sólo quedan reencuadrados por el tope de ancho.
- Debajo del header, el `TabBar` y el contenido del tab se envuelven en un grid
  de 2 columnas: `xl:grid xl:grid-cols-[220px_1fr] xl:gap-8`.
  - Columna izquierda: el `TabBar` en modo rail vertical (sección B),
    `xl:sticky xl:top-8` para permanecer visible mientras el contenido scrollea.
  - Columna derecha: el contenedor del contenido del tab activo (hoy
    `space-y-4 pt-5`). En desktop el `pt-5` se neutraliza (`xl:pt-0`) — el
    `gap` del grid ya da la separación. Los 9 tab components renderizan su
    stack de cards dentro de esta columna (~800px de ancho), sin cambios.
- Debajo de `<xl` el wrapper grid es un bloque normal: `TabBar` y contenido se
  apilan como hoy.

### B. `TabBar` responsive — `app/components/trainer/TabBar.tsx`

`TabBar` se reescribe para renderizar dos variantes con la **misma API**
(`tabs`, `activeTab`, `onChange`) — no cambia ningún call site.

- **<xl:** el strip horizontal actual — fila con `overflow-x: auto`,
  `scrollbar` oculta, borde inferior, y `scrollIntoView` del tab activo. Se
  conserva el comportamiento actual.
- **xl+:** lista vertical (rail). Cada tab es un botón full-width
  (`text-left`), apilado. El tab activo se marca con barra de acento a la
  izquierda (`border-l-2` color vino) + fondo tenue, en lugar del borde
  inferior. Las 9 etiquetas entran sin scroll.
- El `scrollIntoView` del tab activo sólo aplica en la variante horizontal
  (en el rail vertical no hace falta scroll).
- `TabBar` se reescribe usando clases Tailwind (hoy es todo `style={{}}`
  inline). Mantiene `'use client'`.

### C. Bottom sheets → modal centrado en desktop

Afecta los 3 sheets que abren desde el detalle de cliente:
1. **Resolver alerta** — JSX inline en `client/page.tsx`.
2. **Pausar programa** — JSX inline en `client/page.tsx`.
3. **Mensaje post-sesión** — `app/components/trainer/PostSessionMessageSheet.tsx`
   (usado sólo en esta vista).

Los dos sheets inline (1 y 2) comparten un shell idéntico: backdrop
`fixed inset-0 bg-black/40 backdrop-blur-sm` + panel
`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl` con un handle
de arrastre (`w-10 h-1`). Se extrae un componente wrapper
**`ResponsiveSheet`** (`app/components/trainer/ResponsiveSheet.tsx`) que
encapsula la lógica sheet↔modal:

- **<xl:** backdrop + panel anclado abajo, full-width, `rounded-t-3xl`, con
  handle de arrastre visible.
- **xl+:** el panel pasa a modal centrado — `xl:max-w-md`, centrado vertical y
  horizontalmente sobre el backdrop, `xl:rounded-3xl` (esquinas completas). El
  handle de arrastre se oculta (`xl:hidden`).
- El click en el backdrop cierra (comportamiento actual). El panel detiene la
  propagación del click.

`ResponsiveSheet` recibe `onClose` y `children`. Los sheets 1 y 2 se migran a
usarlo. `PostSessionMessageSheet` adopta el mismo wrapper `ResponsiveSheet`
(su formulario interno queda como `children`, sin cambios de lógica).

**Fuera de alcance:** sheets que abren *dentro* de los tab components
(`NotesTab`, eval tabs, `ClientNutritionTab`) — viven en los componentes que no
se tocan.

## Fuera de alcance

- El interior de los 9 tab components (Resumen, Programa, evals, Nutrición,
  Alertas, Notas) — su contenido se renderiza tal cual dentro de la columna
  derecha.
- Reescritura de los `style={{}}` inline preexistentes del header de cliente.
- Las demás vistas del trainer (dashboard, lista de clientes, métricas,
  alertas, catálogo de nutrición) — ya son responsive.
- Las rutas separadas `.../anthropometry`, `.../posturometry`, etc.

## Criterios de aceptación

1. En `<xl` (probar a 375px y 768px) el detalle de cliente se ve y se comporta
   exactamente como hoy: header, `TabBar` horizontal con scroll, contenido en
   una columna, sheets anclados abajo.
2. En `xl+` el contenedor no excede ~1080px de ancho y queda centrado.
3. En `xl+` las 9 tabs se ven como un rail vertical a la izquierda; el tab
   activo está resaltado; al cambiar de tab el contenido de la derecha cambia
   sin recargar la página.
4. En `xl+` el rail permanece visible (sticky) al hacer scroll del contenido.
5. En `xl+` los 3 sheets (resolver alerta, pausar programa, mensaje
   post-sesión) abren como modal centrado angosto, no como barra inferior.
6. Sin errores de hydration en consola al cargar la vista en cualquier ancho.

## Verificación

- `cd frontend && npm run dev`; abrir el detalle de cliente
  (`/trainer/clients/client?id=<n>`) como trainer y recorrer las 9 tabs y los
  3 sheets a 375px, 768px y 1280px+.
- Jest: agregar cobertura para `TabBar` (render de ambas variantes) y
  `ResponsiveSheet`. Verificar que los tests existentes de `client/page.tsx`,
  si los hay, siguen verdes.
- `npm run build` (static export) sin warnings nuevos.
