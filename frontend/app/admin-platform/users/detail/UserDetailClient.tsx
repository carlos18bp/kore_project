'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import DarkActionCard from '@/app/components/admin/DarkActionCard';
import Field from '@/app/components/admin/Field';
import InfoRow from '@/app/components/admin/InfoRow';
import Input from '@/app/components/admin/Input';
import Modal from '@/app/components/admin/Modal';
import SoftActionCard from '@/app/components/admin/SoftActionCard';
import SubCardCompact from '@/app/components/admin/SubCardCompact';
import Toggle from '@/app/components/admin/Toggle';
import UserHero from '@/app/components/admin/UserHero';
import {
  useAdminUserStore,
  type AdminUserDetail,
  type UpdateUserPayload,
} from '@/lib/stores/adminUserStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Nunca ha ingresado';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Nunca ha ingresado';
  return (
    d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  );
}

type EditState = {
  first_name: string;
  last_name: string;
  phone: string;
  role: 'customer' | 'trainer';
  is_active: boolean;
};

function fromUser(u: AdminUserDetail): EditState {
  return {
    first_name: u.first_name ?? '',
    last_name: u.last_name ?? '',
    phone: u.phone ?? '',
    role: (u.role === 'trainer' ? 'trainer' : 'customer') as EditState['role'],
    is_active: u.is_active,
  };
}

export default function UserDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = Number(searchParams.get('id'));
  const {
    selected,
    loading,
    actionLoading,
    error,
    fetchById,
    patchUser,
    resetUserPassword,
    toggleActive,
    deleteUser,
    assignTrainer,
  } = useAdminUserStore();

  const { trainers } = useBookingStore();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetModal, setResetModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (Number.isFinite(id) && id > 0) fetchById(id);
  }, [id, fetchById]);

  useEffect(() => {
    if (selected?.role === 'customer') useBookingStore.getState().fetchTrainers();
  }, [selected?.role]);

  useEffect(() => {
    if (selected) setEdit(fromUser(selected));
  }, [selected]);

  if (!selected || !edit || loading) {
    return (
      <AdminShell breadcrumb={[{ label: 'Usuarios', href: '/admin-platform/users' }]} title="Cargando…">
        <div className="text-sm text-kore-burgundy/55">{error || 'Cargando…'}</div>
      </AdminShell>
    );
  }

  const dirty = (() => {
    if (!selected) return false;
    const original = fromUser(selected);
    return (Object.keys(edit) as (keyof EditState)[]).some((k) => edit[k] !== original[k]);
  })();

  const setField = <K extends keyof EditState>(key: K) =>
    (value: EditState[K]) => {
      setEdit((prev) => (prev ? { ...prev, [key]: value } : prev));
      setErrors((prev) => {
        const n = { ...prev };
        delete n[key as string];
        return n;
      });
    };

  const handleSave = async () => {
    if (!edit) return;
    const payload: UpdateUserPayload = {
      first_name: edit.first_name,
      last_name: edit.last_name,
      phone: edit.phone,
      role: edit.role,
      is_active: edit.is_active,
    };
    const result = await patchUser(id, payload);
    if (!result.ok) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.errors)) {
        flat[k] = Array.isArray(v) ? v[0] : String(v);
      }
      setErrors(flat);
    }
  };

  const handleDiscard = () => {
    setEdit(fromUser(selected));
    setErrors({});
  };

  const handleResetPassword = async () => {
    const ok = await resetUserPassword(id);
    setResetModal(false);
    if (ok) setEdit(fromUser({ ...selected, must_change_password: true }));
  };

  const handleToggleActive = async () => {
    await toggleActive(id);
  };

  const handleDelete = async () => {
    const ok = await deleteUser(id);
    setDeleteModal(false);
    if (ok) router.push('/admin-platform/users');
  };

  const fullName =
    [selected.first_name, selected.last_name].filter(Boolean).join(' ') || selected.email;

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel', href: '/admin-platform/dashboard' },
        { label: 'Usuarios', href: '/admin-platform/users' },
        { label: `#${selected.id}` },
      ]}
      title={fullName}
    >
      <Link
        href="/admin-platform/users"
        prefetch={false}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-kore-burgundy/60 mb-5 hover:text-kore-burgundy"
      >
        ← Volver a usuarios
      </Link>

      <UserHero
        id={selected.id}
        fullName={fullName}
        email={selected.email}
        role={selected.role}
        isActive={selected.is_active}
        mustChangePassword={selected.must_change_password}
        joinedLabel={fmtDate(selected.date_joined)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
        {/* Información read-only */}
        <Card className="p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Identidad
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
            Información
          </div>
          <InfoRow label="Email" value={selected.email} />
          <InfoRow label="Teléfono" value={selected.phone || '—'} />
          <InfoRow label="Rol" value={selected.role === 'trainer' ? 'Entrenador' : 'Cliente'} />
          <InfoRow
            label="Estado"
            value={selected.is_active ? 'Activo' : 'Inactivo'}
            valuePill={selected.is_active ? 'sage' : 'neutral'}
          />
          <InfoRow label="Registro" value={fmtDate(selected.date_joined)} />
          <InfoRow label="Última conexión" value={fmtDateTime(selected.last_login)} />
          <InfoRow
            label="Cambio contraseña"
            value={selected.must_change_password ? 'Pendiente' : 'Realizado'}
            valuePill={selected.must_change_password ? 'amber' : 'sage'}
            last
          />
        </Card>

        {/* Editar */}
        <Card className="p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Editar
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
            Metadatos
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3.5">
            <Field label="Nombre" error={errors.first_name}>
              <Input
                value={edit.first_name}
                onChange={(e) => setField('first_name')(e.target.value)}
              />
            </Field>
            <Field label="Apellido" error={errors.last_name}>
              <Input
                value={edit.last_name}
                onChange={(e) => setField('last_name')(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Teléfono" error={errors.phone} className="mb-3.5">
            <Input value={edit.phone} onChange={(e) => setField('phone')(e.target.value)} />
          </Field>

          <Field label="Rol" error={errors.role} className="mb-3.5">
            <div className="flex gap-1.5 p-1 bg-kore-burgundy/6 rounded-xl border border-kore-burgundy/8">
              {(['customer', 'trainer'] as const).map((r) => {
                const sel = edit.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setField('role')(r)}
                    className={`flex-1 px-3.5 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all ${
                      sel
                        ? 'bg-white text-kore-burgundy shadow-sm'
                        : 'text-kore-burgundy/65 hover:text-kore-burgundy'
                    }`}
                  >
                    {r === 'customer' ? 'Cliente' : 'Entrenador'}
                  </button>
                );
              })}
            </div>
          </Field>

          <div
            className={`flex items-center justify-between p-3.5 rounded-xl border mb-3.5 ${
              edit.is_active
                ? 'bg-kore-sage/10 border-kore-sage/30'
                : 'bg-kore-burgundy/4 border-kore-burgundy/8'
            }`}
          >
            <div>
              <div className="text-xs font-semibold text-kore-burgundy">
                {edit.is_active ? 'Cuenta activa' : 'Cuenta suspendida'}
              </div>
              <div className="text-[10px] text-kore-burgundy/60 mt-0.5">
                {edit.is_active
                  ? 'El usuario puede iniciar sesión'
                  : 'El acceso está bloqueado'}
              </div>
            </div>
            <Toggle checked={edit.is_active} onChange={() => setField('is_active')(!edit.is_active)} />
          </div>

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={handleDiscard} disabled={!dirty}>
              Descartar
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleSave} disabled={!dirty || actionLoading}>
              {actionLoading ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>
        </Card>
      </div>

      {/* Suscripciones */}
      <Card className="p-7 mt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
          Historial
        </div>
        <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
          Suscripciones ({selected.subscriptions.length})
        </div>
        {selected.subscriptions.length === 0 ? (
          <div className="p-7 text-center rounded-xl bg-kore-burgundy/4 border border-dashed border-kore-burgundy/15">
            <div className="text-[13px] text-kore-burgundy/60">
              Este usuario no tiene suscripciones aún.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {selected.subscriptions.map((sub) => (
              <SubCardCompact key={sub.id} sub={sub} />
            ))}
          </div>
        )}

        {selected.role === 'customer' && (
          <div className="mt-4 flex justify-end">
            <Link href={`/admin-platform/subscriptions/new?customer=${selected.id}`}>
              <Btn variant="primary" size="sm">
                {selected.has_active_subscription ? 'Evolucionar plan' : '＋ Crear suscripción'}
              </Btn>
            </Link>
          </div>
        )}
      </Card>

      {/* Asignación de entrenador (solo clientes) */}
      {selected.role === 'customer' && (
        <Card className="p-7 mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">Asignación</div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">Entrenador asignado</div>
          <Field label="Entrenador" error={errors.assigned_trainer_id}>
            <select
              className="w-full rounded-xl border border-kore-burgundy/12 bg-white px-3.5 py-2.5 text-sm text-kore-burgundy"
              value={selected.assigned_trainer?.id ?? ''}
              disabled={assigning || actionLoading}
              onChange={async (e) => {
                const val = e.target.value === '' ? null : Number(e.target.value);
                setAssigning(true);
                const res = await assignTrainer(selected.id, val);
                setAssigning(false);
                if (!res.ok) {
                  setErrors((p) => ({ ...p, assigned_trainer_id: Object.values(res.errors)[0]?.[0] ?? 'No se pudo asignar.' }));
                } else {
                  setErrors((p) => { const n = { ...p }; delete n.assigned_trainer_id; return n; });
                }
              }}
            >
              <option value="">— Sin asignar —</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </Field>
          {!selected.assigned_trainer && (
            <div className="mt-2 text-[11px] font-semibold text-amber-600">Este cliente no puede agendar sesiones hasta que le asignes un entrenador.</div>
          )}
        </Card>
      )}

      {/* Clientes asignados (solo entrenadores) */}
      {selected.role === 'trainer' && (
        <Card className="p-7 mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">Clientes</div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">Clientes asignados ({selected.assigned_clients?.length ?? 0})</div>
          {(selected.assigned_clients?.length ?? 0) === 0 ? (
            <div className="p-7 text-center rounded-xl bg-kore-burgundy/4 border border-dashed border-kore-burgundy/15 text-[13px] text-kore-burgundy/60">Este entrenador no tiene clientes asignados todavía.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {selected.assigned_clients!.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-white border border-kore-burgundy/8 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin-platform/users/detail?id=${c.id}`} prefetch={false} className="text-sm font-semibold text-kore-burgundy hover:underline">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                    </Link>
                    <div className="text-[11px] text-kore-burgundy/55 truncate">{c.email}{c.active_package ? ` · ${c.active_package}` : ''}</div>
                  </div>
                  <Btn variant="ghost" size="sm" disabled={actionLoading} onClick={async () => { await assignTrainer(c.id, null); await fetchById(id); }}>Quitar</Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Acciones admin */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3.5 mt-5">
        <DarkActionCard
          title="Reenviar credenciales"
          description="Genera una nueva contraseña aleatoria, marca al usuario como debe cambiar contraseña y envía un email con las nuevas credenciales."
          cta="Reenviar"
          icon="✉"
          onAction={() => setResetModal(true)}
          disabled={actionLoading}
        />
        <SoftActionCard
          tone="amber"
          title={selected.is_active ? 'Suspender cuenta' : 'Reactivar cuenta'}
          description={
            selected.is_active ? 'Bloquea el acceso temporalmente.' : 'Restaura el acceso del usuario.'
          }
          cta={selected.is_active ? 'Suspender' : 'Reactivar'}
          onAction={handleToggleActive}
          disabled={actionLoading}
        />
        <SoftActionCard
          tone="danger"
          title="Eliminar usuario"
          description="Borra la cuenta de la plataforma de forma permanente."
          cta="Eliminar"
          onAction={() => setDeleteModal(true)}
          disabled={actionLoading}
        />
      </div>

      {resetModal && (
        <Modal
          title="Reenviar credenciales"
          body={`Se generará una contraseña temporal nueva y se enviará a ${selected.email}. ${selected.first_name || 'El usuario'} deberá cambiarla en su próximo ingreso.`}
          confirmLabel="Sí, reenviar"
          loading={actionLoading}
          onClose={() => setResetModal(false)}
          onConfirm={handleResetPassword}
        />
      )}

      {deleteModal && (
        <Modal
          title={`Eliminar a ${fullName}`}
          body="Esta acción es irreversible para el panel. La cuenta queda archivada y oculta. Sus suscripciones se mantienen para auditoría."
          confirmLabel="Eliminar permanentemente"
          danger
          loading={actionLoading}
          onClose={() => setDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </AdminShell>
  );
}
