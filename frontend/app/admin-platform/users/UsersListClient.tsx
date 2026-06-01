'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import Input from '@/app/components/admin/Input';
import StatTile from '@/app/components/admin/StatTile';
import UserRow, { type AdminUserRowData } from '@/app/components/admin/UserRow';
import { useAdminUserStore, type AdminUserFilters } from '@/lib/stores/adminUserStore';

const PAGE_SIZE = 10;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
      <circle cx="11" cy="11" r="7" strokeLinecap="round" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

export default function UsersListClient() {
  const { users, totalCount, filters, loading, fetchUsers, setFilters, assignmentSummary, fetchAssignmentSummary } = useAdminUserStore();
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (filters.role === 'trainer') fetchAssignmentSummary();
  }, [filters.role, fetchAssignmentSummary]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const customers = users.filter((u) => u.role === 'customer').length;
    const trainers = users.filter((u) => u.role === 'trainer').length;
    const pending = users.filter((u) => u.must_change_password).length;
    return { total: users.length, active, customers, trainers, pending };
  }, [users]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSearchSubmit = () => {
    setFilters({ search: searchInput, page: 1 });
    fetchUsers({ search: searchInput, page: 1 });
  };

  const handleRoleSelect = (role: AdminUserFilters['role']) => {
    setFilters({ role, page: 1 });
    fetchUsers({ role, page: 1 });
  };

  const handlePage = (delta: 1 | -1) => {
    const next = Math.min(totalPages, Math.max(1, filters.page + delta));
    if (next === filters.page) return;
    setFilters({ page: next });
    fetchUsers({ page: next });
  };

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Usuarios' },
      ]}
      title="Gestión de usuarios"
    >
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile
          kicker="Total"
          value={stats.total}
          hint={`${stats.active} activos`}
          tone="dark"
          loading={loading && users.length === 0}
        />
        <StatTile
          kicker="Clientes"
          value={stats.customers}
          hint="Con plan o histórico"
          tone="sakura"
          loading={loading && users.length === 0}
        />
        <StatTile
          kicker="Entrenadores"
          value={stats.trainers}
          hint="Equipo interno"
          tone="sage"
          loading={loading && users.length === 0}
        />
        <StatTile
          kicker="Cambio pendiente"
          value={stats.pending}
          hint="Aún no establecen contraseña"
          tone="amber"
          badge={stats.pending > 0}
          loading={loading && users.length === 0}
        />
      </div>

      {/* Filters card */}
      <Card className="p-5 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Input
              icon={<SearchIcon />}
              placeholder="Buscar por nombre o email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit();
              }}
            />
          </div>
          <div className="flex gap-1.5 p-1 bg-kore-burgundy/6 rounded-xl border border-kore-burgundy/8">
            {(
              [
                { k: 'all', label: 'Todos' },
                { k: 'customer', label: 'Clientes' },
                { k: 'trainer', label: 'Entrenadores' },
              ] as const
            ).map((r) => {
              const sel = filters.role === r.k;
              return (
                <button
                  key={r.k}
                  type="button"
                  onClick={() => handleRoleSelect(r.k)}
                  className={`px-3.5 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all ${
                    sel
                      ? 'bg-white text-kore-burgundy shadow-sm'
                      : 'text-kore-burgundy/65 hover:text-kore-burgundy'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <Link href="/admin-platform/users/new" prefetch={false}>
            <Btn variant="primary">＋ Inscribir usuario</Btn>
          </Link>
        </div>
      </Card>

      {/* Trainer coverage card */}
      {filters.role === 'trainer' && assignmentSummary && (
        <Card className="p-5 mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-2">
            Cobertura de entrenadores
          </div>
          <div className="flex items-end gap-6 flex-wrap">
            <div>
              <div className="text-3xl font-black tracking-tight text-kore-burgundy tabular-nums">{assignmentSummary.active_customers}</div>
              <div className="text-[11px] text-kore-burgundy/55">clientes activos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-kore-sage tabular-nums">{assignmentSummary.assigned}</div>
              <div className="text-[11px] text-kore-burgundy/55">con entrenador</div>
            </div>
            <div>
              <div className={`text-2xl font-bold tabular-nums ${assignmentSummary.unassigned > 0 ? 'text-amber-500' : 'text-kore-burgundy/40'}`}>{assignmentSummary.unassigned}</div>
              <div className="text-[11px] text-kore-burgundy/55">sin entrenador</div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <div className="h-2 rounded-full bg-kore-burgundy/8 overflow-hidden flex">
                <div className="h-full bg-kore-sage" style={{ width: `${assignmentSummary.active_customers ? (assignmentSummary.assigned / assignmentSummary.active_customers) * 100 : 0}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${assignmentSummary.active_customers ? (assignmentSummary.unassigned / assignmentSummary.active_customers) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
          {assignmentSummary.unassigned > 0 && (
            <div className="mt-3 text-[11px] font-semibold text-amber-600">⚠ {assignmentSummary.unassigned} cliente(s) activo(s) sin entrenador asignado.</div>
          )}
          {assignmentSummary.per_trainer.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {assignmentSummary.per_trainer.map((p) => (
                <span key={p.trainer_id} className="rounded-full px-3 py-1 text-[11px] font-semibold bg-kore-burgundy/6 text-kore-burgundy">
                  {p.first_name} {p.last_name} · {p.client_count}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Table */}
      {!loading && users.length === 0 ? (
        <div className="p-14 text-center bg-white/55 rounded-2xl border border-dashed border-kore-burgundy/15">
          <div className="font-heading text-lg font-semibold text-kore-burgundy">
            {filters.search || filters.role !== 'all' ? 'Sin resultados' : 'Sin usuarios'}
          </div>
          <div className="text-[13px] text-kore-burgundy/60 mt-2">
            {filters.search || filters.role !== 'all'
              ? 'Ajusta el buscador o cambia los filtros.'
              : 'Inscribe el primer usuario de la plataforma.'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="hidden xl:grid grid-cols-[52px_2.2fr_1fr_1.4fr_1.2fr_0.8fr_28px] gap-4 px-5 text-[9px] font-bold uppercase tracking-[0.20em] text-kore-burgundy/55">
            <div></div>
            <div>Usuario</div>
            <div>Rol</div>
            <div>Sesiones</div>
            <div>Última conexión</div>
            <div>Estado</div>
            <div></div>
          </div>
          {users.map((u) => (
            <UserRow key={u.id} user={u as AdminUserRowData} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col gap-3 mt-6 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-kore-burgundy/60">
          {totalCount} usuario{totalCount !== 1 ? 's' : ''}
          {(filters.search || filters.role !== 'all') && (
            <span className="ml-2 text-kore-burgundy/50">· filtros aplicados</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Btn variant="ghost" size="sm" onClick={() => handlePage(-1)} disabled={filters.page === 1}>
            ← Anterior
          </Btn>
          <div className="px-3.5 py-2 text-[11px] font-semibold text-kore-burgundy whitespace-nowrap">
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
