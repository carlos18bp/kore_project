'use client';

import { useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

const goalLabels: Record<string, string> = {
  fat_loss: 'Perder grasa',
  muscle_gain: 'Ganar masa muscular',
  rehab: 'Rehabilitación',
  general_health: 'Salud general',
  sports_performance: 'Rendimiento deportivo',
};

const sexLabels: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  otro: 'Otro',
  prefiero_no_decir: 'Prefiere no decir',
};

export default function TrainerClientDetailWrapper() {
  return (
    <Suspense>
      <TrainerClientDetailPage />
    </Suspense>
  );
}

function TrainerClientDetailPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const clientId = Number(searchParams.get('id'));
  const {
    selectedClient: client,
    clientLoading,
    clientSessions,
    sessionsLoading,
    fetchClientDetail,
    fetchClientSessions,
    error,
  } = useTrainerStore();
  const sectionRef = useRef<HTMLElement>(null);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    if (clientId) {
      fetchClientDetail(clientId);
      fetchClientSessions(clientId);
    }
  }, [clientId, fetchClientDetail, fetchClientSessions]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
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
        {/* Back + Header */}
        <div data-hero="badge" className="mb-8 xl:mb-10">
          <Link
            href="/trainer/clients"
            className="inline-flex items-center gap-1 text-xs text-kore-gray-dark/40 hover:text-kore-red transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Volver a clientes
          </Link>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            {clientLoading ? 'Cargando...' : client ? `${client.first_name} ${client.last_name}` : 'Cliente'}
          </h1>
        </div>

        {error && (
          <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-kore-red">{error}</p>
          </div>
        )}

        {clientLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : client ? (
          <>
          {/* Next session badge */}
          {client.next_session && (() => {
            const d = new Date(client.next_session.starts_at);
            const dateStr = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
            const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
            return (
              <div className="mb-6 bg-gradient-to-r from-kore-red to-kore-burgundy rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-1">Próxima sesión</p>
                    <p className="font-heading text-lg font-semibold capitalize">{dateStr}</p>
                    <p className="text-white/70 text-sm">{timeStr} · {client.next_session.package_title}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Profile + Subscription */}
            <div data-hero="heading" className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Información personal</h2>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-kore-red/20 to-kore-burgundy/10 flex items-center justify-center ring-2 ring-white shadow-sm overflow-hidden">
                    {client.avatar_url ? (
                      <img src={client.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-heading text-xl font-semibold text-kore-red">
                        {client.first_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-kore-gray-dark">{client.first_name} {client.last_name}</p>
                    <p className="text-xs text-kore-gray-dark/40">{client.email}</p>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-kore-gray-light/30">
                  {client.phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Teléfono</span>
                      <span className="font-medium text-kore-gray-dark">{client.phone}</span>
                    </div>
                  )}
                  {client.profile.sex && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Sexo</span>
                      <span className="font-medium text-kore-gray-dark">{sexLabels[client.profile.sex] || client.profile.sex}</span>
                    </div>
                  )}
                  {client.profile.date_of_birth && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Fecha de nacimiento</span>
                      <span className="font-medium text-kore-gray-dark">{formatDate(client.profile.date_of_birth)}</span>
                    </div>
                  )}
                  {client.profile.eps && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">EPS</span>
                      <span className="font-medium text-kore-gray-dark">{client.profile.eps}</span>
                    </div>
                  )}
                  {client.profile.id_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Documento</span>
                      <span className="font-medium text-kore-gray-dark">
                        {({ ti: 'TI', cc: 'CC', ce: 'CE', pasaporte: 'Pasaporte', dni: 'DNI' }[client.profile.id_type] || client.profile.id_type)}
                        {client.profile.id_number ? ` ${client.profile.id_number}` : ''}
                      </span>
                    </div>
                  )}
                  {client.profile.address && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Dirección</span>
                      <span className="font-medium text-kore-gray-dark">{client.profile.address}</span>
                    </div>
                  )}
                  {client.profile.primary_goal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Objetivo</span>
                      <span className="font-medium text-kore-red">{goalLabels[client.profile.primary_goal] || client.profile.primary_goal}</span>
                    </div>
                  )}
                  {client.profile.city && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Ciudad</span>
                      <span className="font-medium text-kore-gray-dark">{client.profile.city}</span>
                    </div>
                  )}
                  {client.profile.kore_start_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Miembro desde</span>
                      <span className="font-medium text-kore-gray-dark">{formatDate(client.profile.kore_start_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscription + Payment Card */}
              {client.subscription ? (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                  <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Suscripción y pago</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Programa</span>
                      <span className="font-medium text-kore-gray-dark">{client.subscription.package_title}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Valor del programa</span>
                      <span className="font-medium text-kore-red">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: client.subscription.package_currency, minimumFractionDigits: 0 }).format(parseFloat(client.subscription.package_price))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Sesiones</span>
                      <span className="font-medium text-kore-gray-dark">
                        {client.subscription.sessions_used} de {client.subscription.sessions_total} completadas
                      </span>
                    </div>
                    <div className="w-full h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-kore-red to-kore-burgundy rounded-full transition-all duration-500"
                        style={{ width: `${(client.subscription.sessions_used / client.subscription.sessions_total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Restantes</span>
                      <span className="font-medium text-green-600">{client.subscription.sessions_remaining} sesiones</span>
                    </div>
                    <div className="h-px bg-kore-gray-light/40 my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Inicio</span>
                      <span className="font-medium text-kore-gray-dark">{formatDate(client.subscription.starts_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Vencimiento</span>
                      <span className="font-medium text-kore-gray-dark">{formatDate(client.subscription.expires_at)}</span>
                    </div>
                    {client.subscription.next_billing_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Próximo cobro</span>
                        <span className="font-medium text-kore-red">{formatDate(client.subscription.next_billing_date)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Cobro automático</span>
                      <span className={`font-medium ${client.subscription.is_recurring ? 'text-green-600' : 'text-kore-gray-dark/50'}`}>
                        {client.subscription.is_recurring ? 'Sí' : 'No'}
                      </span>
                    </div>
                    {client.last_payment && (
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Último pago</span>
                        <span className="font-medium text-kore-gray-dark">
                          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: client.last_payment.currency, minimumFractionDigits: 0 }).format(parseFloat(client.last_payment.amount))}
                          {' · '}
                          {formatDate(client.last_payment.created_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm text-center">
                  <p className="text-sm text-kore-gray-dark/50">Este cliente no tiene una suscripción activa.</p>
                </div>
              )}

              {/* Upcoming Sessions */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Próximas sesiones</h2>
                {(() => {
                  const upcoming = clientSessions.filter(
                    (s) => s.status === 'pending' && s.starts_at && new Date(s.starts_at) > new Date()
                  );
                  return upcoming.length > 0 ? (
                    <div className="space-y-3">
                      {upcoming.map((session) => {
                        const d = new Date(session.starts_at!);
                        const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                        const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                        return (
                          <div key={session.id} className="flex items-center gap-4 p-3 rounded-xl bg-kore-cream/30">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-kore-red/10 flex items-center justify-center">
                              <svg className="w-5 h-5 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-kore-gray-dark capitalize">{dateStr}</p>
                              <p className="text-xs text-kore-gray-dark/50">{session.package_title}</p>
                            </div>
                            <span className="text-sm font-medium text-kore-red">{timeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-kore-gray-dark/50 text-center py-4">Sin sesiones próximas agendadas.</p>
                  );
                })()}
              </div>
            </div>

            {/* Right: Stats + Future Modules */}
            <div data-hero="cta" className="space-y-6">
              {/* Stats Card */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Resumen</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-kore-gray-dark">{client.stats.completed}</p>
                      <p className="text-xs text-kore-gray-dark/50">Sesiones completadas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-kore-gray-dark">{client.stats.pending}</p>
                      <p className="text-xs text-kore-gray-dark/50">Sesiones pendientes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-kore-gray-dark">{client.stats.canceled}</p>
                      <p className="text-xs text-kore-gray-dark/50">Sesiones canceladas</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-3">Módulos</h2>
                <div className="space-y-2">
                  <Link
                    href={`/trainer/clients/client/anthropometry?id=${clientId}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-kore-red/5 hover:bg-kore-red/10 text-kore-gray-dark transition-colors"
                  >
                    <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                    <span className="text-sm font-medium">Antropometría</span>
                    <svg className="w-4 h-4 ml-auto text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-kore-cream/50 text-kore-gray-dark/30">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    <span className="text-sm">Seguimiento</span>
                    <span className="ml-auto text-xs bg-kore-gray-light/40 px-2 py-0.5 rounded-full">Próximamente</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Session History */}
          <div data-hero="body" className="mt-6 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-5">Sesiones completadas</h2>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-kore-red border-t-transparent rounded-full" />
              </div>
            ) : clientSessions.filter(s => s.status === 'confirmed').length === 0 ? (
              <p className="text-sm text-kore-gray-dark/50 text-center py-6">Sin sesiones completadas.</p>
            ) : (
              <div className="space-y-2">
                {clientSessions.filter(s => s.status === 'confirmed').map((session) => {
                  const { date, time } = session.starts_at ? formatDateTime(session.starts_at) : { date: '—', time: '' };
                  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
                    confirmed: { label: 'Completada', bg: 'bg-green-100', text: 'text-green-700' },
                    pending: { label: 'Pendiente', bg: 'bg-amber-100', text: 'text-amber-700' },
                    canceled: { label: 'Cancelada', bg: 'bg-red-100', text: 'text-red-600' },
                  };
                  const sc = statusConfig[session.status] || { label: session.status, bg: 'bg-gray-100', text: 'text-gray-500' };

                  return (
                    <div key={session.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-kore-cream/50 transition-colors">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${sc.bg} flex items-center justify-center`}>
                        {session.status === 'confirmed' ? (
                          <svg className={`w-5 h-5 ${sc.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : session.status === 'canceled' ? (
                          <svg className={`w-5 h-5 ${sc.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className={`w-5 h-5 ${sc.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-kore-gray-dark">{session.package_title}</p>
                        <p className="text-xs text-kore-gray-dark/50 capitalize">{date} {time && `· ${time}`}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                        {sc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
