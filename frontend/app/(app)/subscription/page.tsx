'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useHeroAnimation } from '@/app/composables/useScrollAnimations';

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const {
    activeSubscription: sub,
    payments,
    loading,
    actionLoading,
    error,
    fetchSubscriptions,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
    fetchPaymentHistory,
  } = useSubscriptionStore();

  const sectionRef = useRef<HTMLElement>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    if (sub) {
      fetchPaymentHistory(sub.id);
    }
  }, [sub, fetchPaymentHistory]);

  const formatPrice = (price: string, currency: string) => {
    return new Intl.NumberFormat('es-CO', {
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
    paused: 'Pausada',
    expired: 'Expirada',
    canceled: 'Cancelada',
  };

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-gray-100 text-gray-500',
    canceled: 'bg-red-100 text-red-600',
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
      <div className="w-full px-6 md:px-10 lg:px-16 pt-8 pb-16">
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
        ) : !sub ? (
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
              href="/programas"
              className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Ver programas
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        ) : (
          /* Active/Paused subscription */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Subscription details */}
            <div data-hero="heading" className="lg:col-span-2 space-y-6">
              {/* Subscription Card */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-kore-gray-light/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading text-lg font-semibold text-kore-gray-dark">Detalles</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[sub.status] || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[sub.status] || sub.status}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Programa</span>
                    <span className="font-medium text-kore-gray-dark">{sub.package.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Sesiones</span>
                    <span className="font-medium text-kore-gray-dark">
                      {sub.sessions_used} / {sub.sessions_total} usadas
                    </span>
                  </div>
                  <div className="w-full h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-kore-red rounded-full transition-all duration-500"
                      style={{ width: `${(sub.sessions_remaining / sub.sessions_total) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Precio</span>
                    <span className="font-medium text-kore-gray-dark">
                      {formatPrice(sub.package.price, sub.package.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Inicio</span>
                    <span className="font-medium text-kore-gray-dark">{formatDate(sub.starts_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kore-gray-dark/50">Vencimiento</span>
                    <span className="font-medium text-kore-gray-dark">{formatDate(sub.expires_at)}</span>
                  </div>
                  {sub.next_billing_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Próximo cobro</span>
                      <span className="font-medium text-kore-red">{formatDate(sub.next_billing_date)}</span>
                    </div>
                  )}
                  {sub.paused_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-kore-gray-dark/50">Pausada desde</span>
                      <span className="font-medium text-yellow-600">{formatDate(sub.paused_at)}</span>
                    </div>
                  )}
                </div>
              </div>

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
                  {sub.status === 'active' && (
                    <button
                      onClick={() => pauseSubscription(sub.id)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium py-3 rounded-lg transition-colors text-sm disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                      Pausar suscripción
                    </button>
                  )}
                  {sub.status === 'paused' && (
                    <button
                      onClick={() => resumeSubscription(sub.id)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-medium py-3 rounded-lg transition-colors text-sm disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      Reanudar suscripción
                    </button>
                  )}
                  {(sub.status === 'active' || sub.status === 'paused') && (
                    <>
                      {!showCancelConfirm ? (
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 bg-kore-red/5 hover:bg-kore-red/10 text-kore-red font-medium py-3 rounded-lg transition-colors text-sm"
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
                            Se detendrán los cobros recurrentes. Las sesiones restantes se mantendrán hasta el vencimiento.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                await cancelSubscription(sub.id);
                                setShowCancelConfirm(false);
                              }}
                              disabled={actionLoading}
                              className="flex-1 bg-kore-red hover:bg-kore-red-dark text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-60"
                            >
                              {actionLoading ? 'Cancelando...' : 'Sí, cancelar'}
                            </button>
                            <button
                              onClick={() => setShowCancelConfirm(false)}
                              className="flex-1 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark font-medium py-2.5 rounded-lg transition-colors text-sm"
                            >
                              No, volver
                            </button>
                          </div>
                        </div>
                      )}
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
                  href="https://wa.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-kore-cream hover:bg-kore-gray-light/60 text-kore-gray-dark/70 font-medium py-3 rounded-lg transition-colors duration-200 text-sm"
                >
                  Escribir por WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
