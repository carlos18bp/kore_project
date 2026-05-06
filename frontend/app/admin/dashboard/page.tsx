'use client';

import { useEffect } from 'react';
import { useAdminSubscriptionStore } from '@/lib/stores/adminSubscriptionStore';

const STATUS_CARDS = [
  { label: 'Total', key: 'total', color: 'text-kore-gray-dark', bg: 'bg-white' },
  { label: 'Activas', key: 'active', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Expiradas', key: 'expired', color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Canceladas', key: 'canceled', color: 'text-rose-600', bg: 'bg-rose-50' },
] as const;

export default function AdminDashboardPage() {
  const { subscriptions, totalCount, loading, fetchSubscriptions } = useAdminSubscriptionStore();

  useEffect(() => {
    fetchSubscriptions({ page: 1, search: '', status: '' });
  }, [fetchSubscriptions]);

  const counts = {
    total: totalCount,
    active: subscriptions.filter((s) => s.status === 'active').length,
    expired: subscriptions.filter((s) => s.status === 'expired').length,
    canceled: subscriptions.filter((s) => s.status === 'canceled').length,
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-6 pt-20 xl:pt-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/40 mb-1">
          Panel de administración
        </p>
        <h1 className="text-2xl font-bold text-kore-gray-dark">Resumen</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_CARDS.map(({ label, key, color, bg }) => (
          <div
            key={key}
            className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/40 mb-2">
              {label}
            </p>
            {loading ? (
              <div className="h-8 w-16 bg-kore-gray-light/30 rounded-lg animate-pulse" />
            ) : (
              <p className={`text-3xl font-black tracking-tight ${color}`}>
                {key === 'total' ? totalCount : counts[key]}
              </p>
            )}
            {key !== 'total' && !loading && (
              <div className={`mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${color}`}>
                {key === 'active' ? 'Activas' : key === 'expired' ? 'Expiradas' : 'Canceladas'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick link */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-kore-gray-dark">Gestión de suscripciones</p>
          <p className="text-xs text-kore-gray-dark/50 mt-0.5">
            Ver, filtrar y editar todas las suscripciones de la plataforma.
          </p>
        </div>
        <a
          href="/admin/subscriptions"
          className="flex-shrink-0 ml-4 bg-kore-red text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-kore-red/90 transition-colors"
        >
          Ver todas
        </a>
      </div>
    </div>
  );
}
