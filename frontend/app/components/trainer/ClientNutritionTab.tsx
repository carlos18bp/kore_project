'use client';

import React, { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import EmptyState from '@/app/components/shared/EmptyState';
import EvalNutriTab from '@/app/components/trainer/evals/EvalNutriTab';
import PhotoViewer from '@/app/components/shared/PhotoViewer';
import { MEAL_BLOCKS } from '@/lib/constants';

// ─── Design tokens ─────────────────────────────────────────────────────────
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

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ─── Types ──────────────────────────────────────────────────────────────────
interface MealSuggestion {
  id: number;
  title: string;
  description: string;
  calories_estimate: number;
  nova_max: number;
  goal_tags: string[];
}

interface PlanMeal {
  id: number;
  meal_block: string;
  meal_block_label: string;
  meal_block_time: string;
  suggestion: MealSuggestion | null;
  trainer_notes: string;
  order: number;
}

interface PlanDay {
  id: number;
  day_number: number;
  week_number: number;
  date: string;
  meals: PlanMeal[];
}

interface WeeklyNutritionPlan {
  id: number;
  status: 'draft' | 'published' | 'completed';
  goal: string;
  fitness_level: number;
  week_start: string;
  week_end: string;
  trainer_notes: string;
  approved_at: string | null;
  created_at: string;
  days?: PlanDay[];
}

interface CatalogSuggestion {
  id: number;
  title: string;
  meal_block: string;
  calories_estimate: number;
  nova_max: number;
  goal_tags: string[];
  description: string;
}

interface NutritionLogMeal {
  meal_entry_id: number;
  meal_block: string;
  status: string;
  notes: string;
  photo_url: string | null;
}

interface NutritionLogWaterGlass {
  id: number;
  photo_url: string | null;
}

interface NutritionLogDay {
  date: string;
  adherence: number;
  is_closed: boolean;
  meals: NutritionLogMeal[];
  water_glasses: NutritionLogWaterGlass[];
}

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function planDateRange(plan: WeeklyNutritionPlan): string {
  const s = new Date(plan.week_start + 'T12:00:00');
  const e = new Date(plan.week_end   + 'T12:00:00');
  const sd = s.getDate();
  const sm = s.toLocaleDateString('es-CO', { month: 'short' });
  const ed = e.getDate();
  const em = e.toLocaleDateString('es-CO', { month: 'short' });
  const ey = e.getFullYear();
  return sm === em ? `${sd}–${ed} ${sm} ${ey}` : `${sd} ${sm} – ${ed} ${em} ${ey}`;
}

function weekDateRange(days: PlanDay[], weekNum: number): string {
  const weekDays = days.filter(d => d.week_number === weekNum);
  if (!weekDays.length) return '';
  const s = new Date(weekDays[0].date + 'T12:00:00');
  const e = new Date(weekDays[weekDays.length - 1].date + 'T12:00:00');
  const sd = s.getDate();
  const sm = s.toLocaleDateString('es-CO', { month: 'short' });
  const ed = e.getDate();
  const em = e.toLocaleDateString('es-CO', { month: 'short' });
  return sm === em ? `${sd}–${ed} ${sm}` : `${sd} ${sm} – ${ed} ${em}`;
}

function isToday(dateStr: string): boolean {
  return new Date().toISOString().slice(0, 10) === dateStr;
}

// ─── Swap Picker ─────────────────────────────────────────────────────────────
function SwapPicker({
  mealBlock,
  onSelect,
  onClose,
}: {
  mealBlock: string;
  onSelect: (s: CatalogSuggestion) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<CatalogSuggestion[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ meal_block: mealBlock, limit: '12' });
      if (q.trim()) params.set('search', q.trim());
      const { data } = await api.get<{ results: CatalogSuggestion[] }>(
        `/meal-suggestions/?${params}`,
        { headers: authHeaders() }
      );
      setResults(data.results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetch(q), 300);
  };

  const blockMeta = MEAL_BLOCKS.find(b => b.key === mealBlock);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(45,15,26,0.45)', display: 'flex', alignItems: 'flex-end',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxHeight: '80vh', borderRadius: '22px 22px 0 0',
        background: '#FDFAF5', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(45,15,26,0.18)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${T.borderSoft}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textSoft }}>
                Cambiar sugerencia
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine, marginTop: 3 }}>
                {blockMeta?.label ?? mealBlock}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(103,15,34,0.06)', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.wine, cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar sugerencia..."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${T.border}`,
              fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textDark, outline: 'none',
              background: 'rgba(255,255,255,0.85)', boxSizing: 'border-box',
            }}
          />
        </div>
        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid rgba(103,15,34,0.12)`, borderTopColor: T.wine, animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textSoft }}>
              No hay sugerencias disponibles para este bloque.
            </div>
          ) : results.map(s => (
            <button key={s.id} onClick={() => onSelect(s)}
              style={{ width: '100%', padding: '12px 24px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', borderBottom: `1px solid ${T.borderSoft}` }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600, color: T.textDark }}>{s.title}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, fontFamily: 'Montserrat, sans-serif', fontSize: 10, color: T.textSoft }}>
                <span>{s.calories_estimate} kcal</span>
                <span>·</span>
                <span style={{ color: s.nova_max <= 2 ? T.sageDark : T.amberDeep, fontWeight: 600 }}>NOVA {s.nova_max}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MealBlockRow ─────────────────────────────────────────────────────────────
function MealBlockRow({
  meal,
  dayId,
  planId,
  planStatus,
  logStatus,
  photoUrl,
  onViewPhoto,
  isLast,
  onMealUpdated,
}: {
  meal: PlanMeal;
  dayId: number;
  planId: number;
  planStatus: string;
  logStatus?: string;
  photoUrl?: string | null;
  onViewPhoto: (url: string) => void;
  isLast: boolean;
  onMealUpdated: (updated: PlanMeal) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusCfg: Record<string, { bg: string; fg: string; label: string }> = {
    completed: { bg: 'rgba(168,194,156,0.16)', fg: T.sageDark,    label: 'Cumplió'     },
    skipped:   { bg: 'rgba(154,5,38,0.10)',   fg: '#9A0526',     label: 'Saltó'        },
    not_done:  { bg: 'rgba(229,201,122,0.18)', fg: T.amberDeep,  label: 'Sin marcar'   },
    pending:   { bg: 'rgba(103,15,34,0.04)',   fg: T.textSoft,   label: 'Futuro'       },
  };

  const blockMeta = MEAL_BLOCKS.find(b => b.key === meal.meal_block);
  const effectiveStatus = logStatus ?? 'pending';
  const cfg = statusCfg[effectiveStatus] ?? statusCfg.pending;

  const handleSwap = async (s: CatalogSuggestion) => {
    setSaving(true);
    setShowPicker(false);
    try {
      const { data } = await api.patch<PlanMeal>(
        `/nutrition-plans/${planId}/days/${dayId}/meals/${meal.id}/`,
        { suggestion_id: s.id },
        { headers: authHeaders() }
      );
      onMealUpdated(data);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={`flex flex-col gap-3 px-4 py-3.5 sm:grid sm:grid-cols-[88px_1fr_auto_auto] sm:items-center sm:gap-3.5 sm:px-[22px] ${isLast ? '' : 'border-b border-kore-wine-dark/8'}`}
        style={{ opacity: saving ? 0.6 : 1, transition: 'opacity 150ms' }}
      >
        {/* Time + Block label */}
        <div className="flex items-baseline gap-2 sm:block">
          <div className="font-body text-[9px] font-bold uppercase tracking-[0.20em] text-kore-wine-dark/55">
            {blockMeta?.time ?? ''}
          </div>
          <div className="font-heading text-[13px] font-semibold text-kore-wine-dark sm:mt-[3px]">
            {blockMeta?.label ?? meal.meal_block_label}
          </div>
        </div>

        {/* Suggestion details */}
        <div className="min-w-0">
          {meal.suggestion ? (
            <>
              <div className="truncate font-body text-[13px] font-semibold text-[#2A1A1F]">
                {meal.suggestion.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 font-body text-[10px] text-kore-wine-dark/55">
                <span>{meal.suggestion.calories_estimate} kcal</span>
                <span className="h-[3px] w-[3px] rounded-full bg-kore-wine-dark/40" />
                <span className="font-semibold" style={{ color: meal.suggestion.nova_max <= 2 ? T.sageDark : T.amberDeep }}>
                  NOVA {meal.suggestion.nova_max}
                </span>
              </div>
            </>
          ) : (
            <div className="font-body text-[12px] italic text-kore-wine-dark/55">
              Sin sugerencia asignada
            </div>
          )}
        </div>

        {/* Status chip + photo + swap — fila propia en móvil, celdas del grid en sm+ */}
        <div className="flex items-center justify-between gap-2 sm:contents">
          <div className="flex items-center gap-2">
            {photoUrl && (
              <button
                type="button"
                onClick={() => onViewPhoto(photoUrl)}
                title="Ver foto que subió el cliente"
                aria-label="Ver foto que subió el cliente"
                className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-kore-wine-dark/10 cursor-pointer active:scale-95 transition-transform"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Foto de la comida" className="h-full w-full object-cover" />
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] font-body text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ background: cfg.bg, color: cfg.fg }}>
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: cfg.fg }} />
              {cfg.label}
            </span>
          </div>

          {/* Swap button (only for draft or published plans; disabled once completed) */}
          {planStatus !== 'completed' && (
            <button
              onClick={() => setShowPicker(true)}
              disabled={saving}
              className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-kore-wine-dark/10 bg-white/75 px-3 py-2 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-kore-wine-dark active:scale-95">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7h13M7 7l4-4M7 7l4 4M17 17H4M17 17l-4-4M17 17l-4 4"/>
              </svg>
              Cambiar
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <SwapPicker
          mealBlock={meal.meal_block}
          onSelect={handleSwap}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ─── DayCard ─────────────────────────────────────────────────────────────────
function DayCard({
  day,
  planId,
  planStatus,
  logDay,
  defaultOpen,
  onPlanUpdated,
}: {
  day: PlanDay;
  planId: number;
  planStatus: string;
  logDay?: NutritionLogDay;
  defaultOpen: boolean;
  onPlanUpdated: (updatedDay: PlanDay) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const dayIndex = new Date(day.date + 'T12:00:00').getDay(); // 0=Sun
  const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Mon=0..Sun=6

  const dayName  = DAY_NAMES[adjustedDayIndex]  ?? '—';
  const dayLabel = DAY_LABELS[adjustedDayIndex] ?? '—';
  const today    = isToday(day.date);
  const dayNum   = new Date(day.date + 'T12:00:00').getDate();

  const logStatuses = MEAL_BLOCKS.map(b => {
    const logMeal = logDay?.meals.find(m => m.meal_block === b.key);
    if (!logMeal) return 'pending';
    return logMeal.status;
  });

  const completed = logStatuses.filter(s => s === 'completed').length;
  const tracked   = logStatuses.filter(s => s !== 'pending').length;
  const totalKcal = day.meals.reduce((acc, m) => acc + (m.suggestion?.calories_estimate ?? 0), 0);

  const updateMeal = (updated: PlanMeal) => {
    const updatedDay: PlanDay = {
      ...day,
      meals: day.meals.map(m => m.id === updated.id ? updated : m),
    };
    onPlanUpdated(updatedDay);
  };

  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden',
      border: today ? '1px solid rgba(154,5,38,0.30)' : `1px solid ${T.borderSoft}`,
      background: '#fff', marginBottom: 12,
      boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)',
    }}>
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full cursor-pointer items-center gap-3 border-none px-4 py-4 text-left sm:gap-[18px] sm:px-[22px]"
        style={{ background: open ? 'rgba(154,5,38,0.03)' : 'transparent' }}>
        {/* Date badge */}
        <div style={{ width: 54, height: 54, borderRadius: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: today ? 'linear-gradient(135deg, #9A0526, #5C2030)' : open ? 'rgba(154,5,38,0.10)' : 'rgba(154,5,38,0.04)' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: today ? '#fff' : T.wine, lineHeight: 1 }}>{dayNum}</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 3, color: today ? 'rgba(231,200,160,0.85)' : T.textSoft }}>{dayName}</div>
        </div>

        {/* Summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 17, fontWeight: 600, color: T.wine }}>{dayLabel}</div>
            {today && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(154,5,38,0.10)', fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.wine }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9A0526', animation: 'pulse 1.5s infinite' }} />
                Hoy
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px 8px', marginTop: 4, fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft }}>
            <span>{day.meals.length} comidas</span>
            {totalKcal > 0 && <><span style={{ width: 3, height: 3, borderRadius: 2, background: T.textSoft }} /><span>{totalKcal} kcal est.</span></>}
            {tracked > 0 && (
              <><span style={{ width: 3, height: 3, borderRadius: 2, background: T.textSoft }} />
              <span style={{ color: completed === tracked ? T.sageDark : T.textSoft, fontWeight: 600 }}>{completed}/{tracked} cumplidas</span></>
            )}
          </div>
        </div>

        {/* Status dots */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {logStatuses.map((s, i) => {
            const c = s === 'completed' ? T.sageDark : s === 'skipped' ? '#9A0526' : s === 'not_done' ? T.amberDeep : 'rgba(103,15,34,0.16)';
            return <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: c }} />;
          })}
        </div>

        {/* Chevron */}
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: 20, color: T.textSoft, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 140ms', display: 'block', lineHeight: 1 }}>⌄</span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          {day.meals.map((meal, i) => {
            // Emparejar el estado por meal_block, nunca por índice: day.meals
            // y el log diario pueden venir en orden o longitud distintos.
            const logMeal = logDay?.meals.find((m) => m.meal_block === meal.meal_block);
            return (
              <MealBlockRow
                key={meal.id}
                meal={meal}
                dayId={day.id}
                planId={planId}
                planStatus={planStatus}
                logStatus={logMeal?.status ?? 'pending'}
                photoUrl={logMeal?.photo_url ?? null}
                onViewPhoto={setViewerPhoto}
                isLast={i === day.meals.length - 1}
                onMealUpdated={updateMeal}
              />
            );
          })}

          {/* Hidratación del día — fotos de los vasos que subió el cliente */}
          {logDay && logDay.water_glasses.length > 0 && (
            <div className="px-4 py-3.5 sm:px-[22px]" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <div className="font-body text-[9px] font-bold uppercase tracking-[0.20em] mb-2.5" style={{ color: T.textSoft }}>
                Hidratación · {logDay.water_glasses.length} {logDay.water_glasses.length === 1 ? 'vaso' : 'vasos'}
              </div>
              <div className="flex flex-wrap gap-2">
                {logDay.water_glasses.map((wg) => {
                  const wgPhoto = wg.photo_url;
                  return wgPhoto ? (
                    <button
                      key={wg.id}
                      type="button"
                      onClick={() => setViewerPhoto(wgPhoto)}
                      aria-label="Ver foto del vaso de agua"
                      className="h-11 w-11 overflow-hidden rounded-lg border border-kore-wine-dark/10 cursor-pointer active:scale-95 transition-transform"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={wgPhoto} alt="Vaso de agua" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div key={wg.id} className="h-11 w-11 rounded-lg" style={{ background: 'linear-gradient(180deg, #4DA3FF, #0B6BC4)' }} />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <PhotoViewer url={viewerPhoto} onClose={() => setViewerPhoto(null)} />
    </div>
  );
}

// ─── Compliance Grid ──────────────────────────────────────────────────────────
function ComplianceGrid({ plan, nutritionLogs, weekNum }: { plan: WeeklyNutritionPlan & { days: PlanDay[] }; nutritionLogs: NutritionLogDay[]; weekNum: number }) {
  const logByDate = Object.fromEntries(nutritionLogs.map(d => [d.date, d]));

  const weekData = (plan.days ?? []).filter(d => d.week_number === weekNum).map(day => {
    const log = logByDate[day.date];
    const statuses = MEAL_BLOCKS.map(b => {
      const m = log?.meals.find(lm => lm.meal_block === b.key);
      if (!m) return 'pending';
      return m.status;
    });
    const photos = MEAL_BLOCKS.map(b => {
      const m = log?.meals.find(lm => lm.meal_block === b.key);
      return !!m?.photo_url;
    });
    const dayIndex = new Date(day.date + 'T12:00:00').getDay();
    const adj = dayIndex === 0 ? 6 : dayIndex - 1;
    return { dayName: DAY_NAMES[adj] ?? '—', statuses, photos, isToday: isToday(day.date) };
  });

  const sumCompleted = weekData.reduce((a, d) => a + d.statuses.filter(s => s === 'completed').length, 0);
  const sumTracked   = weekData.reduce((a, d) => a + d.statuses.filter(s => s !== 'pending').length, 0);
  const totalPhotos  = weekData.reduce((a, d) => a + d.photos.filter(Boolean).length, 0);
  const pct = sumTracked ? Math.round((sumCompleted / sumTracked) * 100) : 0;
  const dasharray = 2 * Math.PI * 46;

  return (
    <div className="mb-[18px] flex flex-col gap-6 rounded-[22px] border border-kore-wine-dark/8 bg-white p-5 shadow-[0_2px_12px_-8px_rgba(45,15,26,0.10)] sm:flex-row sm:items-start sm:gap-8 sm:p-[26px]">
      {/* Ring */}
      <div className="relative flex-shrink-0 self-center sm:self-start">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="nutRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A8C29C"/>
              <stop offset="100%" stopColor="#3F6B36"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(103,15,34,0.08)" strokeWidth="10"/>
          <circle cx="60" cy="60" r="46" fill="none" stroke="url(#nutRingGrad)" strokeWidth="10"
            strokeDasharray={`${(pct / 100) * dasharray} ${dasharray}`}
            strokeLinecap="round" transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 700ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-heading text-[32px] font-semibold leading-none text-kore-wine-dark">{pct}%</div>
          <div className="mt-1 font-body text-[9px] font-bold uppercase tracking-[0.20em] text-kore-wine-dark/55">Cumplimiento</div>
        </div>
      </div>

      {/* Grid */}
      <div className="min-w-0 flex-1">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-kore-wine-dark/55">
            Cumplimiento · 7 días × 5 comidas
          </div>
          <div className="font-body text-[10px] text-kore-wine-dark/55">
            {sumCompleted}/{sumTracked} cumplidas · {totalPhotos} fotos
          </div>
        </div>

        <div className="grid grid-cols-[34px_repeat(7,minmax(0,1fr))] gap-1.5">
          {/* Header row */}
          <div />
          {weekData.map((d, i) => (
            <div key={i} className={`text-center font-body text-[9px] font-bold uppercase tracking-[0.04em] ${d.isToday ? 'text-kore-wine-dark' : 'text-kore-wine-dark/55'}`}>
              {d.dayName}
            </div>
          ))}

          {/* Meal rows */}
          {MEAL_BLOCKS.map((b, bi) => (
            <React.Fragment key={b.key}>
              <div className="self-center font-body text-[9px] font-bold uppercase tracking-[0.04em] text-kore-wine-dark/55">
                {b.label.split(' ')[0].slice(0, 4)}
              </div>
              {weekData.map((d, di) => {
                const s = d.statuses[bi];
                const ph = d.photos[bi];
                const cfgMap: Record<string, { bg: string; fg: string; icon: string }> = {
                  completed: { bg: '#669959', fg: '#fff', icon: '✓' },
                  skipped:   { bg: 'rgba(154,5,38,0.18)', fg: '#9A0526', icon: '✕' },
                  not_done:  { bg: 'rgba(229,201,122,0.30)', fg: T.amberDeep, icon: '?' },
                  pending:   { bg: 'rgba(103,15,34,0.04)', fg: T.textSoft, icon: '·' },
                };
                const cellCfg = cfgMap[s] ?? cfgMap.pending;
                return (
                  <div key={di} title={`${d.dayName} · ${b.label}`}
                    className="relative flex aspect-square items-center justify-center rounded-lg font-heading text-[14px] font-bold"
                    style={{ background: cellCfg.bg, color: cellCfg.fg }}>
                    {cellCfg.icon}
                    {ph && (
                      <span style={{ position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, background: T.wine, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="13" r="3"/>
                          <path d="M3 7h4l2-3h6l2 3h4v12H3z" stroke="currentColor" strokeWidth="2" fill="none"/>
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3.5 flex flex-wrap gap-x-3.5 gap-y-2 border-t border-kore-wine-dark/8 pt-3.5 font-body text-[10px] text-kore-wine-dark/55">
          {[
            { bg: '#669959',              label: 'Cumplió' },
            { bg: 'rgba(154,5,38,0.40)', label: 'Saltó' },
            { bg: 'rgba(229,201,122,0.60)', label: 'Sin marcar' },
            { bg: 'rgba(103,15,34,0.16)', label: 'Futuro' },
          ].map(({ bg, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: bg }} />{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Plan Header ──────────────────────────────────────────────────────────────
function PlanHeader({
  plan,
  onPublish,
  onRegenerate,
  onDelete,
  onRelaunch,
  publishing,
  deleting,
  relaunching,
}: {
  plan: WeeklyNutritionPlan;
  onPublish: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onRelaunch: () => void;
  publishing: boolean;
  deleting: boolean;
  relaunching: boolean;
}) {
  const isDraft = plan.status === 'draft';
  const weekNum = Math.ceil(new Date(plan.week_start).getDate() / 7);

  return (
    <div
      className="relative mb-4 overflow-hidden rounded-[22px] p-6 sm:px-8 sm:py-[26px]"
      style={{
        background: `linear-gradient(135deg, ${isDraft ? '#3D1F1A' : T.wineDark} 0%, ${isDraft ? T.wineDeep : T.wineDeep2} 100%)`,
        color: T.ivory,
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -40, right: -30, width: 240, height: 240,
        borderRadius: '50%', filter: 'blur(20px)',
        background: `radial-gradient(circle, ${isDraft ? 'rgba(229,201,122,0.14)' : 'rgba(168,194,156,0.14)'}, transparent 70%)`,
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Supertitle + status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(231,200,160,0.65)' }}>
              Plan semanal de nutrición
            </div>
            {isDraft ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999, background: 'rgba(229,201,122,0.18)', color: T.amber, border: '1px solid rgba(229,201,122,0.40)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: T.amber }} />Borrador
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999, background: 'rgba(168,194,156,0.20)', color: T.sage, border: '1px solid rgba(168,194,156,0.40)' }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: T.sage }} />Publicado
              </span>
            )}
          </div>

          {/* Week title */}
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(21px, 5.2vw, 28px)', fontWeight: 600, color: T.ivory, letterSpacing: '-0.005em', lineHeight: 1.18 }}>
            Semana {weekNum} · {planDateRange(plan)}
          </div>

          {/* Subtitle */}
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(231,200,160,0.75)', marginTop: 8 }}>
            5 comidas/día · 7 días ·{' '}
            {isDraft
              ? <span style={{ color: T.amber }}>No visible para el cliente — verá la rotación automática</span>
              : <>Publicado el <strong style={{ color: T.ivory, fontWeight: 600 }}>{plan.approved_at ? new Date(plan.approved_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong></>
            }
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
          {isDraft ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onRegenerate} disabled={deleting} style={{ padding: '10px 14px', borderRadius: 11, background: 'transparent', color: 'rgba(231,200,160,0.85)', border: '1px solid rgba(231,200,160,0.32)', fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                  Regenerar
                </button>
                <button
                  onClick={onPublish}
                  disabled={publishing}
                  style={{ padding: '10px 20px', borderRadius: 11, background: 'linear-gradient(135deg, #A8C29C, #669959)', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(168,194,156,0.50)', display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '0.06em', opacity: publishing ? 0.7 : 1 }}>
                  {publishing ? '...' : <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Publicar
                  </>}
                </button>
              </div>
              <button onClick={onDelete} disabled={deleting} style={{ padding: '6px 12px', borderRadius: 9, background: 'transparent', color: 'rgba(231,200,160,0.55)', border: '1px solid rgba(231,200,160,0.16)', fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: deleting ? 0.5 : 1 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Eliminar borrador
              </button>
            </>
          ) : (
            <button
              onClick={onRelaunch}
              disabled={relaunching}
              title="Eliminar el plan actual y generar un borrador nuevo desde cero"
              style={{ padding: '10px 18px', borderRadius: 11, background: 'rgba(244,199,199,0.10)', color: '#F4C7C7', border: '1px solid rgba(244,199,199,0.35)', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600, cursor: relaunching ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '0.04em', opacity: relaunching ? 0.6 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
              {relaunching ? 'Relanzando…' : 'Relanzar plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Habit Summary Card ───────────────────────────────────────────────────────
interface NutritionHabitSummary {
  id: number;
  meals_per_day: number;
  water_liters: string;
  fruit_weekly: number;
  vegetable_weekly: number;
  protein_frequency: number;
  ultraprocessed_weekly: number;
  sugary_drinks_weekly: number;
  eats_breakfast: boolean;
  habit_score: string | null;
  habit_category: string;
  habit_color: string;
  trainer_approved_at: string | null;
  created_at: string;
}

type HabitTone = 'sage' | 'amber' | 'danger';

function habitToneColor(tone: HabitTone): string {
  if (tone === 'sage')   return T.sageDark;
  if (tone === 'danger') return '#9A0526';
  return T.amberDeep;
}

function metricTone(key: string, val: number): HabitTone {
  const good: Record<string, (v: number) => boolean> = {
    meals_per_day:         v => v >= 4,
    water_liters:          v => v >= 2,
    fruit_weekly:          v => v >= 10,
    vegetable_weekly:      v => v >= 10,
    protein_frequency:     v => v >= 4,
    ultraprocessed_weekly: v => v <= 3,
    sugary_drinks_weekly:  v => v <= 1,
  };
  const ok: Record<string, (v: number) => boolean> = {
    meals_per_day:         v => v >= 3,
    water_liters:          v => v >= 1.5,
    fruit_weekly:          v => v >= 6,
    vegetable_weekly:      v => v >= 6,
    protein_frequency:     v => v >= 3,
    ultraprocessed_weekly: v => v <= 6,
    sugary_drinks_weekly:  v => v <= 4,
  };
  if (good[key]?.(val)) return 'sage';
  if (ok[key]?.(val))   return 'amber';
  return 'danger';
}

function HabitSummaryCard({ clientId }: { clientId: number }) {
  const [habit, setHabit] = useState<NutritionHabitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    api.get<NutritionHabitSummary[]>(`/trainer/my-clients/${clientId}/nutrition/`, { headers: authHeaders() })
      .then(r => setHabit(r.data[0] ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const metrics: { l: string; v: string; tone: HabitTone }[] = habit ? [
    { l: 'Comidas/día',   v: String(habit.meals_per_day),               tone: metricTone('meals_per_day', habit.meals_per_day) },
    { l: 'Agua',          v: `${habit.water_liters}L`,                   tone: metricTone('water_liters', parseFloat(habit.water_liters)) },
    { l: 'Verduras/sem',  v: String(habit.vegetable_weekly),             tone: metricTone('vegetable_weekly', habit.vegetable_weekly) },
    { l: 'Frutas/sem',    v: String(habit.fruit_weekly),                 tone: metricTone('fruit_weekly', habit.fruit_weekly) },
    { l: 'Proteína',      v: `${habit.protein_frequency}/5`,             tone: metricTone('protein_frequency', habit.protein_frequency) },
    { l: 'Ultraproc.',    v: `${habit.ultraprocessed_weekly}/sem`,       tone: metricTone('ultraprocessed_weekly', habit.ultraprocessed_weekly) },
    { l: 'Azucaradas',    v: `${habit.sugary_drinks_weekly}/sem`,        tone: metricTone('sugary_drinks_weekly', habit.sugary_drinks_weekly) },
    { l: 'Desayuno',      v: habit.eats_breakfast ? 'Sí' : 'No',        tone: habit.eats_breakfast ? 'sage' : 'amber' },
  ] : [];

  const scoreNum  = habit?.habit_score ? parseFloat(habit.habit_score) : null;
  const scoreColor = scoreNum !== null ? habitToneColor(metricTone('meals_per_day', scoreNum >= 7 ? 4 : scoreNum >= 5 ? 3 : 2)) : T.sageDark;
  const scoreToneColor = habit?.habit_color === 'green' ? T.sageDark : habit?.habit_color === 'red' ? '#9A0526' : T.amberDeep;

  const approvedAt = habit?.trainer_approved_at
    ? new Date(habit.trainer_approved_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div>
      {/* Divider + section header */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.textSoft }}>
              Contexto secundario
            </div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: T.wine, marginTop: 4 }}>
              Hábitos del cliente
            </div>
          </div>
          <button
            onClick={() => setShowFull(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600, color: T.wine, padding: 0 }}>
            {showFull ? 'Ocultar evaluación ↑' : 'Ver evaluación completa →'}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid rgba(103,15,34,0.12)`, borderTopColor: T.wine, animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : !habit ? (
          <div style={{ background: '#fff', borderRadius: 22, padding: '22px 24px', border: `1px solid ${T.borderSoft}`, fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textSoft, textAlign: 'center' }}>
            El cliente aún no ha completado la evaluación de hábitos nutricionales.
          </div>
        ) : (
          <div className="rounded-[22px] border border-kore-wine-dark/8 bg-white p-5 shadow-[0_2px_12px_-8px_rgba(45,15,26,0.10)] sm:p-6">
            <div className="flex flex-col gap-5 sm:grid sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-6">
              {/* Score */}
              <div>
                <div className="font-heading text-[36px] font-semibold leading-none" style={{ color: scoreToneColor }}>
                  {scoreNum?.toFixed(1) ?? '—'}
                  <span className="text-[16px] opacity-55">/10</span>
                </div>
                <div className="mt-1.5 font-body text-[10px] font-bold uppercase tracking-[0.20em] text-kore-wine-dark/55">
                  Score hábito · {habit.habit_category || '—'}
                </div>
              </div>

              {/* 8 metric cells */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 sm:gap-2.5">
                {metrics.map((m, i) => (
                  <div key={i}>
                    <div className="font-body text-[9px] font-semibold text-kore-wine-dark/55">{m.l}</div>
                    <div className="mt-0.5 font-heading text-[14px] font-semibold" style={{ color: habitToneColor(m.tone) }}>{m.v}</div>
                  </div>
                ))}
              </div>

              {/* Approval pill */}
              <div className="flex sm:justify-end">
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-[5px] font-body text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ background: approvedAt ? 'rgba(168,194,156,0.20)' : 'rgba(229,201,122,0.18)', color: approvedAt ? T.sageDark : T.amberDeep, border: `1px solid ${approvedAt ? 'rgba(168,194,156,0.35)' : 'rgba(229,201,122,0.35)'}` }}>
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />
                  {approvedAt ? `Aprobada · ${approvedAt}` : 'Sin aprobar'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Full eval toggle */}
        {showFull && (
          <div style={{ marginTop: 20 }}>
            <EvalNutriTab clientId={clientId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(103,15,34,0.12)', borderTopColor: T.wine, animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
}

// ─── ClientNutritionTab ───────────────────────────────────────────────────────
export default function ClientNutritionTab({
  clientId,
  nutritionLogs,
}: {
  clientId: number;
  nutritionLogs: NutritionLogDay[];
}) {
  const [plans, setPlans] = useState<WeeklyNutritionPlan[]>([]);
  const [activePlan, setActivePlan] = useState<(WeeklyNutritionPlan & { days: PlanDay[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relaunching, setRelaunching] = useState(false);
  const [trainerNotes, setTrainerNotes] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(1);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<WeeklyNutritionPlan[]>(
        `/nutrition-plans/customer/${clientId}/`,
        { headers: authHeaders() }
      );
      setPlans(data);

      // Load detail of draft first, then most recent published
      const draft      = data.find(p => p.status === 'draft');
      const published  = data.find(p => p.status === 'published');
      const toLoad     = draft ?? published;

      if (toLoad) {
        const { data: detail } = await api.get<WeeklyNutritionPlan & { days: PlanDay[] }>(
          `/nutrition-plans/${toLoad.id}/`,
          { headers: authHeaders() }
        );
        setActivePlan(detail);
        setTrainerNotes(detail.trainer_notes ?? '');
        // Auto-select week containing today, or week 1
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayDay = detail.days?.find((d: PlanDay) => d.date === todayStr);
        setSelectedWeek(todayDay?.week_number ?? 1);
      } else {
        setActivePlan(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post<WeeklyNutritionPlan & { days: PlanDay[] }>(
        '/nutrition-plans/generate/',
        { customer_id: clientId },
        { headers: authHeaders() }
      );
      setActivePlan(data);
      setTrainerNotes(data.trainer_notes ?? '');
      setPlans(prev => [data, ...prev.filter(p => p.status !== 'draft')]);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { plan_id?: number } } };
      // If a draft already exists (409), load it
      if (anyErr?.response?.data?.plan_id) {
        const { data: detail } = await api.get<WeeklyNutritionPlan & { days: PlanDay[] }>(
          `/nutrition-plans/${anyErr.response.data.plan_id}/`,
          { headers: authHeaders() }
        );
        setActivePlan(detail);
        setTrainerNotes(detail.trainer_notes ?? '');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!activePlan) return;
    setPublishing(true);
    try {
      const { data } = await api.post<WeeklyNutritionPlan & { days: PlanDay[] }>(
        `/nutrition-plans/${activePlan.id}/approve/`,
        { trainer_notes: trainerNotes },
        { headers: authHeaders() }
      );
      setActivePlan(data);
      setPlans(prev => prev.map(p => p.id === data.id ? data : p));
    } catch {
      // ignore
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!activePlan || !window.confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await api.delete(`/nutrition-plans/${activePlan.id}/delete/`, { headers: authHeaders() });
      await fetchPlans();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activePlan) { handleGenerate(); return; }
    if (!window.confirm('¿Crear un nuevo plan para la siguiente semana?')) return;
    handleGenerate();
  };

  // Relanzar: borra el plan publicado y genera un borrador nuevo en un paso.
  // Los registros diarios del cliente (NutritionDailyLog) son independientes
  // del plan y se conservan tras el borrado.
  const handleRelaunch = async () => {
    if (!activePlan) return;
    if (!window.confirm(
      '¿Relanzar el plan? Se eliminará el plan publicado actual y se generará un borrador nuevo de 28 días.\n\nEl historial de comidas registradas por el cliente se conserva.'
    )) return;
    setRelaunching(true);
    try {
      await api.delete(`/nutrition-plans/${activePlan.id}/delete/`, { headers: authHeaders() });
      const { data } = await api.post<WeeklyNutritionPlan & { days: PlanDay[] }>(
        '/nutrition-plans/generate/',
        { customer_id: clientId },
        { headers: authHeaders() }
      );
      setActivePlan(data);
      setTrainerNotes(data.trainer_notes ?? '');
      await fetchPlans();
    } catch {
      // ignore — UI ya refleja el estado tras fetchPlans (o queda sin plan)
    } finally {
      setRelaunching(false);
    }
  };

  const handleDayUpdated = (updatedDay: PlanDay) => {
    if (!activePlan) return;
    setActivePlan({
      ...activePlan,
      days: activePlan.days.map(d => d.id === updatedDay.id ? updatedDay : d),
    });
  };

  if (loading) return <Spinner />;

  if (!activePlan && plans.length === 0) {
    return (
      <div>
        <EmptyState
          title="Sin plan nutricional"
          description="Genera un plan semanal de 5 comidas/día para este cliente. Las sugerencias se adaptan automáticamente a su objetivo, nivel de fitness y hábitos NOVA."
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: '12px 28px', borderRadius: 13, background: `linear-gradient(135deg, ${T.wineDeep}, ${T.wine})`, color: T.ivory, border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '0.10em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 20px -8px rgba(45,15,26,0.40)' }}>
            {generating ? 'Generando...' : <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Generar plan de nutrición
            </>}
          </button>
        </div>
      </div>
    );
  }

  const isDraft = activePlan?.status === 'draft';

  return (
    <div>
      {/* Plan Header */}
      {activePlan && (
        <PlanHeader
          plan={activePlan}
          onPublish={handlePublish}
          onRegenerate={handleRegenerate}
          onDelete={handleDelete}
          onRelaunch={handleRelaunch}
          publishing={publishing}
          deleting={deleting}
          relaunching={relaunching}
        />
      )}

      {/* Draft banner */}
      {isDraft && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', borderRadius: 14, background: 'rgba(229,201,122,0.12)', border: '1px solid rgba(229,201,122,0.40)', marginBottom: 18 }}>
          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'rgba(229,201,122,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.amberDeep }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div style={{ flex: 1, fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textDark, lineHeight: 1.55 }}>
            <strong style={{ fontWeight: 700 }}>Plan en borrador.</strong> Las sugerencias se generaron automáticamente según objetivo, nivel y NOVA del cliente. Revísalas, intercambia las que no apliquen y publica para que reemplacen la rotación automática.
          </div>
        </div>
      )}

      {/* Week navigation pills */}
      {activePlan?.days && (
        <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-[14px] border border-kore-wine-dark/8 bg-white/55 p-1 sm:flex sm:w-fit sm:gap-1.5">
          {[1, 2, 3, 4].map(w => {
            const wDays = activePlan.days!.filter(d => d.week_number === w);
            const hasToday = wDays.some(d => isToday(d.date));
            const range = weekDateRange(activePlan.days!, w);
            const sel = selectedWeek === w;
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`relative rounded-[10px] px-3 py-2 text-center transition-all duration-150 active:scale-95 sm:px-[18px] ${sel ? 'bg-kore-wine-dark text-kore-ivory' : 'bg-transparent text-kore-wine-dark/55'}`}>
                <div className="font-body text-[11px] font-bold uppercase tracking-[0.12em]">
                  Semana {w}
                </div>
                {hasToday && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: sel ? T.sage : '#9A0526' }} />
                )}
                {range && (
                  <div className="mt-0.5 font-body text-[8px] font-semibold tracking-[0.04em] opacity-75">
                    {range}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Compliance Grid (published only — filtered by selected week) */}
      {!isDraft && activePlan?.days && (
        <ComplianceGrid plan={activePlan as WeeklyNutritionPlan & { days: PlanDay[] }} nutritionLogs={nutritionLogs} weekNum={selectedWeek} />
      )}

      {/* Trainer Notes — readonly mirror; edit in Notas tab */}
      <div style={{ background: '#fff', borderRadius: 22, padding: 26, marginBottom: 18, border: `1px solid ${T.borderSoft}`, boxShadow: '0 2px 12px -8px rgba(45,15,26,0.10)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 600, color: T.wine }}>Nota del entrenador</div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textSoft, marginTop: 4 }}>Edita esta nota en <strong>Notas → Nutrición</strong>.</div>
          </div>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: T.sageDark }}>Solo lectura</span>
        </div>
        {trainerNotes ? (
          <p style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'rgba(168,194,156,0.10)', border: `1px solid ${T.border}`, fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: T.textDark, lineHeight: 1.6, boxSizing: 'border-box', margin: 0, whiteSpace: 'pre-wrap' }}>
            {trainerNotes}
          </p>
        ) : (
          <p style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(103,15,34,0.04)', border: `1px dashed ${T.borderSoft}`, fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: T.textSoft, fontStyle: 'italic', margin: 0 }}>
            Sin nota aún. Agrega una desde la tab Notas → Nutrición.
          </p>
        )}
      </div>

      {/* Day cards — filtered by selected week */}
      {activePlan?.days && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '24px 4px 14px' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, fontWeight: 600, color: T.wine }}>
              Semana {selectedWeek} · día a día
            </div>
            {isDraft && (
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft }}>
                Toca «Cambiar» para intercambiar del catálogo
              </div>
            )}
          </div>
          {activePlan.days.filter(d => d.week_number === selectedWeek).map(day => (
            <DayCard
              key={day.id}
              day={day}
              planId={activePlan.id}
              planStatus={activePlan.status}
              logDay={nutritionLogs.find(l => l.date === day.date)}
              defaultOpen={isToday(day.date)}
              onPlanUpdated={handleDayUpdated}
            />
          ))}
        </>
      )}

      {/* No active plan but there are older plans */}
      {!activePlan && plans.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: '12px 28px', borderRadius: 13, background: `linear-gradient(135deg, ${T.wineDeep}, ${T.wine})`, color: T.ivory, border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '0.10em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 20px -8px rgba(45,15,26,0.40)' }}>
            {generating ? 'Generando...' : <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Crear nuevo plan
            </>}
          </button>
        </div>
      )}

      {/* Demoted habit evaluation */}
      <HabitSummaryCard clientId={clientId} />
    </div>
  );
}
