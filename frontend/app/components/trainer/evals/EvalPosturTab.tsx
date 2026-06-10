'use client';

import { useEffect, useState, useCallback, useId, useMemo } from 'react';
import {
  usePosturometryStore,
  type PosturometryFormData,
  type PosturometryEvaluation,
  type ViewData,
} from '@/lib/stores/posturometryStore';
import {
  T, FormHero, FormSection, Field, ChipSelect, ComputedCard,
  NotesField, PhotoSlot, StickyFooter, EvalSectionHeader, EvalEmptyState, EvalSpinner,
} from './shared';

// ─── Helpers ──────────────────────────────────────────────────
const KORE = {
  ivory:      '#FFF8EC',
  cream:      '#FFE9DC',
  gold:       '#E7C8A0',
  sage:       '#A8C29C',
  sageSoft:   '#C2D6B8',
  sakuraDeep: '#E4A8A8',
  amber:      '#E5C97A',
  copper:     '#E5A574',
  wineDark:   '#670F22',
};

type PosturBand = { name: string; color: string; darkColor: string; bg: string; border: string };

function posturBand(v: number): PosturBand {
  if (v <= 0.5) return { name: 'Funcional',  color: KORE.sage,       darkColor: KORE.gold,       bg: 'rgba(168,194,156,0.18)', border: 'rgba(168,194,156,0.40)' };
  if (v <= 1.2) return { name: 'Leve',       color: KORE.amber,      darkColor: KORE.amber,      bg: 'rgba(229,201,122,0.18)', border: 'rgba(229,201,122,0.40)' };
  if (v <= 2.0) return { name: 'Moderado',   color: KORE.copper,     darkColor: KORE.copper,     bg: 'rgba(229,165,116,0.20)', border: 'rgba(229,165,116,0.42)' };
  return          { name: 'Importante',       color: KORE.sakuraDeep, darkColor: KORE.sakuraDeep, bg: 'rgba(228,168,168,0.22)', border: 'rgba(228,168,168,0.44)' };
}

function num(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null;
  const n = typeof s === 'number' ? s : parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Delta pill (lower is better for posturometry) ────────────
function Delta({
  now, prev, higherBetter = false, decimals = 2, dark = false, big = false,
}: {
  now: number | null;
  prev: number | null;
  higherBetter?: boolean;
  decimals?: number;
  dark?: boolean;
  big?: boolean;
}) {
  if (now === null || prev === null) return null;
  const diff = now - prev;
  const noChange = Math.abs(diff) < 0.05;
  const improve = higherBetter ? diff > 0 : diff < 0;
  const color = noChange
    ? (dark ? 'rgba(231,200,160,0.7)' : 'rgba(103,15,34,0.5)')
    : improve ? KORE.sage : KORE.sakuraDeep;
  const bg = noChange
    ? (dark ? 'rgba(231,200,160,0.10)' : 'rgba(103,15,34,0.05)')
    : improve ? 'rgba(168,194,156,0.18)' : 'rgba(228,168,168,0.18)';
  const borderColor = noChange
    ? (dark ? 'rgba(231,200,160,0.20)' : 'rgba(103,15,34,0.10)')
    : improve ? 'rgba(168,194,156,0.30)' : 'rgba(228,168,168,0.30)';
  const arrow = noChange ? '–' : diff < 0 ? '↓' : '↑';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: big ? '4px 10px' : '2px 8px', borderRadius: 999,
      background: bg, border: `1px solid ${borderColor}`, color,
      fontSize: big ? 12 : 11, fontFamily: 'Montserrat, sans-serif',
      fontWeight: 600, letterSpacing: '0.02em',
    }}>
      {arrow} {Math.abs(diff).toFixed(decimals)}
    </span>
  );
}

// ─── Radar (4 axes — LOWER is better, so larger area = worse) ─
function RadarChart({
  size = 280,
  dataLatest,
  dataFirst,
}: {
  size?: number;
  dataLatest: { global: number; upper: number; central: number; lower: number };
  dataFirst: typeof dataLatest | null;
}) {
  const id = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.34;
  const max = 2.5;
  const axes = [
    { key: 'global'  as const, label: 'Global' },
    { key: 'upper'   as const, label: 'Superior' },
    { key: 'central' as const, label: 'Central' },
    { key: 'lower'   as const, label: 'Inferior' },
  ];
  const angles = axes.map((_, i) => (Math.PI * 2 * i) / axes.length - Math.PI / 2);
  const polygon = (d: typeof dataLatest) =>
    axes.map((ax, i) => {
      const v = Math.min(d[ax.key], max);
      const rr = (v / max) * r;
      return `${cx + rr * Math.cos(angles[i])},${cy + rr * Math.sin(angles[i])}`;
    }).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="auto" style={{ maxWidth: size }}>
      <defs>
        <radialGradient id={`radar-p-${id}`}>
          <stop offset="0%" stopColor={KORE.cream} stopOpacity="0.55" />
          <stop offset="100%" stopColor={KORE.gold} stopOpacity="0.18" />
        </radialGradient>
      </defs>
      {[0.5, 1.0, 1.5, 2.0, 2.5].map((v, i) => {
        const rr = (v/max)*r;
        const b = posturBand(v);
        return (
          <circle key={i} cx={cx} cy={cy} r={rr}
            fill="none" stroke={b.color} strokeOpacity="0.18" strokeWidth="1"
            strokeDasharray={i === 0 ? '0' : '2,3'} />
        );
      })}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)}
          stroke="rgba(231,200,160,0.20)" strokeWidth="1" />
      ))}
      {dataFirst && (
        <polygon points={polygon(dataFirst)}
          fill="rgba(228,168,168,0.10)" stroke={KORE.sakuraDeep}
          strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="3,3" />
      )}
      <polygon points={polygon(dataLatest)}
        fill={`url(#radar-p-${id})`} stroke={KORE.cream}
        strokeWidth="1.8" strokeLinejoin="round" />
      {axes.map((ax, i) => {
        const v = Math.min(dataLatest[ax.key], max);
        const rr = (v/max)*r;
        return <circle key={ax.key} cx={cx+rr*Math.cos(angles[i])} cy={cy+rr*Math.sin(angles[i])}
          r="3.5" fill={KORE.ivory} stroke={KORE.gold} strokeWidth="1.5" />;
      })}
      {axes.map((ax, i) => {
        const lr = r + 24;
        const x = cx + lr * Math.cos(angles[i]);
        const y = cy + lr * Math.sin(angles[i]);
        return (
          <g key={ax.key} transform={`translate(${x},${y})`}>
            <text textAnchor="middle" dominantBaseline="middle"
              fontFamily="Montserrat" fontSize="9" fontWeight="700"
              fill={KORE.gold} letterSpacing="1.2">
              {ax.label.toUpperCase()}
            </text>
            <text textAnchor="middle" dominantBaseline="middle" y="13"
              fontFamily="Cinzel" fontSize="11" fontWeight="600" fill={KORE.ivory}>
              {dataLatest[ax.key].toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mode toggle pill ─────────────────────────────────────────
function ModePill({
  mode, onChange,
}: { mode: 'results' | 'form'; onChange: (m: 'results' | 'form') => void }) {
  return (
    <div style={{
      display: 'inline-flex', borderRadius: 999, padding: 3,
      background: 'rgba(255,255,255,0.70)', border: `1px solid ${T.border}`, marginBottom: 20,
    }}>
      {(['results', 'form'] as const).map(m => {
        const sel = m === mode;
        return (
          <button key={m} type="button" onClick={() => onChange(m)} style={{
            padding: '7px 18px', borderRadius: 999,
            background: sel ? 'rgba(103,15,34,0.10)' : 'transparent',
            border: 'none',
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: sel ? T.wine : T.textMed,
            cursor: 'pointer',
          }}>
            {m === 'results' ? 'Resultados' : 'Formulario'}
          </button>
        );
      })}
    </div>
  );
}

// ─── Region definitions ───────────────────────────────────────
const REGION_LABELS: Record<string, string> = {
  global: 'Global', upper: 'Tren superior', central: 'Tren central', lower: 'Tren inferior',
};
const REGION_DESCRIPTIONS: Record<string, string> = {
  global:  'Promedio ponderado de las tres regiones. Lectura postural general del cliente.',
  upper:   'Cabeza, cuello, hombros, escápulas. Zona que el patrón sedentario afecta más.',
  central: 'Columna, abdomen, cadera. Eje de transmisión de la fuerza y el movimiento.',
  lower:   'Rodillas, tobillos, pies. Base que sostiene toda la cadena.',
};
const REGION_IMPORTANCE: Record<string, Record<string, string>> = {
  global:  { green: 'Postura funcional, base de movimiento eficiente.',  yellow: 'Mejorar global reduce dolor y mejora respiración.', orange: 'Afecta distribución de carga en ejercicios.', red: 'Prioritario: afecta cada patrón de movimiento.' },
  upper:   { green: 'Movilidad de brazos y hombros funcional.',          yellow: 'Cede bien con movilidad torácica y fortalecimiento escapular.', orange: 'Limita rendimiento en tracción y empuje.', red: 'Requiere atención prioritaria.' },
  central: { green: 'Eje estable, centro de control del movimiento.',    yellow: 'Pequeños desbalances cambian transmisión de fuerza.', orange: 'Afecta estabilidad, fuerza y prevención de lesiones.', red: 'Corregir eje es paso previo a progresar en carga.' },
  lower:   { green: 'Base sólida, buen apoyo para toda la estructura.', yellow: 'Cambios en absorción de impacto al caminar.', orange: 'Afecta la cadena ascendente — rodillas, cadera, espalda.', red: 'Corrección de alineación antes de añadir carga.' },
};
const REGION_NEXT_STEP: Record<string, Record<string, string>> = {
  global:  { green: 'Mantener plan: movilidad + cadena posterior.',       yellow: 'Correctivos específicos en próxima fase.', orange: 'Trabajo correctivo como parte central del programa.', red: 'Plan enfocado en corrección antes de progresar en carga.' },
  upper:   { green: 'Mantener movilidad cervical y escapular.',            yellow: 'Movilidad cervical + fortalecimiento escapular.', orange: 'Liberación pectoral menor + romboides y trapecio medio.', red: 'Prioridad correctiva antes de carga de tren superior.' },
  central: { green: 'Seguir fortaleciendo core y movilidad de columna.',  yellow: 'Estabilización de core y movilidad segmentaria.', orange: 'Activación de transverso + trabajo de glúteo medio.', red: 'Trabajo progresivo de estabilidad y control motor.' },
  lower:   { green: 'Mantener fuerza de tren inferior y movilidad.',      yellow: 'Estabilizadores de rodilla + movilidad de tobillo.', orange: 'Propiocepción unipodal + tibial posterior.', red: 'Corrección de alineación antes de carga.' },
};
const REGION_ICONS: Record<string, string> = { global: '◯', upper: '◔', central: '◑', lower: '◕' };

type RegionKey = 'global' | 'upper' | 'central' | 'lower';

function RegionCard({ regionKey, latest, first }: {
  regionKey: RegionKey;
  latest: PosturometryEvaluation;
  first: PosturometryEvaluation | null;
}) {
  const fieldMap: Record<RegionKey, keyof PosturometryEvaluation> = {
    global: 'global_index', upper: 'upper_index', central: 'central_index', lower: 'lower_index',
  };
  const colorMap: Record<RegionKey, keyof PosturometryEvaluation> = {
    global: 'global_color', upper: 'upper_color', central: 'central_color', lower: 'lower_color',
  };
  const value      = num(latest[fieldMap[regionKey]] as string) ?? 0;
  const firstValue = first ? num(first[fieldMap[regionKey]] as string) : null;
  const colorKey   = (latest[colorMap[regionKey]] as string) || 'green';
  const b          = posturBand(value);
  const max        = 2.5;
  const pct        = Math.min((value / max) * 100, 100);

  const importance = REGION_IMPORTANCE[regionKey][colorKey] || REGION_IMPORTANCE[regionKey].green;
  const nextStep   = REGION_NEXT_STEP[regionKey][colorKey]  || REGION_NEXT_STEP[regionKey].green;
  const customRec  = latest.recommendations?.[regionKey];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: 22, borderRadius: 20,
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(103,15,34,0.08)',
      boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: b.color, flexShrink: 0, lineHeight: 1 }}>
            {REGION_ICONS[regionKey]}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)' }}>
              {REGION_LABELS[regionKey]}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: 30, fontWeight: 600, color: KORE.wineDark, letterSpacing: '-0.01em', lineHeight: 1 }}>
                {value.toFixed(2)}
              </span>
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600, color: b.color, letterSpacing: '0.05em' }}>
                {b.name}
              </span>
            </div>
          </div>
        </div>
        <Delta now={value} prev={firstValue} big />
      </div>

      {/* 4-band scale bar */}
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(103,15,34,0.06)', overflow: 'visible' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ flex: 0.5, background: 'rgba(168,194,156,0.20)' }} />
          <div style={{ flex: 0.7, background: 'rgba(229,201,122,0.20)' }} />
          <div style={{ flex: 0.8, background: 'rgba(229,165,116,0.22)' }} />
          <div style={{ flex: 0.5, background: 'rgba(228,168,168,0.22)' }} />
        </div>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`,
          background: `linear-gradient(90deg, ${b.color}AA, ${b.color})`,
          borderRadius: 4, boxShadow: `0 0 12px ${b.color}55`,
          transition: 'width 700ms ease-out',
        }} />
        <div style={{
          position: 'absolute', top: -4, left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: 8,
          background: KORE.ivory, border: `2px solid ${b.color}`,
          boxShadow: '0 2px 6px rgba(45,15,26,0.18)',
        }} />
      </div>

      {/* Description + Importance */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.45)', marginBottom: 5 }}>Qué evaluamos</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, lineHeight: 1.6, color: '#3A2128' }}>{REGION_DESCRIPTIONS[regionKey]}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.45)', marginBottom: 5 }}>Por qué importa</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, lineHeight: 1.6, color: '#3A2128' }}>{importance}</div>
        </div>
      </div>

      {/* Next step */}
      <div style={{
        padding: '13px 15px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
        border: '1px solid rgba(103,15,34,0.08)',
      }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: T.wine, marginBottom: 5 }}>Próximo paso</div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, lineHeight: 1.55, fontStyle: 'italic', color: '#3A2128' }}>
          {customRec?.action || nextStep}
        </div>
        {customRec?.result && (
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 600, color: b.color, marginTop: 8, letterSpacing: '0.02em' }}>
            {customRec.result}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View section (findings + photos) ────────────────────────
type PosturViewKey = 'anterior' | 'lateral_right' | 'lateral_left' | 'posterior';

const VIEW_META: Record<PosturViewKey, { label: string }> = {
  anterior:      { label: 'Vista anterior' },
  lateral_right: { label: 'Vista lateral derecha' },
  lateral_left:  { label: 'Vista lateral izquierda' },
  posterior:     { label: 'Vista posterior' },
};

function getViewPhoto(ev: PosturometryEvaluation, k: PosturViewKey): string | null {
  if (k === 'anterior')      return ev.anterior_photo;
  if (k === 'lateral_right') return ev.lateral_right_photo;
  if (k === 'lateral_left')  return ev.lateral_left_photo;
  return ev.posterior_photo;
}

function getViewObs(ev: PosturometryEvaluation, k: PosturViewKey): string {
  if (k === 'anterior')      return ev.anterior_observations || '';
  if (k === 'lateral_right') return ev.lateral_right_observations || '';
  if (k === 'lateral_left')  return ev.lateral_left_observations || '';
  return ev.posterior_observations || '';
}

function ViewCard({ viewKey, latest, first }: {
  viewKey: PosturViewKey;
  latest: PosturometryEvaluation;
  first: PosturometryEvaluation | null;
}) {
  const meta       = VIEW_META[viewKey];
  const photo      = getViewPhoto(latest, viewKey);
  const photoFirst = first ? getViewPhoto(first, viewKey) : null;
  const obs        = getViewObs(latest, viewKey);
  const findings   = latest.findings?.[viewKey] ?? [];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.65)', borderRadius: 22,
      padding: 22, border: '1px solid rgba(103,15,34,0.08)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid rgba(103,15,34,0.08)',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine }}>{meta.label}</div>
        {findings.length > 0 && (
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: KORE.copper }}>
            {findings.length} hallazgos
          </span>
        )}
      </div>

      {obs && (
        <div style={{
          padding: '11px 14px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(231,200,160,0.10)', border: '1px solid rgba(231,200,160,0.30)',
        }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.wine, marginBottom: 4 }}>Observación</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontStyle: 'italic', lineHeight: 1.55, color: '#3A2128' }}>"{obs}"</div>
        </div>
      )}

      {/* Photos + findings */}
      <div className={first ? 'grid grid-cols-1 sm:grid-cols-3' : 'grid grid-cols-1 sm:grid-cols-2'} style={{ gap: 14 }}>
        {first && (
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 6 }}>
              Inicial · {formatDate(first.evaluation_date)}
            </div>
            <div style={{
              aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden',
              background: photoFirst ? '#1A0A11' : 'rgba(103,15,34,0.05)',
              border: photoFirst ? 'none' : '1px dashed rgba(103,15,34,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {photoFirst
                ? <img src={photoFirst} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.35) brightness(0.85)' }} />
                : <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: 'rgba(103,15,34,0.45)' }}>Sin foto</span>
              }
            </div>
          </div>
        )}

        {/* Findings list */}
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 6 }}>
            Hallazgos
          </div>
          {findings.length === 0 ? (
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontStyle: 'italic', color: 'rgba(103,15,34,0.45)' }}>
              Sin hallazgos para esta vista.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {findings.map((f, i) => {
                const idx = f.indexOf(':');
                const zona = idx > 0 ? f.slice(0, idx).trim() : f;
                const desc = idx > 0 ? f.slice(idx + 1).trim() : '';
                const lower = f.toLowerCase();
                const c = lower.includes('severa') || lower.includes('severo')
                  ? KORE.sakuraDeep
                  : lower.includes('leve') ? KORE.amber : KORE.copper;
                return (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(103,15,34,0.06)',
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: c, flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600, color: KORE.wineDark }}>{zona}</span>
                      {desc && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#3A2128' }}> · {desc}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Latest photo */}
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 6 }}>
            Última · {formatDate(latest.evaluation_date)}
          </div>
          <div style={{
            aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden',
            background: photo ? '#1A0A11' : 'rgba(103,15,34,0.05)',
            border: photo ? 'none' : '1px dashed rgba(103,15,34,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {photo
              ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: 'rgba(103,15,34,0.45)' }}>Sin foto</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero (dark card) ─────────────────────────────────────────
function ResultsHero({ latest, first }: { latest: PosturometryEvaluation; first: PosturometryEvaluation | null }) {
  const g      = num(latest.global_index) ?? 0;
  const gFirst = first ? num(first.global_index) : null;
  const b      = posturBand(g);

  const dataLatest = { global: g, upper: num(latest.upper_index) ?? 0, central: num(latest.central_index) ?? 0, lower: num(latest.lower_index) ?? 0 };
  const dataFirst  = first
    ? { global: num(first.global_index) ?? 0, upper: num(first.upper_index) ?? 0, central: num(first.central_index) ?? 0, lower: num(first.lower_index) ?? 0 }
    : null;

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 24,
      background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
      padding: 28, marginBottom: 20,
      boxShadow: '0 20px 50px -20px rgba(45,15,26,0.50)',
    }}>
      <div style={{
        position: 'absolute', top: '-20%', right: '-12%', width: 380, height: 380,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center">
        {/* LEFT: index + radar */}
        <div className="min-w-0 xl:flex-1">
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: KORE.gold }}>
            Índice postural global
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 64, fontWeight: 600, color: KORE.ivory, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {g.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 999,
              fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              background: `${b.darkColor}22`, border: `1px solid ${b.darkColor}66`, color: b.darkColor,
            }}>● Banda {b.name}</span>
            {gFirst !== null && <Delta now={g} prev={gFirst} big dark decimals={2} />}
          </div>
          {/* radar */}
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 18,
            background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.15)',
            backdropFilter: 'blur(6px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: KORE.gold }}>Mapa por región</span>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: 'Montserrat, sans-serif', color: 'rgba(255,233,220,0.7)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 14, height: 2, background: KORE.cream, display: 'inline-block' }} /> Última
                </span>
                {first && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 14, height: 2, borderTop: `2px dashed ${KORE.sakuraDeep}`, display: 'inline-block' }} /> Inicial
                  </span>
                )}
              </div>
            </div>
            <RadarChart size={260} dataLatest={dataLatest} dataFirst={dataFirst} />
          </div>
        </div>

        {/* RIGHT: before/after anterior photos */}
        <div className="flex w-full flex-col gap-3 xl:w-[240px] xl:shrink-0">
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: KORE.gold }}>
            Vista anterior
          </div>
          <div className="grid grid-cols-2" style={{ gap: 10 }}>
            {[
              { photo: first?.anterior_photo ?? null, label: 'Inicial', dim: true },
              { photo: latest.anterior_photo ?? null, label: 'Última', dim: false },
            ].map(({ photo, label, dim }) => (
              <div key={label}>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(231,200,160,0.60)', marginBottom: 5 }}>{label}</div>
                <div style={{
                  width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden',
                  background: photo ? '#1A0A11' : 'rgba(255,255,255,0.05)',
                  border: photo ? '1px solid rgba(231,200,160,0.18)' : '1px dashed rgba(231,200,160,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {photo
                    ? <img src={photo} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dim ? 'grayscale(0.35) brightness(0.85)' : 'none' }} />
                    : <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, color: 'rgba(231,200,160,0.45)' }}>Sin foto</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────
function PosturTimeline({ evaluations }: { evaluations: PosturometryEvaluation[] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.65)', borderRadius: 24,
      padding: 28, border: '1px solid rgba(103,15,34,0.08)',
    }}>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 4 }}>Línea de tiempo postural</div>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textMed, marginBottom: 20 }}>
        {evaluations.length} evaluaciones registradas
      </div>
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{
          position: 'absolute', left: 7, top: 8, bottom: 8, width: 1,
          background: 'linear-gradient(180deg, transparent 0%, rgba(103,15,34,0.20) 12%, rgba(103,15,34,0.20) 88%, transparent 100%)',
        }} />
        {evaluations.map((e, i) => {
          const v = num(e.global_index) ?? 0;
          const b = posturBand(v);
          const isLatest = i === 0;
          const photo = e.anterior_photo;
          return (
            <div key={e.id} className="relative flex flex-col gap-4 sm:flex-row" style={{
              paddingBottom: i < evaluations.length - 1 ? 20 : 0,
            }}>
              <span style={{
                position: 'absolute', left: -23, top: 16,
                width: 16, height: 16, borderRadius: 8,
                background: isLatest ? `radial-gradient(circle, ${b.color}, ${b.color}88)` : KORE.ivory,
                border: `2px solid ${b.color}`,
                boxShadow: isLatest ? `0 0 0 5px ${b.color}22` : 'none',
              }} />
              {/* Photo thumb */}
              <div style={{
                width: 120, height: 160, borderRadius: 14, overflow: 'hidden',
                background: photo ? '#1A0A11' : 'rgba(103,15,34,0.06)',
                border: photo ? 'none' : '1px dashed rgba(103,15,34,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {photo
                  ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isLatest ? 'none' : 'grayscale(0.4) brightness(0.9)' }} />
                  : <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, color: 'rgba(103,15,34,0.40)' }}>Sin foto</span>
                }
              </div>
              {/* Cells */}
              <div style={{ paddingTop: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600, color: KORE.wineDark }}>{formatDate(e.evaluation_date || e.created_at)}</span>
                  {isLatest && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 999,
                      fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.14em',
                      background: `${b.color}22`, border: `1px solid ${b.color}66`, color: b.color,
                    }}>● Reciente</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 6 }}>
                  {([
                    { k: 'global_index'  as const, label: 'Global' },
                    { k: 'upper_index'   as const, label: 'Superior' },
                    { k: 'central_index' as const, label: 'Central' },
                    { k: 'lower_index'   as const, label: 'Inferior' },
                  ]).map(ax => {
                    const val = num(e[ax.k] as string) ?? 0;
                    const bb = posturBand(val);
                    return (
                      <div key={ax.k} style={{
                        padding: '8px 10px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(103,15,34,0.06)',
                      }}>
                        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.50)' }}>{ax.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: KORE.wineDark }}>{val.toFixed(2)}</span>
                          <span style={{ width: 7, height: 7, borderRadius: 4, background: bb.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Results view ─────────────────────────────────────────────
const POSTUR_VIEW_KEYS: PosturViewKey[] = ['anterior', 'lateral_right', 'lateral_left', 'posterior'];
const REGION_KEYS: RegionKey[] = ['global', 'upper', 'central', 'lower'];

function PosturResults({ evaluations, onEdit, onNew }: {
  evaluations: PosturometryEvaluation[];
  onEdit: () => void;
  onNew: () => void;
}) {
  const latest = evaluations[0];
  const first  = evaluations.length > 1 ? evaluations[evaluations.length - 1] : null;

  return (
    <div>
      <EvalSectionHeader title="Última evaluación" hint={formatDate(latest.evaluation_date || latest.created_at)} onNew={onNew} />

      {/* Dark hero */}
      <ResultsHero latest={latest} first={first} />

      {/* Region cards */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 4 }}>Tu cuerpo en 4 lecturas</div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 16 }}>Por región</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14, marginBottom: 20 }}>
        {REGION_KEYS.map(rk => (
          <RegionCard key={rk} regionKey={rk} latest={latest} first={first} />
        ))}
      </div>

      {/* View sections */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 4 }}>Las 4 vistas</div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 16 }}>Hallazgos por vista</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        {POSTUR_VIEW_KEYS.map(vk => (
          <ViewCard key={vk} viewKey={vk} latest={latest} first={first} />
        ))}
      </div>

      {/* Timeline */}
      {evaluations.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <PosturTimeline evaluations={evaluations} />
        </div>
      )}

      {/* Trainer notes */}
      {latest.notes && (
        <div style={{
          padding: '20px 24px', borderRadius: 20, marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
          border: '1px solid rgba(103,15,34,0.08)',
        }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.wine, marginBottom: 8 }}>Notas del entrenador</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, fontWeight: 600, color: T.wine, lineHeight: 1.5 }}>"{latest.notes}"</div>
        </div>
      )}

      <button onClick={onEdit} type="button" style={{
        width: '100%', padding: '12px', borderRadius: 14, marginBottom: 16,
        background: 'rgba(103,15,34,0.06)', color: T.wine,
        fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600,
        border: `1px solid rgba(103,15,34,0.12)`, cursor: 'pointer',
      }}>Editar esta evaluación</button>
    </div>
  );
}

// ─── Form segment definitions (unchanged) ─────────────────────
type SegmentDef = { key: string; label: string; options: string[] };

const ANTERIOR_SEGS: SegmentDef[] = [
  { key: 'cabeza',   label: 'Cabeza',   options: ['Alineada', 'Inclinada D', 'Inclinada I', 'Rotada D', 'Rotada I'] },
  { key: 'hombros',  label: 'Hombros',  options: ['Nivelados', 'Elevado D', 'Elevado I', 'Descendido D', 'Descendido I'] },
  { key: 'tronco',   label: 'Tronco',   options: ['Neutro', 'Inclinado D', 'Inclinado I'] },
  { key: 'pelvis',   label: 'Pelvis',   options: ['Nivelada', 'Elevada D', 'Elevada I', 'Rotada D', 'Rotada I'] },
  { key: 'rodillas', label: 'Rodillas', options: ['Neutras', 'Valgo', 'Varo'] },
  { key: 'pies',     label: 'Pies',     options: ['Neutros', 'Pronados', 'Supinados'] },
];
const LATERAL_SEGS: SegmentDef[] = [
  { key: 'cabeza',   label: 'Cabeza',   options: ['Neutra', 'Adelantada', 'Posterior'] },
  { key: 'cervical', label: 'Cervical', options: ['Normal', 'Hiperlordosis', 'Rectificada'] },
  { key: 'dorsal',   label: 'Dorsal',   options: ['Normal', 'Hipercifosis', 'Rectificada'] },
  { key: 'lumbar',   label: 'Lumbar',   options: ['Normal', 'Hiperlordosis', 'Rectificada'] },
  { key: 'pelvis',   label: 'Pelvis',   options: ['Neutra', 'Anteversión', 'Retroversión'] },
  { key: 'rodilla',  label: 'Rodilla',  options: ['Neutra', 'Hiperextensión', 'Semiflexión'] },
];
const POSTERIOR_SEGS: SegmentDef[] = [
  { key: 'cabeza',    label: 'Cabeza',    options: ['Alineada', 'Inclinada D', 'Inclinada I'] },
  { key: 'hombros',   label: 'Hombros',   options: ['Nivelados', 'Elevado D', 'Elevado I'] },
  { key: 'escapulas', label: 'Escápulas', options: ['Neutras', 'Aladas', 'Abducidas', 'Aducidas'] },
  { key: 'columna',   label: 'Columna',   options: ['Recta', 'Escoliosis D', 'Escoliosis I'] },
  { key: 'pelvis',    label: 'Pelvis',    options: ['Nivelada', 'Elevada D', 'Elevada I'] },
  { key: 'rodillas',  label: 'Rodillas',  options: ['Neutras', 'Valgo', 'Varo'] },
];

type FormViewKey = 'anterior' | 'lateral_right' | 'lateral_left' | 'posterior';
type ObsKey = 'anterior_observations' | 'lateral_right_observations' | 'lateral_left_observations' | 'posterior_observations';
type PhotoFileKey = 'anterior_photo' | 'lateral_right_photo' | 'lateral_left_photo' | 'posterior_photo';

const FORM_VIEWS: { key: FormViewKey; label: string; segs: SegmentDef[]; photoKey: PhotoFileKey; obsKey: ObsKey }[] = [
  { key: 'anterior',      label: 'Anterior',          segs: ANTERIOR_SEGS,  photoKey: 'anterior_photo',      obsKey: 'anterior_observations' },
  { key: 'lateral_right', label: 'Lateral derecha',   segs: LATERAL_SEGS,   photoKey: 'lateral_right_photo', obsKey: 'lateral_right_observations' },
  { key: 'lateral_left',  label: 'Lateral izquierda', segs: LATERAL_SEGS,   photoKey: 'lateral_left_photo',  obsKey: 'lateral_left_observations' },
  { key: 'posterior',     label: 'Posterior',         segs: POSTERIOR_SEGS, photoKey: 'posterior_photo',     obsKey: 'posterior_observations' },
];

function buildViewData(segs: SegmentDef[], values: Record<string, string>): ViewData {
  const out: ViewData = {};
  for (const seg of segs) {
    const val = values[seg.key] ?? seg.options[0];
    const isNormal = val === seg.options[0];
    out[seg.key] = { is_normal: isNormal, severity: isNormal ? 0 : 1, sub_fields: { posicion: val } };
  }
  return out;
}

function viewDataToValues(vd: ViewData | undefined): Record<string, string> {
  if (!vd) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(vd)) {
    const sub = entry.sub_fields?.posicion;
    if (sub) out[key] = String(sub);
  }
  return out;
}

function emptyViewValues(segs: SegmentDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of segs) out[s.key] = s.options[0];
  return out;
}

type FormState = {
  evaluation_date: string;
  anterior: Record<string, string>;
  lateral_right: Record<string, string>;
  lateral_left: Record<string, string>;
  posterior: Record<string, string>;
  anterior_observations: string;
  lateral_right_observations: string;
  lateral_left_observations: string;
  posterior_observations: string;
  notes: string;
  anterior_photo: File | null;
  lateral_right_photo: File | null;
  lateral_left_photo: File | null;
  posterior_photo: File | null;
};

function emptyForm(): FormState {
  return {
    evaluation_date: new Date().toISOString().split('T')[0],
    anterior: emptyViewValues(ANTERIOR_SEGS),
    lateral_right: emptyViewValues(LATERAL_SEGS),
    lateral_left: emptyViewValues(LATERAL_SEGS),
    posterior: emptyViewValues(POSTERIOR_SEGS),
    anterior_observations: '', lateral_right_observations: '',
    lateral_left_observations: '', posterior_observations: '',
    notes: '',
    anterior_photo: null, lateral_right_photo: null,
    lateral_left_photo: null, posterior_photo: null,
  };
}

function evalToForm(ev: PosturometryEvaluation): FormState {
  return {
    evaluation_date: ev.evaluation_date,
    anterior:       viewDataToValues(ev.anterior_data),
    lateral_right:  viewDataToValues(ev.lateral_right_data),
    lateral_left:   viewDataToValues(ev.lateral_left_data),
    posterior:      viewDataToValues(ev.posterior_data),
    anterior_observations:      ev.anterior_observations,
    lateral_right_observations: ev.lateral_right_observations,
    lateral_left_observations:  ev.lateral_left_observations,
    posterior_observations:     ev.posterior_observations,
    notes: ev.notes,
    anterior_photo: null, lateral_right_photo: null,
    lateral_left_photo: null, posterior_photo: null,
  };
}

function posturColor(color: string) {
  if (color === 'green') return 'sage' as const;
  if (color === 'red') return 'danger' as const;
  return 'amber' as const;
}

// ─── Main component ───────────────────────────────────────────
export default function EvalPosturTab({ clientId }: { clientId: number }) {
  const { evaluations, loading, submitting, error, fetchEvaluations, createEvaluation, fullUpdateEvaluation } =
    usePosturometryStore();

  const [tabMode, setTabMode] = useState<'results' | 'form'>('results');
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [activeView, setActiveView] = useState<FormViewKey>('anterior');
  const latest = evaluations[0] ?? null;

  useEffect(() => {
    if (clientId) fetchEvaluations(clientId);
  }, [clientId, fetchEvaluations]);

  useEffect(() => {
    if (!loading && evaluations.length === 0) setTabMode('form');
  }, [loading, evaluations.length]);

  const enterCreate = useCallback(() => { setForm(emptyForm()); setEditMode('create'); setTabMode('form'); }, []);
  const enterEdit   = useCallback(() => { if (latest) { setForm(evalToForm(latest)); setEditMode('edit'); setTabMode('form'); } }, [latest]);
  const cancel      = useCallback(() => { setEditMode(null); setTabMode(evaluations.length > 0 ? 'results' : 'form'); }, [evaluations.length]);

  const buildPayload = useCallback((): PosturometryFormData => ({
    evaluation_date: form.evaluation_date,
    anterior_data:      buildViewData(ANTERIOR_SEGS,  form.anterior),
    lateral_right_data: buildViewData(LATERAL_SEGS,   form.lateral_right),
    lateral_left_data:  buildViewData(LATERAL_SEGS,   form.lateral_left),
    posterior_data:     buildViewData(POSTERIOR_SEGS, form.posterior),
    anterior_observations:      form.anterior_observations,
    lateral_right_observations: form.lateral_right_observations,
    lateral_left_observations:  form.lateral_left_observations,
    posterior_observations:     form.posterior_observations,
    notes: form.notes,
    anterior_photo:      form.anterior_photo,
    lateral_right_photo: form.lateral_right_photo,
    lateral_left_photo:  form.lateral_left_photo,
    posterior_photo:     form.posterior_photo,
  }), [form]);

  const handleSave = useCallback(async () => {
    const payload = buildPayload();
    if (editMode === 'create') {
      const res = await createEvaluation(clientId, payload);
      if (res) { setEditMode(null); setTabMode('results'); }
    } else if (editMode === 'edit' && latest) {
      const res = await fullUpdateEvaluation(clientId, latest.id, payload);
      if (res) { setEditMode(null); setTabMode('results'); }
    }
  }, [editMode, clientId, latest, buildPayload, createEvaluation, fullUpdateEvaluation]);

  const setViewVal = (view: FormViewKey, seg: string, val: string) =>
    setForm(f => ({ ...f, [view]: { ...f[view], [seg]: val } }));

  const lastEvalLabel = latest
    ? new Date(latest.evaluation_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const isEditing = editMode !== null;
  const cur = FORM_VIEWS.find(v => v.key === activeView)!;
  const viewValues = isEditing ? form[activeView] as Record<string, string> : {};

  const curFile = form[cur.photoKey] as File | null;
  const photoPreview = useMemo(
    () => (curFile ? URL.createObjectURL(curFile) : null),
    [curFile],
  );
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const savedPhoto = editMode === 'edit' && latest ? getViewPhoto(latest, activeView) : null;

  return (
    <div>
      <FormHero
        kicker="Evaluación · Módulo 2"
        title="Posturometría"
        lastEval={lastEvalLabel}
        role="trainer"
        score={latest ? latest.global_index : null}
        scoreLabel="Índice global · /100"
        scoreTone={latest ? posturColor(latest.global_color) : 'sage'}
      />

      {loading && <EvalSpinner />}

      {!loading && evaluations.length > 0 && !isEditing && (
        <ModePill mode={tabMode} onChange={setTabMode} />
      )}

      {!loading && evaluations.length === 0 && !isEditing && (
        <EvalEmptyState message="Sin evaluaciones posturales. Registra la primera." onNew={enterCreate} />
      )}

      {/* Results view */}
      {!loading && evaluations.length > 0 && tabMode === 'results' && !isEditing && (
        <PosturResults evaluations={evaluations} onEdit={enterEdit} onNew={enterCreate} />
      )}

      {/* Form view — read-only summary when not editing */}
      {!loading && tabMode === 'form' && !isEditing && evaluations.length > 0 && (
        <>
          <EvalSectionHeader title="Última evaluación" hint={lastEvalLabel ?? ''} onNew={enterCreate} />
          <FormSection title="Resultados auto-calculados" columns={4} gap={12} dense>
            <ComputedCard label="Índice global" value={latest!.global_index} sub={latest!.global_category} tone={posturColor(latest!.global_color)} />
            <ComputedCard label="Superior" value={latest!.upper_index} sub={latest!.upper_category} tone={posturColor(latest!.upper_color)} />
            <ComputedCard label="Central"  value={latest!.central_index} sub={latest!.central_category} tone={posturColor(latest!.central_color)} />
            <ComputedCard label="Inferior" value={latest!.lower_index} sub={latest!.lower_category} tone={posturColor(latest!.lower_color)} />
          </FormSection>
          {latest!.notes && <NotesField value={latest!.notes} readonly />}
          <button onClick={enterEdit} type="button" style={{
            width: '100%', padding: '12px', borderRadius: 14, marginBottom: 16,
            background: 'rgba(103,15,34,0.06)', color: T.wine,
            fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600,
            border: `1px solid rgba(103,15,34,0.12)`, cursor: 'pointer',
          }}>Editar esta evaluación</button>
        </>
      )}

      {/* Create / Edit form */}
      {isEditing && (
        <>
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 16,
              background: 'rgba(154,5,38,0.06)', border: '1px solid rgba(154,5,38,0.18)',
              fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#9A0526',
              whiteSpace: 'pre-line',
            }}>{error}</div>
          )}

          <FormSection title="Fecha de evaluación" columns={1} gap={12}>
            <Field label="Fecha" value={form.evaluation_date} onChange={v => setForm(f => ({ ...f, evaluation_date: v }))} />
          </FormSection>

          <div style={{
            background: 'rgba(255,255,255,0.70)', borderRadius: 22,
            border: `1px solid ${T.borderSoft}`, padding: 0, marginBottom: 16,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 22px 0' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 14 }}>
                Observaciones por vista
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, borderBottom: `1px solid ${T.border}` }}>
                {FORM_VIEWS.map(v => {
                  const sel = v.key === activeView;
                  return (
                    <button key={v.key} type="button" onClick={() => setActiveView(v.key)} style={{
                      padding: '10px 16px', border: 'none', background: 'transparent',
                      fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: sel ? 700 : 500,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: sel ? T.wine : T.textMed,
                      borderBottom: sel ? `2px solid ${T.wine}` : '2px solid transparent',
                      cursor: 'pointer',
                    }}>{v.label}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '20px 22px 22px' }}>
              <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]" style={{ gap: 20 }}>
                <PhotoSlot
                  label={`Foto vista ${cur.label.toLowerCase()}`}
                  currentUrl={photoPreview ?? savedPhoto}
                  onFile={f => setForm(p => ({ ...p, [cur.photoKey]: f }))}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cur.segs.map(seg => (
                    <ChipSelect
                      key={seg.key}
                      label={seg.label}
                      options={seg.options}
                      value={viewValues[seg.key] ?? seg.options[0]}
                      span={1}
                      onChange={val => setViewVal(activeView, seg.key, val)}
                    />
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.20em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5,
                }}>Observaciones · vista {cur.label.toLowerCase()}</div>
                <textarea
                  value={(form[cur.obsKey] as string) ?? ''}
                  onChange={e => setForm(p => ({ ...p, [cur.obsKey]: e.target.value }))}
                  placeholder="Observaciones del entrenador sobre esta vista…"
                  rows={2}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.85)', border: `1px solid ${T.border}`,
                    fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textDark,
                    outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          <StickyFooter
            lastSaved={editMode === 'edit' && latest ? new Date(latest.created_at).toLocaleDateString('es-CO') : undefined}
            onSave={handleSave}
            onCancel={cancel}
            saving={submitting}
            saveLabel={editMode === 'edit' ? 'Actualizar evaluación' : 'Crear evaluación'}
          />
        </>
      )}
    </div>
  );
}
