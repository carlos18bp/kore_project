'use client';

import { useEffect, useId, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { usePosturometryStore, type PosturometryEvaluation } from '@/lib/stores/posturometryStore';
import TrainerNoteHero from '@/app/components/shared/TrainerNoteHero';

/* ──────────────────────────────────────────────────────────────────────────
 *  Constants — palette, copy, helpers
 *  ────────────────────────────────────────────────────────────────────── */

const KORE = {
  wineDark: '#670F22',
  ivory: '#FFF8EC',
  cream: '#FFE9DC',
  gold: '#E7C8A0',
  goldDeep: '#C9A77A',
  sage: '#A8C29C',
  sageSoft: '#C2D6B8',
  sakura: '#F4C7C7',
  sakuraDeep: '#E4A8A8',
  amber: '#E5C97A',
  copper: '#E5A574',
};

/* 4-band classification (Funcional / Leve / Moderado / Importante) */
type Band = { name: string; color: string; bg: string; border: string };
function band(v: number): Band {
  if (v <= 0.5) return { name: 'Funcional', color: KORE.sage, bg: 'rgba(168,194,156,0.18)', border: 'rgba(168,194,156,0.40)' };
  if (v <= 1.2) return { name: 'Leve', color: KORE.amber, bg: 'rgba(229,201,122,0.18)', border: 'rgba(229,201,122,0.40)' };
  if (v <= 2.0) return { name: 'Moderado', color: KORE.copper, bg: 'rgba(229,165,116,0.20)', border: 'rgba(229,165,116,0.42)' };
  return { name: 'Importante', color: KORE.sakuraDeep, bg: 'rgba(228,168,168,0.22)', border: 'rgba(228,168,168,0.44)' };
}

const VIEW_KEYS = ['anterior', 'lateral_right', 'lateral_left', 'posterior'] as const;
type ViewKey = typeof VIEW_KEYS[number];

const VIEW_META: Record<ViewKey, { label: string; angle: string }> = {
  anterior: { label: 'Vista anterior', angle: 'De frente' },
  lateral_right: { label: 'Vista lateral derecha', angle: 'Lado derecho' },
  lateral_left: { label: 'Vista lateral izquierda', angle: 'Lado izquierdo' },
  posterior: { label: 'Vista posterior', angle: 'De espaldas' },
};

const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  upper: 'Tren superior',
  central: 'Tren central',
  lower: 'Tren inferior',
};

const REGION_DESCRIPTIONS: Record<string, string> = {
  global: 'El promedio ponderado de las tres regiones. Tu lectura postural general.',
  upper: 'Cabeza, cuello, hombros, escápulas, codos. La zona donde el escritorio te marca.',
  central: 'Columna, abdomen, cadera. Tu eje. Donde se transmite todo el movimiento.',
  lower: 'Rodillas, tobillos, pies. La base. Lo que sostiene todo lo demás.',
};

const REGION_IMPORTANCE: Record<string, Record<string, string>> = {
  global: {
    green: 'Una postura funcional es la base de un movimiento eficiente y seguro.',
    yellow: 'Mejorar el global suele traer menos dolor y mejor patrón respiratorio.',
    orange: 'Un global más alto afecta cómo distribuyes la carga en cada ejercicio.',
    red: 'Es prioritario porque afecta cómo distribuyes la carga en cada movimiento.',
  },
  upper: {
    green: 'Esta zona influye en cómo usas brazos, hombros y cuello todos los días.',
    yellow: 'Suele ceder bien con movilidad torácica y fortalecimiento escapular.',
    orange: 'Una zona superior desalineada limita el rendimiento en tracción y empuje.',
    red: 'Requiere atención prioritaria — afecta movilidad y calidad del entrenamiento.',
  },
  central: {
    green: 'Tu eje está estable. Es el centro de control del movimiento.',
    yellow: 'Pequeños desbalances aquí cambian cómo se transmite la fuerza.',
    orange: 'El eje desalineado afecta estabilidad, fuerza y prevención de lesiones.',
    red: 'Un centro desalineado afecta todo lo demás — abordarlo es prioritario.',
  },
  lower: {
    green: 'Tus piernas y pies sostienen toda la estructura. Buen apoyo, todo fluye.',
    yellow: 'Pequeños desbalances cambian cómo absorbes el impacto al caminar.',
    orange: 'Afecta la cadena hacia arriba — rodillas, cadera, espalda.',
    red: 'Tu base. Corregir alineación es fundamental para progresar con seguridad.',
  },
};

const REGION_NEXT_STEP: Record<string, Record<string, string>> = {
  global: {
    green: 'Mantener el plan: movilidad + fortalecimiento de cadena posterior.',
    yellow: 'Tu coach incluirá ejercicios correctivos específicos en tu próxima fase.',
    orange: 'Trabajo correctivo como parte central del programa.',
    red: 'Plan enfocado primero en corrección postural antes de progresar en carga.',
  },
  upper: {
    green: 'Mantener movilidad cervical y escapular en cada sesión.',
    yellow: 'Movilidad cervical + fortalecimiento escapular.',
    orange: 'Liberación de pectoral menor + fortalecimiento de romboides y trapecio medio.',
    red: 'Prioridad correctiva antes de progresar en carga de tren superior.',
  },
  central: {
    green: 'Seguir fortaleciendo tu core y manteniendo la movilidad de columna.',
    yellow: 'Estabilización de core y movilidad segmentaria de columna.',
    orange: 'Activación de transverso del abdomen + trabajo de glúteo medio.',
    red: 'Trabajo progresivo de estabilidad y control motor.',
  },
  lower: {
    green: 'Mantener fuerza de tren inferior y movilidad de tobillo.',
    yellow: 'Estabilizadores de rodilla + movilidad de tobillo.',
    orange: 'Propiocepción unipodal + fortalecimiento del tibial posterior.',
    red: 'Corrección de alineación de rodillas y pies antes de carga.',
  },
};

/* Parse "Zona: descripción" into structured pieces and detect severity keyword */
function parseFinding(s: string): { zona: string; desc: string; severity: 'moderado' | 'leve' | 'severo' } {
  const idx = s.indexOf(':');
  const zona = idx > 0 ? s.slice(0, idx).trim() : s;
  const desc = idx > 0 ? s.slice(idx + 1).trim() : '';
  const lower = (desc + ' ' + zona).toLowerCase();
  if (lower.includes('severa') || lower.includes('severo')) return { zona, desc, severity: 'severo' };
  if (lower.includes('leve')) return { zona, desc, severity: 'leve' };
  return { zona, desc, severity: 'moderado' };
}

/* Functional segments for a view: severity 0 in that view's column of segment_scores */
function getFunctionalSegments(ev: PosturometryEvaluation, viewKey: ViewKey): Array<{ zona: string; desc: string }> {
  const out: Array<{ zona: string; desc: string }> = [];
  for (const [, seg] of Object.entries(ev.segment_scores ?? {})) {
    const v = seg.views?.[viewKey];
    if (v === 0) {
      out.push({ zona: seg.label || '', desc: 'Alineado en eje funcional' });
    }
  }
  return out;
}

function formatDate(iso: string | null | undefined, full = false) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', full
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthYear(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

const num = (s: string | number | null | undefined): number | null => {
  if (s === null || s === undefined || s === '') return null;
  const n = typeof s === 'number' ? s : parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
};

function getViewPhoto(ev: PosturometryEvaluation, viewKey: ViewKey): string | null {
  if (viewKey === 'anterior') return ev.anterior_photo;
  if (viewKey === 'lateral_right') return ev.lateral_right_photo;
  if (viewKey === 'lateral_left') return ev.lateral_left_photo;
  return ev.posterior_photo;
}

function getViewObservation(ev: PosturometryEvaluation, viewKey: ViewKey): string {
  if (viewKey === 'anterior') return ev.anterior_observations || '';
  if (viewKey === 'lateral_right') return ev.lateral_right_observations || '';
  if (viewKey === 'lateral_left') return ev.lateral_left_observations || '';
  return ev.posterior_observations || '';
}

const HERO_KEYFRAMES = `
  @keyframes postur-mist-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-40px) scale(1.1); } }
  @keyframes postur-mist-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,40px) scale(1.05); } }
  @keyframes postur-petal-a { 0%,100% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(8px,-12px) rotate(8deg); } 66% { transform: translate(-6px,-6px) rotate(-5deg); } }
  @keyframes postur-petal-b { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-10px,12px) rotate(-12deg); } }
`;

/* ──────────────────────────────────────────────────────────────────────────
 *  Atom components
 *  ────────────────────────────────────────────────────────────────────── */

function Sparkline({ data, color, w = 80, h = 22 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (data.length < 2) return <span style={{ display: 'inline-block', width: w, height: h }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  const lastY = h - ((data[data.length - 1] - min) / range) * h;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

/* posturometría: lower is better → improve = diff < 0 */
function Delta({ now, prev, big = false, dark = false }: { now: number | null; prev: number | null; big?: boolean; dark?: boolean }) {
  if (now === null || prev === null) return null;
  const diff = now - prev;
  const noChange = Math.abs(diff) < 0.05;
  const improve = diff < 0;
  const color = noChange ? (dark ? 'rgba(231,200,160,0.7)' : 'rgba(103,15,34,0.5)') : improve ? KORE.sage : KORE.sakuraDeep;
  const bg = noChange
    ? (dark ? 'rgba(231,200,160,0.10)' : 'rgba(103,15,34,0.05)')
    : improve
    ? 'rgba(168,194,156,0.18)'
    : 'rgba(228,168,168,0.18)';
  const borderColor = noChange
    ? (dark ? 'rgba(231,200,160,0.20)' : 'rgba(103,15,34,0.10)')
    : improve
    ? 'rgba(168,194,156,0.30)'
    : 'rgba(228,168,168,0.30)';
  const arrow = noChange ? '–' : diff < 0 ? '↓' : '↑';
  return (
    <span
      className="inline-flex items-center font-semibold tabular-nums"
      style={{
        gap: 4,
        padding: big ? '4px 10px' : '2px 8px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${borderColor}`,
        color,
        fontSize: big ? 12 : 11,
        letterSpacing: '0.02em',
      }}
    >
      {arrow} {Math.abs(diff).toFixed(2)}
    </span>
  );
}

/* Radar over 4 axes (global, upper, central, lower). Latest as filled, first as ghost */
function RadarChart({
  size = 300, dataLatest, dataFirst,
}: {
  size?: number;
  dataLatest: { global: number; upper: number; central: number; lower: number };
  dataFirst: { global: number; upper: number; central: number; lower: number } | null;
}) {
  const id = useId().replace(/:/g, '');
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
    <svg width={size} height={size}>
      <defs>
        <radialGradient id={`radar-${id}`}>
          <stop offset="0%" stopColor={KORE.cream} stopOpacity="0.55" />
          <stop offset="100%" stopColor={KORE.gold} stopOpacity="0.18" />
        </radialGradient>
      </defs>
      {ringRadii.map((v, i) => {
        const rr = (v / max) * r;
        const b = band(v);
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={rr}
            fill="none" stroke={b.color} strokeOpacity="0.18" strokeWidth="1"
            strokeDasharray={i === 0 ? '0' : '2,3'}
          />
        );
      })}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(231,200,160,0.20)" strokeWidth="1" />
      ))}
      {dataFirst && (
        <polygon points={polygon(dataFirst)} fill="rgba(228,168,168,0.10)" stroke={KORE.sakuraDeep} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="3,3" />
      )}
      <polygon points={polygon(dataLatest)} fill={`url(#radar-${id})`} stroke={KORE.cream} strokeWidth="1.8" strokeLinejoin="round" />
      {axes.map((ax, i) => {
        const v = Math.min(dataLatest[ax.key], max);
        const rr = (v / max) * r;
        const x = cx + rr * Math.cos(angles[i]);
        const y = cy + rr * Math.sin(angles[i]);
        return <circle key={ax.key} cx={x} cy={y} r="3.5" fill={KORE.ivory} stroke={KORE.gold} strokeWidth="1.5" />;
      })}
      {axes.map((ax, i) => {
        const lr = r + 22;
        const x = cx + lr * Math.cos(angles[i]);
        const y = cy + lr * Math.sin(angles[i]);
        return (
          <g key={ax.key} transform={`translate(${x},${y})`}>
            <text textAnchor="middle" dominantBaseline="middle" fontFamily="Montserrat" fontSize="10" fontWeight="700" fill={KORE.gold} letterSpacing="1.5">
              {ax.label.toUpperCase()}
            </text>
            <text textAnchor="middle" dominantBaseline="middle" y="14" fontFamily="Cinzel" fontSize="13" fontWeight="600" fill={KORE.ivory}>
              {dataLatest[ax.key].toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Photo with japandi grid overlay + corner registration marks */
function PhotoFrame({
  src, label, sublabel, dim = false, height = 380,
}: {
  src: string | null;
  label: string;
  sublabel?: string;
  dim?: boolean;
  height?: number;
}) {
  if (!src) {
    return (
      <div
        className="relative grid place-items-center"
        style={{
          borderRadius: 18, height,
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
      className="relative overflow-hidden"
      style={{
        borderRadius: 18,
        background: '#1A0A11',
        height,
        boxShadow: '0 8px 24px -10px rgba(45,15,26,0.4), inset 0 0 0 1px rgba(231,200,160,0.18)',
      }}
    >
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
      {/* japandi grid: thirds + plumb line + corner marks */}
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

/* ──────────────────────────────────────────────────────────────────────────
 *  Hero — global index + radar + before/after of anterior view
 *  ────────────────────────────────────────────────────────────────────── */

function Hero({
  latest, first,
}: {
  latest: PosturometryEvaluation;
  first: PosturometryEvaluation | null;
}) {
  const latestG = num(latest.global_index) ?? 0;
  const latestU = num(latest.upper_index) ?? 0;
  const latestC = num(latest.central_index) ?? 0;
  const latestL = num(latest.lower_index) ?? 0;
  const dataLatest = { global: latestG, upper: latestU, central: latestC, lower: latestL };

  const firstG = first ? num(first.global_index) : null;
  const dataFirst = first
    ? {
        global: num(first.global_index) ?? 0,
        upper: num(first.upper_index) ?? 0,
        central: num(first.central_index) ?? 0,
        lower: num(first.lower_index) ?? 0,
      }
    : null;

  const gB = band(latestG);
  const fB = first && firstG !== null ? band(firstG) : null;
  const delta = first && firstG !== null ? firstG - latestG : null; // positive = improved

  return (
    <div
      className="relative overflow-hidden text-white"
      style={{
        borderRadius: 32,
        background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
        padding: 'clamp(24px, 4vw, 56px)',
        boxShadow: '0 30px 70px -25px rgba(45,15,26,0.55), inset 0 1px 0 rgba(255,233,220,0.12), 0 0 0 1px rgba(231,200,160,0.10)',
      }}
    >
      {/* mist orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-20%', right: '-12%', width: 580, height: 580, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)',
          filter: 'blur(80px)', animation: 'postur-mist-a 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-25%', left: '-15%', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,5,12,0.65) 0%, transparent 65%)',
          filter: 'blur(90px)', animation: 'postur-mist-b 26s ease-in-out infinite',
        }}
      />
      {/* sakura petals */}
      <svg style={{ position: 'absolute', top: 28, right: 80, width: 28, height: 28, opacity: 0.55, animation: 'postur-petal-a 14s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.sakura} opacity="0.9" />
      </svg>
      <svg style={{ position: 'absolute', top: 110, right: 220, width: 16, height: 16, opacity: 0.4, animation: 'postur-petal-b 18s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.cream} />
      </svg>
      <svg style={{ position: 'absolute', bottom: 80, left: 360, width: 22, height: 22, opacity: 0.4, animation: 'postur-petal-a 20s ease-in-out infinite reverse', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.gold} opacity="0.85" />
      </svg>
      {/* hairline + ensō */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(231,200,160,0.5) 50%, transparent 100%)' }} />
      <svg className="absolute pointer-events-none" style={{ bottom: -40, right: -40, width: 200, height: 200, opacity: 0.06 }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke={KORE.gold} strokeWidth="1.5" strokeDasharray="220 40" />
      </svg>

      <div className="relative grid gap-10 xl:gap-14 xl:grid-cols-[1.1fr_1fr] items-center">
        {/* LEFT: índice global + radar */}
        <div>
          <p className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>Índice postural global</p>
          <div className="flex items-baseline gap-4 xl:gap-5 mt-3.5 flex-wrap">
            <span
              className="font-heading font-semibold leading-none"
              style={{ color: KORE.ivory, fontSize: 'clamp(60px, 8vw, 96px)', letterSpacing: '-0.02em', textShadow: '0 2px 16px rgba(244,199,199,0.18)' }}
            >
              {latestG.toFixed(2)}
            </span>
            <div className="flex flex-col gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase"
                style={{ background: `${gB.color}22`, border: `1px solid ${gB.color}66`, color: gB.color, letterSpacing: '0.10em' }}
              >
                ● Banda {gB.name}
              </span>
              {firstG !== null && <Delta now={latestG} prev={firstG} big dark />}
            </div>
          </div>
          <p className="text-[14px] xl:text-[15px] leading-[1.7] mt-4 max-w-lg" style={{ color: KORE.cream, opacity: 0.95 }}>
            {first && firstG !== null && fB && delta !== null ? (
              <>
                Desde <strong className="capitalize" style={{ color: KORE.ivory, fontWeight: 600 }}>{formatMonthYear(first.evaluation_date || first.created_at)}</strong>, tu índice global{' '}
                {delta > 0.05 ? (
                  <>bajó <strong style={{ color: KORE.sage, fontWeight: 600 }}>−{Math.abs(delta).toFixed(2)} puntos</strong>. Pasaste de banda{' '}
                  <strong style={{ color: fB.color, fontWeight: 600 }}>{fB.name.toLowerCase()}</strong> a{' '}
                  <strong style={{ color: gB.color, fontWeight: 600 }}>{gB.name.toLowerCase()}</strong>. Tu cuerpo está reorganizando su eje.</>
                ) : delta < -0.05 ? (
                  <>subió <strong style={{ color: KORE.sakuraDeep, fontWeight: 600 }}>+{Math.abs(delta).toFixed(2)} puntos</strong>. Es un buen momento para retomar el plan correctivo.</>
                ) : (
                  <>se mantuvo estable. Banda <strong style={{ color: gB.color, fontWeight: 600 }}>{gB.name.toLowerCase()}</strong> consolidada.</>
                )}
              </>
            ) : (
              <>Esta es tu lectura de partida, registrada en{' '}
                <strong className="capitalize" style={{ color: KORE.ivory, fontWeight: 600 }}>{formatMonthYear(latest.evaluation_date || latest.created_at)}</strong>.
                {' '}A partir de aquí construimos progreso — cada nueva evaluación compara contra esta base.
              </>
            )}
          </p>

          {/* radar */}
          <div className="mt-7" style={{ padding: 20, borderRadius: 20, background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.15)', backdropFilter: 'blur(6px)' }}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>Mapa por región</span>
              <div className="flex items-center gap-3 text-[10px]" style={{ color: 'rgba(255,233,220,0.7)' }}>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block" style={{ width: 14, height: 2, background: KORE.cream }} /> Última</span>
                {first && (
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block" style={{ width: 14, height: 2, background: KORE.sakuraDeep, borderTop: `1px dashed ${KORE.sakuraDeep}` }} /> Inicial</span>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <RadarChart size={300} dataLatest={dataLatest} dataFirst={dataFirst} />
            </div>
          </div>
        </div>

        {/* RIGHT: before/after anterior view */}
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>Antes · Después · Vista anterior</span>
            {first && (
              <span className="text-[11px]" style={{ color: 'rgba(255,233,220,0.7)' }}>
                {formatDate(first.evaluation_date || first.created_at)} → {formatDate(latest.evaluation_date || latest.created_at)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <PhotoFrame
              src={first?.anterior_photo ?? null}
              label="Inicial"
              sublabel={first ? `Global ${num(first.global_index)?.toFixed(2) ?? '—'}` : undefined}
              dim
              height={420}
            />
            <PhotoFrame
              src={latest.anterior_photo ?? null}
              label="Última"
              sublabel={`Global ${latestG.toFixed(2)}`}
              height={420}
            />
          </div>
          {first && delta !== null && delta > 0.05 && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(168,194,156,0.12)', border: '1px solid rgba(168,194,156,0.30)' }}>
              <p className="text-[12px] leading-[1.55]" style={{ color: KORE.sageSoft }}>
                <strong style={{ color: KORE.sage, fontWeight: 700 }}>Cambio observable:</strong> tu eje se reorganizó hacia banda {gB.name.toLowerCase()}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Region card — value + scale bar + descripción + importancia + próximo paso
 *  ────────────────────────────────────────────────────────────────────── */

const REGION_ICONS: Record<string, string> = {
  global: '◯',
  upper: '◔',
  central: '◑',
  lower: '◕',
};

function RegionCard({
  regionKey, latest, first,
}: {
  regionKey: 'global' | 'upper' | 'central' | 'lower';
  latest: PosturometryEvaluation;
  first: PosturometryEvaluation | null;
}) {
  const fieldMap: Record<string, keyof PosturometryEvaluation> = {
    global: 'global_index',
    upper: 'upper_index',
    central: 'central_index',
    lower: 'lower_index',
  };
  const colorMap: Record<string, keyof PosturometryEvaluation> = {
    global: 'global_color',
    upper: 'upper_color',
    central: 'central_color',
    lower: 'lower_color',
  };
  const value = num(latest[fieldMap[regionKey]] as string) ?? 0;
  const firstValue = first ? num(first[fieldMap[regionKey]] as string) : null;
  const colorKey = (latest[colorMap[regionKey]] as string) || 'green';
  const b = band(value);
  const max = 2.5;
  const pct = Math.min((value / max) * 100, 100);

  const importance = REGION_IMPORTANCE[regionKey][colorKey] || REGION_IMPORTANCE[regionKey].green;
  const nextStep = REGION_NEXT_STEP[regionKey][colorKey] || REGION_NEXT_STEP[regionKey].green;
  const customRec = latest.recommendations?.[regionKey];
  const tone = customRec?.result || `${b.name} — ${value.toFixed(2)}.`;

  return (
    <div
      className="flex flex-col"
      style={{
        gap: 18,
        padding: 28,
        borderRadius: 22,
        background: 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-heading leading-none shrink-0" style={{ fontSize: 28, color: b.color }}>
            {REGION_ICONS[regionKey]}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>
              {REGION_LABELS[regionKey]}
            </p>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="font-heading font-semibold leading-none tabular-nums" style={{ color: KORE.wineDark, fontSize: 36, letterSpacing: '-0.01em' }}>
                {value.toFixed(2)}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: b.color, letterSpacing: '0.05em' }}>{b.name}</span>
            </div>
          </div>
        </div>
        <Delta now={value} prev={firstValue} big />
      </div>

      {/* scale bar with 4 bands as background + filled marker */}
      <div className="relative" style={{ height: 8, borderRadius: 4, background: 'rgba(103,15,34,0.06)', overflow: 'visible' }}>
        <div className="absolute inset-0 flex" style={{ borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ flex: 0.5, background: 'rgba(168,194,156,0.20)' }} />
          <div style={{ flex: 0.7, background: 'rgba(229,201,122,0.20)' }} />
          <div style={{ flex: 0.8, background: 'rgba(229,165,116,0.22)' }} />
          <div style={{ flex: 0.5, background: 'rgba(228,168,168,0.22)' }} />
        </div>
        <div
          className="absolute"
          style={{
            top: 0, bottom: 0, left: 0, width: `${pct}%`,
            background: `linear-gradient(90deg, ${b.color}AA, ${b.color})`,
            borderRadius: 4,
            boxShadow: `0 0 12px ${b.color}55`,
            transition: 'width 700ms ease-out',
          }}
        />
        <div
          className="absolute"
          style={{
            top: -4, left: `calc(${pct}% - 8px)`, width: 16, height: 16,
            borderRadius: 8, background: KORE.ivory, border: `2px solid ${b.color}`,
            boxShadow: '0 2px 6px rgba(45,15,26,0.18)',
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-1">
        <div>
          <p className="text-[9px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.45)' }}>Qué evaluamos</p>
          <p className="text-[13px] leading-[1.6]" style={{ color: '#3A2128' }}>{REGION_DESCRIPTIONS[regionKey]}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.45)' }}>Por qué importa</p>
          <p className="text-[13px] leading-[1.6]" style={{ color: '#3A2128' }}>{importance}</p>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
          border: '1px solid rgba(103,15,34,0.08)',
        }}
      >
        <p className="text-[9px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.20em', color: KORE.wineDark }}>Próximo paso</p>
        <p className="text-[13px] leading-[1.55] italic" style={{ color: '#3A2128' }}>{customRec?.action || nextStep}</p>
        <p className="font-heading text-[13px] font-semibold mt-2.5" style={{ color: b.color, letterSpacing: '0.02em' }}>{tone}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Findings list — grouped by severity, narrative
 *  ────────────────────────────────────────────────────────────────────── */

function FindingsList({
  ev, viewKey,
}: {
  ev: PosturometryEvaluation;
  viewKey: ViewKey;
}) {
  const flat = ev.findings?.[viewKey] ?? [];
  const moderado: Array<{ zona: string; desc: string }> = [];
  const leve: Array<{ zona: string; desc: string }> = [];
  for (const s of flat) {
    const p = parseFinding(s);
    if (p.severity === 'leve') leve.push({ zona: p.zona, desc: p.desc });
    else moderado.push({ zona: p.zona, desc: p.desc });
  }
  const funcional = getFunctionalSegments(ev, viewKey);

  const groups = [
    { key: 'moderado', label: 'Moderado', color: KORE.copper, items: moderado },
    { key: 'leve', label: 'Leve', color: KORE.amber, items: leve },
    { key: 'funcional', label: 'Funcional', color: KORE.sage, items: funcional },
  ];

  const totalCount = moderado.length + leve.length + funcional.length;
  if (totalCount === 0) {
    return (
      <p className="text-[13px] italic" style={{ color: 'rgba(103,15,34,0.55)' }}>
        Aún no hay hallazgos registrados para esta vista.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.filter((g) => g.items.length > 0).map((g) => (
        <div key={g.key}>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span style={{ width: 6, height: 6, borderRadius: 3, background: g.color, boxShadow: `0 0 0 3px ${g.color}25` }} />
            <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: KORE.wineDark }}>{g.label}</span>
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(103,15,34,0.45)' }}>· {g.items.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {g.items.map((f, i) => (
              <div
                key={`${f.zona}-${i}`}
                className="grid items-baseline"
                style={{
                  gridTemplateColumns: 'minmax(110px, 130px) 1fr',
                  gap: 14,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.55)',
                  border: '1px solid rgba(103,15,34,0.06)',
                }}
              >
                <span className="text-[12px] font-semibold" style={{ color: KORE.wineDark, letterSpacing: '0.02em' }}>{f.zona}</span>
                <span className="text-[13px] leading-[1.5]" style={{ color: '#3A2128' }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  ViewSection — antes | findings | después per view
 *  ────────────────────────────────────────────────────────────────────── */

function ViewSection({
  viewKey, idx, latest, first,
}: {
  viewKey: ViewKey;
  idx: number;
  latest: PosturometryEvaluation;
  first: PosturometryEvaluation | null;
}) {
  const meta = VIEW_META[viewKey];
  const photoLatest = getViewPhoto(latest, viewKey);
  const photoFirst = first ? getViewPhoto(first, viewKey) : null;
  const observation = getViewObservation(latest, viewKey);
  const findings = latest.findings?.[viewKey] ?? [];
  const functional = getFunctionalSegments(latest, viewKey);
  const totalSegments = findings.length + functional.length;
  const moderateCount = findings.filter((f) => parseFinding(f).severity !== 'leve').length;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(20px, 3vw, 32px)',
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 20px -12px rgba(45,15,26,0.15)',
      }}
    >
      <div
        className="flex items-baseline justify-between flex-wrap gap-3 pb-4 mb-5"
        style={{ borderBottom: '1px solid rgba(103,15,34,0.08)' }}
      >
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="font-heading text-[11px] font-semibold" style={{ color: 'rgba(103,15,34,0.45)', letterSpacing: '0.18em' }}>
            0{idx + 1}
          </span>
          <div className="min-w-0">
            <h3 className="font-heading text-2xl font-semibold" style={{ color: KORE.wineDark, letterSpacing: '0.01em' }}>
              {meta.label}
            </h3>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(103,15,34,0.55)' }}>
              {meta.angle} · {totalSegments} segmentos evaluados
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: moderateCount > 0 ? KORE.copper : KORE.sage }}>
          {moderateCount > 0 ? `${moderateCount} hallazgos a trabajar` : 'Sin hallazgos relevantes'}
        </span>
      </div>

      {observation && (
        <div
          className="mb-5"
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(231,200,160,0.10)',
            border: '1px solid rgba(231,200,160,0.30)',
          }}
        >
          <p className="text-[10px] font-bold uppercase mb-1.5" style={{ letterSpacing: '0.18em', color: KORE.wineDark }}>Observación</p>
          <p className="text-[13px] leading-[1.55] italic" style={{ color: '#3A2128' }}>“{observation}”</p>
        </div>
      )}

      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: first ? '1.1fr 1fr 1.1fr' : '1fr 1fr' }}
      >
        {first && (
          <PhotoFrame
            src={photoFirst}
            label={`Inicial · ${formatDate(first.evaluation_date || first.created_at)}`}
            sublabel={meta.label}
            dim
            height={520}
          />
        )}
        <div className="px-1 py-2">
          <p className="text-[10px] font-bold uppercase mb-4" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>
            Hallazgos · Última evaluación
          </p>
          <FindingsList ev={latest} viewKey={viewKey} />
        </div>
        <PhotoFrame
          src={photoLatest}
          label={`Última · ${formatDate(latest.evaluation_date || latest.created_at)}`}
          sublabel={meta.label}
          height={520}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Timeline
 *  ────────────────────────────────────────────────────────────────────── */

function Timeline({ evaluations }: { evaluations: PosturometryEvaluation[] }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(24px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-7">
        <div>
          <h2 className="font-heading text-2xl font-semibold" style={{ color: KORE.wineDark }}>Tu línea de tiempo postural</h2>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(103,15,34,0.55)' }}>
            {evaluations.length} {evaluations.length === 1 ? 'evaluación' : 'evaluaciones'} registradas
          </p>
        </div>
      </div>

      <div className="relative" style={{ paddingLeft: 24 }}>
        <div
          className="absolute"
          style={{
            left: 7, top: 8, bottom: 8, width: 1,
            background: 'linear-gradient(180deg, transparent 0%, rgba(103,15,34,0.20) 12%, rgba(103,15,34,0.20) 88%, transparent 100%)',
          }}
        />
        {evaluations.map((e, i) => {
          const value = num(e.global_index) ?? 0;
          const b = band(value);
          const isLatest = i === 0;
          const photo = e.anterior_photo;
          const dateStr = formatDate(e.evaluation_date || e.created_at, true);
          return (
            <div
              key={e.id}
              className="relative grid gap-5"
              style={{
                gridTemplateColumns: '120px 1fr',
                paddingBottom: i < evaluations.length - 1 ? 28 : 0,
              }}
            >
              <span
                className="absolute"
                style={{
                  left: -23, top: 18, width: 16, height: 16, borderRadius: 8,
                  background: isLatest ? `radial-gradient(circle, ${b.color}, ${b.color}88)` : KORE.ivory,
                  border: `2px solid ${b.color}`,
                  boxShadow: isLatest ? `0 0 0 5px ${b.color}22` : 'none',
                }}
              />
              {photo ? (
                <div className="relative overflow-hidden" style={{ width: 120, height: 160, borderRadius: 14, background: '#1A0A11', boxShadow: '0 4px 14px -8px rgba(45,15,26,0.3)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isLatest ? 'none' : 'grayscale(0.4) brightness(0.9)' }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(20,5,10,0.55))' }} />
                  <span className="absolute text-[9px] font-bold uppercase" style={{ bottom: 8, left: 10, letterSpacing: '0.16em', color: KORE.gold }}>
                    {isLatest ? 'Actual' : i === evaluations.length - 1 ? 'Inicio' : `Eval ${evaluations.length - i}`}
                  </span>
                </div>
              ) : (
                <div
                  className="grid place-items-center"
                  style={{
                    width: 120, height: 160, borderRadius: 14,
                    background: 'rgba(103,15,34,0.06)',
                    border: '1px dashed rgba(103,15,34,0.18)',
                  }}
                >
                  <div className="text-center">
                    <span className="font-heading text-3xl" style={{ color: 'rgba(103,15,34,0.30)' }}>—</span>
                    <p className="text-[9px] font-bold uppercase mt-1.5" style={{ letterSpacing: '0.16em', color: 'rgba(103,15,34,0.40)' }}>Sin foto</p>
                  </div>
                </div>
              )}

              <div className="pt-1 min-w-0">
                <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                  <span className="font-heading text-lg font-semibold" style={{ color: KORE.wineDark }}>{dateStr}</span>
                  {isLatest && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{ background: `${b.color}22`, border: `1px solid ${b.color}66`, color: b.color, letterSpacing: '0.14em' }}
                    >
                      ● Más reciente
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {([
                    { k: 'global_index', label: 'Global' },
                    { k: 'upper_index', label: 'Superior' },
                    { k: 'central_index', label: 'Central' },
                    { k: 'lower_index', label: 'Inferior' },
                  ] as Array<{ k: keyof PosturometryEvaluation; label: string }>).map((ax) => {
                    const v = num(e[ax.k] as string) ?? 0;
                    const bb = band(v);
                    return (
                      <div
                        key={ax.k as string}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.7)',
                          border: '1px solid rgba(103,15,34,0.06)',
                        }}
                      >
                        <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.5)' }}>{ax.label}</p>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="font-heading text-xl font-semibold tabular-nums" style={{ color: KORE.wineDark }}>{v.toFixed(2)}</span>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: bb.color }} />
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

/* ──────────────────────────────────────────────────────────────────────────
 *  Closing notes — trainer notes + scientific basis
 *  ────────────────────────────────────────────────────────────────────── */

function ClosingNote({ latest }: { latest: PosturometryEvaluation }) {
  void latest;
  return (
    <div className="grid gap-5 lg:grid-cols-1">
      <div
        style={{
          padding: 24,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(103,15,34,0.08)',
        }}
      >
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Base científica</p>
        <p className="text-[12px] leading-[1.65] mt-2.5" style={{ color: '#3A2128' }}>
          Tu evaluación combina los protocolos <strong style={{ color: KORE.wineDark }}>REEDCO / NYPR</strong> (puntuación postural por segmentos) con los criterios de <strong style={{ color: KORE.wineDark }}>Janda</strong> y <strong style={{ color: KORE.wineDark }}>Magee</strong> para la valoración funcional.
        </p>
        <p className="text-[11px] mt-3" style={{ color: 'rgba(103,15,34,0.55)' }}>
          Bandas: <strong>≤ 0.50 funcional · ≤ 1.20 leve · ≤ 2.00 moderado · &gt; 2.00 importante</strong>
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Main page
 *  ────────────────────────────────────────────────────────────────────── */

export default function MyPosturometryPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = usePosturometryStore();

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  const latest = evaluations[0] ?? null;
  const first = evaluations.length > 1 ? evaluations[evaluations.length - 1] : null;

  const orderedRegions: Array<'global' | 'upper' | 'central' | 'lower'> = useMemo(
    () => ['global', 'upper', 'central', 'lower'],
    [],
  );

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  if (!latest) {
    return (
      <section className="min-h-screen bg-kore-cream">
        <style>{HERO_KEYFRAMES}</style>
        <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-16 max-w-xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tu salud</p>
          <h1 className="font-heading text-3xl xl:text-4xl font-semibold text-kore-wine-dark mt-2" style={{ letterSpacing: '-0.015em' }}>Mi Postura</h1>
          <div className="mt-10 bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/60 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-red/10 flex items-center justify-center text-3xl">🪞</div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Tu evaluación postural está en camino</h2>
            <p className="text-sm text-kore-gray-dark/55">Tu entrenador realizará tu primera evaluación de postura.</p>
            <p className="text-xs text-kore-gray-dark/40 mt-1">Aquí podrás ver cómo evoluciona tu eje corporal en cada visita.</p>
          </div>
        </div>
      </section>
    );
  }

  const lastEvalDate = formatDate(latest.evaluation_date || latest.created_at, true);

  return (
    <section className="min-h-screen bg-kore-cream">
      <style>{HERO_KEYFRAMES}</style>
      <div className="px-5 xl:px-10 pt-6 xl:pt-10 pb-20 mx-auto" style={{ maxWidth: 1280 }}>
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kore-gray-dark/45">Tu salud</p>
            <h1
              className="font-heading text-3xl xl:text-4xl font-semibold mt-2 leading-tight"
              style={{ color: KORE.wineDark, letterSpacing: '-0.015em' }}
            >
              Posturometría
            </h1>
            <p className="text-[13px] text-kore-gray-dark/60 mt-1.5">
              Última evaluación · {lastEvalDate} · {evaluations.length} {evaluations.length === 1 ? 'sesión registrada' : 'sesiones registradas'}
            </p>
          </div>
          <Link
            href="#plan-accion"
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-[12px]"
            style={{
              background: 'linear-gradient(135deg, #9A0526, #AB0D2F)',
              boxShadow: '0 4px 12px -4px rgba(154,5,38,0.4)',
            }}
          >
            Ver plan de acción
          </Link>
        </div>

        {/* Trainer note */}
        <TrainerNoteHero
          className="mb-6"
          note={latest.notes ?? ''}
          trainerName={latest.trainer_name}
          date={latest.evaluation_date || latest.created_at}
        />

        {/* HERO */}
        <Hero latest={latest} first={first} />

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {orderedRegions.map((rk) => (
              <RegionCard key={rk} regionKey={rk} latest={latest} first={first} />
            ))}
          </div>
        </div>

        {/* VIEW SECTIONS */}
        <div className="mt-12 xl:mt-16">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>
                Las 4 vistas
              </p>
              <h2 className="font-heading text-2xl xl:text-[26px] font-semibold mt-1" style={{ color: KORE.wineDark }}>
                {first ? 'Antes · Hallazgos · Después' : 'Hallazgos por vista'}
              </h2>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {VIEW_KEYS.map((vk, i) => (
              <ViewSection key={vk} viewKey={vk} idx={i} latest={latest} first={first} />
            ))}
          </div>
        </div>

        {/* TIMELINE */}
        {evaluations.length > 1 && (
          <div className="mt-12 xl:mt-16">
            <Timeline evaluations={evaluations} />
          </div>
        )}

        {/* CLOSING NOTES */}
        <div className="mt-8 xl:mt-10" id="plan-accion">
          <ClosingNote latest={latest} />
        </div>

        {/* Footer fino */}
        <div className="mt-10 text-center text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.40)' }}>
          KÓRE · Posturometría · {lastEvalDate}
        </div>
      </div>
    </section>
  );
}
