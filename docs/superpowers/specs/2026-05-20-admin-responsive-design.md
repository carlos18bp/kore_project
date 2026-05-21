# Spec — Responsive del rol Admin

**Fecha:** 2026-05-20
**Rama:** `fix/20052026-release-april-may-fixes`
**Alcance:** Navegación móvil del admin + colapso responsive de las dos tablas-lista.

## Problema

El rol admin (`app/admin-platform/`) no es usable por debajo de 1280px:

1. **Sin navegación móvil (crítico).** `AdminSidebar` envuelve `AppSidebar`, que es
   `hidden xl:flex`. No existe ningún `AdminMobileBottomNav`. El cliente tiene
   `MobileBottomNav` y el trainer tiene `TrainerMobileBottomNav`; el admin no tiene
   nada. En cualquier pantalla `< xl` (celulares y tablets) el admin ve el contenido
   pero no puede moverse entre Panel / Usuarios / Suscripciones / Planes — ni cerrar
   sesión, porque el logout vive sólo en el sidebar.

2. **Tablas-lista con grids de columnas fijas.** `UserRow`
   (`grid-cols-[52px_2.2fr_1fr_1.4fr_1.2fr_0.8fr_28px]`, 7 columnas) y `SubRow`
   (`grid-cols-[2fr_1.6fr_1.4fr_1fr_0.9fr_28px]`, 6 columnas) no tienen variante
   responsive. En celular las columnas se aplastan. Los `div` de encabezado en
   `UsersListClient` y `subscriptions/page.tsx` replican esos grids fijos.

El resto del admin (dashboard, plans, páginas de detalle, formularios) ya es
responsive y queda fuera de alcance.

## Guía de diseño

El front del rol cliente es la referencia: `(app)/layout.tsx` monta `Sidebar` (xl) +
`MobileBottomNav` (`< xl`). `MobileBottomNav` y `TrainerMobileBottomNav` son wrappers
delgados del componente compartido y genérico `AppMobileBottomNav`
(`app/components/layouts/AppMobileBottomNav.tsx`).

## Principios

- **Reusar `AppMobileBottomNav`.** Está probado por cliente y trainer. El admin sólo
  necesita un wrapper, idéntico en forma a `MobileBottomNav.tsx`.
- **CSS-responsive puro.** Variantes de breakpoint de Tailwind. Sin `useMediaQuery`
  ni detección JS → sin riesgo de hydration mismatch (Next.js static export).
- **Breakpoint único: `xl` (1280px).** Es la frontera que ya usa todo el sistema —
  el sidebar aparece en `xl`, la bottom-nav vive debajo. `< xl` = "modo móvil/tablet".

## Diseño

### A. Navegación móvil del admin

Nuevo componente **`app/components/layouts/AdminMobileBottomNav.tsx`**, wrapper de
`AppMobileBottomNav`, con la misma estructura que `MobileBottomNav.tsx`:

- **4 tabs primarios**, con sus íconos reusados de `AdminSidebar.tsx`:
  - Panel → `/admin-platform/dashboard` (icono `HomeIcon`)
  - Usuarios → `/admin-platform/users` (icono `PeopleIcon`)
  - Suscripciones → `/admin-platform/subscriptions` (icono `CardIcon`)
  - Planes → `/admin-platform/plans` (icono `PlansIcon`)
- **5º slot "Más"** (sheet trigger al final — `moreTabAt` por defecto lo inserta al
  final, no hace falta pasarlo). El sheet contiene:
  - "Reportes" como `moreItem` con `disabled: true` (ver extensión abajo) — inerte,
    con tag "Pronto", equivalente al `soon` del sidebar.
  - "Cerrar sesión" — vía `showLogout` (default `true` del componente compartido).
- Los íconos de `AdminSidebar` usan `className: 'w-[18px] h-[18px]'`. El wrapper debe
  re-declarar los SVG con `iconProps` `w-5 h-5` (tamaño que usa `MobileBottomNav`).
- `match` de cada tab: `(p) => p.startsWith(href)` salvo el dashboard, que es
  `(p) => p === '/admin-platform/dashboard'`.

**Extensión a `AppMobileBottomNav` (necesaria, mínima y aditiva).** Hoy
`MobileNavMoreItem` no soporta estado inerte. Se agrega un campo opcional:

- `MobileNavMoreItem` gana `disabled?: boolean`.
- En el render de `moreItems`: si `item.disabled`, se renderiza como `<div>` inerte
  (sin `Link`/`<button>`), con `opacity-50 cursor-not-allowed` y un tag "Pronto"
  (`text-[8px] font-bold uppercase tracking-[0.18em] text-kore-gold/50`), reusando
  el estilo del `soon` de `AppSidebar`.
- Cambio puramente aditivo: `disabled` undefined → comportamiento actual intacto.
  No afecta a `MobileBottomNav` ni `TrainerMobileBottomNav` (no usan el campo).

**Wiring:** `app/admin-platform/layout.tsx` renderiza `<AdminMobileBottomNav />`
junto a `{children}`. Hoy el `return` es `<>{children}</>`; pasa a:

```tsx
return (
  <>
    {children}
    <AdminMobileBottomNav />
  </>
);
```

`AppMobileBottomNav` ya es `xl:hidden` internamente, así que no aparece en desktop.

**Sin cambios:**
- `AdminSidebar` sigue `hidden xl:flex`.
- `AdminShell` ya aplica `pb-24 xl:pb-20` en el `<main>` — el espacio para la barra
  ya existe; no se toca.

### B. Tablas-lista responsive

Afecta `UserRow.tsx`, `SubRow.tsx` y los headers de columna en `UsersListClient.tsx`
y `subscriptions/page.tsx`.

**Patrón por fila:** dos bloques de layout en el mismo componente, alternados por
breakpoint. Los valores derivados (`relativeTime`, `sessionsPct`, `tone`,
`customerTone`, `GuestSubline`, etc.) se computan una sola vez; sólo se duplica el
JSX de presentación.

```
xl+   →  bloque desktop:  hidden xl:grid xl:grid-cols-[...]   (grid actual, intacto)
< xl  →  bloque card:     flex flex-col   xl:hidden            (card apilada)
```

Ambos bloques van dentro del mismo `<Link>` (el `<Link>` no cambia: mismo `href`,
mismos estilos de fondo/hover/borde).

**Card de `UserRow` (`< xl`):**
- Fila 1: `Avatar` (42, con el badge `must_change_password`) + bloque nombre/email
  (`flex-1 min-w-0`, `truncate`) + chevron `›`.
- Separador sutil (`border-t border-kore-burgundy/8`).
- Fila 2 (`flex flex-wrap items-center gap-x-3 gap-y-1.5`): pill de rol + pill de
  estado + sesiones compactas (`usado/total` + barra fina) + última conexión
  (`time.rel`). Si `sessions_total_total === 0`, se muestra "Sin plan" igual que en
  desktop.

**Card de `SubRow` (`< xl`):**
- Fila 1: avatar(es) — uno o dos según `isPair && guestAccepted` — + bloque
  cliente/subline (`customer_name` + `GuestSubline` o `customer_email`) + chevron.
- Separador sutil.
- Fila 2 (`flex flex-wrap items-center gap-x-3 gap-y-1.5`): título del paquete +
  `#id` + sesiones+barra + "Vence {fmtShortDate(expires_at)}" + pill de estado.

**Headers de columna:** los `div` de encabezado de grilla — `UsersListClient.tsx`
(`grid grid-cols-[52px_2.2fr_…]`) y `subscriptions/page.tsx`
(`grid grid-cols-[2fr_1.6fr_…]`) — pasan de `grid …` a `hidden xl:grid …`. Sólo
tienen sentido sobre la grilla desktop.

**Sin cambios:** tarjetas de filtros, paginación y empty-states ya usan `flex-wrap`
/ `grid-cols-2` y funcionan en móvil.

## Fuera de alcance

- `SubCardCompact` (grid de 5 columnas) — vive *dentro* de las páginas de detalle,
  no en las tablas-lista. Mismo patrón aplicaría si se quisiera incluir más adelante.
- Dashboard, plans, páginas de detalle y formularios: ya responsive.
- Rediseño visual: no se cambian colores, tipografía ni el grid desktop existente.

## Criterios de aceptación

1. En `< xl` (probar a 375px y 768px) el admin ve una barra inferior con Panel,
   Usuarios, Suscripciones, Planes y "Más"; el tab activo se resalta según la ruta.
2. El sheet "Más" abre con "Reportes" inerte y "Cerrar sesión" funcional.
3. En `xl+` no aparece la bottom-nav; el sidebar se comporta como hoy.
4. En `< xl`, `/users` y `/subscriptions` muestran cada fila como card apilada
   legible, sin scroll horizontal ni texto aplastado; los headers de columna no se
   ven.
5. En `xl+`, ambas tablas se ven exactamente como hoy (grids intactos).
6. Sin errores de hydration en consola al cargar cualquier vista admin.

## Verificación

- `cd frontend && npm run dev`, recorrer las 8 rutas admin a 375px, 768px y 1280px+.
- Jest: los tests existentes `AdminSidebar.test.tsx` y `UserRow.test.tsx` deben
  seguir verdes; agregar cobertura para `AdminMobileBottomNav` y para el render
  card/grid de `UserRow`/`SubRow`.
- `npm run build` (static export) sin warnings nuevos.
