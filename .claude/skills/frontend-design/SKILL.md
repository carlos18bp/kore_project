---
name: frontend-design
description: "Diseño premium para Kore — directivas de UI/UX estilo Apple Health / Cal AI. Activar siempre que se construya o rediseñe cualquier vista de la app."
argument-hint: "[vista o componente a diseñar]"
---

# KORE — Premium Design Directives

Referencia estética: **Apple Health + Cal AI + Awwwards top sites**.
Nunca diseñes una vista sin leer y aplicar estas reglas primero.

## Regla 1 — Títulos grandes, nunca tímidos
- Título de página: mínimo `text-2xl font-bold`. En hero sections: `text-3xl font-black`.
- Nunca uses `text-sm` o `text-base` para un título principal.
- El primer elemento visual de cada sección debe ser una métrica o título que se lea desde lejos.

## Regla 2 — Espaciado generoso
- Padding de página: `px-5 py-8` mínimo (no `px-4 py-4`).
- Gap entre secciones: `space-y-8` (no `space-y-4`).
- Padding interno de cards: `p-6` estándar, `p-8` para hero cards.
- "Respira" — si una sección se siente apretada, dobla el spacing.

## Regla 3 — Métrica hero siempre presente
- Cada página con datos debe tener UNA métrica principal presentada como hero: `text-5xl font-black tracking-tight`.
- La métrica va primero, la etiqueta va debajo en `text-sm text-*/50`.
- Nunca enterres un número importante en el medio de un párrafo.

## Regla 4 — Minimalismo estricto
- Máximo 2 colores en cualquier card (background + 1 acento).
- Máximo 2 pesos de fuente por vista (`font-bold` + `font-normal` ó `font-black` + `font-medium`).
- Un borde visible en una card es suficiente. Nunca stacks de bordes + sombra + glassmorphism al mismo tiempo.
- Si un elemento no añade información, eliminarlo.

## Regla 5 — Superficies premium (nunca planas)
- Fondo de página: `bg-kore-cream` siempre.
- Card estándar: `bg-white rounded-3xl shadow-sm border border-black/5`.
- Hero/spotlight card: `bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl` — texto blanco.
- Glassmorphism solo en overlays/modals: `bg-white/80 backdrop-blur-xl`.
- `rounded-3xl` para cards grandes, `rounded-2xl` para cards normales, `rounded-xl` para inputs/pills.

## Regla 6 — Un solo acento de color
- El único color de acento de la app es `kore-red`.
- Verde/teal: solo para estado "completado" o tendencia positiva en datos.
- Amber: solo para advertencias o tendencia negativa en datos.
- Nunca uses colores decorativos. El color tiene que significar algo.

## Regla 7 — Tipografía con jerarquía clara
Usar siempre este stack exacto, sin saltarse niveles:

| Rol | Clase |
|-----|-------|
| Hero metric | `text-5xl font-black tracking-tight` |
| Page title | `text-2xl font-bold` |
| Section label | `text-xs font-semibold uppercase tracking-widest opacity-40` |
| Body | `text-base text-kore-gray-dark/80 leading-relaxed` |
| Caption | `text-xs text-kore-gray-dark/40` |

## Regla 8 — Interacciones que se sienten físicas
- Botón primario: `active:scale-95 transition-transform duration-100` siempre.
- Hover en cards: `hover:shadow-md transition-shadow duration-200`.
- Progress/arcos: animar con `transition-all duration-700 ease-out` al montar.
- Nunca `transition-all` en layout properties — solo `opacity`, `transform`, `shadow`, `color`.

## Regla 9 — Mobile-first, siempre
- Diseñar primero para 390px de ancho (iPhone 15 Pro).
- Container: `max-w-xl mx-auto` — nunca full-bleed en desktop para contenido de datos.
- Bottom nav ocupa 64px — el contenido scrolleable necesita `pb-20` mínimo.

## Regla 10 — Visualización de datos premium
- Datos de progreso: arco circular SVG (`strokeDasharray`), nunca barra horizontal como primera opción.
- Strip calendárico de 7 días: siempre presente cuando hay datos históricos.
- El número va dentro del arco, `text-4xl font-black`, centered.
- Track del arco: `stroke-current opacity-10`, fill del arco: `stroke-kore-red` o color de estado.

## Checklist antes de entregar cualquier UI
- [ ] ¿Hay una métrica hero visible a primera vista?
- [ ] ¿Los títulos son `text-2xl` o más grandes?
- [ ] ¿El spacing entre secciones es `space-y-8` o más?
- [ ] ¿Hay a lo sumo 2 colores de acento?
- [ ] ¿Las cards usan `rounded-3xl` o `rounded-2xl`?
- [ ] ¿Los botones tienen `active:scale-95`?
- [ ] ¿Funciona bien en 390px de ancho?
