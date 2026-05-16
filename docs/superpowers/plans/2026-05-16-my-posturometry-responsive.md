# My Posturometry Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer responsive la vista del cliente `/my-posturometry`: arreglar la legibilidad del radar chart, convertir las 4 cards "Por región" en un carrusel con bullets de marca en mobile/tablet, y reorganizar la comparativa de imágenes de cada vista (`ViewSection`) para que colapse correctamente en pantallas estrechas.

**Architecture:** Cambios contenidos al archivo `frontend/app/(app)/my-posturometry/page.tsx`. Tres bloques: (1) `RadarChart` pasa de `width/height` fijo a `viewBox` con tamaño máximo por breakpoint + datapoints/anillos más legibles; (2) nuevo componente local `RegionsCarousel` que envuelve las 4 `RegionCard` con scroll-snap CSS nativo + bullets gold + `IntersectionObserver` para tracking, y `lg:` se rinde como grid 2-col; (3) `ViewSection` migra de `gridTemplateColumns` inline a Tailwind responsive con stack mobile → grid 2-col tablet → grid 3-col desktop.

**Tech Stack:** Next.js 16 + React 19 + TypeScript, Tailwind 4. Sin nuevas dependencias (Swiper ya está instalado pero usamos scroll-snap CSS nativo + `IntersectionObserver` para menos peso). Verificación visual con Playwright MCP o `npm run dev` en breakpoints 375/768/1024/1440.

---

## File Structure

**Single file modified:** `frontend/app/(app)/my-posturometry/page.tsx`

Responsabilidades internas (todas en el mismo archivo, manteniendo el patrón existente):
- `RadarChart` — refactorizada para usar `viewBox` y aceptar `compact` prop (renombrada internamente, mantiene la misma firma pública usada solo dentro del archivo).
- `RegionsCarousel` (nuevo) — wrapper sobre las 4 `RegionCard`. Responsable de: scroll-snap container, observer del card activo, render de bullets gold. Sólo activa el modo carrusel en `<lg`.
- `ViewSection` — recibe el grid responsive vía clases Tailwind en vez de `style` inline. `PhotoFrame` acepta `className` para que el padre pueda controlar la altura por breakpoint.

No se crean archivos nuevos. No se tocan stores, servicios, ni rutas.

---

## Task 1: Radar chart — viewBox responsive + legibilidad

**Files:**
- Modify: `frontend/app/(app)/my-posturometry/page.tsx:237-316` (componente `RadarChart`)
- Modify: `frontend/app/(app)/my-posturometry/page.tsx:531-534` (call site dentro de `Hero`)

- [ ] **Step 1: Refactorizar `RadarChart` para usar `viewBox`**

Reemplazar el bloque actual del componente (líneas 237-316). El SVG pasa a `width="100%" height="auto" viewBox="0 0 300 300"`, los datapoints crecen de `r="3.5"` a `r="5"` con halo circular detrás (radio 8, opacidad 0.18), los anillos pasan de `strokeOpacity="0.18"` a `0.32` (excepto el de valor 1.0 que sube a `0.45`), y el polígono de datos agrega `filter: drop-shadow(0 0 6px rgba(255,233,220,0.35))`. Las etiquetas mantienen Cinzel 13px pero con `paintOrder: 'stroke fill'` + stroke wine `#2D0F1A` 3px para que se lean sobre el polígono cream.

```tsx
function RadarChart({
  dataLatest, dataFirst,
}: {
  dataLatest: { global: number; upper: number; central: number; lower: number };
  dataFirst: { global: number; upper: number; central: number; lower: number } | null;
}) {
  const id = useId().replace(/:/g, '');
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const max = 2.5;
  const axes = [
    { key: 'global' as const, label: 'Global' },
    { key: 'upper' as const, label: 'Superior' },
    { key: 'central' as const, label: 'Central' },
    { key: 'lower' as const, label: 'Inferior' },
  ];
  const angles = axes.map((_, i) => (Math.PI * 2 * i) / axes.length - Math.PI / 2);
  const polygon = (data: { global: number; upper: number; central: number; lower: number }) =>
    axes
      .map((ax, i) => {
        const v = Math.min(data[ax.key], max);
        const rr = (v / max) * r;
        return `${cx + rr * Math.cos(angles[i])},${cy + rr * Math.sin(angles[i])}`;
      })
      .join(' ');
  const ringRadii = [0.5, 1.0, 1.5, 2.0, 2.5];
  return (
    <svg
      width="100%"
      height="auto"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: 300, display: 'block' }}
    >
      <defs>
        <radialGradient id={`radar-${id}`}>
          <stop offset="0%" stopColor={KORE.cream} stopOpacity="0.55" />
          <stop offset="100%" stopColor={KORE.gold} stopOpacity="0.18" />
        </radialGradient>
      </defs>
      {ringRadii.map((v, i) => {
        const rr = (v / max) * r;
        const b = band(v);
        const ringOpacity = v === 1.0 ? 0.45 : 0.32;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={rr}
            fill="none" stroke={b.color} strokeOpacity={ringOpacity} strokeWidth="1"
            strokeDasharray={i === 0 ? '0' : '2,3'}
          />
        );
      })}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(231,200,160,0.28)" strokeWidth="1" />
      ))}
      {dataFirst && (
        <polygon points={polygon(dataFirst)} fill="rgba(228,168,168,0.10)" stroke={KORE.sakuraDeep} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="3,3" />
      )}
      <polygon
        points={polygon(dataLatest)}
        fill={`url(#radar-${id})`}
        stroke={KORE.cream}
        strokeWidth="2.2"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(255,233,220,0.35))' }}
      />
      {axes.map((ax, i) => {
        const v = Math.min(dataLatest[ax.key], max);
        const rr = (v / max) * r;
        const x = cx + rr * Math.cos(angles[i]);
        const y = cy + rr * Math.sin(angles[i]);
        return (
          <g key={ax.key}>
            <circle cx={x} cy={y} r="8" fill={KORE.gold} fillOpacity="0.18" />
            <circle cx={x} cy={y} r="5" fill={KORE.ivory} stroke={KORE.gold} strokeWidth="1.8" />
          </g>
        );
      })}
      {axes.map((ax, i) => {
        const lr = r + 22;
        const x = cx + lr * Math.cos(angles[i]);
        const y = cy + lr * Math.sin(angles[i]);
        return (
          <g key={ax.key} transform={`translate(${x},${y})`}>
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="Montserrat"
              fontSize="10"
              fontWeight="700"
              fill={KORE.gold}
              letterSpacing="1.5"
              style={{ paintOrder: 'stroke fill', stroke: '#2D0F1A', strokeWidth: 3, strokeLinejoin: 'round' }}
            >
              {ax.label.toUpperCase()}
            </text>
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y="14"
              fontFamily="Cinzel"
              fontSize="13"
              fontWeight="600"
              fill={KORE.ivory}
              style={{ paintOrder: 'stroke fill', stroke: '#2D0F1A', strokeWidth: 3, strokeLinejoin: 'round' }}
            >
              {dataLatest[ax.key].toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Actualizar call site del `RadarChart` en `Hero`**

En `Hero` (línea 533), eliminar la prop `size={300}` ya no usada. El wrapper que contiene el radar pasa de `<div className="flex justify-center">` a un wrapper con `maxWidth` para limitar el chart en pantallas muy grandes:

```tsx
<div className="flex justify-center">
  <div style={{ width: '100%', maxWidth: 320 }}>
    <RadarChart dataLatest={dataLatest} dataFirst={dataFirst} />
  </div>
</div>
```

- [ ] **Step 3: Verificar TypeScript compila**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: sin errores en `app/(app)/my-posturometry/page.tsx`. Si el TS detecta el `size` huérfano en otra parte, removerlo.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(app\)/my-posturometry/page.tsx
git commit -m "$(cat <<'EOF'
feat(posturometry): radar chart responsive con datapoints legibles

- SVG ahora usa viewBox para escalar con el contenedor (maxWidth 320)
- Datapoints r=3.5 → r=5 con halo gold detrás (r=8, opacity 0.18)
- Anillos guía opacity 0.18 → 0.32 (anillo límite leve→moderado a 0.45)
- Polígono datos con stroke 2.2 + drop-shadow cream para destacar
- Labels con paint-order stroke fill (wine) para legibilidad sobre el polígono

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Region cards carousel (mobile + tablet)

**Files:**
- Modify: `frontend/app/(app)/my-posturometry/page.tsx:1126-1146` (sección "Por región")
- Add: nuevo componente local `RegionsCarousel` antes de la sección "REGION CARDS" (después de `RegionCard`, antes de `FindingsList`).

- [ ] **Step 1: Importar `useRef, useState` adicionales**

Modificar la línea 3:

```tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 2: Agregar `RegionsCarousel` después de `RegionCard`**

Insertar el componente nuevo entre `RegionCard` (línea ~703) y `FindingsList` (línea ~709). El comportamiento:
- `<lg` (mobile + tablet, < 1024px): contenedor `flex overflow-x-auto snap-x snap-mandatory` con cada card a `w-[88%] max-w-[440px] shrink-0 snap-center`, padding lateral para que asome la siguiente, scrollbar oculta.
- `lg+`: el mismo contenedor se convierte en `lg:grid lg:grid-cols-2 lg:gap-5 lg:overflow-visible` y las cards ya no son `shrink-0` (width auto).
- Bullets sólo se renderizan en `<lg` (`lg:hidden`).
- Tracking del index con `IntersectionObserver` sobre cada card; el de mayor `intersectionRatio` queda activo.
- Click en bullet → `scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })`.

```tsx
function RegionsCarousel({
  regions, latest, first,
}: {
  regions: Array<'global' | 'upper' | 'central' | 'lower'>;
  latest: PosturometryEvaluation;
  first: PosturometryEvaluation | null;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best = { idx: activeIndex, ratio: 0 };
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.idx);
          if (entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best.ratio > 0.55) setActiveIndex(best.idx);
      },
      { root: trackRef.current, threshold: [0.4, 0.55, 0.7, 0.9] },
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [activeIndex]);

  const scrollTo = (idx: number) => {
    const el = cardRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <>
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 pb-3 lg:grid lg:grid-cols-2 lg:gap-5 lg:mx-0 lg:px-0 lg:pb-0 lg:overflow-visible"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <style>{`.regions-carousel-track::-webkit-scrollbar{display:none}`}</style>
        {regions.map((rk, idx) => (
          <div
            key={rk}
            ref={(el) => { cardRefs.current[idx] = el; }}
            data-idx={idx}
            className="snap-center shrink-0 w-[88%] max-w-[440px] lg:w-auto lg:max-w-none lg:shrink"
          >
            <RegionCard regionKey={rk} latest={latest} first={first} />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2.5 lg:hidden" role="tablist" aria-label="Regiones">
        {regions.map((rk, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={rk}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Ver ${REGION_LABELS[rk]}`}
              onClick={() => scrollTo(idx)}
              className="grid place-items-center transition-all"
              style={{
                width: 28, height: 28, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: isActive ? 10 : 8,
                  height: isActive ? 10 : 8,
                  borderRadius: 999,
                  background: isActive ? KORE.gold : 'transparent',
                  border: isActive ? `1px solid ${KORE.goldDeep}` : `1px solid ${KORE.gold}66`,
                  boxShadow: isActive
                    ? `0 0 0 4px ${KORE.gold}22, 0 0 0 5px ${KORE.wineDark}1A`
                    : 'none',
                  transition: 'all 280ms ease-out',
                }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Reemplazar el grid actual por el carrusel**

En `MyPosturometryPage` (líneas 1126-1146), sustituir:

```tsx
{/* REGION CARDS */}
<div className="mt-10 xl:mt-14">
  <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
    <div>
      <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>
        Tu cuerpo en 4 lecturas
      </p>
      <h2 className="font-heading text-2xl xl:text-[26px] font-semibold mt-1" style={{ color: KORE.wineDark }}>
        Por región
      </h2>
    </div>
    <span className="text-[11px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
      Bandas · ≤ 0.50 funcional · ≤ 1.20 leve · ≤ 2.00 moderado · &gt; 2.00 importante
    </span>
  </div>
  <RegionsCarousel regions={orderedRegions} latest={latest} first={first} />
</div>
```

- [ ] **Step 4: Build TS check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "my-posturometry" | head -10`
Expected: vacío.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(app\)/my-posturometry/page.tsx
git commit -m "$(cat <<'EOF'
feat(posturometry): convertir "Por región" en carrusel con bullets dorados

- En <lg: scroll-snap horizontal con peek de la siguiente card (w-[88%], max 440px)
- En lg+: grid 2 columnas como estaba — sin cambios visuales en desktop
- Bullets gold debajo (sólo <lg): activo con halo wine, inactivo ring gold 40%
- IntersectionObserver para tracking del índice activo
- Click en bullet hace smooth scroll a la card

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ViewSection responsive (comparativa de fotos)

**Files:**
- Modify: `frontend/app/(app)/my-posturometry/page.tsx:319-403` (`PhotoFrame`, ajustar para que altura sea opcional/controlable)
- Modify: `frontend/app/(app)/my-posturometry/page.tsx:778-870` (`ViewSection`)

- [ ] **Step 1: Hacer `PhotoFrame` flexible para alturas responsive**

Modificar `PhotoFrame` para que `height` sea opcional y se pueda inyectar altura desde el contenedor padre vía `className`. Si no se pasa `height`, el componente usa altura 100% del padre (deja que el padre la controle con Tailwind).

```tsx
function PhotoFrame({
  src, label, sublabel, dim = false, height, className,
}: {
  src: string | null;
  label: string;
  sublabel?: string;
  dim?: boolean;
  height?: number;
  className?: string;
}) {
  const sizeStyle = height ? { height } : { height: '100%' };
  if (!src) {
    return (
      <div
        className={`relative grid place-items-center ${className ?? ''}`}
        style={{
          borderRadius: 18,
          ...sizeStyle,
          background: 'rgba(103,15,34,0.05)',
          border: '1px dashed rgba(103,15,34,0.18)',
        }}
      >
        <div className="text-center">
          <div className="font-heading text-3xl" style={{ color: 'rgba(103,15,34,0.30)' }}>—</div>
          <div className="text-[10px] font-bold uppercase mt-2" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.45)' }}>{label}</div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{
        borderRadius: 18,
        background: '#1A0A11',
        ...sizeStyle,
        boxShadow: '0 8px 24px -10px rgba(45,15,26,0.4), inset 0 0 0 1px rgba(231,200,160,0.18)',
      }}
    >
      {/* resto del componente sin cambios — img, overlay, grid svg, label, sublabel */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dim ? 'grayscale(0.35) brightness(0.85)' : 'none' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(20,5,10,0.20) 0%, transparent 30%, transparent 65%, rgba(20,5,10,0.55) 100%)' }}
      />
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,233,220,0.35)" strokeWidth="0.18" strokeDasharray="0.6,0.8" />
        <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="rgba(255,233,220,0.14)" strokeWidth="0.12" />
        <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="rgba(255,233,220,0.14)" strokeWidth="0.12" />
        <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="rgba(255,233,220,0.14)" strokeWidth="0.12" />
        <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="rgba(255,233,220,0.14)" strokeWidth="0.12" />
        {[
          [3, 3, 'tl'],
          [97, 3, 'tr'],
          [3, 97, 'bl'],
          [97, 97, 'br'],
        ].map(([x, y, k]) => (
          <circle key={k as string} cx={x as number} cy={y as number} r="0.5" fill={KORE.gold} opacity="0.55" />
        ))}
      </svg>
      <div
        className="absolute"
        style={{
          top: 14, left: 16, padding: '5px 12px', borderRadius: 999,
          background: 'rgba(20,5,10,0.55)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(231,200,160,0.30)',
        }}
      >
        <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: KORE.gold }}>{label}</span>
      </div>
      {sublabel && (
        <div className="absolute" style={{ bottom: 14, left: 16, right: 16 }}>
          <span className="font-heading text-[13px] font-semibold" style={{ color: KORE.ivory, letterSpacing: '0.04em' }}>{sublabel}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Refactorizar el grid de `ViewSection`**

En `ViewSection` (líneas 842-867), reemplazar el bloque `<div className="grid gap-5" style={{ gridTemplateColumns: ... }}>` con un sistema responsive. La estructura nueva:

- **`<md`**: stack vertical. Foto inicial (h-72) → foto última (h-72) → findings full-width debajo.
- **`md+`**: fotos lado a lado en grid 2-col (`md:grid-cols-2`), findings full-width en una tercera fila (`md:col-span-2`). Fotos `md:h-96`.
- **`lg+`**: layout actual 3-col `[1.1fr_1fr_1.1fr]`, fotos a los lados con findings en el centro. Altura `lg:h-[520px]`.

Para lograr esto con CSS Grid, uso `grid-template-areas` por breakpoint:

```tsx
<div
  className={`grid gap-5 ${first
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.1fr]'
    : 'grid-cols-1 lg:grid-cols-2'
  }`}
>
  {first && (
    <div className="h-72 md:h-96 lg:h-[520px] lg:order-1">
      <PhotoFrame
        src={photoFirst}
        label={`Inicial · ${formatDate(first.evaluation_date || first.created_at)}`}
        sublabel={meta.label}
        dim
      />
    </div>
  )}
  <div className="px-1 py-2 md:col-span-2 lg:col-span-1 lg:order-2">
    <p className="text-[10px] font-bold uppercase mb-4" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>
      Hallazgos · Última evaluación
    </p>
    <FindingsList ev={latest} viewKey={viewKey} />
  </div>
  <div className="h-72 md:h-96 lg:h-[520px] lg:order-3">
    <PhotoFrame
      src={photoLatest}
      label={`Última · ${formatDate(latest.evaluation_date || latest.created_at)}`}
      sublabel={meta.label}
    />
  </div>
</div>
```

Notas sobre el orden:
- Sin `first`: 2 columnas en lg (foto + findings). En mobile: foto última primero, findings debajo. Como sólo hay una foto y no compite, el orden natural funciona.
- Con `first`: en mobile el orden DOM es `[foto inicial, findings (col-span-2), foto última]`. En md sigue siendo el mismo (foto inicial top-left, foto última top-right, findings span 2 abajo). En lg uso `order-1/2/3` para que findings quede al centro entre las dos fotos.

- [ ] **Step 3: Build TS check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "my-posturometry" | head -10`
Expected: vacío.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(app\)/my-posturometry/page.tsx
git commit -m "$(cat <<'EOF'
feat(posturometry): ViewSection responsive con grid por breakpoint

- PhotoFrame ahora acepta height opcional + className para que padre controle altura
- <md: stack vertical (foto inicial → foto última → findings full-width)
- md+: grid 2-col para fotos, findings col-span-2 debajo
- lg+: layout 3-col original con findings al centro (via order-1/2/3)
- Alturas responsivas h-72 / md:h-96 / lg:h-[520px]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verificación visual end-to-end

**Files:**
- No file changes — sólo verificación.

- [ ] **Step 1: Levantar dev server**

Run: `cd frontend && npm run dev` (background)
Expected: server en `http://localhost:3000` (o 3001 si el puerto está ocupado).

- [ ] **Step 2: Verificar visualmente en breakpoints**

Abrir DevTools y revisar `/my-posturometry` en:
- **375px** (iPhone SE): radar legible, cards en carrusel con peek, bullets visibles, fotos del ViewSection stacked.
- **768px** (iPad portrait): radar tamaño moderado, carrusel aún activo (md está en 768 pero `<lg`), fotos en md ya pueden estar en 2-col.
- **1024px** (iPad landscape / desktop): grid 2-col en regiones, sin bullets, ViewSection en 3-col.
- **1440px** (laptop): chart 300px máx, todo el layout en su forma desktop.

En cada breakpoint:
- ¿Los datapoints del radar son notorios? ¿Los anillos se ven?
- ¿El carrusel se desliza suave con swipe / scroll?
- ¿Los bullets reaccionan al scroll y al click?
- ¿Las fotos del ViewSection se ven completas sin compresión absurda?

- [ ] **Step 3: Build de producción para confirmar export estático**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: build exitoso, sin errores TS, `Route (app) ✓ /my-posturometry` listado.

- [ ] **Step 4: Si hay ajustes, hacerlos y commitear**

Cualquier polish post-verificación visual va en un commit final tipo `style(posturometry): ajustes finos post-QA visual`.

---

## Self-Review

**Spec coverage:**
- ✅ Fix 1 (radar chart legibilidad/responsive) → Task 1
- ✅ Fix 2 (cards región → carrusel con bullets gold) → Task 2
- ✅ Fix 3 (ViewSection responsive) → Task 3
- ✅ Verificación visual → Task 4

**Placeholder scan:**
- Ningún "TBD" o "TODO" en el plan.
- Todos los snippets tienen código completo.
- Comandos exactos con expected output.

**Type consistency:**
- `RadarChart` perdió la prop `size` (era opcional con default 300) — actualicé el único call site en `Hero` (Step 2 de Task 1).
- `PhotoFrame` ahora acepta `className` opcional y `height` ya era opcional — no rompe call sites existentes (los del `Hero` siguen pasando `height={420}`).
- `RegionsCarousel` toma `regions, latest, first` consistente con el patrón existente de `RegionCard`.

**Scope check:** Un solo archivo, tres bloques independientes pero cohesivos. No requiere descomposición.
