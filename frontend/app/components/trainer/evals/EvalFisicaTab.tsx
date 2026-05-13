'use client';

import { useEffect, useState, useCallback, useId } from 'react';
import {
  usePhysicalEvaluationStore,
  type PhysicalEvalFormData,
  type PhysicalEvaluation,
} from '@/lib/stores/physicalEvaluationStore';
import {
  T, FormHero, FormSection, Field, RatingScale, YesNoToggle,
  ComputedCard, NotesField, StickyFooter, EvalSectionHeader, EvalEmptyState, EvalSpinner,
} from './shared';

// ─── Helpers ──────────────────────────────────────────────────
const KORE = {
  ivory:      '#FFF8EC',
  cream:      '#FFE9DC',
  gold:       '#E7C8A0',
  sage:       '#A8C29C',
  sageSoft:   '#B8D0A8',
  sakuraDeep: '#E4A8A8',
  amber:      '#E5C97A',
  copper:     '#E5A574',
  wineDark:   '#670F22',
};

type Band = { name: string; color: string; darkColor: string; bg: string; border: string };

function physBand(v: number): Band {
  if (v >= 4.5) return { name: 'Muy bueno',  color: KORE.sage,       darkColor: KORE.gold,       bg: 'rgba(168,194,156,0.18)', border: 'rgba(168,194,156,0.40)' };
  if (v >= 4.0) return { name: 'Bueno',      color: KORE.sageSoft,   darkColor: KORE.gold,       bg: 'rgba(184,208,168,0.18)', border: 'rgba(184,208,168,0.40)' };
  if (v >= 3.0) return { name: 'Intermedio', color: KORE.amber,      darkColor: KORE.amber,      bg: 'rgba(229,201,122,0.18)', border: 'rgba(229,201,122,0.40)' };
  if (v >= 2.0) return { name: 'Bajo',       color: KORE.copper,     darkColor: KORE.copper,     bg: 'rgba(229,165,116,0.20)', border: 'rgba(229,165,116,0.42)' };
  return          { name: 'Muy bajo',         color: KORE.sakuraDeep, darkColor: KORE.sakuraDeep, bg: 'rgba(228,168,168,0.22)', border: 'rgba(228,168,168,0.44)' };
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

// ─── Delta pill ───────────────────────────────────────────────
function Delta({
  now, prev, higherBetter = true, decimals = 2, dark = false, big = false,
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
  const arrow = noChange ? '–' : diff > 0 ? '↑' : '↓';
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

// ─── Radar (5 axes) ───────────────────────────────────────────
function RadarChart({
  size = 280,
  dataLatest,
  dataFirst,
}: {
  size?: number;
  dataLatest: { general: number; strength: number; endurance: number; mobility: number; balance: number };
  dataFirst: typeof dataLatest | null;
}) {
  const id = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.34;
  const max = 5;
  const axes = [
    { key: 'general'   as const, label: 'General' },
    { key: 'strength'  as const, label: 'Fuerza' },
    { key: 'endurance' as const, label: 'Resistencia' },
    { key: 'mobility'  as const, label: 'Movilidad' },
    { key: 'balance'   as const, label: 'Balance' },
  ];
  const angles = axes.map((_, i) => (Math.PI * 2 * i) / axes.length - Math.PI / 2);
  const polygon = (d: typeof dataLatest) =>
    axes.map((ax, i) => {
      const v = Math.min(d[ax.key], max);
      const rr = (v / max) * r;
      return `${cx + rr * Math.cos(angles[i])},${cy + rr * Math.sin(angles[i])}`;
    }).join(' ');

  return (
    <svg width={size} height={size}>
      <defs>
        <radialGradient id={`radar-f-${id}`}>
          <stop offset="0%" stopColor={KORE.cream} stopOpacity="0.55" />
          <stop offset="100%" stopColor={KORE.gold} stopOpacity="0.18" />
        </radialGradient>
      </defs>
      {[1,2,3,4,5].map((v, i) => (
        <circle key={i} cx={cx} cy={cy} r={(v/max)*r}
          fill="none" stroke="rgba(231,200,160,0.20)" strokeWidth="1"
          strokeDasharray={i === 4 ? '0' : '2,3'} />
      ))}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx+r*Math.cos(a)} y2={cy+r*Math.sin(a)}
          stroke="rgba(231,200,160,0.18)" strokeWidth="1" />
      ))}
      {dataFirst && (
        <polygon points={polygon(dataFirst)}
          fill="rgba(228,168,168,0.10)" stroke={KORE.sakuraDeep}
          strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="3,3" />
      )}
      <polygon points={polygon(dataLatest)}
        fill={`url(#radar-f-${id})`} stroke={KORE.cream}
        strokeWidth="1.8" strokeLinejoin="round" />
      {axes.map((ax, i) => {
        const v = Math.min(dataLatest[ax.key], max);
        const rr = (v/max)*r;
        return <circle key={ax.key} cx={cx+rr*Math.cos(angles[i])} cy={cy+rr*Math.sin(angles[i])}
          r="3.5" fill={KORE.ivory} stroke={KORE.gold} strokeWidth="1.5" />;
      })}
      {axes.map((ax, i) => {
        const lr = r + 26;
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
      background: 'rgba(255,255,255,0.70)',
      border: `1px solid ${T.border}`, marginBottom: 20,
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

// ─── Results view ─────────────────────────────────────────────

const TEST_META = {
  squats:   { label: 'Sentadillas',       rawKey: 'squats_reps'       as const, scoreKey: 'squats_score'    as const, unit: 'reps/min' },
  pushups:  { label: 'Flexiones',         rawKey: 'pushups_reps'      as const, scoreKey: 'pushups_score'   as const, unit: 'reps' },
  plank:    { label: 'Plancha',           rawKey: 'plank_seconds'     as const, scoreKey: 'plank_score'     as const, unit: 's' },
  walk:     { label: 'Caminata 6 min',    rawKey: 'walk_meters'       as const, scoreKey: 'walk_score'      as const, unit: 'm' },
  unipodal: { label: 'Equilibrio unipodal', rawKey: 'unipodal_seconds' as const, scoreKey: 'unipodal_score' as const, unit: 's' },
} as const;
type TestKey = keyof typeof TEST_META;
const TEST_KEYS: TestKey[] = ['squats', 'pushups', 'plank', 'walk', 'unipodal'];

const TEST_INTERPRET: Record<TestKey, Record<string, string>> = {
  squats: {
    'Muy bueno': 'Baremo ACSM: muy bueno para este grupo. Cadena posterior sólida; priorizar mantenimiento con sobrecarga progresiva.',
    'Bueno': 'Baremo ACSM: bueno. Margen de 1 banda; subir volumen y densidad en próxima fase.',
    'Intermedio': 'Baremo ACSM: intermedio. Priorizar volumen y técnica de bisagra en próxima fase.',
    'Bajo': 'Baremo ACSM: bajo. Trabajo correctivo de cadena posterior + activación de glúteo y core.',
    'Muy bajo': 'Baremo ACSM: muy bajo. Patrón de sentadilla asistida + trabajo funcional antes de carga.',
  },
  pushups: {
    'Muy bueno': 'ACSM: muy bueno. Empuje horizontal eficiente; incorporar variantes de mayor dificultad.',
    'Bueno': 'ACSM: bueno. Estabilidad escapular correcta; añadir tracción y aislamiento de pectoral.',
    'Intermedio': 'ACSM: intermedio. Fortalecer serrato anterior + escapular para subir de banda.',
    'Bajo': 'ACSM: bajo. Activar pectoral y deltoides anterior; iniciar flexiones asistidas.',
    'Muy bajo': 'ACSM: muy bajo. Patrón de empuje en plano inclinado primero; progresión lenta.',
  },
  plank: {
    'Muy bueno': 'Core resistente en cadena cinética larga. Añadir inestabilidad (TRX, BOSU) como progresión.',
    'Bueno': 'Buen control de tronco. Introducir variantes anti-rotatorias en próxima fase.',
    'Intermedio': 'Resistencia de core moderada. Trabajo de transverso + glúteo para sostener más tiempo.',
    'Bajo': 'Fatiga prematura del core. Series cortas con técnica estricta; no sacrificar postura.',
    'Muy bajo': 'Activación profunda primero. Plancha en rodillas y dead bugs antes de plank estándar.',
  },
  walk: {
    'Muy bueno': 'Test ATS: VO₂máx estimado > percentil 75 para edad/sexo. Base aeróbica sólida.',
    'Bueno': 'Test ATS: bueno. Incrementar zona 2 para consolidar capacidad cardiorrespiratoria.',
    'Intermedio': 'Test ATS: promedio. Sumar 2–3 sesiones/semana en zona 2 (60–70% FCmáx).',
    'Bajo': 'Test ATS: bajo. Trabajo aeróbico continuo de baja intensidad 3x/semana.',
    'Muy bajo': 'Test ATS: muy bajo. Base aeróbica mínima. Empezar con caminata de 20 min diarios.',
  },
  unipodal: {
    'Muy bueno': 'Propiocepción y control motor excelente. Progresión unilateral con carga.',
    'Bueno': 'Buena estabilidad. Introducir superficies inestables con progresión controlada.',
    'Intermedio': 'Control moderado. Ejercicios de fortalecimiento de tobillo y glúteo medio.',
    'Bajo': 'Déficit propioceptivo. Trabajo de tobillo (theraband) + balance asistido.',
    'Muy bajo': 'Inestabilidad significativa. Apoyos asistidos y trabajo de pie dominante primero.',
  },
};

function TestCard({
  testKey, latest, prev,
}: { testKey: TestKey; latest: PhysicalEvaluation; prev: PhysicalEvaluation | null }) {
  const meta = TEST_META[testKey];
  const raw   = latest[meta.rawKey] as number | null;
  const score = num(latest[meta.scoreKey]);
  const prevRaw = prev ? (prev[meta.rawKey] as number | null) : null;

  if (raw === null || score === null) {
    return (
      <div style={{
        padding: 20, borderRadius: 20,
        background: 'rgba(255,255,255,0.50)',
        border: '1px dashed rgba(103,15,34,0.14)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.45)' }}>{meta.label}</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: 'rgba(103,15,34,0.45)', marginTop: 6 }}>Sin medición registrada</div>
        </div>
      </div>
    );
  }

  const b   = physBand(score);
  const pct = (score / 5) * 100;

  const pain        = testKey === 'squats' ? latest.squats_pain : testKey === 'pushups' ? latest.pushups_pain : testKey === 'plank' ? latest.plank_pain : false;
  const interrupted = testKey === 'squats' ? latest.squats_interrupted : false;
  const borg        = testKey === 'walk' ? num(latest.walk_effort_perception) : null;
  const hr          = testKey === 'walk' ? num(latest.walk_heart_rate) : null;
  const interpret   = TEST_INTERPRET[testKey][b.name] || '';

  return (
    <div style={{
      padding: 20, borderRadius: 20,
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(103,15,34,0.08)',
      boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)' }}>{meta.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 32, fontWeight: 600, color: KORE.wineDark, letterSpacing: '-0.01em', lineHeight: 1 }}>{raw}</span>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: 'rgba(103,15,34,0.55)' }}>{meta.unit}</span>
          </div>
          {prevRaw !== null && (
            <div style={{ marginTop: 4 }}>
              <Delta now={raw} prev={prevRaw} higherBetter decimals={0} />
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 26, fontWeight: 600, color: b.color, lineHeight: 1 }}>{score.toFixed(1)}</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: b.color, marginTop: 3 }}>{b.name}</div>
        </div>
      </div>

      {/* 5-tier scale bar */}
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(103,15,34,0.06)', overflow: 'visible' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ flex: 2, background: 'rgba(228,168,168,0.18)' }} />
          <div style={{ flex: 1, background: 'rgba(229,165,116,0.18)' }} />
          <div style={{ flex: 1, background: 'rgba(229,201,122,0.18)' }} />
          <div style={{ flex: 0.5, background: 'rgba(184,208,168,0.20)' }} />
          <div style={{ flex: 0.5, background: 'rgba(168,194,156,0.22)' }} />
        </div>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`,
          background: `linear-gradient(90deg, ${b.color}AA, ${b.color})`,
          borderRadius: 3, boxShadow: `0 0 10px ${b.color}55`,
          transition: 'width 700ms ease-out',
        }} />
      </div>

      {/* Flags */}
      {(borg !== null || hr !== null || pain || interrupted) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {borg !== null && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(103,15,34,0.65)' }}><strong style={{ color: KORE.wineDark }}>Borg {borg}</strong> · esfuerzo</span>}
          {hr !== null && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(103,15,34,0.65)' }}><strong style={{ color: KORE.wineDark }}>{hr} bpm</strong> · FC</span>}
          {pain && <span style={{ padding: '2px 8px', borderRadius: 999, fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600, background: 'rgba(228,168,168,0.18)', color: '#9A0526' }}>⚠ Dolor</span>}
          {interrupted && <span style={{ padding: '2px 8px', borderRadius: 999, fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600, background: 'rgba(229,165,116,0.18)', color: '#C97A3D' }}>◔ Interrumpida</span>}
        </div>
      )}

      {/* Interpretation */}
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, lineHeight: 1.6, color: '#3A2128', borderTop: '1px solid rgba(103,15,34,0.08)', paddingTop: 10 }}>
        {interpret}
      </div>
    </div>
  );
}

function MobilitySection({ latest, prev }: { latest: PhysicalEvaluation; prev: PhysicalEvaluation | null }) {
  const items = [
    { key: 'hip',      label: 'Cadera',   value: num(latest.hip_mobility),      prevVal: prev ? num(prev.hip_mobility) : null,      desc: 'Flex/ext, rot int/ext' },
    { key: 'shoulder', label: 'Hombros',  value: num(latest.shoulder_mobility), prevVal: prev ? num(prev.shoulder_mobility) : null, desc: 'Test combinado Apley' },
    { key: 'ankle',    label: 'Tobillo',  value: num(latest.ankle_mobility),    prevVal: prev ? num(prev.ankle_mobility) : null,    desc: 'Dorsiflexión pared' },
  ].filter(m => m.value !== null) as Array<{ key: string; label: string; value: number; prevVal: number | null; desc: string }>;

  if (items.length === 0) return null;
  const avg = items.reduce((s, m) => s + m.value, 0) / items.length;
  const b = physBand(avg);

  return (
    <div style={{
      padding: 22, borderRadius: 20,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,233,220,0.20))',
      border: '1px solid rgba(103,15,34,0.08)',
      boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)' }}>Movilidad articular</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 28, fontWeight: 600, color: KORE.wineDark }}>{avg.toFixed(1)}</span>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: b.color }}>{b.name}</span>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontStyle: 'italic', color: 'rgba(103,15,34,0.50)' }}>· promedio 3 zonas</span>
          </div>
        </div>
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontStyle: 'italic', color: 'rgba(103,15,34,0.50)' }}>Escala 1–5 · valoración del trainer</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {items.map(m => {
          const mb = physBand(m.value);
          return (
            <div key={m.key} style={{
              padding: 14, borderRadius: 14,
              background: 'rgba(255,255,255,0.70)',
              border: '1px solid rgba(103,15,34,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: KORE.wineDark }}>{m.label}</span>
                <Delta now={m.value} prev={m.prevVal} higherBetter decimals={0} />
              </div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{
                    flex: 1, height: 8, borderRadius: 2,
                    background: n <= m.value ? mb.color : 'rgba(103,15,34,0.08)',
                  }} />
                ))}
              </div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(103,15,34,0.55)', lineHeight: 1.4 }}>{m.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultsHero({ latest, first }: { latest: PhysicalEvaluation; first: PhysicalEvaluation | null }) {
  const g = num(latest.general_index) ?? 0;
  const gFirst = first ? num(first.general_index) : null;
  const b = physBand(g);

  const dataLatest = {
    general:   g,
    strength:  num(latest.strength_index)  ?? 0,
    endurance: num(latest.endurance_index) ?? 0,
    mobility:  num(latest.mobility_index)  ?? 0,
    balance:   num(latest.balance_index)   ?? 0,
  };
  const dataFirst = first ? {
    general:   num(first.general_index)   ?? 0,
    strength:  num(first.strength_index)  ?? 0,
    endurance: num(first.endurance_index) ?? 0,
    mobility:  num(first.mobility_index)  ?? 0,
    balance:   num(first.balance_index)   ?? 0,
  } : null;

  const subAxes = [
    { key: 'strength'  as const, label: 'Fuerza' },
    { key: 'endurance' as const, label: 'Resistencia' },
    { key: 'mobility'  as const, label: 'Movilidad' },
    { key: 'balance'   as const, label: 'Balance' },
  ];

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 24,
      background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
      padding: 28, marginBottom: 20,
      boxShadow: '0 20px 50px -20px rgba(45,15,26,0.50)',
    }}>
      <div style={{
        position: 'absolute', top: '-20%', right: '-12%', width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,233,220,0.20) 0%, rgba(244,199,199,0.10) 40%, transparent 65%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
        {/* LEFT */}
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: KORE.gold }}>
            Índice general de condición
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 64, fontWeight: 600, color: KORE.ivory, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {g.toFixed(2)}
            </span>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, color: KORE.gold }}>/5.00</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
              borderRadius: 999, fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              background: `${b.darkColor}22`, border: `1px solid ${b.darkColor}66`, color: b.darkColor,
            }}>
              ● Banda {b.name}
            </span>
            {gFirst !== null && <Delta now={g} prev={gFirst} higherBetter big dark decimals={2} />}
          </div>
          {/* Sub-index cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
            {subAxes.map(ax => {
              const v = dataLatest[ax.key];
              const sb = physBand(v);
              return (
                <div key={ax.key} style={{
                  padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.18)',
                }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: KORE.gold }}>{ax.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: KORE.ivory }}>{v.toFixed(2)}</span>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: sb.darkColor, flexShrink: 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* RIGHT: Radar */}
        <div style={{
          padding: 16, borderRadius: 18,
          background: 'rgba(20,5,12,0.30)', border: '1px solid rgba(231,200,160,0.15)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: KORE.gold }}>Mapa por capacidad</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'rgba(255,233,220,0.7)', fontFamily: 'Montserrat, sans-serif' }}>
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
          <RadarChart size={280} dataLatest={dataLatest} dataFirst={dataFirst} />
        </div>
      </div>
    </div>
  );
}

function PhysTimeline({ evaluations }: { evaluations: PhysicalEvaluation[] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.65)', borderRadius: 24,
      padding: 28, border: '1px solid rgba(103,15,34,0.08)',
    }}>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 4 }}>Línea de tiempo</div>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textMed, marginBottom: 20 }}>
        {evaluations.length} evaluaciones registradas
      </div>
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{
          position: 'absolute', left: 7, top: 8, bottom: 8, width: 1,
          background: 'linear-gradient(180deg, transparent 0%, rgba(103,15,34,0.20) 12%, rgba(103,15,34,0.20) 88%, transparent 100%)',
        }} />
        {evaluations.map((e, i) => {
          const v = num(e.general_index) ?? 0;
          const b = physBand(v);
          const isLatest = i === 0;
          return (
            <div key={e.id} style={{
              position: 'relative',
              display: 'grid', gridTemplateColumns: 'minmax(120px,160px) 1fr',
              gap: 16, paddingBottom: i < evaluations.length - 1 ? 20 : 0,
            }}>
              <span style={{
                position: 'absolute', left: -23, top: 12,
                width: 16, height: 16, borderRadius: 8,
                background: isLatest ? `radial-gradient(circle, ${b.color}, ${b.color}88)` : KORE.ivory,
                border: `2px solid ${b.color}`,
                boxShadow: isLatest ? `0 0 0 5px ${b.color}22` : 'none',
              }} />
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600, color: KORE.wineDark }}>{formatDate(e.evaluation_date || e.created_at)}</div>
                {isLatest && (
                  <span style={{
                    display: 'inline-block', marginTop: 5, padding: '2px 8px',
                    borderRadius: 999, fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.14em',
                    background: `${b.color}22`, border: `1px solid ${b.color}66`, color: b.color,
                  }}>● Reciente</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                {([
                  { k: 'general_index' as const,   label: 'General' },
                  { k: 'strength_index' as const,  label: 'Fuerza' },
                  { k: 'endurance_index' as const, label: 'Resist.' },
                  { k: 'mobility_index' as const,  label: 'Movil.' },
                  { k: 'balance_index' as const,   label: 'Balance' },
                ]).map(ax => {
                  const val = num(e[ax.k] as string | null) ?? 0;
                  const bb = physBand(val);
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
          );
        })}
      </div>
    </div>
  );
}

function FisicaResults({ evaluations, onEdit, onNew }: {
  evaluations: PhysicalEvaluation[];
  onEdit: () => void;
  onNew: () => void;
}) {
  const latest = evaluations[0];
  const first  = evaluations.length > 1 ? evaluations[evaluations.length - 1] : null;
  const prev   = evaluations.length > 1 ? evaluations[1] : null;

  const lastEvalLabel = formatDate(latest.evaluation_date || latest.created_at);

  return (
    <div>
      <EvalSectionHeader title="Última evaluación" hint={lastEvalLabel} onNew={onNew} />

      {/* Dark hero */}
      <ResultsHero latest={latest} first={first} />

      {/* Test cards */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 4 }}>Las 5 pruebas</div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 16 }}>Por capacidad</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {TEST_KEYS.map(tk => (
          <TestCard key={tk} testKey={tk} latest={latest} prev={prev} />
        ))}
      </div>

      {/* Mobility */}
      <div style={{ marginBottom: 20 }}>
        <MobilitySection latest={latest} prev={prev} />
      </div>

      {/* Trainer notes */}
      {latest.notes && (
        <div style={{
          padding: '20px 24px', borderRadius: 20, marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
          border: '1px solid rgba(103,15,34,0.08)',
        }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.wine, marginBottom: 8 }}>Notas del entrenador</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, lineHeight: 1.5 }}>"{latest.notes}"</div>
        </div>
      )}

      {/* Timeline */}
      {evaluations.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <PhysTimeline evaluations={evaluations} />
        </div>
      )}

      {/* Edit button */}
      <button onClick={onEdit} type="button" style={{
        width: '100%', padding: '12px', borderRadius: 14, marginBottom: 16,
        background: 'rgba(103,15,34,0.06)', color: T.wine,
        fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600,
        border: `1px solid rgba(103,15,34,0.12)`, cursor: 'pointer',
      }}>Editar esta evaluación</button>
    </div>
  );
}

// ─── Form helpers (unchanged) ─────────────────────────────────
function emptyForm(): PhysicalEvalFormData {
  return {
    evaluation_date: new Date().toISOString().split('T')[0],
    squats_reps: null, pushups_reps: null, plank_seconds: null,
    walk_meters: null, unipodal_seconds: null,
    hip_mobility: null, shoulder_mobility: null, ankle_mobility: null,
    squats_notes: '', squats_pain: false, squats_interrupted: false,
    pushups_notes: '', pushups_pain: false,
    plank_notes: '', plank_pain: false,
    walk_notes: '', walk_effort_perception: null, walk_heart_rate: null,
    unipodal_notes: '', mobility_notes: '', notes: '',
  };
}

function evalToForm(ev: PhysicalEvaluation): PhysicalEvalFormData {
  return {
    evaluation_date: ev.evaluation_date,
    squats_reps: ev.squats_reps, pushups_reps: ev.pushups_reps,
    plank_seconds: ev.plank_seconds, walk_meters: ev.walk_meters,
    unipodal_seconds: ev.unipodal_seconds,
    hip_mobility: ev.hip_mobility, shoulder_mobility: ev.shoulder_mobility,
    ankle_mobility: ev.ankle_mobility,
    squats_notes: ev.squats_notes, squats_pain: ev.squats_pain,
    squats_interrupted: ev.squats_interrupted,
    pushups_notes: ev.pushups_notes, pushups_pain: ev.pushups_pain,
    plank_notes: ev.plank_notes, plank_pain: ev.plank_pain,
    walk_notes: ev.walk_notes, walk_effort_perception: ev.walk_effort_perception,
    walk_heart_rate: ev.walk_heart_rate,
    unipodal_notes: ev.unipodal_notes, mobility_notes: ev.mobility_notes, notes: ev.notes,
  };
}

function indexColor(color: string) {
  if (color === 'green') return 'sage' as const;
  if (color === 'red') return 'danger' as const;
  return 'amber' as const;
}

function TestRow({
  name, hint, value, suffix, pain, interrupted, observation,
  onValue, onPain, onInterrupted, onObservation,
  showInterrupted = false,
  extra,
}: {
  name: string; hint?: string;
  value: number | null; suffix: string;
  pain?: boolean; interrupted?: boolean; observation?: string;
  onValue: (v: number | null) => void;
  onPain?: (v: boolean) => void;
  onInterrupted?: (v: boolean) => void;
  onObservation?: (v: string) => void;
  showInterrupted?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '16px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: showInterrupted ? '1.4fr 1fr 0.9fr 0.9fr' : '1.4fr 1fr 0.9fr 1fr',
        gap: 14, alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine }}>{name}</div>
          {hint && <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textMed, marginTop: 2 }}>{hint}</div>}
        </div>
        <div>
          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5,
          }}>Resultado</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              value={value ?? ''}
              onChange={e => onValue(e.target.value === '' ? null : Number(e.target.value))}
              style={{
                width: '80px', padding: '9px 11px', borderRadius: 10,
                background: 'rgba(255,255,255,0.85)', border: `1px solid ${T.border}`,
                fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine,
                outline: 'none',
              }}
            />
            <span style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', color: T.textSoft,
            }}>{suffix}</span>
          </div>
        </div>
        {onPain ? (
          <div>
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 7,
            }}>¿Dolor?</div>
            <YesNoToggle value={pain} onChange={onPain} />
          </div>
        ) : extra ? <div>{extra}</div> : <div />}
        {showInterrupted && onInterrupted ? (
          <div>
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 7,
            }}>¿Interrumpida?</div>
            <YesNoToggle value={interrupted} onChange={onInterrupted} />
          </div>
        ) : <div />}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, flexShrink: 0,
        }}>Obs.</span>
        <input
          value={observation ?? ''}
          onChange={e => onObservation?.(e.target.value)}
          placeholder="Opcional · técnica, fatiga, modificaciones…"
          style={{
            flex: 1, padding: '7px 11px', borderRadius: 9,
            background: 'rgba(255,255,255,0.70)', border: `1px solid ${T.border}`,
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textDark, outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function EvalFisicaTab({ clientId }: { clientId: number }) {
  const { evaluations, loading, submitting, error, fetchEvaluations, createEvaluation, updateEvaluation } =
    usePhysicalEvaluationStore();

  const [tabMode, setTabMode] = useState<'results' | 'form'>('results');
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<PhysicalEvalFormData>(emptyForm());
  const latest = evaluations[0] ?? null;

  useEffect(() => {
    if (clientId) fetchEvaluations(clientId);
  }, [clientId, fetchEvaluations]);

  // Default to form when no evaluations
  useEffect(() => {
    if (!loading && evaluations.length === 0) setTabMode('form');
  }, [loading, evaluations.length]);

  const enterCreate = useCallback(() => { setForm(emptyForm()); setEditMode('create'); setTabMode('form'); }, []);
  const enterEdit   = useCallback(() => { if (latest) { setForm(evalToForm(latest)); setEditMode('edit'); setTabMode('form'); } }, [latest]);
  const cancel      = useCallback(() => { setEditMode(null); setTabMode(evaluations.length > 0 ? 'results' : 'form'); }, [evaluations.length]);

  const handleSave = useCallback(async () => {
    if (editMode === 'create') {
      const res = await createEvaluation(clientId, form);
      if (res) { setEditMode(null); setTabMode('results'); }
    } else if (editMode === 'edit' && latest) {
      const res = await updateEvaluation(clientId, latest.id, form);
      if (res) { setEditMode(null); setTabMode('results'); }
    }
  }, [editMode, clientId, form, latest, createEvaluation, updateEvaluation]);

  const set = <K extends keyof PhysicalEvalFormData>(k: K, v: PhysicalEvalFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const lastEvalLabel = latest
    ? new Date(latest.evaluation_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const isEditing = editMode !== null;

  return (
    <div>
      <FormHero
        kicker="Evaluación · Módulo 3"
        title="Condición física"
        lastEval={lastEvalLabel}
        role="trainer"
        score={latest ? latest.general_index : null}
        scoreLabel="Índice general"
        scoreTone={latest ? indexColor(latest.general_color) : 'sage'}
      />

      {loading && <EvalSpinner />}

      {/* Mode toggle — only when evaluations exist and not editing */}
      {!loading && evaluations.length > 0 && !isEditing && (
        <ModePill mode={tabMode} onChange={setTabMode} />
      )}

      {/* Empty state */}
      {!loading && evaluations.length === 0 && !isEditing && (
        <EvalEmptyState message="Sin evaluaciones físicas. Registra la primera." onNew={enterCreate} />
      )}

      {/* Results view */}
      {!loading && evaluations.length > 0 && tabMode === 'results' && !isEditing && (
        <FisicaResults evaluations={evaluations} onEdit={enterEdit} onNew={enterCreate} />
      )}

      {/* Form view */}
      {!loading && tabMode === 'form' && !isEditing && evaluations.length > 0 && (
        <>
          <EvalSectionHeader title="Última evaluación" hint={lastEvalLabel ?? ''} onNew={enterCreate} />
          <FormSection title="Resultados auto-calculados" columns={5} gap={12}>
            <ComputedCard label="Fuerza"    value={latest!.strength_index}   sub={latest!.strength_category}  tone={indexColor(latest!.strength_color)} />
            <ComputedCard label="Resistencia" value={latest!.endurance_index} sub={latest!.endurance_category} tone={indexColor(latest!.endurance_color)} />
            <ComputedCard label="Movilidad" value={latest!.mobility_index}   sub={latest!.mobility_category}  tone={indexColor(latest!.mobility_color)} />
            <ComputedCard label="Equilibrio" value={latest!.balance_index}   sub={latest!.balance_category}   tone={indexColor(latest!.balance_color)} />
            <ComputedCard label="General"   value={latest!.general_index}    sub={latest!.general_category}   tone={indexColor(latest!.general_color)} />
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
            }}>{error}</div>
          )}

          <FormSection title="Fecha" columns={1} gap={12}>
            <Field label="Fecha de evaluación" value={form.evaluation_date} onChange={v => set('evaluation_date', v)} />
          </FormSection>

          <div style={{
            background: 'rgba(255,255,255,0.70)', borderRadius: 22,
            border: `1px solid ${T.borderSoft}`, padding: '20px 22px', marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginBottom: 4 }}>
              Tests funcionales
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textMed, marginBottom: 8 }}>
              Registrar repeticiones / tiempo · marcar si hubo dolor o si la prueba fue interrumpida.
            </div>
            <TestRow
              name="Sentadillas" hint="Repeticiones correctas en 1 minuto"
              value={form.squats_reps} suffix="reps"
              pain={form.squats_pain} interrupted={form.squats_interrupted}
              observation={form.squats_notes}
              onValue={v => set('squats_reps', v)}
              onPain={v => set('squats_pain', v)}
              onInterrupted={v => set('squats_interrupted', v)}
              onObservation={v => set('squats_notes', v)}
              showInterrupted
            />
            <TestRow
              name="Flexiones" hint="Repeticiones hasta el fallo técnico"
              value={form.pushups_reps} suffix="reps"
              pain={form.pushups_pain} observation={form.pushups_notes}
              onValue={v => set('pushups_reps', v)}
              onPain={v => set('pushups_pain', v)}
              onObservation={v => set('pushups_notes', v)}
            />
            <TestRow
              name="Plancha" hint="Mantener posición correcta en segundos"
              value={form.plank_seconds} suffix="s"
              pain={form.plank_pain} observation={form.plank_notes}
              onValue={v => set('plank_seconds', v)}
              onPain={v => set('plank_pain', v)}
              onObservation={v => set('plank_notes', v)}
            />
            <TestRow
              name="Caminata 6 min" hint="Distancia en metros en 6 minutos"
              value={form.walk_meters} suffix="m"
              observation={form.walk_notes}
              onValue={v => set('walk_meters', v)}
              onObservation={v => set('walk_notes', v)}
              extra={
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="FC post" suffix="ppm"
                    value={form.walk_heart_rate != null ? String(form.walk_heart_rate) : ''}
                    onChange={v => set('walk_heart_rate', v === '' ? null : Number(v))} />
                  <Field label="RPE" suffix="/10"
                    value={form.walk_effort_perception != null ? String(form.walk_effort_perception) : ''}
                    onChange={v => set('walk_effort_perception', v === '' ? null : Number(v))} />
                </div>
              }
            />
            <TestRow
              name="Equilibrio unipodal" hint="Tiempo sobre un solo apoyo · mejor pierna"
              value={form.unipodal_seconds} suffix="s"
              observation={form.unipodal_notes}
              onValue={v => set('unipodal_seconds', v)}
              onObservation={v => set('unipodal_notes', v)}
            />
          </div>

          <FormSection title="Movilidad articular" hint="Escala 1 (limitada) – 5 (excelente)" columns={1} gap={14}>
            <RatingScale label="Cadera" value={form.hip_mobility ?? 0} hint="Flex/ext, rot int/ext" onChange={v => set('hip_mobility', v)} />
            <RatingScale label="Hombros" value={form.shoulder_mobility ?? 0} hint="Flex, abd, rot int/ext" onChange={v => set('shoulder_mobility', v)} />
            <RatingScale label="Tobillo" value={form.ankle_mobility ?? 0} hint="Dorsiflex, eversión / inversión" onChange={v => set('ankle_mobility', v)} />
          </FormSection>

          <NotesField
            placeholder="Observaciones globales: nivel inicial, progresión esperada, contraindicaciones…"
            value={form.notes}
            onChange={v => set('notes', v)}
          />

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
