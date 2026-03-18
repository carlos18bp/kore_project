'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

export default function TrainerDashboardPage() {
  const { user } = useAuthStore();
  const { dashboardStats, statsLoading, fetchDashboardStats } = useTrainerStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  if (!user) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="min-h-screen bg-kore-cream">
      <div className="w-full px-6 md:px-10 lg:px-16 pt-20 xl:pt-8 pb-16">
        {/* Header */}
        <div data-hero="badge" className="mb-8 xl:mb-12">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Panel del entrenador</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            {getGreeting()}, {user.name.split(' ')[0]}
          </h1>
        </div>

        {/* Stats Cards */}
        <div data-hero="heading" className="grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-6 mb-8">
          {/* Total Clients */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium mb-3">Clientes</p>
            <div className="flex items-end gap-2">
              <span className="font-heading text-3xl font-bold text-kore-gray-dark">
                {statsLoading ? '—' : (dashboardStats?.total_clients ?? 0)}
              </span>
              <span className="text-sm text-kore-gray-dark/50 mb-1">activos</span>
            </div>
          </div>

          {/* Today Sessions */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <p className="text-xs text-kore-gray-dark/50 uppercase tracking-widest font-medium mb-3">Sesiones hoy</p>
            <div className="flex items-end gap-2">
              <span className="font-heading text-3xl font-bold text-kore-red">
                {statsLoading ? '—' : (dashboardStats?.today_sessions ?? 0)}
              </span>
              <span className="text-sm text-kore-gray-dark/50 mb-1">programadas</span>
            </div>
          </div>

          {/* Quick Action */}
          <Link
            href="/trainer/clients"
            className="group bg-gradient-to-br from-kore-red to-kore-burgundy rounded-2xl p-6 text-white hover:shadow-lg transition-shadow"
          >
            <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-3">Acceso rápido</p>
            <p className="font-heading text-xl font-semibold mb-1">Ver clientes</p>
            <p className="text-white/70 text-sm">Gestiona tus clientes</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
              <span>Ir al listado</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Upcoming Sessions */}
        <div data-hero="body" className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Próximas sesiones</h2>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
            </div>
          ) : !dashboardStats?.upcoming_sessions?.length ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-kore-cream mx-auto mb-3 flex items-center justify-center">
                <svg className="w-7 h-7 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-sm text-kore-gray-dark/50">No hay sesiones próximas</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-kore-cream/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-kore-red/10 flex items-center justify-center">
                      <span className="font-heading text-sm font-semibold text-kore-red">
                        {session.customer_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-kore-gray-dark truncate">{session.customer_name}</p>
                      <p className="text-xs text-kore-gray-dark/50">{session.package_title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-kore-gray-dark capitalize">{date}</p>
                      <p className="text-xs text-kore-gray-dark/50">{time}</p>
                    </div>
                    <svg className="w-4 h-4 text-kore-gray-dark/30 group-hover:text-kore-red transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
