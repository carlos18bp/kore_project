'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import type { MonthlyProgram, ProgramDay, ProgramExercise } from '@/lib/stores/programStore';
import { useTrainerStore, type DailyLogDay } from '@/lib/stores/trainerStore';
import EmptyState from '@/app/components/shared/EmptyState';

// ─── Design tokens ─────────────────────────────────────────────
const T = {
  wine:       '#670F22',
  wineDeep:   '#5C2030',
  wineDark:   '#2D0F1A',
  wineDeep2:  '#4A1828',
  ivory:      '#FFF8EC',
  champagne:  '#E7C8A0',
  sage:       '#A8C29C',
  sageDeep:   '#669959',
  sageDark:   '#3F6B36',
  amber:      '#E5C97A',
  amberDeep:  '#A88A2E',
  textDark:   '#2A1A1F',
  textMed:    'rgba(103,15,34,0.65)',
  textSoft:   'rgba(103,15,34,0.55)',
  border:     'rgba(103,15,34,0.10)',
  borderSoft: 'rgba(103,15,34,0.08)',
};

const GOAL_LABEL: Record<string, string> = {
  fat_loss:           'Pérdida de grasa',
  muscle_gain:        'Ganancia muscular',
  rehab:              'Rehabilitación',
  general_health:     'Salud general',
  sports_performance: 'Rendimiento deportivo',
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Date helpers
function fmtDay(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
function weekRange(days: ProgramDay[]): string {
  if (!days.length) return '';
  const first = fmtDay(days[0].date);
  const last  = fmtDay(days[days.length - 1].date);
  return `${first} – ${last}`;
}
function programDateRange(p: MonthlyProgram): string {
  const start = new Date(p.start_date + 'T12:00:00');
  const end   = new Date(p.end_date   + 'T12:00:00');
  const sd = start.getDate();
  const sm = start.toLocaleDateString('es-CO', { month: 'short' });
  const ed = end.getDate();
  const em = end.toLocaleDateString('es-CO', { month: 'short' });
  return sm === em ? `${sd}–${ed} ${sm}` : `${sd} ${sm} – ${ed} ${em}`;
}

// ─── Day type chip ─────────────────────────────────────────────
const DAY_CFG = {
  training:    { bg: 'linear-gradient(135deg, rgba(154,5,38,0.12), rgba(171,13,47,0.18))', fg: '#9A0526', bd: 'rgba(154,5,38,0.30)', label: 'Entrenamiento' },
  active_rest: { bg: 'rgba(229,201,122,0.20)', fg: T.amberDeep, bd: 'rgba(229,201,122,0.40)', label: 'Descanso activo' },
  rest:        { bg: 'rgba(168,194,156,0.18)', fg: T.sageDark,  bd: 'rgba(168,194,156,0.32)', label: 'Descanso' },
} as const;

function DayTypeChip({ type }: { type: string }) {
  const cfg = DAY_CFG[type as keyof typeof DAY_CFG] ?? DAY_CFG.rest;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.bd}`, fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', flexShrink: 0 }}>
      {cfg.label}
    </span>
  );
}

// ─── Adherence status ──────────────────────────────────────────
type AdhStatus = 'done' | 'skipped' | 'pending' | 'rest';

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'Montserrat', fontSize: 10, color: T.textMed }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }}/>
      {label}
    </div>
  );
}

// ─── Exercise row (with inline editing) ───────────────────────
type OnExSaved = (dayId: number, exId: number, updated: ProgramExercise) => void;

type CatalogExercise = {
  id: number;
  name: string;
  pattern: string;
  exercise_type: string;
  youtube_url: string;
  primary_muscles: string;
};

function ExerciseRow({
  ex, last, programId, dayId, onSaved,
}: {
  ex: ProgramExercise;
  last: boolean;
  programId: number;
  dayId: number;
  onSaved: OnExSaved;
}) {
  const isTimeBased = ex.duration_seconds != null && ex.reps == null;

  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [sets,       setSets]       = useState(ex.sets);
  const [reps,       setReps]       = useState(ex.reps);
  const [dur,        setDur]        = useState(ex.duration_seconds);
  const [rest,       setRest]       = useState(ex.rest_seconds);
  const [notes,      setNotes]      = useState(ex.notes ?? '');
  const [mode,       setMode]       = useState<'reps' | 'time'>(isTimeBased ? 'time' : 'reps');
  // Catalog picker
  const [showPicker,     setShowPicker]     = useState(false);
  const [results,        setResults]        = useState<CatalogExercise[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [search,         setSearch]         = useState('');
  const [picked,         setPicked]         = useState<CatalogExercise | null>(null);

  const repsVal  = ex.reps != null ? String(ex.reps) : ex.duration_seconds != null ? `${ex.duration_seconds}s` : '—';
  const repsUnit = ex.duration_seconds != null ? 'Tiempo' : 'Reps';

  const fetchExercises = async (query: string) => {
    setCatalogLoading(true);
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (query.trim()) {
        params.set('search', query.trim());
      } else {
        params.set('similar_to', String(ex.exercise.id));
      }
      const { data } = await api.get<{ results: CatalogExercise[] }>(`/exercises/?${params}`, { headers: authHeaders() });
      setResults(data.results);
    } catch {
      // silent
    } finally {
      setCatalogLoading(false);
    }
  };

  const filtered = results;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        sets,
        rest_seconds: rest,
        notes,
        ...(mode === 'reps'
          ? { reps, duration_seconds: null }
          : { reps: null, duration_seconds: dur }),
        ...(picked ? { exercise_id: picked.id } : {}),
      };
      const { data: updated } = await api.patch<ProgramExercise>(
        `/monthly-programs/${programId}/days/${dayId}/exercises/${ex.id}/`,
        body,
        { headers: authHeaders() },
      );
      onSaved(dayId, ex.id, updated);
      setEditing(false);
      setShowPicker(false);
      setPicked(null);
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSets(ex.sets); setReps(ex.reps); setDur(ex.duration_seconds);
    setRest(ex.rest_seconds); setNotes(ex.notes ?? '');
    setMode(ex.duration_seconds != null && ex.reps == null ? 'time' : 'reps');
    setPicked(null); setShowPicker(false); setSearch(''); setResults([]);
    setEditing(false);
  };

  return (
    <div style={{ borderBottom: last ? 'none' : `1px solid ${T.borderSoft}` }}>
      {/* View row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.7fr 0.7fr auto auto', gap: 10, alignItems: 'center', padding: '12px 18px' }}>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 13, fontWeight: 600, color: T.textDark }}>{ex.exercise.name}</div>
          {(ex.notes || ex.exercise.pattern) && (
            <div style={{ fontFamily: 'Montserrat', fontSize: 10, color: T.textMed, marginTop: 2, fontStyle: 'italic' }}>
              {ex.notes || ex.exercise.pattern}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cinzel', fontSize: 14, fontWeight: 600, color: T.wine }}>{ex.sets}</div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginTop: 1 }}>Series</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cinzel', fontSize: 14, fontWeight: 600, color: T.wine }}>{repsVal}</div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginTop: 1 }}>{repsUnit}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cinzel', fontSize: 14, fontWeight: 600, color: T.wine }}>{ex.rest_seconds}s</div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginTop: 1 }}>Descanso</div>
        </div>
        {ex.exercise.youtube_url ? (
          <a href={ex.exercise.youtube_url} target="_blank" rel="noopener noreferrer" title="Ver demo"
            style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(154,5,38,0.06)', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.wine, textDecoration: 'none', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23 12s0-3.7-.5-5.5c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5c-1 .3-1.7 1-2 2C1 8.3 1 12 1 12s0 3.7.5 5.5c.3 1 1 1.7 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5c1-.3 1.7-1 2-2 .5-1.8.5-5.5.5-5.5zM10 15.5v-7l6 3.5z"/>
            </svg>
          </a>
        ) : <div style={{ width: 30 }}/>}
        {/* Edit toggle */}
        <button
          onClick={() => editing ? handleCancel() : setEditing(true)}
          title={editing ? 'Cancelar edición' : 'Editar ejercicio'}
          style={{ width: 30, height: 30, borderRadius: 8, background: editing ? 'rgba(154,5,38,0.10)' : 'rgba(103,15,34,0.04)', border: `1px solid ${editing ? 'rgba(154,5,38,0.25)' : T.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: editing ? '#9A0526' : T.textSoft, cursor: 'pointer', flexShrink: 0 }}>
          {editing
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ padding: '0 18px 16px', background: 'rgba(103,15,34,0.02)' }}>

          {/* Reps / Time mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft }}>Modo</div>
            <div style={{ display: 'flex', padding: 2, background: 'rgba(103,15,34,0.06)', borderRadius: 8 }}>
              {(['reps', 'time'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: mode === m ? T.wine : 'transparent', color: mode === m ? '#fff' : T.textMed, fontFamily: 'Montserrat', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 120ms' }}>
                  {m === 'reps' ? 'Repeticiones' : 'Tiempo'}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5 }}>Series</div>
              <input type="number" min={1} value={sets} onChange={e => setSets(Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.85)', fontFamily: 'Cinzel', fontSize: 15, fontWeight: 600, color: T.wine, outline: 'none' }}/>
            </div>
            {mode === 'reps' ? (
              <div>
                <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5 }}>Reps</div>
                <input type="number" min={1} value={reps ?? ''} onChange={e => { setReps(e.target.value === '' ? null : Number(e.target.value)); setDur(null); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.85)', fontFamily: 'Cinzel', fontSize: 15, fontWeight: 600, color: T.wine, outline: 'none' }}/>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5 }}>Tiempo (s)</div>
                <input type="number" min={1} value={dur ?? ''} onChange={e => { setDur(e.target.value === '' ? null : Number(e.target.value)); setReps(null); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.85)', fontFamily: 'Cinzel', fontSize: 15, fontWeight: 600, color: T.wine, outline: 'none' }}/>
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5 }}>Descanso (s)</div>
              <input type="number" min={0} value={rest} onChange={e => setRest(Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.85)', fontFamily: 'Cinzel', fontSize: 15, fontWeight: 600, color: T.wine, outline: 'none' }}/>
            </div>
            <div>
              <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5 }}>Indicación (cue)</div>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Indicación técnica para el cliente…"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.85)', fontFamily: 'Montserrat', fontSize: 12, color: T.textDark, outline: 'none' }}/>
            </div>
          </div>

          {/* Exercise catalog picker */}
          <div style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 12, marginBottom: 14 }}>
            <button
              onClick={() => {
                const next = !showPicker;
                setShowPicker(next);
                if (next) { setSearch(''); fetchExercises(''); }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 8, background: showPicker ? 'rgba(103,15,34,0.08)' : 'rgba(103,15,34,0.04)', border: `1px solid ${T.borderSoft}`, fontFamily: 'Montserrat', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: picked ? T.wine : T.textMed, cursor: 'pointer' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {picked ? `→ ${picked.name}` : 'Cambiar ejercicio del catálogo'}
            </button>

            {showPicker && (
              <div style={{ marginTop: 10 }}>
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); fetchExercises(e.target.value); }}
                  placeholder="Buscar por nombre… (por defecto muestra ejercicios similares)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.90)', fontFamily: 'Montserrat', fontSize: 12, color: T.textDark, outline: 'none', marginBottom: 8 }}
                />
                {catalogLoading ? (
                  <div style={{ padding: '14px 0', textAlign: 'center', fontFamily: 'Montserrat', fontSize: 11, color: T.textSoft }}>Cargando catálogo…</div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 10, border: `1px solid ${T.borderSoft}`, background: 'rgba(255,255,255,0.80)' }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: '14px', textAlign: 'center', fontFamily: 'Montserrat', fontSize: 11, color: T.textSoft }}>Sin resultados</div>
                    ) : filtered.map((item, i) => (
                      <button key={item.id}
                        onClick={() => { setPicked(item); setShowPicker(false); setSearch(''); }}
                        style={{ width: '100%', padding: '10px 14px', background: picked?.id === item.id ? 'rgba(103,15,34,0.06)' : 'transparent', border: 'none', borderBottom: i < filtered.length - 1 ? `1px solid ${T.borderSoft}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
                        <div>
                          <div style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 600, color: T.textDark }}>{item.name}</div>
                          {item.pattern && <div style={{ fontFamily: 'Montserrat', fontSize: 10, color: T.textSoft, marginTop: 2 }}>{item.pattern}</div>}
                        </div>
                        {item.youtube_url && (
                          <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, background: 'rgba(154,5,38,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.wine }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23 12s0-3.7-.5-5.5c-.3-1-1-1.7-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5c-1 .3-1.7 1-2 2C1 8.3 1 12 1 12s0 3.7.5 5.5c.3 1 1 1.7 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5c1-.3 1.7-1 2-2 .5-1.8.5-5.5.5-5.5zM10 15.5v-7l6 3.5z"/>
                            </svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={handleCancel}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'transparent', border: `1px solid ${T.border}`, fontFamily: 'Montserrat', fontSize: 11, fontWeight: 600, color: T.textMed, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '7px 18px', borderRadius: 9, background: 'linear-gradient(135deg, #9A0526, #AB0D2F)', border: 'none', fontFamily: 'Montserrat', fontSize: 11, fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day row ───────────────────────────────────────────────────
function DayRow({ day, programId, onExSaved }: { day: ProgramDay; programId: number; onExSaved: OnExSaved }) {
  const [open, setOpen] = useState(false);
  const isRest = day.day_type === 'rest';
  const weekday = new Date(day.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short' });
  const dateStr = fmtDay(day.date);

  return (
    <div className="border-t border-kore-wine-dark/8">
      <button
        onClick={() => !isRest && setOpen((o) => !o)}
        className={`flex w-full flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3.5 text-left sm:px-[22px] ${
          open ? 'bg-[#9A0526]/3' : 'bg-transparent'
        } ${isRest ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="min-w-[54px]">
          <div className="font-heading text-[12px] font-semibold capitalize text-kore-wine-dark">
            {weekday}
          </div>
          <div className="font-body text-[10px] text-kore-wine-dark/65">{dateStr}</div>
        </div>
        <DayTypeChip type={day.day_type} />
        <div className="min-w-0 flex-1 font-body text-[12px] text-kore-wine-dark/65">
          {isRest ? 'Recuperación · sin ejercicios' : `${day.exercises.length} ejercicios`}
        </div>
        {!isRest && (
          <span
            className="inline-block font-body text-[16px] leading-none text-kore-wine-dark/65 transition-transform duration-150"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          >
            ⌄
          </span>
        )}
      </button>
      {open && !isRest && day.exercises.length > 0 && (
        <div className="border-t border-kore-wine-dark/8 bg-white/55">
          {day.exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              last={i === day.exercises.length - 1}
              programId={programId}
              dayId={day.id}
              onSaved={onExSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Week card ─────────────────────────────────────────────────
function WeekCard({
  weekNum, days, defaultOpen = false, programId, onExSaved,
}: {
  weekNum: number;
  days: ProgramDay[];
  defaultOpen?: boolean;
  programId: number;
  onExSaved: OnExSaved;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const trainCount = days.filter((d) => d.day_type === 'training').length;
  const activeCount = days.filter((d) => d.day_type === 'active_rest').length;
  const range = weekRange(days);

  return (
    <div className="mb-3.5 overflow-hidden rounded-[22px] border border-kore-wine-dark/8 bg-white/65 shadow-[0_2px_12px_-8px_rgba(45,15,26,0.10)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left sm:gap-[18px] sm:px-6"
      >
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] transition-all duration-150 ${
            open ? 'bg-gradient-to-br from-[#9A0526] to-[#5C2030]' : 'bg-[#9A0526]/6'
          }`}
        >
          <div className={`font-heading text-[18px] font-semibold ${open ? 'text-white' : 'text-kore-wine-dark'}`}>
            {weekNum}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <div className="font-heading text-[18px] font-semibold text-kore-wine-dark">
              Semana {weekNum}
            </div>
            <div className="font-body text-[11px] text-kore-wine-dark/65">{range}</div>
          </div>
          <div className="mt-0.5 font-body text-[11px] text-kore-wine-dark/55">
            {trainCount} entrenamientos{activeCount > 0 ? ` · ${activeCount} activos` : ''}
          </div>
        </div>
        <span
          className="inline-block flex-shrink-0 font-body text-[18px] leading-none text-kore-wine-dark/65 transition-transform duration-150"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          ⌄
        </span>
      </button>
      {open && days.map((d, i) => (
        <DayRow key={d.id ?? i} day={d} programId={programId} onExSaved={onExSaved} />
      ))}
    </div>
  );
}

// ─── Adherence card ────────────────────────────────────────────
const ADH_CELL: Record<AdhStatus, string> = {
  done:    'bg-[#669959] text-white',
  skipped: 'bg-[#9A0526]/15 text-[#9A0526]',
  rest:    'bg-[#A8C29C]/25 text-[#3F6B36]',
  pending: 'bg-kore-wine-dark/5 text-kore-wine-dark/40',
};

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function AdherenceCard({ logs }: { logs: DailyLogDay[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const cells = logs.map((d) => {
    const logDate = new Date(d.date + 'T12:00:00');
    logDate.setHours(0, 0, 0, 0);
    const isPast = logDate.getTime() <= todayTime;
    const dayNum = logDate.getDate();
    let status: AdhStatus;
    if (d.day_type === 'rest' || d.day_type === 'active_rest') status = 'rest';
    else if (!isPast) status = 'pending';
    else status = d.training_adherence >= 0.5 ? 'done' : 'skipped';
    return { dayNum, status, isToday: logDate.getTime() === todayTime };
  });

  const countable = cells.filter((c) => c.status === 'done' || c.status === 'skipped');
  const done = cells.filter((c) => c.status === 'done').length;
  const pct = countable.length > 0 ? Math.round((done / countable.length) * 100) : 0;
  const dasharray = 2 * Math.PI * 46;

  // Celdas vacías al inicio para alinear el primer día a su día de semana (L=0).
  const leadingBlanks = logs.length
    ? (new Date(logs[0].date + 'T12:00:00').getDay() + 6) % 7
    : 0;

  return (
    <div className="mb-[18px] flex flex-col gap-6 rounded-[22px] border border-kore-wine-dark/8 bg-white/65 p-6 shadow-[0_2px_12px_-8px_rgba(45,15,26,0.10)] sm:flex-row sm:items-start sm:gap-7">
      {/* Anillo de adherencia */}
      <div className="relative flex-shrink-0 self-center sm:self-start">
        <svg width="112" height="112" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(103,15,34,0.08)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="46" fill="none" stroke="url(#adhGrad)" strokeWidth="10"
            strokeDasharray={`${(pct / 100) * dasharray} ${dasharray}`}
            strokeLinecap="round" transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
          />
          <defs>
            <linearGradient id="adhGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A8C29C" />
              <stop offset="100%" stopColor="#3F6B36" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-heading text-[30px] font-semibold leading-none text-kore-wine-dark">
            {pct}%
          </div>
          <div className="mt-1 font-body text-[8px] font-bold uppercase tracking-[0.20em] text-kore-wine-dark/55">
            Adherencia
          </div>
        </div>
      </div>

      {/* Minicalendario */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-kore-wine-dark/55">
          Bitácora · {logs.length} días
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_HEADERS.map((h, i) => (
            <div
              key={`h-${i}`}
              className="text-center font-body text-[9px] font-bold uppercase text-kore-wine-dark/40"
            >
              {h}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`b-${i}`} />
          ))}
          {cells.map((c, i) => (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-lg font-heading text-[13px] font-semibold ${ADH_CELL[c.status]} ${
                c.isToday ? 'ring-2 ring-[#9A0526]/40' : ''
              }`}
            >
              {c.dayNum}
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-3 border-t border-kore-wine-dark/8 pt-3.5">
          <LegendDot color="#669959" label="Completado" />
          <LegendDot color="rgba(154,5,38,0.40)" label="Saltado" />
          <LegendDot color="rgba(168,194,156,0.45)" label="Descanso" />
          <LegendDot color="rgba(103,15,34,0.20)" label="Pendiente" />
        </div>
      </div>
    </div>
  );
}

// ─── Program header ────────────────────────────────────────────
function ProgramHeader({
  program, onPublish, onGenerate, onRegenerate, onDelete, publishing, generating, hasNextDraft,
}: {
  program: MonthlyProgram;
  onPublish: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  publishing: boolean;
  generating: boolean;
  hasNextDraft: boolean;
}) {
  const isDraft     = program.status === 'draft';
  const goalLabel   = GOAL_LABEL[program.goal] ?? program.goal;
  const range       = programDateRange(program);
  const programName = `${goalLabel} · ${range}`;
  const publishedAt = program.approved_at
    ? new Date(program.approved_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: `linear-gradient(135deg, ${isDraft ? '#3D1F1A' : '#2D0F1A'} 0%, ${isDraft ? '#5C2030' : '#4A1828'} 100%)`, padding: '26px 28px', color: T.ivory, marginBottom: 18 }}>
      <div style={{ position: 'absolute', top: -40, right: -30, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${isDraft ? '#E5C97A' : '#A8C29C'}28, transparent 70%)`, filter: 'blur(20px)' }}/>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ fontFamily: 'Montserrat', fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(231,200,160,0.65)' }}>Programa mensual</div>
            {isDraft ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999, background: 'rgba(229,201,122,0.18)', color: '#E5C97A', border: '1px solid rgba(229,201,122,0.40)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#E5C97A' }}/>Borrador
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999, background: 'rgba(168,194,156,0.20)', color: '#A8C29C', border: '1px solid rgba(168,194,156,0.40)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#A8C29C' }}/>Publicado
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'Cinzel', fontSize: 26, fontWeight: 600, color: T.ivory, letterSpacing: '-0.005em', lineHeight: 1.15 }}>{programName}</div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 11, color: 'rgba(231,200,160,0.75)', marginTop: 8 }}>
            {isDraft
              ? <span style={{ color: '#E5C97A' }}>No visible para el cliente todavía</span>
              : publishedAt
                ? <>Publicado el <strong style={{ color: T.ivory, fontWeight: 600 }}>{publishedAt}</strong></>
                : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignSelf: 'flex-start', marginTop: 4 }}>
          {isDraft ? (
            <>
              <button onClick={onDelete}
                title="Eliminar borrador"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: '1px solid rgba(244,199,199,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(244,199,199,0.70)', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
              <button onClick={onRegenerate} disabled={generating}
                style={{ padding: '10px 16px', borderRadius: 11, background: 'transparent', color: 'rgba(231,200,160,0.85)', border: '1px solid rgba(231,200,160,0.32)', fontFamily: 'Montserrat', fontSize: 11, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: generating ? 0.6 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                {generating ? 'Regenerando…' : 'Regenerar borrador'}
              </button>
              <button onClick={onPublish} disabled={publishing}
                style={{ padding: '10px 18px', borderRadius: 11, background: 'linear-gradient(135deg, #A8C29C, #669959)', color: '#fff', border: 'none', fontFamily: 'Montserrat', fontSize: 11, fontWeight: 700, cursor: publishing ? 'not-allowed' : 'pointer', boxShadow: '0 6px 16px -6px rgba(168,194,156,0.50)', display: 'inline-flex', alignItems: 'center', gap: 7, letterSpacing: '0.08em', opacity: publishing ? 0.6 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {publishing ? 'Publicando…' : 'Publicar'}
              </button>
            </>
          ) : !hasNextDraft ? (
            <button onClick={onGenerate} disabled={generating}
              style={{ padding: '10px 16px', borderRadius: 11, background: 'transparent', color: 'rgba(231,200,160,0.85)', border: '1px solid rgba(231,200,160,0.32)', fontFamily: 'Montserrat', fontSize: 11, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: generating ? 0.6 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              {generating ? 'Generando…' : 'Preparar siguiente mes'}
            </button>
          ) : (
            <span style={{ fontFamily: 'Montserrat', fontSize: 10, color: 'rgba(231,200,160,0.55)', padding: '10px 0' }}>Borrador del siguiente mes listo ↑</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trainer notes block ───────────────────────────────────────
function TrainerNotesBlock({ value }: { value: string }) {
  return (
    <div style={{ borderRadius: 22, background: 'rgba(255,255,255,0.65)', border: `1px solid ${T.borderSoft}`, boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)', padding: 26, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Cinzel', fontSize: 18, fontWeight: 600, color: T.wine }}>Nota para el cliente</div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 12, color: T.textMed, marginTop: 4 }}>
            Edita esta nota en <strong>Notas → Programa</strong>.
          </div>
        </div>
        <span style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: T.sageDeep }}>Solo lectura</span>
      </div>
      {value ? (
        <p style={{ fontFamily: 'Montserrat', fontSize: 13, color: T.textDark, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, padding: '14px 16px', borderRadius: 12, background: 'rgba(168,194,156,0.08)', border: '1px solid rgba(168,194,156,0.30)' }}>
          {value}
        </p>
      ) : (
        <p style={{ fontFamily: 'Montserrat', fontSize: 12, color: T.textSoft, fontStyle: 'italic', margin: 0, padding: '14px 16px', borderRadius: 12, background: 'rgba(103,15,34,0.04)', border: `1px dashed ${T.borderSoft}` }}>
          Sin nota aún. Agrega una desde la tab Notas → Programa.
        </p>
      )}
    </div>
  );
}

// ─── Fitness level labels ──────────────────────────────────────
const LEVEL_LABEL: Record<number, string> = {
  1: 'Principiante',
  2: 'Básico',
  3: 'Intermedio',
  4: 'Avanzado',
  5: 'Élite',
};

function FitnessLevelEditor({
  clientId,
  computed,
  override,
  onSaved,
}: {
  clientId: number;
  computed: number;
  override: number | null;
  onSaved: (override: number | null) => void;
}) {
  const active = override ?? computed;
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const handleSet = async (level: number | null) => {
    setSaving(true);
    try {
      await api.patch(
        `/trainer/my-clients/${clientId}/fitness-level/`,
        { fitness_level: level },
        { headers: authHeaders() },
      );
      onSaved(level);
      setEditing(false);
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.65)', border: `1px solid ${T.borderSoft}`, padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 5 }}>Nivel de condición física</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'Cinzel', fontSize: 22, fontWeight: 600, color: T.wine }}>{active}</span>
              <span style={{ fontFamily: 'Montserrat', fontSize: 12, fontWeight: 600, color: T.textMed }}>{LEVEL_LABEL[active]}</span>
            </div>
            {override !== null && (
              <span style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: 'rgba(229,201,122,0.18)', color: T.amberDeep, border: '1px solid rgba(229,201,122,0.40)' }}>
                Manual
              </span>
            )}
          </div>
          {override !== null && (
            <div style={{ fontFamily: 'Montserrat', fontSize: 10, color: T.textSoft, marginTop: 3 }}>
              Calculado de evaluaciones: <strong style={{ color: T.textMed }}>{computed} — {LEVEL_LABEL[computed]}</strong>
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          style={{ padding: '7px 14px', borderRadius: 9, background: editing ? 'rgba(103,15,34,0.08)' : 'rgba(103,15,34,0.04)', border: `1px solid ${T.borderSoft}`, fontFamily: 'Montserrat', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textMed, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar nivel
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textSoft, marginBottom: 10 }}>Selecciona el nivel</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map(lvl => {
              const sel = active === lvl;
              return (
                <button key={lvl} onClick={() => !saving && handleSet(lvl)} disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${sel ? T.wine : T.borderSoft}`, background: sel ? T.wine : 'rgba(255,255,255,0.80)', color: sel ? '#fff' : T.textMed, fontFamily: 'Montserrat', fontSize: 11, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontFamily: 'Cinzel', fontSize: 15, fontWeight: 600 }}>{lvl}</span>
                  <span style={{ fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', opacity: 0.8 }}>{LEVEL_LABEL[lvl]}</span>
                </button>
              );
            })}
          </div>
          {override !== null && (
            <button onClick={() => !saving && handleSet(null)} disabled={saving}
              style={{ fontFamily: 'Montserrat', fontSize: 10, fontWeight: 600, color: T.textSoft, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              Restablecer a automático (evaluaciones)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────
export default function ClientProgramTab({ clientId }: { clientId: number }) {
  const { clientDailyLogs, dailyLogsLoading, fetchClientDailyLogs } = useTrainerStore();

  const [programs, setPrograms]             = useState<MonthlyProgram[]>([]);
  const [selectedIdx, setSelectedIdx]       = useState(0);
  const [loading, setLoading]               = useState(true);
  const [generating, setGenerating]         = useState(false);
  const [approving, setApproving]           = useState(false);
  const [error, setError]                   = useState('');
  const [levelComputed, setLevelComputed]   = useState(1);
  const [levelOverride, setLevelOverride]   = useState<number | null>(null);

  const activeProgram = programs[selectedIdx] ?? null;
  const dailyLogs     = clientDailyLogs[clientId] ?? [];
  const isPublished   = activeProgram?.status === 'published' || activeProgram?.status === 'completed';
  const trainerNotes  = activeProgram?.trainer_notes ?? '';

  useEffect(() => {
    if (!clientId) return;
    fetchPrograms();
    api.get<{ fitness_level_computed: number; fitness_level_override: number | null }>(
      `/trainer/my-clients/${clientId}/fitness-level/`,
      { headers: authHeaders() },
    ).then(({ data }) => {
      setLevelComputed(data.fitness_level_computed);
      setLevelOverride(data.fitness_level_override);
    }).catch(() => {});
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isPublished && clientId && !clientDailyLogs[clientId]) {
      fetchClientDailyLogs(clientId, 14);
    }
  }, [isPublished, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<MonthlyProgram[]>(`/monthly-programs/customer/${clientId}/`, { headers: authHeaders() });
      setPrograms(data);
    } catch {
      setError('No se pudieron cargar los programas.');
    } finally {
      setLoading(false);
    }
  };

  // Regenerate current draft with the same start date
  const handleRegenerateDraft = async () => {
    if (!activeProgram || activeProgram.status !== 'draft') return;
    setGenerating(true);
    setError('');
    try {
      await api.post('/monthly-programs/generate/', {
        customer_id: clientId,
        start_date: activeProgram.start_date,
      }, { headers: authHeaders() });
      await fetchPrograms();
      setSelectedIdx(0);
    } catch {
      setError('No se pudo regenerar el borrador.');
    } finally {
      setGenerating(false);
    }
  };

  // Generate next month's program — backend derives start_date from latest published end_date + 1
  const handleGenerateNext = async () => {
    setGenerating(true);
    setError('');
    try {
      await api.post('/monthly-programs/generate/', { customer_id: clientId }, { headers: authHeaders() });
      await fetchPrograms();
      setSelectedIdx(0);
    } catch {
      setError('No se pudo generar el programa del siguiente mes.');
    } finally {
      setGenerating(false);
    }
  };

  // First-time generate (no program yet)
  const handleGenerateFirst = async () => {
    setGenerating(true);
    setError('');
    try {
      await api.post('/monthly-programs/generate/', { customer_id: clientId }, { headers: authHeaders() });
      await fetchPrograms();
      setSelectedIdx(0);
    } catch {
      setError('No se pudo generar el programa. Verifica que el cliente tenga el rol correcto.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!activeProgram) return;
    setApproving(true);
    setError('');
    try {
      await api.patch(`/monthly-programs/${activeProgram.id}/approve/`, {}, { headers: authHeaders() });
      await fetchPrograms();
    } catch {
      setError('No se pudo publicar el programa.');
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!activeProgram || activeProgram.status !== 'draft') return;
    if (!window.confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) return;
    setError('');
    try {
      await api.delete(`/monthly-programs/${activeProgram.id}/delete/`, { headers: authHeaders() });
      await fetchPrograms();
      setSelectedIdx(0);
    } catch {
      setError('No se pudo eliminar el borrador.');
    }
  };

  // Called when an exercise is saved in-place — update local state without refetch
  const handleExerciseSaved: OnExSaved = (dayId, exId, updated) => {
    setPrograms(prev => prev.map((p, i) =>
      i !== selectedIdx ? p : {
        ...p,
        days: p.days.map(d =>
          d.id !== dayId ? d : {
            ...d,
            exercises: d.exercises.map(e => e.id === exId ? updated : e),
          }
        ),
      }
    ));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(103,15,34,0.15)', borderTopColor: '#670F22', animation: 'spin 0.8s linear infinite' }}/>
      </div>
    );
  }

  if (!activeProgram) {
    return (
      <EmptyState
        title="Sin programa mensual"
        description="Genera el primer plan mensual para este cliente. Tomará unos segundos."
        cta={{ label: generating ? 'Generando…' : 'Generar programa', onClick: handleGenerateFirst }}
      />
    );
  }

  const weeks: ProgramDay[][] = [1, 2, 3, 4].map(w =>
    activeProgram.days.filter(d => Math.ceil(d.day_number / 7) === w),
  );

  const programLabel = (p: MonthlyProgram) => {
    const range = programDateRange(p);
    if (p.status === 'draft')     return `Borrador · ${range}`;
    if (p.status === 'completed') return `Completado · ${range}`;
    return `Activo · ${range}`;
  };

  const hasNextDraft = programs.length > 1 && programs[0].status === 'draft' && selectedIdx !== 0;

  return (
    <div>
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(154,5,38,0.06)', border: '1px solid rgba(154,5,38,0.20)', fontFamily: 'Montserrat', fontSize: 12, color: '#9A0526', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <FitnessLevelEditor
        clientId={clientId}
        computed={levelComputed}
        override={levelOverride}
        onSaved={setLevelOverride}
      />

      {/* Program selector pill */}
      {programs.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(255,255,255,0.60)', border: `1px solid ${T.borderSoft}`, borderRadius: 12, width: 'fit-content', marginBottom: 18 }}>
          {programs.map((p, i) => {
            const sel = i === selectedIdx;
            return (
              <button key={p.id} onClick={() => setSelectedIdx(i)}
                style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: sel ? T.wine : 'transparent', color: sel ? '#fff' : T.textMed, fontFamily: 'Montserrat', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 120ms' }}>
                {programLabel(p)}
              </button>
            );
          })}
        </div>
      )}

      <ProgramHeader
        program={activeProgram}
        onPublish={handleApprove}
        onGenerate={handleGenerateNext}
        onRegenerate={handleRegenerateDraft}
        onDelete={handleDeleteDraft}
        publishing={approving}
        generating={generating}
        hasNextDraft={hasNextDraft}
      />

      {/* Draft warning banner */}
      {activeProgram.status === 'draft' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', borderRadius: 14, background: 'rgba(229,201,122,0.12)', border: '1px solid rgba(229,201,122,0.40)', marginBottom: 18 }}>
          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'rgba(229,201,122,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.amberDeep }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div style={{ flex: 1, fontFamily: 'Montserrat', fontSize: 12, color: T.textDark, lineHeight: 1.55 }}>
            <strong style={{ fontWeight: 700 }}>Borrador generado.</strong> Revisa y edita los ejercicios, ajusta la nota y publica cuando esté listo. El cliente <em>no</em> ve este programa hasta que lo publiques.
          </div>
        </div>
      )}

      <TrainerNotesBlock value={trainerNotes} />

      {/* Adherence (published only) */}
      {isPublished && (
        dailyLogsLoading && dailyLogs.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(103,15,34,0.15)', borderTopColor: '#670F22', animation: 'spin 0.8s linear infinite' }}/>
          </div>
        ) : dailyLogs.length > 0 ? (
          <AdherenceCard logs={dailyLogs} />
        ) : null
      )}

      {/* Week cards */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 4px 16px' }}>
        <div style={{ fontFamily: 'Cinzel', fontSize: 20, fontWeight: 600, color: T.wine }}>Plan del mes · 4 semanas</div>
        <div style={{ fontFamily: 'Montserrat', fontSize: 11, color: T.textMed }}>
          {weeks.reduce((a, w) => a + w.filter(d => d.day_type === 'training').length, 0)} entrenamientos
        </div>
      </div>

      {weeks.map((weekDays, idx) => weekDays.length > 0 && (
        <WeekCard
          key={idx + 1}
          weekNum={idx + 1}
          days={weekDays}
          defaultOpen={idx === 0}
          programId={activeProgram.id}
          onExSaved={handleExerciseSaved}
        />
      ))}
    </div>
  );
}
