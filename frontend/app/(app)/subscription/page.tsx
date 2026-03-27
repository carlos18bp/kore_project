'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';
import { WHATSAPP_URL } from '@/lib/constants';

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const {
    subscriptions,
    activeSubscription,
    selectedSubscriptionId,
    payments,
    loading,
    actionLoading,
    error,
    fetchSubscriptions,
    setSelectedSubscriptionId,
    cancelSubscription,
    fetchPaymentHistory,
  } = useSubscriptionStore();

  const { bookings, fetchBookings } = useBookingStore();
  const sectionRef = useRef<HTMLElement>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [sessionTab, setSessionTab] = useState<'upcoming' | 'past'>('upcoming');
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchSubscriptions();
    fetchBookings();
  }, [fetchSubscriptions, fetchBookings]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((item) => item.status === 'active'),
    [subscriptions]
  );
  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter((item) => item.status === 'expired' || item.status === 'canceled'),
    [subscriptions]
  );
  const selectedSubscription = useMemo(() => {
    if (!selectedSubscriptionId) {
      return null;
    }
    return subscriptions.find((item) => item.id === selectedSubscriptionId) ?? null;
  }, [selectedSubscriptionId, subscriptions]);

  useEffect(() => {
    if (subscriptions.length === 0) {
      setSelectedSubscriptionId(null);
      return;
    }
    const selectedStillExists = selectedSubscriptionId
      ? subscriptions.some((item) => item.id === selectedSubscriptionId)
      : false;
    if (selectedStillExists) {
      return;
    }
    const fallback = activeSubscriptions[0] ?? inactiveSubscriptions[0];
    setSelectedSubscriptionId(fallback?.id ?? null);
  }, [activeSubscriptions, inactiveSubscriptions, selectedSubscriptionId, subscriptions, setSelectedSubscriptionId]);

  useEffect(() => {
    if (selectedSubscription) {
      fetchPaymentHistory(selectedSubscription.id);
      setShowCancelConfirm(false);
    }
  }, [selectedSubscription, fetchPaymentHistory]);

  const formatPrice = (price: string, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const statusLabel: Record<string, string> = {
    active: 'Activa',
    expired: 'Expirada',
    canceled: 'Cancelada',
  };

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-500',
    canceled: 'bg-red-100 text-red-600',
  };

  const hasSubscriptions = subscriptions.length > 0;
  const detailSubscription = selectedSubscription ?? activeSubscription ?? null;

  const renderSubscriptionCard = (item: (typeof subscriptions)[number]) => {
    const isSelected = detailSubscription?.id === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setSelectedSubscriptionId(item.id)}
        className={`w-full text-left rounded-2xl border px-4 py-4 transition-all cursor-pointer ${
          isSelected
            ? 'border-kore-gray-dark/30 bg-white shadow-md ring-2 ring-kore-gray-dark/10'
            : 'border-kore-gray-light/60 bg-white/60 hover:bg-white/80 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-kore-gray-dark">
              {item.package.title}
            </p>
            <p className="text-xs text-kore-gray-dark/50">
              {item.sessions_used} de {item.sessions_total} completadas
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[item.status] || 'bg-gray-100 text-gray-500'}`}>
            {statusLabel[item.status] || item.status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-kore-gray-dark/50">
          <span>Vence: {formatDate(item.expires_at)}</span>
          <span>Avance: {Math.round((item.sessions_used / item.sessions_total) * 100)}%</span>
        </div>
      </button>
    );
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
        <div data-hero="badge" className="mb-12">
          <p className="text-xs text-kore-gray-dark/40 uppercase tracking-widest mb-1">Mi cuenta</p>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-kore-gray-dark">
            Mi Suscripción
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-kore-red">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin h-8 w-8 border-2 border-kore-red border-t-transparent rounded-full" />
          </div>
        ) : !hasSubscriptions ? (
          /* No subscription */
          <div data-hero="heading" className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-kore-gray-light/50 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-kore-cream flex items-center justify-center">
              <svg className="w-8 h-8 text-kore-gray-dark/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-semibold text-kore-gray-dark mb-2">
              Sin suscripción activa
            </h2>
            <p className="text-sm text-kore-gray-dark/50 mb-6">
              Explora nuestros programas y comienza tu transformación.
            </p>
            <Link
              href="/programs"
              className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm cursor-pointer"
            >
              Ver programas
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Activas</h2>
                    <span className="text-xs text-kore-gray-dark/40">{activeSubscriptions.length} programas</span>
                  </div>
                  {activeSubscriptions.length === 0 ? (
                    <p className="text-sm text-kore-gray-dark/50">No tienes suscripciones activas por ahora.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeSubscriptions.map(renderSubscriptionCard)}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Inactivas</h2>
                    <span className="text-xs text-kore-gray-dark/40">{inactiveSubscriptions.length} programas</span>
                  </div>
                  {inactiveSubscriptions.length === 0 ? (
                    <p className="text-sm text-kore-gray-dark/50">Aún no tienes historial de programas inactivos.</p>
                  ) : (
                    <div className="space-y-3">
                      {inactiveSubscriptions.map(renderSubscriptionCard)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {detailSubscription && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Subscription details */}
                <div data-hero="heading" className="lg:col-span-2 space-y-6">
                  {/* Subscription Card */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Detalles</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[detailSubscription.status] || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[detailSubscription.status] || detailSubscription.status}
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Programa</span>
                        <span className="font-medium text-kore-gray-dark">{detailSubscription.package.title}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Sesiones</span>
                        <span className="font-medium text-kore-gray-dark">
                          {detailSubscription.sessions_used} de {detailSubscription.sessions_total} completadas
                        </span>
                      </div>
                      <div className="w-full h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-kore-red to-kore-burgundy rounded-full transition-all duration-500"
                          style={{ width: `${(detailSubscription.sessions_used / detailSubscription.sessions_total) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Precio</span>
                        <span className="font-medium text-kore-gray-dark">
                          {formatPrice(detailSubscription.package.price, detailSubscription.package.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Inicio</span>
                        <span className="font-medium text-kore-gray-dark">{formatDate(detailSubscription.starts_at)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-kore-gray-dark/50">Vencimiento</span>
                        <span className="font-medium text-kore-gray-dark">{formatDate(detailSubscription.expires_at)}</span>
                      </div>
                      {detailSubscription.next_billing_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-kore-gray-dark/50">Próximo cobro</span>
                          <span className="font-medium text-kore-red">{formatDate(detailSubscription.next_billing_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sessions for this subscription */}
                  {(() => {
                    const subId = detailSubscription.id;
                    const now = new Date();
                    const subBookings = bookings.filter(b => b.subscription_id_display === subId);
                    const upcoming = subBookings.filter(b => b.status === 'pending' && new Date(b.slot.starts_at) > now).sort((a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime());
                    const past = subBookings.filter(b => b.status === 'confirmed' || (b.status === 'pending' && new Date(b.slot.starts_at) <= now)).sort((a, b) => new Date(b.slot.starts_at).getTime() - new Date(a.slot.starts_at).getTime());
                    const displayed = sessionTab === 'upcoming' ? upcoming : past;

                    return (
                      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Mis sesiones</h2>
                          <Link href="/book-session" className="text-xs text-kore-red font-medium hover:underline">Agendar</Link>
                        </div>
                        {/* Tabs */}
                        <div className="flex gap-1 mb-4 bg-kore-cream/50 rounded-lg p-1">
                          <button onClick={() => setSessionTab('upcoming')} className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer ${sessionTab === 'upcoming' ? 'bg-white text-kore-gray-dark shadow-sm' : 'text-kore-gray-dark/40 hover:text-kore-gray-dark/60'}`}>
                            Próximas ({upcoming.length})
                          </button>
                          <button onClick={() => setSessionTab('past')} className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors cursor-pointer ${sessionTab === 'past' ? 'bg-white text-kore-gray-dark shadow-sm' : 'text-kore-gray-dark/40 hover:text-kore-gray-dark/60'}`}>
                            Pasadas ({past.length})
                          </button>
                        </div>
                        {displayed.length === 0 ? (
                          <p className="text-sm text-kore-gray-dark/40 py-4 text-center">
                            {sessionTab === 'upcoming' ? 'No tienes sesiones próximas' : 'Aún no tienes sesiones completadas'}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {displayed.slice(0, 5).map((booking) => {
                              const d = new Date(booking.slot.starts_at);
                              const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                              const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                              const trainerName = booking.trainer ? `${booking.trainer.first_name} ${booking.trainer.last_name}` : '';
                              return (
                                <div key={booking.id} className="flex items-center gap-3 py-2.5 border-b border-kore-gray-light/20 last:border-0">
                                  <div className="w-8 h-8 rounded-full bg-kore-red/10 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-kore-gray-dark capitalize">{dateStr} <span className="text-kore-red">· {timeStr}</span></p>
                                    {trainerName && <p className="text-xs text-kore-gray-dark/40">{trainerName}</p>}
                                  </div>
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                    {booking.status === 'confirmed' ? 'Confirmada' : booking.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                                  </span>
                                </div>
                              );
                            })}
                            {displayed.length > 5 && (
                              <p className="text-xs text-kore-gray-dark/40 text-center pt-2">{displayed.length - 5} sesiones más</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Payment History */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                    <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Historial de pagos</h2>
                    {payments.length === 0 ? (
                      <p className="text-sm text-kore-gray-dark/40 py-4 text-center">Sin pagos registrados</p>
                    ) : (
                      <div className="space-y-3">
                        {payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-3 border-b border-kore-gray-light/30 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-kore-gray-dark">
                                {formatPrice(p.amount, p.currency)}
                              </p>
                              <p className="text-xs text-kore-gray-dark/40">{formatDate(p.created_at)}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              p.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                              p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {p.status === 'confirmed' ? 'Confirmado' : p.status === 'pending' ? 'Pendiente' : 'Fallido'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div data-hero="cta" className="space-y-6">
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                    <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-4">Acciones</h2>
                    <div className="space-y-3">
                      {detailSubscription.status === 'active' && (
                        <>
                          {/* Renew button - billing failed: always enabled */}
                          {detailSubscription.billing_failed_at && (
                            <Link
                              href={`/checkout?package=${detailSubscription.package.id}`}
                              className="w-full flex items-center justify-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3 rounded-lg transition-colors text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              Actualizar pago
                            </Link>
                          )}

                          {/* Renew button - non-recurring: enabled only 7 days before expiry */}
                          {!detailSubscription.is_recurring && !detailSubscription.billing_failed_at && (() => {
                            const expiresAt = new Date(detailSubscription.expires_at);
                            const now = new Date();
                            const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            const canRenew = daysLeft <= 7;
                            const renewUrl = `/checkout?package=${detailSubscription.package.id}`;

                            if (canRenew) {
                              return (
                                <Link
                                  href={renewUrl}
                                  className="w-full flex items-center justify-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3 rounded-lg transition-colors text-sm"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                  </svg>
                                  Renovar suscripción
                                </Link>
                              );
                            }

                            return (
                              <div className="relative group">
                                <button
                                  type="button"
                                  disabled
                                  className="w-full flex items-center justify-center gap-2 bg-kore-gray-light/60 text-kore-gray-dark/40 font-medium py-3 rounded-lg text-sm cursor-not-allowed"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                  </svg>
                                  Renovar suscripción
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-kore-gray-dark text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
                                  Se habilitará 7 días antes del vencimiento (faltan {daysLeft} días)
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-kore-gray-dark" />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Billing failed alert */}
                          {detailSubscription.billing_failed_at && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-xs text-red-700">
                                No pudimos procesar tu último cobro automático. Actualiza tu método de pago para mantener tu suscripción.
                              </p>
                            </div>
                          )}

                          {/* Auto-renewal info */}
                          {detailSubscription.is_recurring && !detailSubscription.billing_failed_at && detailSubscription.next_billing_date && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="text-xs text-green-700">
                                Tu suscripción se renovará automáticamente el {formatDate(detailSubscription.next_billing_date)}.
                              </p>
                            </div>
                          )}

                          {!showCancelConfirm ? (
                            <button
                              onClick={() => setShowCancelConfirm(true)}
                              className="w-full flex items-center justify-center gap-2 bg-kore-red/5 hover:bg-kore-red/10 text-kore-red font-medium py-3 rounded-lg transition-colors text-sm cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancelar suscripción
                            </button>
                          ) : (
                            <div className="bg-kore-red/5 border border-kore-red/20 rounded-lg p-4 space-y-3">
                              <p className="text-sm text-kore-red font-medium">
                                ¿Seguro que deseas cancelar?
                              </p>
                              <p className="text-xs text-kore-gray-dark/50">
                                {detailSubscription.is_recurring
                                  ? 'Se detendrán los cobros automáticos. Podrás usar tus sesiones restantes hasta el vencimiento.'
                                  : `Podrás seguir usando tus ${detailSubscription.sessions_remaining} sesiones restantes hasta el ${formatDate(detailSubscription.expires_at)}.`
                                }
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    await cancelSubscription(detailSubscription.id);
                                    setShowCancelConfirm(false);
                                  }}
                                  disabled={actionLoading}
                                  className="flex-1 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60 cursor-pointer"
                                >
                                  {actionLoading ? 'Cancelando...' : 'Sí, cancelar'}
                                </button>
                                <button
                                  onClick={() => setShowCancelConfirm(false)}
                                  className="flex-1 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark font-medium py-2.5 rounded-lg transition-colors text-sm cursor-pointer"
                                >
                                  No, volver
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {detailSubscription.status !== 'active' && (
                        <>
                          <Link
                            href={`/checkout?package=${detailSubscription.package.id}`}
                            className="w-full flex items-center justify-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-3 rounded-lg transition-colors text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Renovar este programa
                          </Link>
                          <p className="text-xs text-kore-gray-dark/50 text-center">
                            O explora otros programas en nuestra <Link href="/programs" className="text-kore-red hover:underline">página de programas</Link>.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Help card */}
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                    <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-2">¿Necesitas ayuda?</h2>
                    <p className="text-sm text-kore-gray-dark/50 mb-4">
                      Escríbenos para resolver dudas sobre tu suscripción.
                    </p>
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark/70 font-medium py-3 rounded-lg transition-colors duration-200 text-sm cursor-pointer"
                    >
                      Escribir por WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
