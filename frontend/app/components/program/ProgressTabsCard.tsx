'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import gsap from 'gsap';
import { useProgressStore } from '@/lib/stores/progressStore';

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

function getAdherenceCopy(combinedPct: number, trainingPct: number, nutritionPct: number) {
  if (combinedPct >= 85) {
    return { title: 'Excelente mes', body: 'Disciplina ejemplar. Mantén este ritmo el próximo mes.' };
  }
  if (combinedPct >= 70) {
    const weakest = nutritionPct < trainingPct ? 'nutrición' : 'entrenamiento';
    return { title: 'Buen mes', body: `Buen ritmo. Empuja un poco más en ${weakest}.` };
  }
  if (combinedPct >= 50) {
    return { title: 'Mes en construcción', body: 'Hay base para crecer. Vamos a por una semana más arriba.' };
  }
  return { title: 'Mes en pausa', body: 'Cada día cuenta. Empieza el próximo mes con una rutina cada día.' };
}

// 96px gradient ring with red→crimson stroke + soft glow.
function MonthlyRing({ value, size = 96, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const gradId = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id={`mr-${gradId}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FF4040" />
          <stop offset="100%" stopColor="#9A0526" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#mr-${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1000ms ease-out', filter: 'drop-shadow(0 0 8px rgba(154,5,38,0.6))' }}
      />
    </svg>
  );
}

// Compact sparkline for evolución rows. Interpolates 4 points between before/after
// when no time series is available — the visual conveys trajectory only.
function MonthlySpark({ from, to, color, width = 80, height = 28 }: { from: number; to: number; color: string; width?: number; height?: number }) {
  const gradId = useId().replace(/:/g, '');
  const data = [from, from + (to - from) * 0.33, from + (to - from) * 0.66, to];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
  const lastY = height - ((to - min) / range) * height;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`ms-${gradId}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={`url(#ms-${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="3" fill={color} />
      <circle cx={width} cy={lastY} r="6" fill={color} opacity="0.2" />
    </svg>
  );
}

// Pending sparkline: renders a flat baseline + a dashed forward line ending in a
// hollow circle. Used when only the starting value is known (no follow-up eval yet).
function PendingSpark({ width = 80, height = 28 }: { width?: number; height?: number }) {
  const midY = height / 2;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <line x1={0} y1={midY} x2={width * 0.45} y2={midY} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={width * 0.45} y1={midY} x2={width} y2={midY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx={width * 0.45} cy={midY} r={3} fill="rgba(255,255,255,0.55)" />
      <circle cx={width} cy={midY} r={3} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
    </svg>
  );
}

interface Props {
  className?: string;
  mobileExpanded?: boolean;
  onToggleMobile?: () => void;
}

export default function ProgressTabsCard({ className = '', mobileExpanded = false, onToggleMobile }: Props) {
  const {
    weeklySummary, weeklyLoading,
    monthlySummary, monthlyLoading,
    projection,
    fetchWeeklySummary, fetchMonthlySummary,
    fetchProjection,
  } = useProgressStore();

  const [bottomTab, setBottomTab] = useState<BottomTab>('progreso');
  const [userWeek, setUserWeek] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const weeklyFetchedRef = useRef(false);
  const monthlyFetchedRef = useRef(false);
  const projectionFetchedRef = useRef(false);

  // Solo la instancia mobile maneja el accordion (la desktop no recibe onToggleMobile).
  const isMobileInstance = typeof onToggleMobile === 'function';

  // Refs para animar con GSAP las secciones colapsables (mobile only).
  const chartRef = useRef<HTMLDivElement>(null);
  const projectionRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<HTMLDivElement>(null);
  const evolutionRef = useRef<HTMLDivElement>(null);
  const lastTabRef = useRef<BottomTab | null>(null);
  const syncedSet = useRef<Set<HTMLElement>>(new Set());

  // Sync (sin animación) para refs recién montados — primer mount, cambio de
  // pestaña, o cuando los datos cargan tarde y un bloque condicional se monta.
  useLayoutEffect(() => {
    if (!isMobileInstance) return;

    const allRefs = [chartRef.current, projectionRef.current, moodRef.current, evolutionRef.current];
    const mounted = allRefs.filter(Boolean) as HTMLElement[];

    const tabChanged = lastTabRef.current !== bottomTab;
    if (tabChanged) {
      syncedSet.current.clear();
      lastTabRef.current = bottomTab;
    }

    const toSync = mounted.filter((el) => !syncedSet.current.has(el));
    if (toSync.length === 0) return;

    toSync.forEach((el) => syncedSet.current.add(el));
    gsap.set(
      toSync,
      mobileExpanded
        ? { height: 'auto', opacity: 1, display: 'block', overflow: 'visible' }
        : { height: 0, opacity: 0, display: 'none', overflow: 'hidden' },
    );
  }, [bottomTab, mobileExpanded, isMobileInstance, projection, weeklySummary, monthlySummary]);

  // Animación cuando el usuario togglea mobileExpanded.
  useEffect(() => {
    if (!isMobileInstance) return;
    if (syncedSet.current.size === 0) return; // todavía no hay refs sincronizados

    const targets = [chartRef.current, projectionRef.current, moodRef.current, evolutionRef.current]
      .filter(Boolean) as HTMLElement[];
    if (targets.length === 0) return;

    if (mobileExpanded) {
      gsap.set(targets, { display: 'block', overflow: 'hidden' });
      gsap.fromTo(
        targets,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.04 },
      );
    } else {
      gsap.to(targets, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        stagger: 0.03,
        onComplete: () => {
          targets.forEach((t) => gsap.set(t, { display: 'none' }));
        },
      });
    }
  }, [mobileExpanded, isMobileInstance]);

  useEffect(() => {
    if (weeklyFetchedRef.current) return;
    weeklyFetchedRef.current = true;
    if (!weeklySummary) fetchWeeklySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projectionFetchedRef.current) return;
    projectionFetchedRef.current = true;
    if (!projection) fetchProjection();
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
  const projectedPct = projection ? Math.round(projection.projected_final_adherence * 100) : null;

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
                background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
                boxShadow: '0 14px 36px -14px rgba(0,0,0,0.45)',
              }}
            >
              {/* Animated orbs */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '8%', right: '12%', width: 200, height: 200, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)',
                  filter: 'blur(40px)', animation: 'prog-orb-a 9s ease-in-out infinite',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: '5%', left: '10%', width: 150, height: 150, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)',
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
                <div
                  ref={chartRef}
                  className="relative min-w-0"
                >
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

                  <div className="relative" style={{ height: 200, paddingTop: 16 }}>
                    {/* Gridlines — multiplicador 1.28 para alinear con bars (height 128 = 100%) */}
                    {[100, 75, 50, 25].map((y) => (
                      <div
                        key={y}
                        className="absolute left-0 right-0 flex justify-end pointer-events-none"
                        style={{ top: `${16 + (100 - y) * 1.28}px`, borderTop: '1px dashed rgba(255,255,255,0.06)' }}
                      >
                        <span
                          className="text-[8.5px] text-white/30 tabular-nums -mt-[5px] mr-0.5 xl:mr-0 xl:-mr-[22px]"
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
                        const isFuture = !!d.is_future;
                        const ghostPct = projectedPct ?? 8;
                        const trainPct = isFuture ? ghostPct : Math.round(d.training_adherence * 100);
                        const nutriPct = isFuture ? ghostPct : Math.round(d.nutrition_adherence * 100);
                        const dateNum = new Date(d.date + 'T12:00:00').getDate();
                        const dayLetter = DAY_INITIAL[String(new Date(d.date + 'T12:00:00').getDay())] ?? '';
                        const isToday = d.date === todayStr;
                        const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
                        const isProjectedFuture = isFuture && projectedPct !== null && !isRest;
                        const tooltipLabel = isFuture
                          ? (isRest
                            ? 'Descanso · próximamente'
                            : projectedPct !== null
                            ? `Proyectado · ${projectedPct}%`
                            : 'Próximamente')
                          : isRest
                          ? 'Descanso'
                          : null;
                        // Real data → solid gradient + glow
                        // Projected future → translucent gradient, dashed top, no glow
                        // Rest / future without projection → flat gray ghost
                        const trainBarBg = !isFuture && !isRest
                          ? 'linear-gradient(180deg, #FF4040 0%, #9A0526 100%)'
                          : isProjectedFuture
                          ? 'linear-gradient(180deg, rgba(255,64,64,0.32) 0%, rgba(154,5,38,0.1) 100%)'
                          : 'rgba(255,255,255,0.08)';
                        const nutriBarBg = !isFuture
                          ? 'linear-gradient(180deg, #34D399 0%, #047857 100%)'
                          : isProjectedFuture
                          ? 'linear-gradient(180deg, rgba(52,211,153,0.32) 0%, rgba(4,120,87,0.1) 100%)'
                          : 'rgba(255,255,255,0.08)';
                        const trainShadow = !isFuture && !isRest
                          ? (isHover ? '0 0 12px rgba(255,64,64,0.7)' : '0 0 6px rgba(255,64,64,0.3)')
                          : 'none';
                        const nutriShadow = !isFuture
                          ? (isHover ? '0 0 12px rgba(52,211,153,0.7)' : '0 0 6px rgba(52,211,153,0.3)')
                          : 'none';
                        const projectedBorderTop = isProjectedFuture ? '1px dashed rgba(255,255,255,0.32)' : 'none';
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
                                {tooltipLabel ? (
                                  <div className="text-[10px] font-semibold text-white/65 mt-0.5">{tooltipLabel}</div>
                                ) : (
                                  <div className="flex gap-2 mt-0.5">
                                    <span className="text-[11px] font-bold" style={{ color: '#FF4040' }}>{Math.round(d.training_adherence * 100)}%</span>
                                    <span className="text-[11px] font-bold" style={{ color: '#34D399' }}>{Math.round(d.nutrition_adherence * 100)}%</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div
                              style={{
                                width: 8, height: `${trainPct}%`,
                                background: trainBarBg,
                                borderTop: projectedBorderTop,
                                borderRadius: '5px 5px 1.5px 1.5px',
                                boxShadow: trainShadow,
                                transformOrigin: 'bottom',
                                animation: `prog-bar-rise 700ms ease-out ${i * 70}ms backwards`,
                                transition: 'box-shadow 200ms',
                              }}
                            />
                            <div
                              style={{
                                width: 8, height: `${nutriPct}%`,
                                background: nutriBarBg,
                                borderTop: projectedBorderTop,
                                borderRadius: '5px 5px 1.5px 1.5px',
                                boxShadow: nutriShadow,
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

              {projection && projectedPct !== null && (
                <div
                  ref={projectionRef}
                  className="relative px-5 md:px-6 pb-5 md:pb-6 -mt-1"
                >
                  <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 xl:gap-4">
                      <div className="min-w-0 xl:flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/45">
                            Si mantienes el ritmo
                          </p>
                          <span
                            className="text-[9.5px] font-bold uppercase tracking-[0.1em] px-2 py-[3px] rounded-md"
                            style={
                              projection.trend === 'improving'
                                ? { background: 'rgba(16,185,129,0.18)', color: '#34D399' }
                                : projection.trend === 'declining'
                                ? { background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }
                                : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }
                            }
                          >
                            {projection.trend === 'improving'
                              ? '↗ Mejorando'
                              : projection.trend === 'declining'
                              ? '↘ Bajando'
                              : '→ Estable'}
                          </span>
                          <span className="text-[9.5px] font-semibold text-white/35 uppercase tracking-[0.1em]">
                            ·{' '}
                            {projection.confidence === 'high'
                              ? 'Alta confianza'
                              : projection.confidence === 'medium'
                              ? 'Confianza media'
                              : 'Pocos datos aún'}
                          </span>
                        </div>

                        {/* Mobile-only: métricas entre header y recomendación */}
                        <div className="xl:hidden mt-3 flex items-end gap-5">
                          <div>
                            <p className="font-heading font-bold text-white tabular-nums leading-none" style={{ fontSize: 28 }}>
                              {projectedPct}
                              <span className="text-[13px] text-white/40 font-light">%</span>
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/45 mt-1.5">
                              Adherencia final
                            </p>
                          </div>
                          {projection.weight_projection !== null && (
                            <div className="pl-5" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                              <p className="font-heading font-bold text-white tabular-nums leading-none" style={{ fontSize: 22 }}>
                                {projection.weight_projection}
                                <span className="text-[11px] text-white/40 font-light"> kg</span>
                              </p>
                              <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/45 mt-1.5">
                                Peso proyectado
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-[12px] text-white/70 mt-3 xl:mt-1.5 leading-snug">
                          {projection.recommendation}
                        </p>
                        <p className="text-[10.5px] text-white/40 mt-1 tabular-nums">
                          {projection.days_elapsed} días registrados · faltan {projection.days_remaining}
                        </p>
                      </div>

                      {/* Desktop-only: métricas a la derecha */}
                      <div className="hidden xl:flex items-end gap-4 shrink-0">
                        <div className="text-right">
                          <p className="font-heading font-bold text-white tabular-nums leading-none" style={{ fontSize: 30 }}>
                            {projectedPct}
                            <span className="text-[14px] text-white/40 font-light">%</span>
                          </p>
                          <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/45 mt-1.5">
                            Adherencia final
                          </p>
                        </div>
                        {projection.weight_projection !== null && (
                          <div className="text-right pl-4" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                            <p className="font-heading font-bold text-white tabular-nums leading-none" style={{ fontSize: 22 }}>
                              {projection.weight_projection}
                              <span className="text-[11px] text-white/40 font-light"> kg</span>
                            </p>
                            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/45 mt-1.5">
                              Peso proyectado
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📊</p>
              <p className="text-xs text-kore-gray-dark/50">No hay datos de progreso todavía.</p>
            </div>
          )}

          {weeklySummary && days.length > 0 && onToggleMobile && (
            <button
              type="button"
              onClick={onToggleMobile}
              aria-expanded={mobileExpanded}
              className="xl:hidden w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/55 hover:text-kore-gray-dark transition-colors active:scale-[0.99]"
            >
              <span>{mobileExpanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${mobileExpanded ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </button>
          )}
        </div>
      )}

      {bottomTab === 'resumen' && (
        <div className="px-4 py-3.5 space-y-3">
          <style>{PROG_HERO_STYLES}</style>
          {monthlyLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-kore-red border-t-transparent" /></div>
          ) : monthlySummary ? (
            (() => {
              const combinedPct = Math.round(monthlySummary.overall_adherence * 100);
              const trainingPct = Math.round(monthlySummary.training_adherence * 100);
              const nutritionPct = Math.round(monthlySummary.nutrition_adherence * 100);
              const copy = getAdherenceCopy(combinedPct, trainingPct, nutritionPct);
              const moodFirst = monthlySummary.mood.first_week;
              const moodLast = monthlySummary.mood.last_week;
              const moodDelta = moodFirst !== null && moodLast !== null ? Number((moodLast - moodFirst).toFixed(1)) : null;

              type EvolutionRow = {
                label: string;
                description: string;
                before: number | null;
                after: number | null;
                delta: number | null;
                unit: string;
                decimals: number;
                lowerIsBetter: boolean;
              };
              const rawRows: EvolutionRow[] = [
                {
                  label: 'IMC',
                  description: 'Índice de masa corporal: relación peso/altura. Útil como primer vistazo, no determinante.',
                  ...monthlySummary.comparisons.bmi,
                  unit: '', decimals: 2, lowerIsBetter: true,
                },
                {
                  label: 'Grasa corporal',
                  description: 'Porcentaje de grasa total. Mejor indicador que el IMC para salud metabólica.',
                  ...monthlySummary.comparisons.body_fat_pct,
                  unit: '%', decimals: 1, lowerIsBetter: true,
                },
                {
                  label: 'Condición física',
                  description: 'Tu nivel agregado de fuerza, resistencia y movilidad. Se actualiza con cada evaluación de tu coach.',
                  ...monthlySummary.comparisons.physical_index,
                  unit: '', decimals: 2, lowerIsBetter: false,
                },
                {
                  label: 'Peso',
                  description: 'Tu peso registrado. Útil para tendencia, no como métrica única de progreso.',
                  before: monthlySummary.weight.start, after: monthlySummary.weight.end, delta: monthlySummary.weight.delta,
                  unit: ' kg', decimals: 1, lowerIsBetter: true,
                },
              ];
              const rows = rawRows.filter((r) => r.before !== null || r.after !== null);

              return (
                <>
                  <p className="text-[10.5px] text-kore-gray-dark/40 uppercase tracking-[0.14em] font-semibold text-center capitalize">
                    {formatDate(monthlySummary.start_date)} — {formatDate(monthlySummary.end_date)}
                  </p>

                  <div
                    className="relative overflow-hidden rounded-2xl text-white"
                    style={{
                      background: 'linear-gradient(155deg, #2D0F1A 0%, #4A1828 35%, #5C2030 65%, #6B2A3A 100%)',
                      boxShadow: '0 14px 36px -14px rgba(0,0,0,0.45)',
                    }}
                  >
                    {/* Animated orbs */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: '-10%', right: '8%', width: 240, height: 240, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,233,220,0.22) 0%, rgba(244,199,199,0.10) 50%, transparent 70%)',
                        filter: 'blur(50px)', animation: 'prog-orb-a 10s ease-in-out infinite',
                      }}
                    />
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        bottom: '-10%', left: '5%', width: 200, height: 200, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(244,199,199,0.32) 0%, transparent 70%)',
                        filter: 'blur(50px)', animation: 'prog-orb-b 12s ease-in-out infinite',
                      }}
                    />

                    <div className="relative grid p-5 md:p-7 gap-6 md:gap-10 grid-cols-1 md:grid-cols-[1fr_1px_1fr] md:items-stretch">
                      {/* LEFT — Adherencia total */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Adherencia total</p>

                        <div className="flex items-center gap-5 mt-4">
                          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
                            <MonthlyRing value={combinedPct} />
                            <div className="absolute inset-0 grid place-items-center">
                              <div className="text-center">
                                <p className="font-heading text-[26px] font-bold leading-none text-white">{combinedPct}</p>
                                <p className="text-[9px] font-semibold tracking-[0.1em] text-white/50 mt-1">COMBINADA</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-heading text-[20px] font-semibold text-white leading-tight">{copy.title}</p>
                            <p className="text-[12px] text-white/55 mt-1 leading-snug">{copy.body}</p>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3.5">
                          {[
                            { label: 'Entrenamiento', value: trainingPct, color: '#FF4040', shadow: 'rgba(255,64,64,0.6)', gradTo: '#9A0526' },
                            { label: 'Nutrición', value: nutritionPct, color: '#34D399', shadow: 'rgba(52,211,153,0.6)', gradTo: '#047857' },
                          ].map((s) => (
                            <div key={s.label}>
                              <div className="flex justify-between items-baseline">
                                <span className="text-[12px] text-white/85 font-medium">{s.label}</span>
                                <span className="text-[15px] text-white font-bold tabular-nums">
                                  {s.value}
                                  <span className="text-[10px] text-white/40 font-medium">%</span>
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${s.value}%`,
                                    background: `linear-gradient(90deg, ${s.color} 0%, ${s.gradTo} 100%)`,
                                    boxShadow: `0 0 12px ${s.shadow}`,
                                    transition: 'width 1000ms ease-out',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {(moodFirst !== null || moodLast !== null) && (
                          <div
                            ref={moodRef}
                            className="mt-6 pt-5"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Bienestar</p>
                            <p className="text-[11px] text-white/45 mt-1 leading-snug">
                              Tu estado de ánimo promedio (1–10) que registras al abrir la app cada día.
                            </p>
                            <div className="flex items-center gap-4 mt-3">
                              <div>
                                <p className="font-heading text-[24px] font-bold leading-none text-white/55 tabular-nums">{moodFirst ?? '—'}</p>
                                <p className="text-[9px] font-semibold tracking-[0.1em] text-white/40 mt-1">1ª SEMANA</p>
                              </div>
                              <div
                                className="flex-1 relative"
                                style={{
                                  height: 2,
                                  background:
                                    moodDelta !== null && moodDelta > 0
                                      ? 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(52,211,153,0.6))'
                                      : moodDelta !== null && moodDelta < 0
                                      ? 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(245,158,11,0.6))'
                                      : 'rgba(255,255,255,0.15)',
                                }}
                              >
                                <span
                                  className="absolute -right-[2px] -top-1 text-[10px]"
                                  style={{
                                    color: moodDelta !== null && moodDelta > 0 ? '#34D399' : moodDelta !== null && moodDelta < 0 ? '#F59E0B' : 'rgba(255,255,255,0.4)',
                                  }}
                                >
                                  ▶
                                </span>
                              </div>
                              <div>
                                <p className="font-heading text-[24px] font-bold leading-none text-white tabular-nums">{moodLast ?? '—'}</p>
                                <p className="text-[9px] font-semibold tracking-[0.1em] text-white/40 mt-1">ÚLTIMA</p>
                              </div>
                              {moodDelta !== null && (
                                <span
                                  className="px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums shrink-0"
                                  style={
                                    moodDelta > 0
                                      ? { background: 'rgba(16,185,129,0.18)', color: '#34D399' }
                                      : moodDelta < 0
                                      ? { background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }
                                      : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
                                  }
                                >
                                  {moodDelta === 0 ? '—' : `${moodDelta > 0 ? '+' : ''}${moodDelta}`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Vertical divider — desktop only */}
                      <div
                        className="hidden md:block"
                        style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)' }}
                      />

                      {/* RIGHT — Evolución */}
                      <div
                        ref={evolutionRef}
                        className="xl:!block xl:!h-auto xl:!opacity-100 xl:!overflow-visible"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Evolución</p>

                        <div className="mt-4 flex flex-col">
                          {rows.length === 0 ? (
                            <p className="text-[12px] text-white/40 mt-2">Aún no hay comparaciones disponibles para este mes.</p>
                          ) : (
                            rows.map((e, i) => {
                              const hasBoth = e.before !== null && e.after !== null && e.delta !== null;
                              const onlyBefore = e.before !== null && e.after === null;
                              const positive = hasBoth && (e.lowerIsBetter ? (e.delta as number) < 0 : (e.delta as number) > 0);
                              const neutral = hasBoth && e.delta === 0;
                              const deltaColor = !hasBoth
                                ? 'rgba(255,255,255,0.4)'
                                : neutral
                                ? 'rgba(255,255,255,0.4)'
                                : positive
                                ? '#34D399'
                                : '#F59E0B';
                              const sparkColor = !hasBoth
                                ? 'rgba(255,255,255,0.35)'
                                : neutral
                                ? 'rgba(255,255,255,0.35)'
                                : positive
                                ? '#34D399'
                                : '#F59E0B';

                              return (
                                <div
                                  key={e.label}
                                  className="grid items-center gap-3 py-2.5"
                                  style={{
                                    gridTemplateColumns: 'minmax(150px, 1.4fr) 80px auto auto auto',
                                    borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                  }}
                                >
                                  <div className="min-w-0">
                                    <p className="text-[12px] text-white/85 font-medium truncate">{e.label}</p>
                                    <p className="text-[10.5px] text-white/40 leading-snug mt-0.5">{e.description}</p>
                                  </div>
                                  {hasBoth ? (
                                    <MonthlySpark from={e.before as number} to={e.after as number} color={sparkColor} />
                                  ) : onlyBefore ? (
                                    <PendingSpark />
                                  ) : (
                                    <span />
                                  )}
                                  <span className="text-[11px] text-white/40 tabular-nums">
                                    {e.before !== null ? `${e.before.toFixed(e.decimals)}${e.unit}` : '—'}
                                  </span>
                                  <span className="text-[10px] text-white/30">→</span>
                                  <div className="text-right" style={{ minWidth: 72 }}>
                                    <p className="font-heading text-[16px] font-semibold text-white tabular-nums leading-none">
                                      {e.after !== null ? `${e.after.toFixed(e.decimals)}${e.unit}` : '—'}
                                    </p>
                                    <p
                                      className="text-[10px] font-bold tabular-nums mt-1"
                                      style={{ color: onlyBefore ? 'rgba(255,255,255,0.45)' : deltaColor }}
                                    >
                                      {onlyBefore
                                        ? 'Pendiente'
                                        : !hasBoth
                                        ? '—'
                                        : neutral
                                        ? '—'
                                        : `${(e.delta as number) > 0 ? '+' : ''}${(e.delta as number).toFixed(e.decimals)}${e.unit}`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-xs text-kore-gray-dark/50">No hay datos de resumen todavía.</p>
            </div>
          )}

          {monthlySummary && onToggleMobile && (
            <button
              type="button"
              onClick={onToggleMobile}
              aria-expanded={mobileExpanded}
              className="xl:hidden w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-kore-gray-dark/55 hover:text-kore-gray-dark transition-colors active:scale-[0.99]"
            >
              <span>{mobileExpanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-300 ${mobileExpanded ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
