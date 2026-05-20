'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import Input from '@/app/components/admin/Input';
import SubRow, { type AdminSubRowData } from '@/app/components/admin/SubRow';
import SubscriptionCategoryTabs from '@/app/components/admin/SubscriptionCategoryTabs';
import {
  useAdminSubscriptionStore,
  type AdminSubscriptionFilters,
} from '@/lib/stores/adminSubscriptionStore';

const PAGE_SIZE = 10;

type Category = 'semi_personalizado' | 'personalizado' | 'terapeutico';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <circle cx="11" cy="11" r="7" strokeLinecap="round" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_OPTIONS: Array<{ k: '' | 'active' | 'expired' | 'canceled'; label: string }> = [
  { k: '', label: 'Todas' },
  { k: 'active', label: 'Activa' },
  { k: 'expired', label: 'Expirada' },
  { k: 'canceled', label: 'Cancelada' },
];

export default function AdminSubscriptionsPage() {
  const { subscriptions, totalCount, filters, loading, fetchSubscriptions, setFilters } =
    useAdminSubscriptionStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  // Default tab — `semi_personalizado` if not set yet.
  const activeCategory: Category =
    (filters.category as Category) || 'semi_personalizado';

  useEffect(() => {
    fetchSubscriptions({ page: 1, category: activeCategory });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const acc: Record<Category, number> = {
      semi_personalizado: 0,
      personalizado: 0,
      terapeutico: 0,
    };
    // Counts derived from current page only — backend total comes from totalCount per active filter.
    // We surface the *current* filter count as the active tab count and approximate others to "—".
    // Better UX would be a dedicated counts endpoint; for MVP we show what we have.
    if (filters.category) {
      acc[filters.category as Category] = totalCount;
    }
    return acc;
  }, [filters.category, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleCategory = (cat: Category) => {
    setFilters({ category: cat as AdminSubscriptionFilters['category'], page: 1 });
    fetchSubscriptions({ category: cat as AdminSubscriptionFilters['category'], page: 1 });
  };

  const handleSearchSubmit = () => {
    setFilters({ search: searchInput, page: 1 });
    fetchSubscriptions({ search: searchInput, page: 1 });
  };

  const handleStatus = (status: string) => {
    setFilters({ status, page: 1 });
    fetchSubscriptions({ status, page: 1 });
  };

  const handlePage = (delta: 1 | -1) => {
    const next = Math.min(totalPages, Math.max(1, filters.page + delta));
    if (next === filters.page) return;
    setFilters({ page: next });
    fetchSubscriptions({ page: next });
  };

  return (
    <AdminShell
      breadcrumb={[{ label: 'Panel de administración', href: '/admin-platform/dashboard' }, { label: 'Suscripciones' }]}
      title="Gestión de suscripciones"
    >
      <div className="flex items-center justify-end mb-3">
        <Link href="/admin-platform/subscriptions/new">
          <Btn variant="primary" size="sm">＋ Crear suscripción</Btn>
        </Link>
      </div>

      <SubscriptionCategoryTabs active={activeCategory} counts={counts} onChange={handleCategory} />

      <Card className="p-4 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Input
              icon={<SearchIcon />}
              placeholder="Buscar cliente, email o paquete…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit();
              }}
            />
          </div>
          <div className="flex gap-1.5 p-1 bg-kore-burgundy/6 rounded-xl border border-kore-burgundy/8">
            {STATUS_OPTIONS.map((s) => {
              const sel = filters.status === s.k;
              return (
                <button
                  key={s.k || 'all'}
                  type="button"
                  onClick={() => handleStatus(s.k)}
                  className={`px-3.5 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all ${
                    sel
                      ? 'bg-white text-kore-burgundy shadow-sm'
                      : 'text-kore-burgundy/65 hover:text-kore-burgundy'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {!loading && subscriptions.length === 0 ? (
        <div className="p-14 text-center bg-white/55 rounded-2xl border border-dashed border-kore-burgundy/15">
          <div className="font-heading text-lg font-semibold text-kore-burgundy">
            Sin suscripciones
          </div>
          <div className="text-[13px] text-kore-burgundy/60 mt-2">
            No hay resultados con los filtros aplicados.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="hidden xl:grid grid-cols-[2fr_1.6fr_1.4fr_1fr_0.9fr_28px] gap-4 px-5 text-[9px] font-bold uppercase tracking-[0.20em] text-kore-burgundy/55">
            <div>Cliente</div>
            <div>Paquete</div>
            <div>Sesiones</div>
            <div>Vence</div>
            <div>Estado</div>
            <div></div>
          </div>
          {subscriptions.map((sub) => (
            <SubRow key={sub.id} sub={sub as AdminSubRowData} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-6 px-1">
        <div className="text-xs text-kore-burgundy/60">
          {totalCount} suscripcion{totalCount === 1 ? '' : 'es'}
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={() => handlePage(-1)} disabled={filters.page === 1}>
            ← Anterior
          </Btn>
          <div className="px-3.5 py-2 text-[11px] font-semibold text-kore-burgundy">
            Página {filters.page} de {totalPages}
          </div>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => handlePage(1)}
            disabled={filters.page === totalPages}
          >
            Siguiente →
          </Btn>
        </div>
      </div>
    </AdminShell>
  );
}
