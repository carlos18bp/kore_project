'use client';

import { useEffect } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Card from '@/app/components/admin/Card';
import StatTile from '@/app/components/admin/StatTile';
import TrendBars from '@/app/components/admin/TrendBars';
import { useAdminReportsStore, type ReportWindow } from '@/lib/stores/adminReportsStore';

const WINDOWS: { key: ReportWindow; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: 'all', label: 'Todo' },
];

const fmtCop = (n: number) => `${n.toLocaleString('es-CO')} COP`;

export default function ReportsPage() {
  const { window: active, data, loading, error, fetchReport } = useAdminReportsStore();

  useEffect(() => {
    fetchReport('30d');
  }, [fetchReport]);

  const busy = loading && !data;

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Reportes' },
      ]}
      title="Reportes"
    >
      <div className="flex gap-2 mb-6 flex-wrap">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => fetchReport(w.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active === w.key
                ? 'bg-kore-red text-white'
                : 'bg-white/60 border border-white/60 text-kore-burgundy/60 hover:bg-white/80'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-kore-red mb-4">{error}</p>}

      {/* Ingresos */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Ingresos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <StatTile kicker="Total" value={fmtCop(data?.revenue.total_cop ?? 0)} tone="dark" loading={busy} />
          <StatTile kicker="Suscripciones" value={fmtCop(data?.revenue.subscriptions_cop ?? 0)} tone="sage" loading={busy} />
          <StatTile kicker="Créditos (Wompi)" value={fmtCop(data?.revenue.credits_cop ?? 0)} tone="amber" loading={busy} />
        </div>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
            Ingresos · últimos 6 meses
          </p>
          <TrendBars data={data?.revenue.trend ?? []} />
        </Card>
      </section>

      {/* Suscripciones */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Suscripciones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile kicker="Activas" value={data?.subscriptions.active ?? 0} tone="sage" loading={busy} />
          <StatTile kicker="Expiradas" value={data?.subscriptions.expired ?? 0} tone="amber" loading={busy} />
          <StatTile kicker="Canceladas" value={data?.subscriptions.canceled ?? 0} tone="sakura" loading={busy} />
          <StatTile kicker="% Nutrición" value={`${data?.subscriptions.with_nutrition_pct ?? 0}%`} tone="dark" loading={busy} />
        </div>
      </section>

      {/* Créditos */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Créditos</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatTile kicker="Ganados" value={data?.credits.earned ?? 0} tone="sage" loading={busy} />
          <StatTile kicker="Gastados" value={data?.credits.spent ?? 0} tone="sakura" loading={busy} />
        </div>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-3">
            Canjes por estado
          </p>
          <div className="flex gap-4 text-sm text-kore-burgundy/80">
            <span>Pendiente: {data?.credits.redemptions_by_status.pending ?? 0}</span>
            <span>Entregado: {data?.credits.redemptions_by_status.fulfilled ?? 0}</span>
            <span>Rechazado: {data?.credits.redemptions_by_status.rejected ?? 0}</span>
          </div>
        </Card>
      </section>

      {/* Calidad */}
      <section>
        <h2 className="text-lg font-bold text-kore-burgundy mb-3">Calidad</h2>
        <div className="grid grid-cols-2 gap-4">
          <StatTile kicker="Promedio" value={data?.quality.average_score ?? 0} hint="de 5 estrellas" tone="dark" loading={busy} />
          <StatTile kicker="Calificadas" value={data?.quality.rated_count ?? 0} hint="sesiones" tone="sage" loading={busy} />
        </div>
      </section>
    </AdminShell>
  );
}
