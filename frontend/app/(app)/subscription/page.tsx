'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
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

  const sectionRef = useRef<HTMLElement>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  useHeroAnimation(sectionRef);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

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
        className={`w-full text-left rounded-2xl border px-4 py-4 transition-colors cursor-pointer ${
          isSelected
            ? 'border-kore-red bg-kore-red/5'
            : 'border-kore-gray-light/60 bg-white/60 hover:bg-white/80'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-kore-gray-dark">
              {item.package.title}
            </p>
            <p className="text-xs text-kore-gray-dark/50">
              {item.sessions_used} / {item.sessions_total} usadas
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[item.status] || 'bg-gray-100 text-gray-500'}`}>
            {statusLabel[item.status] || item.status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-kore-gray-dark/50">
          <span>Vence: {formatDate(item.expires_at)}</span>
          <span>Restantes: {item.sessions_remaining}</span>
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
              <div className="max-w-lg">
                <label className="block text-sm font-medium text-kore-gray-dark mb-2">Selecciona tu suscripción</label>
                <select
                  value={selectedSubscriptionId ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value ? Number(event.target.value) : null;
                    setSelectedSubscriptionId(nextValue);
                  }}
                  className="w-full rounded-lg border border-kore-gray-light bg-white/80 px-4 py-3 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/40 cursor-pointer"
                >
                  <option value="" disabled>Selecciona una suscripción</option>
                  {activeSubscriptions.length > 0 && (
                    <optgroup label="Activas">
                      {activeSubscriptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.package.title} — {item.sessions_remaining} sesiones restantes
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {inactiveSubscriptions.length > 0 && (
                    <optgroup label="Inactivas">
                      {inactiveSubscriptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.package.title} — {statusLabel[item.status] || item.status}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

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
                          {detailSubscription.sessions_used} / {detailSubscription.sessions_total} usadas
                        </span>
                      </div>
                      <div className="w-full h-2 bg-kore-gray-light/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-kore-red rounded-full transition-all duration-500"
                          style={{ width: `${(detailSubscription.sessions_remaining / detailSubscription.sessions_total) * 100}%` }}
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
                          {!showCancelConfirm ? (
                            <button
                              disabled={true}
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
                                Se detendrán los cobros recurrentes. Las sesiones restantes se mantendrán hasta el vencimiento.
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
                        <p className="text-sm text-kore-gray-dark/50">
                          Esta suscripción está inactiva, por lo que no requiere acciones.
                        </p>
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
