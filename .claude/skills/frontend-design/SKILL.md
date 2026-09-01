---
name: frontend-design
description: "Diseño premium para Kore — directivas de UI/UX estilo Apple Health / Cal AI. Activar siempre que se construya o rediseñe cualquier vista de la app."
argument-hint: "[vista o componente a diseñar]"
---

# KORE — Premium Design Directives

## Cómo invocar este skill

Gating ([[_output-protocol]] §4): con `$ARGUMENTS` o intención clara en la sesión (la vista/componente a diseñar) → ejecutar directo, PROHIBIDO preguntar el tema. Sin argumentos ni contexto → UNA sola pregunta corta en texto por la vista o el componente (no picker: el insumo es libre). Nunca en modo fleet/headless.

Sin picker por diseño: no hay flags — el argumento es la vista/componente y las directivas viven en este documento.


Referencia estética: **Apple Health + Cal AI + Awwwards top sites**.
Nunca diseñes una vista sin leer y aplicar estas reglas primero.

---

## ⚠️ REGLA 0 — Color de texto en superficies oscuras (LA MÁS VIOLADA)

`globals.css` fuerza `color: var(--color-kore-wine-dark)` en **todos** los `h1–h6` vía `:where()`.
Eso significa que **cualquier heading sin clase de color explícita sale oscuro — incluso sobre fondo negro**.

**Regla absoluta:**
- Superficie oscura (gradiente vino, `from-kore-wine-deep`, `from-slate-900`, etc.) → **siempre** añadir `text-kore-ivory` explícitamente a CADA heading, párrafo y texto dentro.
- Superficie clara (cream, white) → `text-kore-wine-dark` para headings, `text-kore-gray-dark` para body.
- **Nunca** dejes un `<h1>/<h2>/<h3>` sin clase de color dentro de una card oscura. Siempre se requiere override explícito.

```tsx
// ✅ Correcto — superficie oscura
<div style={{ background: 'linear-gradient(135deg, #2D0F1A, #670F22)' }}>
  <h1 className="font-heading text-3xl text-kore-ivory">Título</h1>
  <p className="font-body text-sm text-kore-ivory/80">Subtítulo</p>
</div>

// ❌ Incorrecto — heading sin color explícito hereda kore-wine-dark (texto oscuro sobre fondo oscuro)
<div style={{ background: 'linear-gradient(135deg, #2D0F1A, #670F22)' }}>
  <h1 className="font-heading text-3xl">Título</h1>
</div>
```

**Stack de colores por superficie:**

| Superficie | Heading | Body | Caption | Acento |
|---|---|---|---|---|
| Cream / white | `text-kore-wine-dark` | `text-kore-gray-dark/80` | `text-kore-wine-dark/40` | `text-kore-crimson` |
| Dark hero (wine gradient) | `text-kore-ivory` | `text-kore-ivory/78` | `text-kore-gold/75` | `text-kore-gold` |
| Dark hero (slate gradient) | `text-white` | `text-white/70` | `text-white/50` | `text-white` |

---

## Sistema Trainer — Línea gráfica exacta

El área Trainer hereda la misma línea del Admin. **No inventar tokens ni paletas nuevas.**

**Sidebar:**
- Fondo: `linear-gradient(170deg, #2D0F1A 0%, #4A1828 100%)`
- Borde derecho: `1px solid rgba(231,200,160,0.12)`
- Logo "KÓRE": `font-heading`, `#FFF8EC` (ivory), tracking ancho
- Subtítulo "ENTRENADOR": `font-body`, 9px, `#E7C8A0` (champagne), uppercase tracking
- Ítem activo: `linear-gradient(135deg, rgba(244,199,199,0.16), rgba(231,200,160,0.10))` + borde champagne 30%
- Ítem inactivo: `rgba(255,248,236,0.72)` — ivory translúcido
- Ícono activo: `#E7C8A0` (champagne); inactivo: `rgba(231,200,160,0.55)`
- Badge alertas: píldora roja `#9A0526`
- Card usuario (bottom): fondo `rgba(20,5,12,0.40)`, avatar gradiente petal→gold

**Topbar (cream, sticky):**
- Fondo: `rgba(245,239,227,0.85)` + `backdrop-blur`
- Breadcrumb: 10px, uppercase, `rgba(103,15,34,0.55)`
- Título principal: `font-heading`, 26px, `text-kore-wine-dark` ← cream bg, sí va oscuro
- Derecha: bell con dot rojo + chip "Sistema operativo" sage

**Tokens de referencia (design bundle `_shell.jsx`):**
```
wine:       #670F22   → text-kore-wine-dark
wineDeep:   #5C2030   → text-kore-wine
wineDark:   #2D0F1A   → text-kore-wine-deep
red/crimson:#9A0526   → text-kore-crimson
ivory:      #FFF8EC   → text-kore-ivory
champagne:  #E7C8A0   → text-kore-gold
sage:       #A8C29C   → text-kore-sage
sageDeep:   #669959   → text-kore-sage-deep
amber:      #E5C97A   → text-kore-amber
amberDeep:  #A88A2E   → text-kore-amber-deep
petal/sakura:#F4C7C7  → text-kore-petal
border:     rgba(103,15,34,0.10) → border-kore-wine-dark/10
borderSoft: rgba(103,15,34,0.08)
```

**Cards (sobre fondo cream):**
- Estándar: `bg-white/65 rounded-[22px]` + `border` + `boxShadow: 0 2px 12px -8px rgba(45,15,26,0.10)`
- Headings dentro: `text-kore-wine-dark` (cream bg → correcto)
- Labels uppercase: `rgba(103,15,34,0.55)`

---

## Regla 1 — Títulos grandes, nunca tímidos
- Título de página: mínimo `text-2xl font-bold`. En hero sections: `text-3xl font-semibold` (Cinzel, no black).
- Nunca uses `text-sm` o `text-base` para un título principal.
- El primer elemento visual de cada sección debe ser una métrica o título que se lea desde lejos.

## Regla 2 — Espaciado generoso
- Padding de página trainer/admin: `px-5 xl:px-10 pt-20 xl:pt-8 pb-24`.
- Gap entre secciones: `space-y-5`.
- Padding interno de cards: `p-6` estándar, `p-8` para hero cards.
- **Sin `max-w-*` en páginas (app)** — los contenedores son full-width dentro del área de contenido.

## Regla 3 — Métrica hero siempre presente
- Cada página con datos debe tener UNA métrica principal como hero.
- KPI Strip de 6: `font-heading text-[30px] font-semibold` — no `text-5xl font-black` (eso es para arcos circulares de cliente).
- La métrica va primero, etiqueta debajo en `text-[9px] font-bold tracking uppercase`.

## Regla 4 — Minimalismo estricto
- Máximo 2 colores en cualquier card.
- Si un elemento no añade información, eliminarlo.

## Regla 5 — Superficies
- Página: `bg-kore-cream`.
- Card estándar trainer: `bg-white/65 rounded-[22px] border border-kore-wine-dark/10`.
- Hero greeting / dark card: gradiente vino, `rounded-3xl`, texto ivory.
- KPI strip: celdas `rgba(255,255,255,0.70)` separadas por gap 1px sobre fondo `rgba(103,15,34,0.10)`.

## Regla 6 — Acento único
- Único acento: `kore-crimson` (`#9A0526`) para acciones y alertas críticas.
- Sage (`#669959`): solo completado / tendencia positiva.
- Amber (`#A88A2E`): solo advertencias / pendientes.
- Nunca decorativo.

## Regla 7 — Tipografía (trainer/admin)

| Rol | Clase |
|-----|-------|
| Sidebar logo | `font-heading text-2xl font-bold tracking-[0.16em] text-kore-ivory` |
| Topbar title | `font-heading text-[26px] font-semibold text-kore-wine-dark` |
| Hero greeting | `font-heading text-3xl font-semibold text-kore-ivory` |
| Card heading | `font-heading text-[18-22px] font-semibold text-kore-wine-dark` |
| KPI value | `font-heading text-[30px] font-semibold text-kore-wine-dark` |
| Section label | `font-body text-[10px] font-bold tracking-[0.22em] uppercase` + `rgba(103,15,34,0.55)` |
| Body | `font-body text-[13px] font-semibold text-kore-gray-dark` |
| Caption | `font-body text-[11px]` + `rgba(103,15,34,0.55)` |

## Regla 8 — Interacciones físicas
- Botones: `active:scale-95 transition-all duration-100`.
- Cards hover: solo color shift, nunca layout shift.
- Progress arcos: `transition-all duration-700 ease-out`.

## Regla 9 — Responsive trainer
- Mobile: single column, `pt-20 pb-24`.
- Desktop (xl): sidebar fijo 256px (`xl:ml-64`), content full width.
- Grids de dos columnas: `xl:grid-cols-[3fr_2fr]` o `xl:grid-cols-[1.5fr_1fr]`.

## Regla 10 — Visualización de datos
- Sparklines: SVG polyline con gradiente fill.
- Arcos: `strokeDasharray` SVG, no librerías externas.
- Números siempre primero — el chart es contexto.

## Checklist antes de entregar cualquier UI

- [ ] ¿Headings dentro de superficies oscuras tienen `text-kore-ivory` explícito?
- [ ] ¿Headings en cream/white tienen `text-kore-wine-dark` explícito?
- [ ] ¿El sidebar usa el gradiente vino correcto (no blanco, no sage)?
- [ ] ¿Hay una métrica hero visible a primera vista?
- [ ] ¿Los títulos son `text-2xl` o más grandes?
- [ ] ¿El spacing usa `space-y-5` o más?
- [ ] ¿Las cards usan `rounded-[22px]` o `rounded-3xl`?
- [ ] ¿Los botones tienen `active:scale-95`?
- [ ] ¿Sin `max-w-*` en el contenedor de página?
