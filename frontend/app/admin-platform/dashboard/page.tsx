'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import StatTile from '@/app/components/admin/StatTile';
import { useAdminSubscriptionStore } from '@/lib/stores/adminSubscriptionStore';

export default function AdminDashboardPage() {
  const { subscriptions, totalCount, loading, fetchSubscriptions } = useAdminSubscriptionStore();

  useEffect(() => {
    fetchSubscriptions({ page: 1, search: '', status: '', category: '' });
  }, [fetchSubscriptions]);

  const counts = useMemo(
    () => ({
      total: totalCount,
      active: subscriptions.filter((s) => s.status === 'active').length,
      expired: subscriptions.filter((s) => s.status === 'expired').length,
      canceled: subscriptions.filter((s) => s.status === 'canceled').length,
    }),
    [subscriptions, totalCount],
  );

  return (
    <AdminShell breadcrumb={[{ label: 'Panel de administración' }]} title="Resumen">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile
          kicker="Total"
          value={counts.total}
          hint="suscripciones cargadas"
          tone="dark"
          loading={loading && subscriptions.length === 0}
        />
        <StatTile
          kicker="Activas"
          value={counts.active}
          hint="con sesiones disponibles"
          tone="sage"
          loading={loading && subscriptions.length === 0}
        />
        <StatTile
          kicker="Expiradas"
          value={counts.expired}
          hint="sin renovación reciente"
          tone="amber"
          loading={loading && subscriptions.length === 0}
        />
        <StatTile
          kicker="Canceladas"
          value={counts.canceled}
          hint="dadas de baja"
          tone="sakura"
          loading={loading && subscriptions.length === 0}
        />
      </div>

      <Card className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-kore-burgundy">Gestión de suscripciones</p>
          <p className="text-xs text-kore-burgundy/60 mt-0.5">
            Ver, filtrar y editar suscripciones por categoría (Pareja, Personalizada, Terapéutica).
          </p>
        </div>
        <Link href="/admin-platform/subscriptions" prefetch={false}>
          <Btn variant="primary">Ver todas</Btn>
        </Link>
      </Card>

      <Card className="p-5 mt-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-kore-burgundy">Gestión de usuarios</p>
          <p className="text-xs text-kore-burgundy/60 mt-0.5">
            Inscribir clientes y entrenadores, ver suscripciones por usuario.
          </p>
        </div>
        <Link href="/admin-platform/users" prefetch={false}>
          <Btn variant="ghost">Ver usuarios</Btn>
        </Link>
      </Card>
    </AdminShell>
  );
}
