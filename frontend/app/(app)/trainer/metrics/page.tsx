'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import GlowRing from '@/app/components/shared/GlowRing';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import TrainerEngagementView from '@/app/components/trainer/TrainerEngagementView';

// Fase 3 — la vista de Métricas no está lista para este release. La lógica
// queda intacta; para reactivarla, poner PHASE_3_READY = true.
const PHASE_3_READY: boolean = false;

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};

const MODULE_PATH: Record<string, string> = {
  anthropometry: 'anthropometry',
  posturometry: 'posturometry',
  physical: 'physical-evaluation',
  parq: 'parq',
  nutrition: 'nutrition',
};

const URGENCY_COLORS: Record<string, string> = {
  critical: 'text-kore-red bg-kore-red/10',
  high: 'text-amber-700 bg-amber-100',
  medium: 'text-yellow-700 bg-yellow-100',
  low: 'text-green-700 bg-green-100',
};

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span className={`text-xs font-semibold ${positive ? 'text-green-600' : 'text-kore-red'}`}>
      {positive ? '+' : ''}{Math.round(delta * 100)}%
    </span>
  );
}

export default function TrainerMetricsPage() {
  const { comparativeMetrics, comparativeLoading, fetchComparativeMetrics } = useTrainerStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    if (PHASE_3_READY) fetchComparativeMetrics();
  }, [fetchComparativeMetrics]);

  if (!PHASE_3_READY) return <TrainerEngagementView />;

  const gp = comparativeMetrics?.global_patterns;
  const trainAdh = gp?.avg_training_adherence ?? 0;
  const nutritionAdh = gp?.avg_nutrition_adherence ?? 0;
  const missedDay = gp?.most_missed_day_of_week;

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">

        {/* Header */}
        <div data-hero="badge">
          <SectionLabel className="mb-0.5">Inteligencia</SectionLabel>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">Métricas Comparativas</h1>
        </div>

        {comparativeLoading && !comparativeMetrics ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-7 w-7 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : !comparativeMetrics ? (
          <EmptyState
            title="Sin datos comparativos"
            description="Cuando tengas clientes con actividad reciente, aquí verás patrones globales y rankings."
          />
        ) : (
          <>
            {/* Global adherence hero */}
            <HeroOrbsCard radius="2xl">
              <div data-hero="heading" className="p-6">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.18em] mb-4">
                  Adherencia global de tu base
                </p>
                <div className="flex items-center justify-around gap-4">
                  <GlowRing value={trainAdh * 100} size={104} stroke={9}>
                    <div className="text-center">
                      <p className="text-2xl font-black text-white leading-none tabular-nums">
                        {Math.round(trainAdh * 100)}%
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-white/55 mt-0.5">Entreno</p>
                    </div>
                  </GlowRing>
                  <GlowRing
                    value={nutritionAdh * 100}
                    size={104}
                    stroke={9}
                    gradientFrom="#34D399"
                    gradientTo="#059669"
                    glowColor="rgba(5,150,105,0.5)"
                  >
                    <div className="text-center">
                      <p className="text-2xl font-black text-white leading-none tabular-nums">
                        {Math.round(nutritionAdh * 100)}%
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-white/55 mt-0.5">Nutrición</p>
                    </div>
                  </GlowRing>
                  {missedDay && (
                    <div className="text-center">
                      <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wide mb-1">
                        Día más fallado
                      </p>
                      <p className="text-white text-lg font-black">{DAY_LABELS[missedDay] ?? missedDay}</p>
                    </div>
                  )}
                </div>
              </div>
            </HeroOrbsCard>

            {/* Adherence ranking */}
            {comparativeMetrics.adherence_ranking.length > 0 && (
              <div data-hero="body" className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm">
                <div className="px-5 pt-5 pb-3">
                  <SectionLabel className="mb-0.5">Esta semana</SectionLabel>
                  <h2 className="text-base font-bold text-kore-gray-dark">Ranking de adherencia</h2>
                </div>
                <div className="px-3 pb-3 space-y-0.5">
                  {comparativeMetrics.adherence_ranking.map((client, index) => (
                    <Link
                      key={client.customer_id}
                      href={`/trainer/clients/client?id=${client.customer_id}`}
                      prefetch={false}
                      className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-kore-cream/60 transition-colors group"
                    >
                      <span className="w-6 text-xs font-bold text-kore-gray-dark/30 text-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-kore-red">
                          {client.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-kore-gray-dark truncate">{client.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-20 h-1.5 rounded-full bg-kore-gray-light/30">
                            <div
                              className="h-full rounded-full bg-kore-red transition-all duration-700"
                              style={{ width: `${Math.round(client.combined_7d * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-kore-gray-dark/50">{Math.round(client.combined_7d * 100)}%</span>
                        </div>
                      </div>
                      <DeltaBadge delta={client.delta_vs_last_week} />
                      <svg className="w-4 h-4 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Improved / Worsened */}
            {(comparativeMetrics.improved_this_week.length > 0 || comparativeMetrics.worsened_this_week.length > 0) && (
              <div className="space-y-2">
                <SectionLabel>Cambios semanales</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600 mb-3">Mejoraron</p>
                    {comparativeMetrics.improved_this_week.length === 0 ? (
                      <p className="text-xs text-kore-gray-dark/40">Ninguno esta semana</p>
                    ) : (
                      <div className="space-y-2">
                        {comparativeMetrics.improved_this_week.slice(0, 5).map((c) => (
                          <div key={c.customer_id} className="flex items-center justify-between gap-1">
                            <span className="text-xs text-kore-gray-dark truncate">{c.name.split(' ')[0]}</span>
                            <DeltaBadge delta={c.delta} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-kore-red mb-3">Empeoraron</p>
                    {comparativeMetrics.worsened_this_week.length === 0 ? (
                      <p className="text-xs text-kore-gray-dark/40">Ninguno esta semana</p>
                    ) : (
                      <div className="space-y-2">
                        {comparativeMetrics.worsened_this_week.slice(0, 5).map((c) => (
                          <div key={c.customer_id} className="flex items-center justify-between gap-1">
                            <span className="text-xs text-kore-gray-dark truncate">{c.name.split(' ')[0]}</span>
                            <DeltaBadge delta={c.delta} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Most failed exercises and meals */}
            {((comparativeMetrics.most_failed_exercises?.length ?? 0) > 0 ||
              (comparativeMetrics.most_failed_meal_blocks?.length ?? 0) > 0) && (
              <div className="space-y-2">
                <SectionLabel>Patrones de incumplimiento (7d)</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-kore-red mb-3">
                      Ejercicios más saltados
                    </p>
                    {(comparativeMetrics.most_failed_exercises?.length ?? 0) === 0 ? (
                      <p className="text-xs text-kore-gray-dark/40">Ninguno saltado esta semana</p>
                    ) : (
                      <div className="space-y-2">
                        {comparativeMetrics.most_failed_exercises!.slice(0, 5).map((ex) => (
                          <div key={ex.name} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-kore-gray-dark truncate flex-1">{ex.name}</span>
                            <span className="text-xs font-bold text-kore-red bg-kore-red/10 px-2 py-0.5 rounded-full tabular-nums">
                              {ex.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-3">
                      Comidas más saltadas
                    </p>
                    {(comparativeMetrics.most_failed_meal_blocks?.length ?? 0) === 0 ? (
                      <p className="text-xs text-kore-gray-dark/40">Ninguna saltada esta semana</p>
                    ) : (
                      <div className="space-y-2">
                        {comparativeMetrics.most_failed_meal_blocks!.slice(0, 5).map((m) => (
                          <div key={m.block} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-kore-gray-dark truncate flex-1">{m.block_label}</span>
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full tabular-nums">
                              {m.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Expired evaluations */}
            {comparativeMetrics.expired_evaluations.length > 0 && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm">
                <div className="px-5 pt-5 pb-3">
                  <SectionLabel className="mb-0.5">Acción requerida</SectionLabel>
                  <h2 className="text-base font-bold text-kore-gray-dark">Evaluaciones vencidas</h2>
                </div>
                <div className="px-3 pb-3 space-y-0.5">
                  {comparativeMetrics.expired_evaluations.map((ev, i) => {
                    const modulePath = MODULE_PATH[ev.module] ?? null;
                    const href = modulePath
                      ? `/trainer/clients/client/${modulePath}?id=${ev.customer_id}`
                      : `/trainer/clients/client?id=${ev.customer_id}`;
                    return (
                      <Link
                        key={i}
                        href={href}
                        prefetch={false}
                        className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-kore-cream/60 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-kore-gray-dark truncate">{ev.name}</p>
                          <p className="text-xs text-kore-gray-dark/40">{ev.module_label} · {ev.days_since}d vencida</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${URGENCY_COLORS[ev.urgency] ?? URGENCY_COLORS.medium}`}>
                          {ev.urgency === 'critical' ? 'Crítico' : ev.urgency === 'high' ? 'Alto' : ev.urgency === 'medium' ? 'Medio' : 'Bajo'}
                        </span>
                        <svg className="w-4 h-4 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </section>
  );
}
