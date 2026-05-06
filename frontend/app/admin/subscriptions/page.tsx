'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminSubscriptionStore, type AdminSubscription } from '@/lib/stores/adminSubscriptionStore';

const STATUS_OPTIONS = [
  { label: 'Todas', value: '' },
  { label: 'Activas', value: 'active' },
  { label: 'Expiradas', value: 'expired' },
  { label: 'Canceladas', value: 'canceled' },
];

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  canceled: 'bg-rose-100 text-rose-700',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  expired: 'Expirada',
  canceled: 'Cancelada',
};

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const { subscriptions, totalCount, filters, loading, fetchSubscriptions, setFilters } =
    useAdminSubscriptionStore();

  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    fetchSubscriptions({ page: 1 });
  }, [fetchSubscriptions]);

  const handleSearch = () => {
    fetchSubscriptions({ search: searchInput, page: 1 });
  };

  const handleStatusFilter = (value: string) => {
    fetchSubscriptions({ status: value, page: 1 });
  };

  const handlePage = (next: number) => {
    fetchSubscriptions({ page: next });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-5 pt-20 xl:pt-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/40 mb-1">
          Panel de administración
        </p>
        <h1 className="text-2xl font-bold text-kore-gray-dark">Suscripciones</h1>
      </div>

      {/* Filter bar */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="flex gap-2 flex-1 min-w-48">
          <input
            type="text"
            placeholder="Buscar por email o nombre…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 rounded-xl border border-kore-gray-light/40 px-3 py-2 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20"
          />
          <button
            onClick={handleSearch}
            className="bg-kore-red text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-kore-red/90 transition-colors"
          >
            Buscar
          </button>
        </div>

        {/* Status pills */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setFilters({ status: opt.value });
                handleStatusFilter(opt.value);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filters.status === opt.value
                  ? 'bg-kore-red text-white'
                  : 'bg-white border border-kore-gray-light/40 text-kore-gray-dark/60 hover:border-kore-red/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-kore-gray-light/40 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-x-4 px-4 py-3 bg-kore-cream">
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50">#</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50">Cliente</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50">Paquete</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50">Estado</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50">Sesiones</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50">Vence</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/50"></span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="px-4 py-12 text-center">
            <div className="inline-block w-5 h-5 border-2 border-kore-red border-t-transparent rounded-full animate-spin" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-kore-gray-dark/40">
            No hay suscripciones que coincidan con los filtros.
          </div>
        ) : (
          subscriptions.map((sub: AdminSubscription) => (
            <div
              key={sub.id}
              className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-x-4 px-4 py-3 border-t border-kore-gray-light/20 hover:bg-kore-cream/50 transition-colors items-center"
            >
              <span className="text-xs text-kore-gray-dark/40 font-mono">{sub.id}</span>

              <div className="min-w-0">
                <p className="text-sm font-medium text-kore-gray-dark truncate">{sub.customer_name}</p>
                <p className="text-xs text-kore-gray-dark/40 truncate">{sub.customer_email}</p>
              </div>

              <p className="text-sm text-kore-gray-dark/80 truncate">{sub.package.title}</p>

              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_PILL[sub.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {STATUS_LABEL[sub.status] ?? sub.status}
              </span>

              <span className="text-sm text-kore-gray-dark/60 whitespace-nowrap">
                {sub.sessions_used}/{sub.sessions_total}
              </span>

              <span className="text-xs text-kore-gray-dark/50 whitespace-nowrap">
                {formatDate(sub.expires_at)}
              </span>

              <button
                onClick={() => router.push(`/admin/subscriptions/${sub.id}`)}
                className="text-xs font-medium text-kore-red hover:underline whitespace-nowrap"
              >
                Ver →
              </button>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-kore-gray-dark/40">
            {totalCount} suscripciones · Página {filters.page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => handlePage(filters.page - 1)}
              className="px-3 py-1.5 rounded-xl text-sm border border-kore-gray-light/40 text-kore-gray-dark/60 disabled:opacity-30 hover:bg-kore-cream transition-colors"
            >
              ← Anterior
            </button>
            <button
              disabled={filters.page >= totalPages}
              onClick={() => handlePage(filters.page + 1)}
              className="px-3 py-1.5 rounded-xl text-sm border border-kore-gray-light/40 text-kore-gray-dark/60 disabled:opacity-30 hover:bg-kore-cream transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
