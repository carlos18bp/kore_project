'use client';

import { useEffect, useId, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { usePhysicalEvaluationStore, type PhysicalEvaluation } from '@/lib/stores/physicalEvaluationStore';

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
  sageSoft: '#B8D0A8',
  sakura: '#F4C7C7',
  sakuraDeep: '#E4A8A8',
  amber: '#E5C97A',
  copper: '#E5A574',
};

/* 5-tier classification for physical evaluation */
type Band = { name: string; color: string; bg: string; border: string };
function band(v: number): Band {
  if (v >= 4.5) return { name: 'Muy bueno', color: KORE.sage, bg: 'rgba(168,194,156,0.18)', border: 'rgba(168,194,156,0.40)' };
  if (v >= 4.0) return { name: 'Bueno', color: KORE.sageSoft, bg: 'rgba(184,208,168,0.18)', border: 'rgba(184,208,168,0.40)' };
  if (v >= 3.0) return { name: 'Intermedio', color: KORE.amber, bg: 'rgba(229,201,122,0.18)', border: 'rgba(229,201,122,0.40)' };
  if (v >= 2.0) return { name: 'Bajo', color: KORE.copper, bg: 'rgba(229,165,116,0.20)', border: 'rgba(229,165,116,0.42)' };
  return { name: 'Muy bajo', color: KORE.sakuraDeep, bg: 'rgba(228,168,168,0.22)', border: 'rgba(228,168,168,0.44)' };
}

const num = (s: string | number | null | undefined): number | null => {
  if (s === null || s === undefined || s === '') return null;
  const n = typeof s === 'number' ? s : parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
};

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

const TEST_META: Record<string, { label: string; metric: string; rawKey: keyof PhysicalEvaluation; scoreKey: keyof PhysicalEvaluation; ageOnly?: boolean }> = {
  squats: { label: 'Sentadillas', metric: 'reps/min', rawKey: 'squats_reps', scoreKey: 'squats_score' },
  pushups: { label: 'Flexiones', metric: 'reps', rawKey: 'pushups_reps', scoreKey: 'pushups_score' },
  plank: { label: 'Plancha', metric: 'seg', rawKey: 'plank_seconds', scoreKey: 'plank_score' },
  walk: { label: 'Caminata 6 min', metric: 'm', rawKey: 'walk_meters', scoreKey: 'walk_score' },
  unipodal: { label: 'Equilibrio unipodal', metric: 'seg', rawKey: 'unipodal_seconds', scoreKey: 'unipodal_score', ageOnly: true },
};

const TEST_KEYS = ['squats', 'pushups', 'plank', 'walk', 'unipodal'] as const;
type TestKey = typeof TEST_KEYS[number];

const TEST_INTERPRET: Record<string, Record<string, string>> = {
  squats: {
    'Muy bueno': 'Tu fuerza de tren inferior está sólida. La cadena posterior responde con calidad y volumen.',
    'Bueno': 'Buen empuje del tren inferior. Hay margen para subir 1 banda más.',
    'Intermedio': 'Fuerza de tren inferior promedio. Con técnica y consistencia, sube rápido.',
    'Bajo': 'Cadena posterior débil. Vamos a fortalecer glúteo, isquios y core de forma progresiva.',
    'Muy bajo': 'Punto de partida. Trabajo correctivo + técnica antes de subir carga.',
  },
  pushups: {
    'Muy bueno': 'Tren superior potente. Empuje funcional con técnica sostenida.',
    'Bueno': 'Buen empuje en horizontal. Sigue afinando estabilidad escapular.',
    'Intermedio': 'Fuerza promedio. Banda Bueno está cerca con trabajo de empuje + escápula.',
    'Bajo': 'Tren superior necesita activación. Trabajaremos pectoral, deltoides y serrato.',
    'Muy bajo': 'Empezamos desde escapular. Patrón antes que volumen.',
  },
  plank: {
    'Muy bueno': 'Core sostiene en cadena cinética larga. Indicador positivo de estabilidad.',
    'Bueno': 'Buen control de tronco. Mantén el patrón en otros ejercicios.',
    'Intermedio': 'Core estable pero con margen. Trabajo de transverso + glúteo.',
    'Bajo': 'Tronco cede pronto. Vamos a sumar resistencia segmentada.',
    'Muy bajo': 'Activación profunda primero. Series cortas con calidad.',
  },
  walk: {
    'Muy bueno': 'Capacidad cardiovascular por encima del promedio para tu edad. Buen marcador de salud general.',
    'Bueno': 'Aeróbico sólido. Mantén la base con trabajo continuo.',
    'Intermedio': 'Capacidad media. Sumar zona 2 sostenida ayuda mucho.',
    'Bajo': 'Aeróbico bajo. Trabajaremos volumen progresivo en intensidad cómoda.',
    'Muy bajo': 'Empezamos por caminar largo y suave. La base se construye con minutos, no con velocidad.',
  },
  unipodal: {
    'Muy bueno': 'Propiocepción y control vestibular trabajaron bien. Buen indicador para la rodilla.',
    'Bueno': 'Estabilidad sólida. Sigamos con trabajo unilateral progresivo.',
    'Intermedio': 'Equilibrio promedio. Propiocepción + tobillo lo mejora rápido.',
    'Bajo': 'Tobillo y cadera ceden pronto. Vamos a sumar trabajo unilateral controlado.',
    'Muy bajo': 'Base inestable. Empezamos con apoyos asistidos antes de cargar.',
  },
};

const TEST_TONE: Record<string, Record<string, string>> = {
  squats: { 'Muy bueno': 'Tu mejor capacidad.', 'Bueno': 'Camino claro a Muy bueno.', 'Intermedio': 'Sigue empujando.', 'Bajo': 'Hay margen visible.', 'Muy bajo': 'Punto de partida.' },
  pushups: { 'Muy bueno': 'Empuje sólido.', 'Bueno': 'Banda buena.', 'Intermedio': 'Mejora alcanzable.', 'Bajo': 'Activación primero.', 'Muy bajo': 'Patrón antes que volumen.' },
  plank: { 'Muy bueno': 'Control élite.', 'Bueno': 'Core estable.', 'Intermedio': 'Buen base.', 'Bajo': 'A trabajar.', 'Muy bajo': 'Empezamos desde activación.' },
  walk: { 'Muy bueno': 'Aeróbico sólido.', 'Bueno': 'Buen ritmo.', 'Intermedio': 'Sumar zona 2.', 'Bajo': 'Volumen primero.', 'Muy bajo': 'Construyendo base.' },
  unipodal: { 'Muy bueno': 'Equilibrio fino.', 'Bueno': 'Estable.', 'Intermedio': 'A entrenar.', 'Bajo': 'Propiocepción.', 'Muy bajo': 'Apoyos asistidos.' },
};

const MOBILITY_DESC: Record<string, string> = {
  hip: 'Flexión de cadera con tronco neutro',
  shoulder: 'Test combinado de Apley',
  ankle: 'Dorsiflexión con rodilla a la pared',
};

const MOBILITY_LABELS: Record<string, string> = {
  hip: 'Cadera',
  shoulder: 'Hombro',
  ankle: 'Tobillo',
};

const HERO_KEYFRAMES = `
  @keyframes pf-mist-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-40px) scale(1.1); } }
  @keyframes pf-mist-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,40px) scale(1.05); } }
  @keyframes pf-petal-a { 0%,100% { transform: translate(0,0) rotate(0deg); } 33% { transform: translate(8px,-12px) rotate(8deg); } 66% { transform: translate(-6px,-6px) rotate(-5deg); } }
  @keyframes pf-petal-b { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-10px,12px) rotate(-12deg); } }
`;

/* ──────────────────────────────────────────────────────────────────────────
 *  Atom components
 *  ────────────────────────────────────────────────────────────────────── */

function Delta({
  now, prev, big = false, dark = false, decimals = 1,
}: { now: number | null; prev: number | null; big?: boolean; dark?: boolean; decimals?: number }) {
  if (now === null || prev === null) return null;
  const diff = now - prev;
  const noChange = Math.abs(diff) < 0.05;
  const improve = diff > 0;
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
  const arrow = noChange ? '–' : diff > 0 ? '↑' : '↓';
  const isInteger = Math.abs(diff) >= 1 && diff % 1 === 0;
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
      {arrow} {Math.abs(diff).toFixed(isInteger ? 0 : decimals)}
    </span>
  );
}

/* Radar over 5 axes */
function RadarChart({
  size = 320, dataLatest, dataFirst,
}: {
  size?: number;
  dataLatest: { general: number; strength: number; endurance: number; mobility: number; balance: number };
  dataFirst: { general: number; strength: number; endurance: number; mobility: number; balance: number } | null;
}) {
  const id = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const max = 5;
  const axes = [
    { key: 'general' as const, label: 'General' },
    { key: 'strength' as const, label: 'Fuerza' },
    { key: 'endurance' as const, label: 'Resistencia' },
    { key: 'mobility' as const, label: 'Movilidad' },
    { key: 'balance' as const, label: 'Balance' },
  ];
  const angles = axes.map((_, i) => (Math.PI * 2 * i) / axes.length - Math.PI / 2);
  const polygon = (data: typeof dataLatest) =>
    axes
      .map((ax, i) => {
        const v = Math.min(data[ax.key], max);
        const rr = (v / max) * r;
        return `${cx + rr * Math.cos(angles[i])},${cy + rr * Math.sin(angles[i])}`;
      })
      .join(' ');
  const ringRadii = [1, 2, 3, 4, 5];
  return (
    <svg width={size} height={size}>
      <defs>
        <radialGradient id={`pf-radar-${id}`}>
          <stop offset="0%" stopColor={KORE.cream} stopOpacity="0.55" />
          <stop offset="100%" stopColor={KORE.gold} stopOpacity="0.18" />
        </radialGradient>
      </defs>
      {ringRadii.map((v, i) => {
        const rr = (v / max) * r;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={rr}
            fill="none" stroke="rgba(231,200,160,0.20)" strokeWidth="1"
            strokeDasharray={i === ringRadii.length - 1 ? '0' : '2,3'}
          />
        );
      })}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(231,200,160,0.18)" strokeWidth="1" />
      ))}
      {dataFirst && (
        <polygon points={polygon(dataFirst)} fill="rgba(228,168,168,0.10)" stroke={KORE.sakuraDeep} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="3,3" />
      )}
      <polygon points={polygon(dataLatest)} fill={`url(#pf-radar-${id})`} stroke={KORE.cream} strokeWidth="1.8" strokeLinejoin="round" />
      {axes.map((ax, i) => {
        const v = Math.min(dataLatest[ax.key], max);
        const rr = (v / max) * r;
        const x = cx + rr * Math.cos(angles[i]);
        const y = cy + rr * Math.sin(angles[i]);
        return <circle key={ax.key} cx={x} cy={y} r="3.5" fill={KORE.ivory} stroke={KORE.gold} strokeWidth="1.5" />;
      })}
      {axes.map((ax, i) => {
        const lr = r + 26;
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

/* ──────────────────────────────────────────────────────────────────────────
 *  Hero — índice general + radar
 *  ────────────────────────────────────────────────────────────────────── */

function Hero({
  latest, first,
}: { latest: PhysicalEvaluation; first: PhysicalEvaluation | null }) {
  const generalNow = num(latest.general_index) ?? 0;
  const generalFirst = first ? num(first.general_index) : null;

  const dataLatest = {
    general: generalNow,
    strength: num(latest.strength_index) ?? 0,
    endurance: num(latest.endurance_index) ?? 0,
    mobility: num(latest.mobility_index) ?? 0,
    balance: num(latest.balance_index) ?? 0,
  };
  const dataFirst = first
    ? {
        general: num(first.general_index) ?? 0,
        strength: num(first.strength_index) ?? 0,
        endurance: num(first.endurance_index) ?? 0,
        mobility: num(first.mobility_index) ?? 0,
        balance: num(first.balance_index) ?? 0,
      }
    : null;

  const gB = band(generalNow);
  const fB = first && generalFirst !== null ? band(generalFirst) : null;
  const delta = first && generalFirst !== null ? generalNow - generalFirst : null;

  const subAxes = [
    { key: 'strength' as const, label: 'Fuerza', value: dataLatest.strength },
    { key: 'endurance' as const, label: 'Resistencia', value: dataLatest.endurance },
    { key: 'mobility' as const, label: 'Movilidad', value: dataLatest.mobility },
    { key: 'balance' as const, label: 'Balance', value: dataLatest.balance },
  ];

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
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-20%', right: '-12%', width: 580, height: 580, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)',
          filter: 'blur(80px)', animation: 'pf-mist-a 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-25%', left: '-15%', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,5,12,0.65) 0%, transparent 65%)',
          filter: 'blur(90px)', animation: 'pf-mist-b 26s ease-in-out infinite',
        }}
      />
      <svg style={{ position: 'absolute', top: 28, right: 80, width: 28, height: 28, opacity: 0.55, animation: 'pf-petal-a 14s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.sakura} opacity="0.9" />
      </svg>
      <svg style={{ position: 'absolute', top: 110, right: 220, width: 16, height: 16, opacity: 0.4, animation: 'pf-petal-b 18s ease-in-out infinite', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C13 7 17 8 22 7C18 11 18 14 22 18C17 17 13 19 12 23C11 19 7 17 2 18C6 14 6 11 2 7C7 8 11 7 12 2Z" fill={KORE.cream} />
      </svg>
      <div className="absolute pointer-events-none" style={{ top: 0, left: 32, right: 32, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(231,200,160,0.5) 50%, transparent 100%)' }} />
      <svg className="absolute pointer-events-none" style={{ bottom: -40, right: -40, width: 200, height: 200, opacity: 0.06 }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke={KORE.gold} strokeWidth="1.5" strokeDasharray="220 40" />
      </svg>

      <div className="relative grid gap-10 xl:gap-14 xl:grid-cols-2 items-center">
        {/* LEFT */}
        <div>
          <p className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>
            Índice general de condición
          </p>
          <div className="flex items-baseline gap-4 xl:gap-5 mt-3.5 flex-wrap">
            <span
              className="font-heading font-semibold leading-none"
              style={{ color: KORE.ivory, fontSize: 'clamp(60px, 8vw, 96px)', letterSpacing: '-0.02em', textShadow: '0 2px 16px rgba(244,199,199,0.18)' }}
            >
              {generalNow.toFixed(2)}
            </span>
            <span className="text-[14px]" style={{ color: KORE.gold }}>/ 5.00</span>
          </div>
          <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase"
              style={{ background: `${gB.color}22`, border: `1px solid ${gB.color}66`, color: gB.color, letterSpacing: '0.10em' }}
            >
              ● Banda {gB.name}
            </span>
            {generalFirst !== null && <Delta now={generalNow} prev={generalFirst} big dark decimals={2} />}
          </div>
          <p className="text-[14px] xl:text-[15px] leading-[1.7] mt-4 max-w-lg" style={{ color: KORE.cream, opacity: 0.95 }}>
            {first && generalFirst !== null && fB && delta !== null && Math.abs(delta) > 0.05 ? (
              <>
                Desde <strong className="capitalize" style={{ color: KORE.ivory, fontWeight: 600 }}>{formatMonthYear(first.evaluation_date || first.created_at)}</strong>, tu condición general{' '}
                {delta > 0 ? (
                  <>subió <strong style={{ color: KORE.sage, fontWeight: 600 }}>+{delta.toFixed(2)} puntos</strong>. Pasaste de banda{' '}
                  <strong style={{ color: fB.color, fontWeight: 600 }}>{fB.name.toLowerCase()}</strong> a{' '}
                  <strong style={{ color: gB.color, fontWeight: 600 }}>{gB.name.toLowerCase()}</strong>. Tu cuerpo respondió a la planificación.</>
                ) : (
                  <>bajó <strong style={{ color: KORE.sakuraDeep, fontWeight: 600 }}>{delta.toFixed(2)} puntos</strong>. Es momento de retomar el plan con consistencia.</>
                )}
              </>
            ) : (
              <>Esta es tu lectura de partida, registrada en{' '}
                <strong className="capitalize" style={{ color: KORE.ivory, fontWeight: 600 }}>{formatMonthYear(latest.evaluation_date || latest.created_at)}</strong>.{' '}
                A partir de aquí construimos progreso — fuerza, resistencia, movilidad y balance.
              </>
            )}
          </p>

          {/* Sub-indices */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-6">
            {subAxes.map((ax) => {
              const b = band(ax.value);
              return (
                <div
                  key={ax.key}
                  style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.18)',
                  }}
                >
                  <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: KORE.gold }}>{ax.label}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="font-heading text-[22px] font-semibold tabular-nums" style={{ color: KORE.ivory }}>{ax.value.toFixed(2)}</span>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: b.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — radar */}
        <div
          style={{
            padding: 20, borderRadius: 20,
            background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.15)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.gold }}>Mapa por capacidad</span>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'rgba(255,233,220,0.7)' }}>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block" style={{ width: 14, height: 2, background: KORE.cream }} /> Última</span>
              {first && (
                <span className="inline-flex items-center gap-1.5"><span className="inline-block" style={{ width: 14, height: 2, background: KORE.sakuraDeep, borderTop: `1px dashed ${KORE.sakuraDeep}` }} /> Inicial</span>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <RadarChart size={320} dataLatest={dataLatest} dataFirst={dataFirst} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Alerts banner — cross-module alerts
 *  ────────────────────────────────────────────────────────────────────── */

function AlertsBanner({ alerts }: { alerts: Array<{ test: string; message: string }> }) {
  if (!alerts.length) return null;
  return (
    <div
      className="mt-6"
      style={{
        padding: '18px 22px',
        borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(229,165,116,0.12), rgba(228,168,168,0.10))',
        border: '1px solid rgba(229,165,116,0.35)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <span
          className="grid place-items-center font-heading font-bold text-[15px]"
          style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(229,165,116,0.22)', color: '#C97A3D' }}
        >
          !
        </span>
        <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.wineDark }}>
          Alertas cruzadas · {alerts.length}
        </span>
        <span className="font-heading text-[15px] font-semibold" style={{ color: KORE.wineDark }}>
          Tu plan ajusta carga según tu posturometría
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((a, i) => {
          const meta = TEST_META[a.test];
          return (
            <div
              key={`${a.test}-${i}`}
              style={{
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(229,165,116,0.20)',
              }}
            >
              <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.18em', color: '#9A0526' }}>
                {meta?.label || a.test}
              </p>
              <p className="text-[13px] leading-[1.55] mt-1.5" style={{ color: '#3A2128' }}>{a.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Test card
 *  ────────────────────────────────────────────────────────────────────── */

function TestCard({
  testKey, latest, first, hasAlert,
}: {
  testKey: TestKey;
  latest: PhysicalEvaluation;
  first: PhysicalEvaluation | null;
  hasAlert: boolean;
}) {
  const meta = TEST_META[testKey];
  const rawValue = latest[meta.rawKey] as number | null;
  const score = num(latest[meta.scoreKey] as number | null);
  const prevRaw = first ? (first[meta.rawKey] as number | null) : null;

  if (rawValue === null || score === null) {
    return (
      <div
        className="grid place-items-center"
        style={{
          padding: 24, borderRadius: 22,
          background: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(103,15,34,0.15)',
          minHeight: 200,
        }}
      >
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>{meta.label}</p>
          <p className="text-[12px] mt-2" style={{ color: 'rgba(103,15,34,0.55)' }}>Sin medición registrada</p>
        </div>
      </div>
    );
  }

  const b = band(score);
  const max = 5;
  const pct = (score / max) * 100;
  const interpretText = TEST_INTERPRET[testKey][b.name] || '';
  const toneText = TEST_TONE[testKey][b.name] || '';

  // Test-specific extras
  const borg = testKey === 'walk' ? num(latest.walk_effort_perception) : null;
  const hr = testKey === 'walk' ? num(latest.walk_heart_rate) : null;
  const pain =
    testKey === 'squats' ? latest.squats_pain
    : testKey === 'pushups' ? latest.pushups_pain
    : testKey === 'plank' ? latest.plank_pain
    : false;
  const interrupted = testKey === 'squats' ? latest.squats_interrupted : false;

  return (
    <div
      className="flex flex-col"
      style={{
        gap: 14,
        padding: 22,
        borderRadius: 22,
        background: 'rgba(255,255,255,0.78)',
        border: hasAlert ? '1px solid rgba(229,165,116,0.40)' : '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.20em', color: 'rgba(103,15,34,0.55)' }}>{meta.label}</p>
          <div className="flex items-baseline gap-2.5 mt-1.5 flex-wrap">
            <span className="font-heading font-semibold leading-none tabular-nums" style={{ color: KORE.wineDark, fontSize: 36, letterSpacing: '-0.01em' }}>
              {rawValue}
            </span>
            <span className="text-[12px] font-medium" style={{ color: 'rgba(103,15,34,0.6)' }}>{meta.metric}</span>
          </div>
          {prevRaw !== null && (
            <div className="mt-2">
              <Delta now={rawValue} prev={prevRaw} decimals={1} />
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-heading text-[28px] font-semibold leading-none" style={{ color: b.color }}>{score.toFixed(1)}</p>
          <p className="text-[9px] font-bold uppercase mt-1" style={{ letterSpacing: '0.18em', color: b.color }}>{b.name}</p>
        </div>
      </div>

      {/* Scale bar with 5 bands */}
      <div className="relative" style={{ height: 6, borderRadius: 3, background: 'rgba(103,15,34,0.06)', overflow: 'visible' }}>
        <div className="absolute inset-0 flex" style={{ borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ flex: 2, background: 'rgba(228,168,168,0.18)' }} />
          <div style={{ flex: 1, background: 'rgba(229,165,116,0.18)' }} />
          <div style={{ flex: 1, background: 'rgba(229,201,122,0.18)' }} />
          <div style={{ flex: 0.5, background: 'rgba(184,208,168,0.20)' }} />
          <div style={{ flex: 0.5, background: 'rgba(168,194,156,0.22)' }} />
        </div>
        <div
          className="absolute"
          style={{
            top: 0, bottom: 0, left: 0, width: `${pct}%`,
            background: `linear-gradient(90deg, ${b.color}AA, ${b.color})`,
            borderRadius: 3,
            boxShadow: `0 0 10px ${b.color}55`,
            transition: 'width 700ms ease-out',
          }}
        />
      </div>

      {/* Extras: Borg + HR + flags */}
      {(borg !== null || hr !== null || pain || interrupted || meta.ageOnly) && (
        <div className="flex items-center gap-3 flex-wrap text-[11px]" style={{ color: 'rgba(103,15,34,0.65)' }}>
          {borg !== null && <span><strong style={{ color: KORE.wineDark, fontWeight: 700 }}>Borg {borg}</strong> · esfuerzo</span>}
          {hr !== null && <span><strong style={{ color: KORE.wineDark, fontWeight: 700 }}>{hr} bpm</strong> · FC</span>}
          {meta.ageOnly && <span className="italic">Baremo por edad</span>}
          {pain && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(228,168,168,0.18)', color: '#9A0526' }}>
              ⚠ Dolor reportado
            </span>
          )}
          {interrupted && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(229,165,116,0.18)', color: '#C97A3D' }}>
              ◔ Interrumpida
            </span>
          )}
        </div>
      )}

      <p className="text-[13px] leading-[1.6]" style={{ color: '#3A2128' }}>{interpretText}</p>

      <p
        className="font-heading text-[13px] font-semibold pt-2.5"
        style={{ color: b.color, letterSpacing: '0.02em', borderTop: '1px solid rgba(103,15,34,0.08)' }}
      >
        {toneText}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Mobility section
 *  ────────────────────────────────────────────────────────────────────── */

function MobilitySection({ latest, first }: { latest: PhysicalEvaluation; first: PhysicalEvaluation | null }) {
  const items = [
    { key: 'hip', value: num(latest.hip_mobility), prev: first ? num(first.hip_mobility) : null },
    { key: 'shoulder', value: num(latest.shoulder_mobility), prev: first ? num(first.shoulder_mobility) : null },
    { key: 'ankle', value: num(latest.ankle_mobility), prev: first ? num(first.ankle_mobility) : null },
  ].filter((m) => m.value !== null) as Array<{ key: string; value: number; prev: number | null }>;

  if (items.length === 0) return null;

  const avg = items.reduce((s, m) => s + m.value, 0) / items.length;
  const b = band(avg);

  return (
    <div
      style={{
        padding: 'clamp(20px, 3vw, 28px)',
        borderRadius: 22,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,233,220,0.20))',
        border: '1px solid rgba(103,15,34,0.08)',
        boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Movilidad</p>
          <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
            <span className="font-heading text-[32px] font-semibold tabular-nums" style={{ color: KORE.wineDark }}>{avg.toFixed(1)}</span>
            <span className="text-[11px] font-bold uppercase" style={{ color: b.color, letterSpacing: '0.10em' }}>{b.name}</span>
            <span className="text-[11px] italic" style={{ color: 'rgba(103,15,34,0.5)' }}>· promedio de las 3 zonas</span>
          </div>
        </div>
        <span className="text-[10px] italic" style={{ color: 'rgba(103,15,34,0.5)' }}>Escala 1–5 · valoración del trainer</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((m) => (
          <div
            key={m.key}
            style={{
              padding: 16, borderRadius: 14,
              background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(103,15,34,0.06)',
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-heading text-[16px] font-semibold" style={{ color: KORE.wineDark }}>{MOBILITY_LABELS[m.key]}</span>
              <Delta now={m.value} prev={m.prev} decimals={0} />
            </div>
            <div className="flex gap-1 mb-2.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= m.value;
                return (
                  <span
                    key={n}
                    className="flex-1"
                    style={{ height: 8, borderRadius: 2, background: filled ? band(m.value).color : 'rgba(103,15,34,0.08)' }}
                  />
                );
              })}
            </div>
            <p className="text-[12px] leading-[1.5]" style={{ color: 'rgba(103,15,34,0.65)' }}>{MOBILITY_DESC[m.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Timeline
 *  ────────────────────────────────────────────────────────────────────── */

function Timeline({ evaluations }: { evaluations: PhysicalEvaluation[] }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.65)',
        borderRadius: 28,
        padding: 'clamp(24px, 3vw, 36px)',
        border: '1px solid rgba(103,15,34,0.08)',
      }}
    >
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-semibold" style={{ color: KORE.wineDark }}>Tu línea de tiempo</h2>
        <p className="text-[12px] mt-1" style={{ color: 'rgba(103,15,34,0.55)' }}>
          {evaluations.length} {evaluations.length === 1 ? 'evaluación registrada' : 'evaluaciones registradas'}
        </p>
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
          const value = num(e.general_index) ?? 0;
          const b = band(value);
          const isLatest = i === 0;
          return (
            <div
              key={e.id}
              className="relative grid items-start gap-5"
              style={{
                gridTemplateColumns: 'minmax(120px, 160px) 1fr',
                paddingBottom: i < evaluations.length - 1 ? 24 : 0,
              }}
            >
              <span
                className="absolute"
                style={{
                  left: -23, top: 14, width: 16, height: 16, borderRadius: 8,
                  background: isLatest ? `radial-gradient(circle, ${b.color}, ${b.color}88)` : KORE.ivory,
                  border: `2px solid ${b.color}`,
                  boxShadow: isLatest ? `0 0 0 5px ${b.color}22` : 'none',
                }}
              />
              <div>
                <p className="font-heading text-lg font-semibold" style={{ color: KORE.wineDark }}>{formatDate(e.evaluation_date || e.created_at, true)}</p>
                {isLatest && (
                  <span
                    className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                    style={{ background: `${b.color}22`, border: `1px solid ${b.color}66`, color: b.color, letterSpacing: '0.14em' }}
                  >
                    ● Reciente
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {([
                  { k: 'general_index', label: 'General' },
                  { k: 'strength_index', label: 'Fuerza' },
                  { k: 'endurance_index', label: 'Resist.' },
                  { k: 'mobility_index', label: 'Movil.' },
                  { k: 'balance_index', label: 'Balance' },
                ] as Array<{ k: keyof PhysicalEvaluation; label: string }>).map((ax) => {
                  const v = num(e[ax.k] as string | null) ?? 0;
                  const bb = band(v);
                  return (
                    <div
                      key={ax.k as string}
                      style={{
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(103,15,34,0.06)',
                      }}
                    >
                      <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.16em', color: 'rgba(103,15,34,0.5)' }}>{ax.label}</p>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-heading text-[18px] font-semibold tabular-nums" style={{ color: KORE.wineDark }}>{v.toFixed(2)}</span>
                        <span style={{ width: 7, height: 7, borderRadius: 4, background: bb.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Closing notes
 *  ────────────────────────────────────────────────────────────────────── */

function ClosingNote({ latest }: { latest: PhysicalEvaluation }) {
  const trainerName = latest.trainer_name?.trim();
  const dateStr = formatDate(latest.evaluation_date || latest.created_at, true);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      {latest.notes && (
        <div
          style={{
            padding: 'clamp(20px, 3vw, 32px)', borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
            border: '1px solid rgba(103,15,34,0.08)',
          }}
        >
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: KORE.wineDark }}>Notas de tu trainer</p>
          <p className="font-heading text-xl xl:text-[22px] font-semibold mt-2.5 leading-[1.4]" style={{ color: KORE.wineDark, letterSpacing: '0.005em' }}>
            “{latest.notes}”
          </p>
          {(trainerName || dateStr) && (
            <p className="text-[12px] italic mt-3.5" style={{ color: 'rgba(103,15,34,0.6)' }}>
              — {trainerName || 'Tu trainer'} · {dateStr}
            </p>
          )}
        </div>
      )}
      <div
        style={{
          padding: 24, borderRadius: 20,
          background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(103,15,34,0.08)',
        }}
      >
        <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Base científica</p>
        <p className="text-[12px] leading-[1.65] mt-2.5" style={{ color: '#3A2128' }}>
          Tests con baremo edad×sexo basados en <strong style={{ color: KORE.wineDark }}>ACSM Health-Related Physical Fitness</strong>, caminata de 6 min según protocolo <strong style={{ color: KORE.wineDark }}>ATS</strong>. Esfuerzo medido con escala <strong style={{ color: KORE.wineDark }}>Borg 6–20</strong>.
        </p>
        <p className="text-[11px] mt-3" style={{ color: 'rgba(103,15,34,0.55)' }}>
          Bandas: <strong>≤ 2 muy bajo · ≤ 3 bajo · ≤ 4 intermedio · ≤ 4.5 bueno · &gt; 4.5 muy bueno</strong>
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Main page
 *  ────────────────────────────────────────────────────────────────────── */

export default function MyPhysicalEvaluationPage() {
  const { user } = useAuthStore();
  const { evaluations, loading, fetchMyEvaluations } = usePhysicalEvaluationStore();

  useEffect(() => {
    fetchMyEvaluations();
  }, [fetchMyEvaluations]);

  const latest = evaluations[0] ?? null;
  const first = evaluations.length > 1 ? evaluations[evaluations.length - 1] : null;

  const flatAlerts = useMemo(() => {
    if (!latest?.cross_module_alerts) return [];
    const out: Array<{ test: string; message: string }> = [];
    for (const [k, msgs] of Object.entries(latest.cross_module_alerts)) {
      if (Array.isArray(msgs)) {
        for (const m of msgs) out.push({ test: k, message: m });
      }
    }
    return out;
  }, [latest]);

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
          <h1 className="font-heading text-3xl xl:text-4xl font-semibold text-kore-wine-dark mt-2" style={{ letterSpacing: '-0.015em' }}>Mi Condición Física</h1>
          <div className="mt-10 bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/60 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-red/10 flex items-center justify-center text-3xl">💪</div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">Tu evaluación física está en camino</h2>
            <p className="text-sm text-kore-gray-dark/55">Tu entrenador realizará tus pruebas de fuerza, resistencia, movilidad y balance.</p>
            <p className="text-xs text-kore-gray-dark/40 mt-1">Aquí podrás ver cómo evolucionan tus 5 capacidades a lo largo del tiempo.</p>
          </div>
        </div>
      </section>
    );
  }

  const lastEvalDate = formatDate(latest.evaluation_date || latest.created_at, true);
  const alertedTests = new Set(flatAlerts.map((a) => a.test));

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
              Evaluación Física
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

        {/* HERO */}
        <Hero latest={latest} first={first} />

        {/* ALERTS */}
        <AlertsBanner alerts={flatAlerts} />

        {/* TEST CARDS */}
        <div className="mt-10 xl:mt-14">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.22em', color: 'rgba(103,15,34,0.55)' }}>Tus 5 pruebas</p>
              <h2 className="font-heading text-2xl xl:text-[26px] font-semibold mt-1" style={{ color: KORE.wineDark }}>Por capacidad</h2>
            </div>
            <span className="text-[11px]" style={{ color: 'rgba(103,15,34,0.55)' }}>
              Bandas · ≤ 2 muy bajo · ≤ 3 bajo · ≤ 4 intermedio · ≤ 4.5 bueno · &gt; 4.5 muy bueno
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            {TEST_KEYS.map((tk) => (
              <TestCard key={tk} testKey={tk} latest={latest} first={first} hasAlert={alertedTests.has(tk)} />
            ))}
          </div>
        </div>

        {/* MOBILITY */}
        <div className="mt-8">
          <MobilitySection latest={latest} first={first} />
        </div>

        {/* TIMELINE */}
        {evaluations.length > 1 && (
          <div className="mt-12 xl:mt-16">
            <Timeline evaluations={evaluations} />
          </div>
        )}

        {/* CLOSING */}
        <div className="mt-8 xl:mt-10" id="plan-accion">
          <ClosingNote latest={latest} />
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: 'rgba(103,15,34,0.40)' }}>
          KÓRE · Evaluación Física · {lastEvalDate}
        </div>
      </div>
    </section>
  );
}
