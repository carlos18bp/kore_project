'use client';

import { useEffect, useRef, useState } from 'react';
import { useProgressStore } from '@/lib/stores/progressStore';
import StreakBadge from './StreakBadge';
import ComparisonCard from './ComparisonCard';

type BottomTab = 'progreso' | 'resumen';

const DAY_INITIAL: Record<string, string> = {
  '0': 'D', '1': 'L', '2': 'M', '3': 'X', '4': 'J', '5': 'V', '6': 'S',
};

const PROG_HERO_STYLES = `
  @keyframes prog-orb-a{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}
  @keyframes prog-orb-b{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,30px)}}
  @keyframes prog-bar-rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}
`;

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

interface Props {
  className?: string;
}

export default function ProgressTabsCard({ className = '' }: Props) {
  const {
    weeklySummary, weeklyLoading,
    monthlySummary, monthlyLoading,
    fetchWeeklySummary, fetchMonthlySummary,
  } = useProgressStore();

  const [bottomTab, setBottomTab] = useState<BottomTab>('progreso');
  const [userWeek, setUserWeek] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const weeklyFetchedRef = useRef(false);
  const monthlyFetchedRef = useRef(false);

  useEffect(() => {
    if (weeklyFetchedRef.current) return;
    weeklyFetchedRef.current = true;
    if (!weeklySummary) fetchWeeklySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bottomTab !== 'resumen') return;
    if (monthlyFetchedRef.current) return;
    monthlyFetchedRef.current = true;
    if (!monthlySummary) fetchMonthlySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomTab]);

  const displayWeek = userWeek ?? weeklySummary?.week_number ?? 1;

  const handleWeekClick = (w: number) => {
    if (w === displayWeek) return;
    setUserWeek(w);
    fetchWeeklySummary(w);
  };

  // Per-stream averages derived from daily breakdown (the WeeklySummary type only
  // exposes the combined average; entreno/nutrición avgs are computed here).
  const days = weeklySummary?.days ?? [];
  const daysCount = days.length || 1;
  const trainingAvg = Math.round(
    days.reduce((s, d) => s + d.training_adherence, 0) / daysCount * 100,
  );
  const nutritionAvg = Math.round(
    days.reduce((s, d) => s + d.nutrition_adherence, 0) / daysCount * 100,
  );
  const combinedPct = Math.round((weeklySummary?.week_average ?? 0) * 100);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden ${className}`}>
      <div className="flex border-b border-kore-gray-light/30">
        {(['progreso', 'resumen'] as BottomTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setBottomTab(t)}
            className={`flex-1 py-2.5 text-[11px] font-semibold tracking-[0.02em] transition-colors capitalize ${
              bottomTab === t
                ? 'text-kore-red border-b border-kore-red -mb-px'
                : 'text-kore-gray-dark/40 hover:text-kore-gray-dark'
            }`}
          >
            {t === 'progreso' ? 'Mi Progreso' : 'Resumen Mensual'}
          </button>
        ))}
      </div>

      {bottomTab === 'progreso' && (
        <div className="px-4 py-3.5 space-y-3">
          <style>{PROG_HERO_STYLES}</style>

          {/* Week selector — compact pill row matching the design */}
          <div
            className="inline-flex gap-1 p-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(229,229,229,0.5)' }}
          >
            {[1, 2, 3, 4].map((w) => {
              const active = displayWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => handleWeekClick(w)}
                  className="px-3 py-1 rounded-lg text-[10.5px] font-semibold transition-all"
                  style={
                    active
                      ? { background: 'linear-gradient(135deg, #9A0526, #AB0D2F)', color: '#fff', boxShadow: '0 3px 10px -4px rgba(154,5,38,0.4)' }
                      : { background: 'transparent', color: 'rgba(51,51,51,0.55)' }
                  }
                >
                  Sem. {w}
                </button>
              );
            })}
          </div>

          {weeklyLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-kore-red border-t-transparent" /></div>
          ) : weeklySummary && days.length > 0 ? (
            <div
              className="relative overflow-hidden rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #0b1220 0%, #1a1f2e 50%, #0b1220 100%)',
                boxShadow: '0 14px 36px -14px rgba(0,0,0,0.45)',
              }}
            >
              {/* Animated orbs */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '8%', right: '12%', width: 200, height: 200, borderRadius: '50%',
                  background: 'radial-gradient(circle, #E0000055 0%, transparent 70%)',
                  filter: 'blur(40px)', animation: 'prog-orb-a 9s ease-in-out infinite',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: '5%', left: '10%', width: 150, height: 150, borderRadius: '50%',
                  background: 'radial-gradient(circle, #9A052666 0%, transparent 70%)',
                  filter: 'blur(45px)', animation: 'prog-orb-b 11s ease-in-out infinite',
                }}
              />

              <div className="relative grid gap-5 md:gap-6 p-5 md:p-6 md:grid-cols-[220px_1fr] items-center">
                {/* Score block */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">
                    Adherencia combinada
                  </p>
                  <div className="flex items-baseline gap-1 mt-2.5">
                    <span
                      className="font-heading font-bold leading-none"
                      style={{
                        fontSize: 56,
                        background: 'linear-gradient(135deg, #ffffff 0%, #CD0C36 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {combinedPct}
                    </span>
                    <span className="text-[16px] text-white/40 font-light">%</span>
                  </div>
                  <p className="text-[10px] text-white/45 mt-1">
                    Semana {weeklySummary.week_number}
                  </p>

                  <div className="mt-4 pt-3.5 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      { label: 'Entreno', weight: '60%', value: trainingAvg, color: '#E00000', glow: 'rgba(224,0,0,0.6)' },
                      { label: 'Nutrición', weight: '40%', value: nutritionAvg, color: '#34D399', glow: 'rgba(52,211,153,0.6)' },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] text-white/85 font-medium">
                            {s.label} <span className="text-[9px] opacity-45">· {s.weight}</span>
                          </span>
                          <span className="text-[12px] font-bold text-white tabular-nums">{s.value}%</span>
                        </div>
                        <div
                          className="mt-1 h-1 rounded-full overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.08)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s.value}%`,
                              background: s.color,
                              boxShadow: `0 0 8px ${s.glow}`,
                              transition: 'width 800ms ease-out',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart block */}
                <div className="relative min-w-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-white/45">Distribución diaria</span>
                    <div className="flex gap-3 text-[10px] text-white/65">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm" style={{ background: 'linear-gradient(180deg, #FF4040, #9A0526)' }} />
                        Entreno
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm" style={{ background: 'linear-gradient(180deg, #34D399, #047857)' }} />
                        Nutrición
                      </span>
                    </div>
                  </div>

                  <div className="relative" style={{ height: 160, paddingTop: 16 }}>
                    {/* Gridlines */}
                    {[100, 75, 50, 25].map((y) => (
                      <div
                        key={y}
                        className="absolute left-0 right-0 flex justify-end pointer-events-none"
                        style={{ top: `${16 + (100 - y) * 1.12}px`, borderTop: '1px dashed rgba(255,255,255,0.06)' }}
                      >
                        <span
                          className="text-[8.5px] text-white/30 tabular-nums"
                          style={{ marginTop: -5, marginRight: -22 }}
                        >
                          {y}
                        </span>
                      </div>
                    ))}

                    {/* Bars */}
                    <div
                      className="grid relative"
                      style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, height: 128, alignItems: 'end' }}
                    >
                      {days.map((d, i) => {
                        const isHover = hoverDay === i;
                        const isRest = d.day_type === 'rest';
                        const trainPct = Math.round(d.training_adherence * 100);
                        const nutriPct = Math.round(d.nutrition_adherence * 100);
                        const dateNum = new Date(d.date + 'T12:00:00').getDate();
                        const dayLetter = DAY_INITIAL[String(new Date(d.date + 'T12:00:00').getDay())] ?? '';
                        const isToday = d.date === todayStr;
                        const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
                        return (
                          <div
                            key={d.date}
                            onMouseEnter={() => setHoverDay(i)}
                            onMouseLeave={() => setHoverDay(null)}
                            className="relative flex items-end justify-center cursor-pointer h-full"
                            style={{ gap: 3 }}
                          >
                            {isHover && (
                              <div
                                className="absolute z-10"
                                style={{
                                  bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6,
                                  padding: '6px 10px', background: 'rgba(15,18,28,0.95)',
                                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                                  whiteSpace: 'nowrap', boxShadow: '0 6px 16px -4px rgba(0,0,0,0.5)',
                                }}
                              >
                                <div className="text-[9px] text-white/55 font-semibold uppercase tracking-[0.08em] capitalize">{dayLabel}</div>
                                <div className="flex gap-2 mt-0.5">
                                  <span className="text-[11px] font-bold" style={{ color: '#FF4040' }}>{trainPct}%</span>
                                  <span className="text-[11px] font-bold" style={{ color: '#34D399' }}>{nutriPct}%</span>
                                </div>
                              </div>
                            )}
                            <div
                              style={{
                                width: 8, height: `${trainPct}%`,
                                background: isRest ? 'rgba(255,255,255,0.08)' : 'linear-gradient(180deg, #FF4040 0%, #9A0526 100%)',
                                borderRadius: '5px 5px 1.5px 1.5px',
                                boxShadow: isRest ? 'none' : (isHover ? '0 0 12px rgba(255,64,64,0.7)' : '0 0 6px rgba(255,64,64,0.3)'),
                                transformOrigin: 'bottom',
                                animation: `prog-bar-rise 700ms ease-out ${i * 70}ms backwards`,
                                transition: 'box-shadow 200ms',
                              }}
                            />
                            <div
                              style={{
                                width: 8, height: `${nutriPct}%`,
                                background: 'linear-gradient(180deg, #34D399 0%, #047857 100%)',
                                borderRadius: '5px 5px 1.5px 1.5px',
                                boxShadow: isHover ? '0 0 12px rgba(52,211,153,0.7)' : '0 0 6px rgba(52,211,153,0.3)',
                                transformOrigin: 'bottom',
                                animation: `prog-bar-rise 700ms ease-out ${i * 70 + 90}ms backwards`,
                                transition: 'box-shadow 200ms',
                              }}
                            />
                            {isToday && !isHover && (
                              <span
                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                                style={{ background: '#FF4040', boxShadow: '0 0 6px rgba(255,64,64,0.7)' }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Day labels */}
                    <div
                      className="grid mt-2.5"
                      style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}
                    >
                      {days.map((d, i) => {
                        const dateNum = new Date(d.date + 'T12:00:00').getDate();
                        const dayLetter = DAY_INITIAL[String(new Date(d.date + 'T12:00:00').getDay())] ?? '';
                        const isHover = hoverDay === i;
                        const isToday = d.date === todayStr;
                        return (
                          <div key={d.date} className="text-center">
                            <div
                              className="font-heading font-semibold transition-colors"
                              style={{
                                fontSize: 14,
                                color: isHover || isToday ? '#fff' : 'rgba(255,255,255,0.65)',
                              }}
                            >
                              {dayLetter}
                            </div>
                            <div className="text-[9px] tabular-nums mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {dateNum}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📊</p>
              <p className="text-xs text-kore-gray-dark/50">No hay datos de progreso todavía.</p>
            </div>
          )}
        </div>
      )}

      {bottomTab === 'resumen' && (
        <div className="px-4 py-3.5 space-y-3.5">
          {monthlyLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-kore-red border-t-transparent" /></div>
          ) : monthlySummary ? (
            <>
              <p className="text-[10.5px] text-kore-gray-dark/40 uppercase tracking-[0.14em] font-semibold text-center capitalize">
                {formatDate(monthlySummary.start_date)} — {formatDate(monthlySummary.end_date)}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-kore-gray-dark/45">Adherencia total</p>
                    {[
                      { label: 'Combinada', value: monthlySummary.overall_adherence, color: 'bg-kore-red' },
                      { label: 'Entrenamiento', value: monthlySummary.training_adherence, color: 'bg-kore-red/70' },
                      { label: 'Nutrición', value: monthlySummary.nutrition_adherence, color: 'bg-teal-400' },
                    ].map(({ label, value, color }) => {
                      const pct = Math.round(value * 100);
                      return (
                        <div key={label}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[10px] text-kore-gray-dark/60">{label}</span>
                            <span className="text-[10px] font-bold text-kore-gray-dark">{pct}%</span>
                          </div>
                          <div className="h-1 bg-kore-red/10 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(monthlySummary.mood.first_week !== null || monthlySummary.mood.last_week !== null) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-kore-gray-dark/45 mb-2">Bienestar</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-center">
                          <p className="font-heading text-[18px] font-bold text-kore-gray-dark leading-none">{monthlySummary.mood.first_week ?? '—'}</p>
                          <p className="text-[9px] text-kore-gray-dark/45 uppercase tracking-[0.12em] font-semibold mt-0.5">1ª sem.</p>
                        </div>
                        <svg className="w-4 h-3 text-kore-gray-dark/20 shrink-0" fill="none" viewBox="0 0 20 12">
                          <path d="M0 6h16m0 0l-4-3m4 3l-4 3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex-1 text-center">
                          <p className={`font-heading text-[18px] font-bold leading-none ${monthlySummary.mood.last_week !== null && monthlySummary.mood.first_week !== null && monthlySummary.mood.last_week > monthlySummary.mood.first_week ? 'text-teal-600' : monthlySummary.mood.last_week !== null && monthlySummary.mood.first_week !== null && monthlySummary.mood.last_week < monthlySummary.mood.first_week ? 'text-rose-500' : 'text-kore-gray-dark'}`}>{monthlySummary.mood.last_week ?? '—'}</p>
                          <p className="text-[9px] text-kore-gray-dark/45 uppercase tracking-[0.12em] font-semibold mt-0.5">Última</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <StreakBadge current={0} longest={monthlySummary.streak_best} />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-kore-gray-dark/45">Evolución</p>
                  <ComparisonCard label="IMC" before={monthlySummary.comparisons.bmi.before} after={monthlySummary.comparisons.bmi.after} delta={monthlySummary.comparisons.bmi.delta} lowerIsBetter decimals={2} />
                  <ComparisonCard label="Grasa corporal" before={monthlySummary.comparisons.body_fat_pct.before} after={monthlySummary.comparisons.body_fat_pct.after} delta={monthlySummary.comparisons.body_fat_pct.delta} unit="%" lowerIsBetter />
                  <ComparisonCard label="Condición física" before={monthlySummary.comparisons.physical_index.before} after={monthlySummary.comparisons.physical_index.after} delta={monthlySummary.comparisons.physical_index.delta} decimals={2} />
                  {(monthlySummary.weight.start !== null || monthlySummary.weight.end !== null) && (
                    <ComparisonCard label="Peso" before={monthlySummary.weight.start} after={monthlySummary.weight.end} delta={monthlySummary.weight.delta} unit=" kg" lowerIsBetter decimals={1} />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-xs text-kore-gray-dark/50">No hay datos de resumen todavía.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
