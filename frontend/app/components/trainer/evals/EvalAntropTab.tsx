'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  useAnthropometryStore,
  type AnthropometryFormData,
  type AnthropometryEvaluation,
} from '@/lib/stores/anthropometryStore';
import {
  T, FormHero, FormSection, Field, BilateralPair,
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
  now, prev, higherBetter = true, decimals = 1, dark = false,
}: {
  now: number | null;
  prev: number | null;
  higherBetter?: boolean;
  decimals?: number;
  dark?: boolean;
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
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 999,
      background: bg, border: `1px solid ${borderColor}`, color,
      fontSize: 10, fontFamily: 'Montserrat, sans-serif',
      fontWeight: 600, letterSpacing: '0.02em',
    }}>
      {arrow} {Math.abs(diff).toFixed(decimals)}
    </span>
  );
}

// ─── Mode toggle pill ─────────────────────────────────────────
function ModePill({ mode, onChange }: { mode: 'results' | 'form'; onChange: (m: 'results' | 'form') => void }) {
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
            color: sel ? T.wine : T.textMed, cursor: 'pointer',
          }}>
            {m === 'results' ? 'Resultados' : 'Formulario'}
          </button>
        );
      })}
    </div>
  );
}

// ─── Metric hero strip ────────────────────────────────────────
type MetricCell = {
  label: string;
  value: string | null;
  sub: string | null;
  delta: React.ReactNode;
  warn?: boolean;
};

function MetricStrip({ cells }: { cells: MetricCell[] }) {
  return (
    <div style={{
      display: 'flex', gap: 0, overflowX: 'auto', marginBottom: 20,
      background: 'rgba(255,255,255,0.78)', borderRadius: 20,
      border: '1px solid rgba(103,15,34,0.08)',
      boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
    }}>
      {cells.map((c, i) => (
        <div key={i} style={{
          flex: 1, minWidth: 92, padding: '18px 14px',
          borderRight: i < cells.length - 1 ? '1px solid rgba(103,15,34,0.07)' : 'none',
        }}>
          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.20em', textTransform: 'uppercase',
            color: 'rgba(103,15,34,0.55)', marginBottom: 6,
          }}>{c.label}</div>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: 24, fontWeight: 600,
            color: c.warn ? KORE.copper : KORE.wineDark, lineHeight: 1, marginBottom: 4,
          }}>{c.value ?? '—'}</div>
          {c.sub && (
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600,
              color: c.warn ? KORE.copper : T.textMed, marginBottom: 4,
            }}>{c.sub}</div>
          )}
          {c.delta}
        </div>
      ))}
    </div>
  );
}

// ─── Composition bars ─────────────────────────────────────────
function CompositionBars({ latest }: { latest: AnthropometryEvaluation }) {
  const weight  = num(latest.weight_kg) ?? 0;
  const fatMass = num(latest.fat_mass_kg) ?? 0;
  const lean    = num(latest.lean_mass_kg) ?? 0;
  const fatPct  = num(latest.body_fat_pct) ?? 0;
  const leanPct = weight > 0 ? Math.round((lean / weight) * 100) : 0;

  if (weight === 0) return null;

  const bars: Array<{ label: string; kg: number | null; pct: number; color: string; bg: string }> = [
    { label: 'Masa magra',  kg: lean,    pct: leanPct,      color: KORE.sage,       bg: 'rgba(168,194,156,0.15)' },
    { label: 'Masa grasa',  kg: fatMass, pct: Math.round(fatPct), color: KORE.copper,    bg: 'rgba(229,165,116,0.15)' },
    { label: '% Grasa',     kg: null,    pct: Math.round(fatPct), color: KORE.amber,     bg: 'rgba(229,201,122,0.15)' },
  ];

  return (
    <div style={{
      padding: '20px 22px', borderRadius: 20, marginBottom: 20,
      background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(103,15,34,0.08)',
      boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
    }}>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine, marginBottom: 4 }}>
        Composición corporal
      </div>
      <div style={{
        fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textMed, marginBottom: 16,
      }}>
        {latest.bf_method || 'Método de pliegues cutáneos'} · {latest.weight_kg} kg total
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bars.map((b, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600, color: T.textDark }}>{b.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {b.kg !== null && <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textMed }}>{b.kg.toFixed(1)} kg</span>}
                <span style={{
                  fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600, color: b.color,
                  minWidth: 40, textAlign: 'right',
                }}>{b.pct}%</span>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: b.bg, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${Math.min(b.pct, 100)}%`, borderRadius: 4,
                background: `linear-gradient(90deg, ${b.color}88, ${b.color})`,
                transition: 'width 700ms ease-out',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Measurements table ───────────────────────────────────────
const PERIMETER_TABLE_FIELDS = [
  { key: 'brazo_relajado',   label: 'Brazo relajado',   bilateral: true  },
  { key: 'brazo_flexionado', label: 'Brazo flexionado', bilateral: true  },
  { key: 'antebrazo',        label: 'Antebrazo',        bilateral: true  },
  { key: 'muneca',           label: 'Muñeca',           bilateral: true  },
  { key: 'pecho',            label: 'Tórax / Pecho',    bilateral: false },
  { key: 'muslo',            label: 'Muslo',            bilateral: true  },
  { key: 'pantorrilla',      label: 'Pantorrilla',      bilateral: true  },
  { key: 'tobillo',          label: 'Tobillo',          bilateral: true  },
];
const SKINFOLD_TABLE_FIELDS = [
  { key: 'triceps',       label: 'Tríceps',        bilateral: true  },
  { key: 'biceps',        label: 'Bíceps',         bilateral: true  },
  { key: 'subescapular',  label: 'Sub Escapular',  bilateral: true  },
  { key: 'cresta_iliaca', label: 'Cresta Ilíaca',  bilateral: true  },
  { key: 'supraespinal',  label: 'Supraespinal',   bilateral: false },
  { key: 'abdominal',     label: 'Abdominal',      bilateral: false },
  { key: 'muslo',         label: 'Muslo',          bilateral: true  },
  { key: 'pantorrilla',   label: 'Pantorrilla',    bilateral: true  },
];

function MeasurementsTable({
  latest, prev,
}: { latest: AnthropometryEvaluation; prev: AnthropometryEvaluation | null }) {
  const p = latest.perimeters ?? {};
  const s = latest.skinfolds  ?? {};
  const pp = prev?.perimeters ?? {};
  const ps = prev?.skinfolds  ?? {};

  function valCell(val: number | undefined | null, prevVal: number | undefined | null, higherBetter = false) {
    const v = val ?? null;
    const pv = prevVal ?? null;
    if (v === null) return <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(103,15,34,0.30)' }}>—</span>;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 600, color: KORE.wineDark }}>{v}</span>
        {pv !== null && <Delta now={v} prev={pv} higherBetter={higherBetter} decimals={0} />}
      </div>
    );
  }

  const colHeader = (text: string) => (
    <th style={{
      padding: '8px 10px', fontFamily: 'Montserrat, sans-serif', fontSize: 8, fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)',
      background: 'rgba(103,15,34,0.04)', borderBottom: '1px solid rgba(103,15,34,0.08)',
      textAlign: 'left', whiteSpace: 'nowrap',
    }}>{text}</th>
  );

  const rowStyle = (even: boolean): React.CSSProperties => ({
    background: even ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.30)',
  });

  const tableStyle: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse',
    fontFamily: 'Montserrat, sans-serif', fontSize: 11,
  };

  const tdStyle: React.CSSProperties = {
    padding: '7px 10px', borderBottom: '1px solid rgba(103,15,34,0.05)',
    verticalAlign: 'middle',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16, marginBottom: 20 }}>
      {/* Perímetros */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(103,15,34,0.08)',
        background: 'rgba(255,255,255,0.78)',
      }}>
        <div style={{ padding: '14px 16px 0', fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: T.wine }}>Perímetros</div>
        <div className="overflow-x-auto" style={{ padding: '8px 0' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {colHeader('Segmento')}
                {colHeader('D (cm)')}
                {colHeader('I (cm)')}
              </tr>
            </thead>
            <tbody>
              {PERIMETER_TABLE_FIELDS.map((f, i) => (
                f.bilateral ? (
                  <tr key={f.key} style={rowStyle(i % 2 === 0)}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: KORE.wineDark }}>{f.label}</td>
                    <td style={tdStyle}>{valCell(p[`${f.key}_d`], pp[`${f.key}_d`])}</td>
                    <td style={tdStyle}>{valCell(p[`${f.key}_i`], pp[`${f.key}_i`])}</td>
                  </tr>
                ) : (
                  <tr key={f.key} style={rowStyle(i % 2 === 0)}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: KORE.wineDark }}>{f.label}</td>
                    <td style={{ ...tdStyle }} colSpan={2}>{valCell(p[f.key], pp[f.key])}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pliegues */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(103,15,34,0.08)',
        background: 'rgba(255,255,255,0.78)',
      }}>
        <div style={{ padding: '14px 16px 0', fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600, color: T.wine }}>Pliegues</div>
        <div className="overflow-x-auto" style={{ padding: '8px 0' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {colHeader('Segmento')}
                {colHeader('D (mm)')}
                {colHeader('I (mm)')}
              </tr>
            </thead>
            <tbody>
              {SKINFOLD_TABLE_FIELDS.map((f, i) => (
                f.bilateral ? (
                  <tr key={f.key} style={rowStyle(i % 2 === 0)}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: KORE.wineDark }}>{f.label}</td>
                    <td style={tdStyle}>{valCell(s[`${f.key}_d`], ps[`${f.key}_d`])}</td>
                    <td style={tdStyle}>{valCell(s[`${f.key}_i`], ps[`${f.key}_i`])}</td>
                  </tr>
                ) : (
                  <tr key={f.key} style={rowStyle(i % 2 === 0)}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: KORE.wineDark }}>{f.label}</td>
                    <td style={{ ...tdStyle }} colSpan={2}>{valCell(s[f.key], ps[f.key])}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────
function AntropTimeline({ evaluations }: { evaluations: AnthropometryEvaluation[] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.65)', borderRadius: 24,
      padding: 24, border: '1px solid rgba(103,15,34,0.08)', marginBottom: 20,
    }}>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine, marginBottom: 14 }}>
        Línea de tiempo
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Montserrat, sans-serif', fontSize: 11, minWidth: 500 }}>
          <thead>
            <tr>
              {(['Fecha', 'Peso', 'IMC', '% Grasa', 'M. Magra', 'M. Grasa'] as const).map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 9,
                  letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)',
                  background: 'rgba(103,15,34,0.04)', borderBottom: '1px solid rgba(103,15,34,0.08)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e, i) => {
              const isLatest = i === 0;
              const prev = evaluations[i + 1] ?? null;
              return (
                <tr key={e.id} style={{
                  background: isLatest ? 'rgba(103,15,34,0.04)' : (i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.30)'),
                }}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(103,15,34,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: isLatest ? 700 : 500, color: KORE.wineDark }}>
                        {formatDate(e.evaluation_date || e.created_at)}
                      </span>
                      {isLatest && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 999, fontSize: 8, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.12em',
                          background: 'rgba(103,15,34,0.10)', color: KORE.wineDark,
                        }}>Reciente</span>
                      )}
                    </div>
                  </td>
                  {[
                    { v: num(e.weight_kg),     pv: prev ? num(prev.weight_kg) : null,     hi: false, suf: ' kg' },
                    { v: num(e.bmi),           pv: prev ? num(prev.bmi) : null,           hi: false, suf: '' },
                    { v: num(e.body_fat_pct),  pv: prev ? num(prev.body_fat_pct) : null,  hi: false, suf: '%' },
                    { v: num(e.lean_mass_kg),  pv: prev ? num(prev.lean_mass_kg) : null,  hi: true,  suf: ' kg' },
                    { v: num(e.fat_mass_kg),   pv: prev ? num(prev.fat_mass_kg) : null,   hi: false, suf: ' kg' },
                  ].map((cell, ci) => (
                    <td key={ci} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(103,15,34,0.05)' }}>
                      {cell.v !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 600, color: KORE.wineDark }}>
                            {cell.v.toFixed(1)}{cell.suf}
                          </span>
                          {cell.pv !== null && <Delta now={cell.v} prev={cell.pv} higherBetter={cell.hi} decimals={1} />}
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(103,15,34,0.30)' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Results view ─────────────────────────────────────────────
function AntropResults({ evaluations, onEdit, onNew }: {
  evaluations: AnthropometryEvaluation[];
  onEdit: () => void;
  onNew: () => void;
}) {
  const latest = evaluations[0];
  const prev   = evaluations.length > 1 ? evaluations[1] : null;

  const bmiN    = num(latest.bmi);
  const bfPctN  = num(latest.body_fat_pct);
  const fatMass = num(latest.fat_mass_kg);
  const leanM   = num(latest.lean_mass_kg);
  const icc     = num(latest.waist_hip_ratio);
  const ict     = num(latest.waist_height_ratio);

  const prevBmi   = prev ? num(prev.bmi)           : null;
  const prevBf    = prev ? num(prev.body_fat_pct)  : null;
  const prevFat   = prev ? num(prev.fat_mass_kg)   : null;
  const prevLean  = prev ? num(prev.lean_mass_kg)  : null;
  const prevIcc   = prev ? num(prev.waist_hip_ratio)    : null;
  const prevIct   = prev ? num(prev.waist_height_ratio) : null;

  const metricCells: MetricCell[] = [
    {
      label: 'IMC',
      value: bmiN !== null ? bmiN.toFixed(1) : null,
      sub: latest.bmi_category || null,
      delta: <Delta now={bmiN} prev={prevBmi} higherBetter={false} decimals={1} />,
    },
    {
      label: '% Grasa',
      value: bfPctN !== null ? `${bfPctN.toFixed(1)}%` : null,
      sub: latest.bf_category || null,
      delta: <Delta now={bfPctN} prev={prevBf} higherBetter={false} decimals={1} />,
      warn: latest.bf_color === 'red' || latest.bf_color === 'orange',
    },
    {
      label: 'Masa grasa',
      value: fatMass !== null ? `${fatMass.toFixed(1)} kg` : null,
      sub: null,
      delta: <Delta now={fatMass} prev={prevFat} higherBetter={false} decimals={1} />,
    },
    {
      label: 'Masa magra',
      value: leanM !== null ? `${leanM.toFixed(1)} kg` : null,
      sub: null,
      delta: <Delta now={leanM} prev={prevLean} higherBetter={true} decimals={1} />,
    },
    ...(icc !== null ? [{
      label: 'ICC',
      value: icc.toFixed(2),
      sub: latest.whr_risk || null,
      delta: <Delta now={icc} prev={prevIcc} higherBetter={false} decimals={2} />,
      warn: latest.whr_color === 'red' || latest.whr_color === 'orange',
    }] : []),
    ...(ict !== null ? [{
      label: 'IC / Talla',
      value: ict.toFixed(2),
      sub: latest.whe_risk || null,
      delta: <Delta now={ict} prev={prevIct} higherBetter={false} decimals={2} />,
      warn: latest.whe_color === 'red' || latest.whe_color === 'orange',
    }] : []),
  ];

  return (
    <div>
      <EvalSectionHeader
        title="Última evaluación"
        hint={formatDate(latest.evaluation_date || latest.created_at)}
        onNew={onNew}
      />

      {/* Metric hero strip */}
      <MetricStrip cells={metricCells} />

      {/* Composition bars */}
      <CompositionBars latest={latest} />

      {/* Measurements table */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(103,15,34,0.55)', marginBottom: 4 }}>Mediciones</div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine, marginBottom: 14 }}>Perímetros y pliegues</div>
      </div>
      <MeasurementsTable latest={latest} prev={prev} />

      {/* Timeline */}
      {evaluations.length > 1 && (
        <AntropTimeline evaluations={evaluations} />
      )}

      {/* Trainer notes */}
      {latest.notes && (
        <div style={{
          padding: '18px 22px', borderRadius: 18, marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(103,15,34,0.04), rgba(231,200,160,0.10))',
          border: '1px solid rgba(103,15,34,0.08)',
        }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.wine, marginBottom: 6 }}>Notas del entrenador</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 15, fontWeight: 600, color: T.wine, lineHeight: 1.5 }}>"{latest.notes}"</div>
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

// ─── Form helpers (unchanged) ─────────────────────────────────
const PERIMETER_FIELDS: { key: string; label: string; bilateral: boolean; suffix: string }[] = [
  { key: 'brazo_relajado',   label: 'Brazo relajado',   bilateral: true,  suffix: 'cm' },
  { key: 'brazo_flexionado', label: 'Brazo flexionado', bilateral: true,  suffix: 'cm' },
  { key: 'antebrazo',        label: 'Antebrazo',        bilateral: true,  suffix: 'cm' },
  { key: 'muneca',           label: 'Muñeca',           bilateral: true,  suffix: 'cm' },
  { key: 'pecho',            label: 'Tórax/Pecho',      bilateral: false, suffix: 'cm' },
  { key: 'muslo',            label: 'Muslo',            bilateral: true,  suffix: 'cm' },
  { key: 'pantorrilla',      label: 'Pantorrilla',      bilateral: true,  suffix: 'cm' },
  { key: 'tobillo',          label: 'Tobillo',          bilateral: true,  suffix: 'cm' },
];

const SKINFOLD_FIELDS: { key: string; label: string; bilateral: boolean }[] = [
  { key: 'triceps',       label: 'Tríceps',       bilateral: true  },
  { key: 'biceps',        label: 'Bíceps',        bilateral: true  },
  { key: 'subescapular',  label: 'Sub Escapular', bilateral: true  },
  { key: 'cresta_iliaca', label: 'Cresta Ilíaca', bilateral: true  },
  { key: 'supraespinal',  label: 'Supraespinal',  bilateral: false },
  { key: 'abdominal',     label: 'Abdominal',     bilateral: false },
  { key: 'muslo',         label: 'Muslo',         bilateral: true  },
  { key: 'pantorrilla',   label: 'Pantorrilla',   bilateral: true  },
];

function emptyForm(): AnthropometryFormData {
  return {
    evaluation_date: new Date().toISOString().split('T')[0],
    weight_kg: '', height_cm: '', waist_cm: '', hip_cm: '',
    perimeters: {}, skinfolds: {}, notes: '',
  };
}

function evalToForm(ev: AnthropometryEvaluation): AnthropometryFormData {
  const perimeters: Record<string, string> = {};
  for (const [k, v] of Object.entries(ev.perimeters ?? {})) perimeters[k] = String(v);
  const skinfolds: Record<string, string> = {};
  for (const [k, v] of Object.entries(ev.skinfolds ?? {})) skinfolds[k] = String(v);
  return {
    evaluation_date: ev.evaluation_date,
    weight_kg: ev.weight_kg ?? '',
    height_cm: ev.height_cm ?? '',
    waist_cm: ev.waist_cm ?? '',
    hip_cm: ev.hip_cm ?? '',
    perimeters, skinfolds,
    notes: ev.notes ?? '',
  };
}

function bmiColor(color: string) {
  if (color === 'green') return 'sage' as const;
  if (color === 'red') return 'danger' as const;
  return 'amber' as const;
}

// ─── Main component ───────────────────────────────────────────
export default function EvalAntropTab({ clientId }: { clientId: number }) {
  const { evaluations, loading, submitting, error, fetchEvaluations, createEvaluation, fullUpdateEvaluation } =
    useAnthropometryStore();

  const [tabMode, setTabMode] = useState<'results' | 'form'>('results');
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<AnthropometryFormData>(emptyForm());
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

  const handleSave = useCallback(async () => {
    if (editMode === 'create') {
      const res = await createEvaluation(clientId, form);
      if (res) { setEditMode(null); setTabMode('results'); }
    } else if (editMode === 'edit' && latest) {
      const res = await fullUpdateEvaluation(clientId, latest.id, form);
      if (res) { setEditMode(null); setTabMode('results'); }
    }
  }, [editMode, clientId, form, latest, createEvaluation, fullUpdateEvaluation]);

  const setP = (key: string, val: string) =>
    setForm(f => ({ ...f, perimeters: { ...f.perimeters, [key]: val } }));
  const setS = (key: string, val: string) =>
    setForm(f => ({ ...f, skinfolds: { ...f.skinfolds, [key]: val } }));

  const lastEvalLabel = latest
    ? new Date(latest.evaluation_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const isEditing = editMode !== null;
  const displayEval = editMode === 'edit' ? null : latest;

  return (
    <div>
      <FormHero
        kicker="Evaluación · Módulo 1"
        title="Antropometría"
        lastEval={lastEvalLabel}
        role="trainer"
        score={displayEval ? parseFloat(displayEval.bmi).toFixed(1) : null}
        scoreLabel="IMC"
        scoreTone={displayEval ? bmiColor(displayEval.bmi_color) : 'sage'}
      />

      {loading && <EvalSpinner />}

      {!loading && evaluations.length > 0 && !isEditing && (
        <ModePill mode={tabMode} onChange={setTabMode} />
      )}

      {!loading && evaluations.length === 0 && !isEditing && (
        <EvalEmptyState message="Sin evaluaciones antropométricas. Registra la primera." onNew={enterCreate} />
      )}

      {/* Results view */}
      {!loading && evaluations.length > 0 && tabMode === 'results' && !isEditing && (
        <AntropResults evaluations={evaluations} onEdit={enterEdit} onNew={enterCreate} />
      )}

      {/* Form view — read-only summary */}
      {!loading && tabMode === 'form' && !isEditing && evaluations.length > 0 && (
        <>
          <EvalSectionHeader title="Última evaluación" hint={lastEvalLabel ?? ''} onNew={enterCreate} />
          <FormSection title="Resultados auto-calculados" columns={4} gap={12}>
            <ComputedCard label="IMC" value={latest!.bmi} sub={latest!.bmi_category} tone={bmiColor(latest!.bmi_color)} />
            <ComputedCard label="% Grasa" value={`${latest!.body_fat_pct}%`} sub={latest!.bf_category} tone={bmiColor(latest!.bf_color)} />
            <ComputedCard label="Masa grasa" value={`${latest!.fat_mass_kg} kg`} tone="wine" />
            <ComputedCard label="Masa magra" value={`${latest!.lean_mass_kg} kg`} tone="sage" />
            {latest!.waist_hip_ratio && <ComputedCard label="ICC" value={latest!.waist_hip_ratio} sub={latest!.whr_risk} tone={bmiColor(latest!.whr_color)} />}
            {latest!.waist_height_ratio && <ComputedCard label="IC / Talla" value={latest!.waist_height_ratio} sub={latest!.whe_risk} tone={bmiColor(latest!.whe_color)} />}
          </FormSection>
          <FormSection title="Medidas básicas" columns={2} gap={16}>
            <Field label="Peso" suffix="kg" value={latest!.weight_kg} readonly />
            <Field label="Talla" suffix="cm" value={latest!.height_cm} readonly />
            <Field label="Cintura" suffix="cm" value={latest!.waist_cm ?? ''} readonly />
            <Field label="Cadera" suffix="cm" value={latest!.hip_cm ?? ''} readonly />
          </FormSection>
          <NotesField value={latest!.notes} readonly label="Notas del entrenador" />
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

          <FormSection title="Medidas básicas" required hint="Necesarias para el cálculo de IMC y composición corporal." columns={2} gap={16}>
            <Field label="Fecha" value={form.evaluation_date} onChange={v => setForm(f => ({ ...f, evaluation_date: v }))} />
            <Field label="Peso" suffix="kg" value={form.weight_kg} placeholder="75.0" onChange={v => setForm(f => ({ ...f, weight_kg: v }))} />
            <Field label="Talla" suffix="cm" value={form.height_cm} placeholder="175" onChange={v => setForm(f => ({ ...f, height_cm: v }))} />
            <Field label="Cintura" suffix="cm" value={form.waist_cm} placeholder="80" onChange={v => setForm(f => ({ ...f, waist_cm: v }))} />
            <Field label="Cadera" suffix="cm" value={form.hip_cm} placeholder="95" onChange={v => setForm(f => ({ ...f, hip_cm: v }))} />
          </FormSection>

          <FormSection title="Perímetros" hint="Centímetros · medir 2 veces y promediar." columns={4} gap={14}>
            {PERIMETER_FIELDS.map(f =>
              f.bilateral ? (
                <BilateralPair
                  key={f.key} label={f.label} suffix={f.suffix}
                  dR={form.perimeters[`${f.key}_d`]}
                  dL={form.perimeters[`${f.key}_i`]}
                  onChangeR={v => setP(`${f.key}_d`, v)}
                  onChangeL={v => setP(`${f.key}_i`, v)}
                />
              ) : (
                <Field
                  key={f.key} label={f.label} suffix={f.suffix}
                  value={form.perimeters[f.key]}
                  onChange={v => setP(f.key, v)}
                />
              )
            )}
          </FormSection>

          <FormSection title="Pliegues cutáneos" hint="Milímetros · calibrador · promedio de 2 mediciones." columns={4} gap={14}>
            {SKINFOLD_FIELDS.map(f =>
              f.bilateral ? (
                <BilateralPair
                  key={f.key} label={f.label} suffix="mm"
                  dR={form.skinfolds[`${f.key}_d`]}
                  dL={form.skinfolds[`${f.key}_i`]}
                  onChangeR={v => setS(`${f.key}_d`, v)}
                  onChangeL={v => setS(`${f.key}_i`, v)}
                />
              ) : (
                <Field
                  key={f.key} label={f.label} suffix="mm"
                  value={form.skinfolds[f.key]}
                  onChange={v => setS(f.key, v)}
                />
              )
            )}
          </FormSection>

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
