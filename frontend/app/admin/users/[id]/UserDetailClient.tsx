'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
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
  } = useAdminUserStore();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetModal, setResetModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    if (Number.isFinite(id) && id > 0) fetchById(id);
  }, [id, fetchById]);

  useEffect(() => {
    if (selected) setEdit(fromUser(selected));
  }, [selected]);

  if (!selected || !edit || loading) {
    return (
      <AdminShell breadcrumb={[{ label: 'Usuarios', href: '/admin/users' }]} title="Cargando…">
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
    if (ok) router.push('/admin/users');
  };

  const fullName =
    [selected.first_name, selected.last_name].filter(Boolean).join(' ') || selected.email;

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel', href: '/admin/dashboard' },
        { label: 'Usuarios', href: '/admin/users' },
        { label: `#${selected.id}` },
      ]}
      title={fullName}
    >
      <Link
        href="/admin/users"
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
      </Card>

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
