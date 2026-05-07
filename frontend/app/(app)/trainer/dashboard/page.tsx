'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { ClientRiskScore } from '@/lib/stores/trainerStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import HeroOrbsCard from '@/app/components/shared/HeroOrbsCard';
import SectionLabel from '@/app/components/shared/SectionLabel';
import EmptyState from '@/app/components/shared/EmptyState';
import GlowRing from '@/app/components/shared/GlowRing';
import RiskBadge from '@/app/components/trainer/RiskBadge';

const RISK_DOT: Record<string, string> = {
  alto: 'bg-kore-red',
  medio: 'bg-amber-400',
  bajo: 'bg-green-400',
  sin_riesgo: 'bg-gray-300',
};

const RISK_LABEL: Record<string, string> = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
  sin_riesgo: 'OK',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function topSignalLabel(client: ClientRiskScore): string {
  const all = [...client.behavioral_signals, ...client.clinical_signals];
  if (all.length === 0) return 'Sin señales';
  const sorted = [...all].sort((a, b) => {
    const order = { alto: 0, medio: 1, bajo: 2 } as const;
    return order[a.severity] - order[b.severity];
  });
  return sorted[0].label;
}

export default function TrainerDashboardPage() {
  const { user } = useAuthStore();
  const {
    dashboardStats, statsLoading, fetchDashboardStats,
    riskDashboard, riskDashboardLoading, fetchRiskDashboard,
    comparativeMetrics, comparativeLoading, fetchComparativeMetrics,
  } = useTrainerStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchDashboardStats();
    fetchRiskDashboard();
    fetchComparativeMetrics();
  }, [fetchDashboardStats, fetchRiskDashboard, fetchComparativeMetrics]);

  const totalClients = dashboardStats?.total_clients ?? 0;
  const riskSummary = riskDashboard?.risk_summary;
  const globalAdherence = comparativeMetrics?.global_patterns?.avg_training_adherence ?? null;

  const clientsNeedingAttention = (riskDashboard?.clients_by_risk ?? []).filter(
    (c) => c.level === 'alto' || c.level === 'medio',
  );

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-4 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-24 max-w-2xl xl:max-w-none mx-auto space-y-5">

        {/* Greeting */}
        <div data-hero="badge">
          <SectionLabel className="mb-0.5">Panel del entrenador</SectionLabel>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark">
            {getGreeting()}, {user.name.split(' ')[0]}
          </h1>
        </div>

        {/* Hero — overview */}
        <HeroOrbsCard radius="2xl">
          <div data-hero="heading" className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.18em] mb-1">
                  Clientes activos
                </p>
                <p className="text-5xl font-black tracking-tight text-white leading-none">
                  {statsLoading ? '—' : totalClients}
                </p>
                <p className="text-white/50 text-xs mt-2 leading-relaxed">
                  Tu base actual de clientes en programa.
                </p>
              </div>
              {globalAdherence !== null ? (
                <GlowRing value={globalAdherence * 100} size={96} stroke={9}>
                  <div className="text-center">
                    <p className="text-2xl font-black text-white leading-none tabular-nums">
                      {Math.round(globalAdherence * 100)}
                    </p>
                    <p className="text-[9px] uppercase tracking-wide text-white/50 mt-0.5">
                      Adherencia
                    </p>
                  </div>
                </GlowRing>
              ) : (
                <div className="w-[96px] h-[96px] rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  {comparativeLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="text-white/30 text-[10px] text-center">Sin datos</span>
                  )}
                </div>
              )}
            </div>

            {riskSummary && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                {(['alto', 'medio', 'bajo', 'sin_riesgo'] as const).map((key) => {
                  const count = riskSummary[key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Link
                      key={key}
                      href={key === 'alto' || key === 'medio' ? `/trainer/alerts` : `/trainer/clients`}
                      prefetch={false}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[key]}`} />
                      <span className="text-white/85 text-xs font-medium">
                        {count} {RISK_LABEL[key]}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </HeroOrbsCard>

        {/* Clientes que requieren atención hoy */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <SectionLabel className="mb-0.5">Triage</SectionLabel>
              <h2 className="text-lg font-bold text-kore-gray-dark">Atención hoy</h2>
            </div>
            {clientsNeedingAttention.length > 0 && (
              <span className="text-xs font-semibold text-kore-red bg-kore-red/10 px-2.5 py-1 rounded-full">
                {clientsNeedingAttention.length}
              </span>
            )}
          </div>

          {riskDashboardLoading && clientsNeedingAttention.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          ) : clientsNeedingAttention.length === 0 ? (
            <EmptyState
              size="sm"
              title="Todo bajo control"
              description="Ningún cliente está en riesgo alto o medio en este momento."
            />
          ) : (
            <div className="px-3 pb-3 space-y-0.5">
              {clientsNeedingAttention.map((client) => (
                <Link
                  key={client.id}
                  href={`/trainer/clients/client?id=${client.customer_id}`}
                  prefetch={false}
                  className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-kore-cream/60 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center ring-2 ring-white shadow-sm flex-shrink-0 overflow-hidden">
                    {client.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-kore-red">
                        {client.customer_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-kore-gray-dark truncate">{client.customer_name}</p>
                      <RiskBadge level={client.level} size="sm" />
                    </div>
                    <p className="text-xs text-kore-gray-dark/50 truncate">
                      {client.signals_count} señal{client.signals_count !== 1 ? 'es' : ''} · {topSignalLabel(client)}
                    </p>
                  </div>
                  {client.kore_score !== null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-kore-gray-dark/40">KORE</p>
                      <p className="text-sm font-bold text-kore-gray-dark tabular-nums">
                        {Math.round(client.kore_score)}
                      </p>
                    </div>
                  )}
                  <svg className="w-4 h-4 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div data-hero="body" className="space-y-2">
          <SectionLabel>Acceso rápido</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/trainer/alerts"
              prefetch={false}
              className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm flex items-center gap-3 active:scale-95 transition-transform duration-100 hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-kore-gray-dark">Alertas</p>
                {riskSummary?.alto ? (
                  <p className="text-xs text-kore-red font-medium">{riskSummary.alto} alto riesgo</p>
                ) : (
                  <p className="text-xs text-kore-gray-dark/40">Centro de alertas</p>
                )}
              </div>
            </Link>

            <Link
              href="/trainer/evidence"
              prefetch={false}
              className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm flex items-center gap-3 active:scale-95 transition-transform duration-100 hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-kore-gray-dark">Evidencia</p>
                <p className="text-xs text-kore-gray-dark/40">Fotos de comidas</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <SectionLabel className="mb-0.5">Agenda</SectionLabel>
              <h2 className="text-lg font-bold text-kore-gray-dark">Próximas sesiones</h2>
            </div>
            {dashboardStats?.today_sessions ? (
              <span className="text-xs font-semibold text-kore-red bg-kore-red/10 px-2.5 py-1 rounded-full">
                {dashboardStats.today_sessions} hoy
              </span>
            ) : null}
          </div>

          {statsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          ) : !dashboardStats?.upcoming_sessions?.length ? (
            <EmptyState
              size="sm"
              title="No hay sesiones próximas"
              description="Cuando un cliente reserve una sesión, aparecerá aquí."
            />
          ) : (
            <div className="px-3 pb-3 space-y-0.5">
              {dashboardStats.upcoming_sessions.map((session) => {
                const date = new Date(session.starts_at).toLocaleDateString('es-CO', {
                  weekday: 'short', day: 'numeric', month: 'short',
                });
                const time = new Date(session.starts_at).toLocaleTimeString('es-CO', {
                  hour: '2-digit', minute: '2-digit', hour12: true,
                });
                return (
                  <Link
                    key={session.id}
                    href={`/trainer/clients/client?id=${session.customer_id}`}
                    prefetch={false}
                    className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-kore-cream/60 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-kore-red">
                        {session.customer_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-kore-gray-dark truncate">{session.customer_name}</p>
                      <p className="text-xs text-kore-gray-dark/40 truncate">{session.package_title}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-kore-gray-dark capitalize">{date}</p>
                      <p className="text-xs text-kore-gray-dark/40">{time}</p>
                    </div>
                    <svg className="w-4 h-4 text-kore-gray-dark/20 group-hover:text-kore-red transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Clients link */}
        <Link
          href="/trainer/clients"
          prefetch={false}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm text-kore-gray-dark/60 text-sm font-medium active:scale-95 transition-transform duration-100 hover:text-kore-gray-dark hover:shadow-md"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          Ver todos los clientes
        </Link>

      </div>
    </section>
  );
}
