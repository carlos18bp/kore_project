'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import DarkActionCard from '@/app/components/admin/DarkActionCard';
import Field from '@/app/components/admin/Field';
import InfoRow from '@/app/components/admin/InfoRow';
import Input from '@/app/components/admin/Input';
import MemberCard, {
  NoGuestCard,
  PendingMemberCard,
  RevokedMemberCard,
} from '@/app/components/admin/MemberCard';
import Modal from '@/app/components/admin/Modal';
import SoftActionCard from '@/app/components/admin/SoftActionCard';
import SubscriptionHero from '@/app/components/admin/SubscriptionHero';
import {
  useAdminSubscriptionStore,
  type PatchSubscriptionPayload,
} from '@/lib/stores/adminSubscriptionStore';

const CATEGORY_LABEL: Record<string, string> = {
  semi_personalizado: 'Pareja',
  personalizado: 'Personalizada',
  terapeutico: 'Terapéutica',
};

const STATUS_LABEL = { active: 'Activa', expired: 'Expirada', canceled: 'Cancelada' } as const;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const {
    selected, loading, actionLoading, error,
    fetchById, patchSubscription, renewSubscription, deleteSubscription,
  } = useAdminSubscriptionStore();

  const [form, setForm] = useState<PatchSubscriptionPayload>({});
  const [saveOk, setSaveOk] = useState(false);
  const [renewOk, setRenewOk] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  useEffect(() => {
    if (Number.isFinite(id) && id > 0) fetchById(id);
  }, [id, fetchById]);

  useEffect(() => {
    if (selected) {
      setForm({
        status: selected.status,
        sessions_used: selected.sessions_used,
        expires_at: selected.expires_at,
      });
      setSaveOk(false);
      setRenewOk(false);
    }
  }, [selected]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    if (form.status !== undefined && form.status !== selected.status) return true;
    if (
      form.sessions_used !== undefined &&
      Number(form.sessions_used) !== selected.sessions_used
    )
      return true;
    if (form.expires_at !== undefined && form.expires_at !== selected.expires_at) return true;
    return false;
  }, [form, selected]);

  if (!selected || loading) {
    return (
      <AdminShell breadcrumb={[{ label: 'Suscripciones', href: '/admin/subscriptions' }]} title="Cargando…">
        <div className="text-sm text-kore-burgundy/55">{error || 'Cargando…'}</div>
      </AdminShell>
    );
  }

  const categoryLabel = CATEGORY_LABEL[selected.package.category] ?? selected.package.category;
  const canRenew = selected.status === 'expired' || selected.status === 'canceled';

  const handleSave = async () => {
    setSaveOk(false);
    const ok = await patchSubscription(id, form);
    if (ok) setSaveOk(true);
  };

  const handleDiscard = () => {
    setForm({
      status: selected.status,
      sessions_used: selected.sessions_used,
      expires_at: selected.expires_at,
    });
  };

  const handleRenew = async () => {
    setRenewModal(false);
    setRenewOk(false);
    const result = await renewSubscription(id);
    if (result) {
      setRenewOk(true);
      await fetchById(id);
    }
  };

  const handleDelete = async () => {
    setDeleteErr('');
    const res = await deleteSubscription(id);
    setDeleteModal(false);
    if (res.ok) {
      router.push('/admin/subscriptions');
    } else {
      setDeleteErr(res.detail);
    }
  };

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel', href: '/admin/dashboard' },
        { label: 'Suscripciones', href: '/admin/subscriptions' },
        { label: `#${selected.id}` },
      ]}
      title={selected.package.title}
    >
      <Link
        href="/admin/subscriptions"
        prefetch={false}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-kore-burgundy/60 mb-5 hover:text-kore-burgundy"
      >
        ← Volver a suscripciones
      </Link>

      <SubscriptionHero
        id={selected.id}
        categoryLabel={categoryLabel}
        packageTitle={selected.package.title}
        status={selected.status}
        startsAt={fmtDate(selected.starts_at)}
        expiresAt={fmtDate(selected.expires_at)}
        sessionsUsed={selected.sessions_used}
        sessionsTotal={selected.sessions_total}
      />

      {/* Plan Pareja */}
      {selected.is_duo && (
        <Card className="p-7 mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Plan Pareja
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-5">
            Miembros del plan
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 items-center">
            <MemberCard
              role="Anfitrión"
              name={selected.customer_name}
              email={selected.customer_email}
              userId={selected.customer_id}
            />

            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-heading text-[13px] ${
                  selected.guest_info?.status === 'accepted'
                    ? 'bg-kore-sage/20 text-kore-sage-deep'
                    : selected.guest_info?.status === 'pending'
                      ? 'bg-kore-amber/20 text-kore-amber-deep'
                      : 'bg-kore-burgundy/8 text-kore-burgundy/55'
                }`}
              >
                {selected.guest_info?.status === 'accepted'
                  ? '⌘'
                  : selected.guest_info?.status === 'pending'
                    ? '⏳'
                    : '✕'}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-kore-burgundy/55">
                {selected.guest_info?.status === 'accepted'
                  ? 'Aceptada'
                  : selected.guest_info?.status === 'pending'
                    ? 'Pendiente'
                    : selected.guest_info?.status === 'revoked'
                      ? 'Revocada'
                      : 'Sin enviar'}
              </div>
              {selected.guest_info?.accepted_at && (
                <div className="text-[10px] text-kore-burgundy/55">
                  {fmtDate(selected.guest_info.accepted_at)}
                </div>
              )}
            </div>

            {selected.guest_info?.status === 'accepted' ? (
              <MemberCard
                role="Invitado"
                name={selected.guest_info.guest_name ?? selected.guest_info.invited_email}
                email={selected.guest_info.invited_email}
                userId={selected.guest_info.guest_user_id}
              />
            ) : selected.guest_info?.status === 'pending' ? (
              <PendingMemberCard email={selected.guest_info.invited_email} />
            ) : selected.guest_info?.status === 'revoked' ? (
              <RevokedMemberCard
                name={selected.guest_info.guest_name ?? selected.guest_info.invited_email}
              />
            ) : (
              <NoGuestCard />
            )}
          </div>
        </Card>
      )}

      {!selected.is_duo && (
        <Card className="p-7 mt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Cliente
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-5">
            Información
          </div>
          <div className="max-w-md">
            <MemberCard
              role="Cliente"
              name={selected.customer_name}
              email={selected.customer_email}
              userId={selected.customer_id}
              fullWidth
            />
          </div>
        </Card>
      )}

      {/* Detail + Edit */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
        <Card className="p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Detalle
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
            Información del paquete
          </div>
          <InfoRow label="Paquete" value={selected.package.title} />
          <InfoRow label="Categoría" value={categoryLabel} />
          <InfoRow label="Inicio" value={fmtDate(selected.starts_at)} />
          <InfoRow label="Vence" value={fmtDate(selected.expires_at)} />
          <InfoRow label="Sesiones" value={`${selected.sessions_used} / ${selected.sessions_total}`} />
          <InfoRow
            label="Estado"
            value={STATUS_LABEL[selected.status] ?? selected.status}
            valuePill={selected.status === 'active' ? 'sage' : 'neutral'}
            last
          />
        </Card>

        <Card className="p-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
            Editar
          </div>
          <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
            Ajustes administrativos
          </div>

          <Field label="Estado" className="mb-3.5">
            <div className="flex gap-1.5 p-1 bg-kore-burgundy/6 rounded-xl border border-kore-burgundy/8">
              {(['active', 'expired', 'canceled'] as const).map((st) => {
                const sel = (form.status ?? selected.status) === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: st }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                      sel
                        ? 'bg-white text-kore-burgundy shadow-sm'
                        : 'text-kore-burgundy/65 hover:text-kore-burgundy'
                    }`}
                  >
                    {STATUS_LABEL[st]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Sesiones consumidas" className="mb-3.5">
            <Input
              type="number"
              min={0}
              max={selected.sessions_total}
              value={form.sessions_used ?? selected.sessions_used}
              onChange={(e) =>
                setForm((f) => ({ ...f, sessions_used: Number(e.target.value) }))
              }
            />
          </Field>

          <Field label="Fecha de vencimiento" className="mb-3.5">
            <Input
              type="date"
              value={toDateInput(form.expires_at ?? selected.expires_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, expires_at: new Date(e.target.value).toISOString() }))
              }
            />
          </Field>

          {saveOk && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-kore-sage/15 border border-kore-sage/35 text-[11px] font-semibold text-kore-sage-deep">
              Cambios guardados.
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="ghost" size="sm" onClick={handleDiscard} disabled={!dirty}>
              Descartar
            </Btn>
            <Btn
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || actionLoading}
            >
              {actionLoading ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>
        </Card>
      </div>

      {/* Renewal */}
      <div className="mt-5">
        {renewOk && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-kore-sage/15 border border-kore-sage/35 text-[12px] font-semibold text-kore-sage-deep">
            Suscripción renovada. La actual quedó marcada como expirada y se creó una nueva.
          </div>
        )}
        <DarkActionCard
          title="Renovación manual"
          description="Registra un pago en efectivo y extiende la suscripción con las mismas condiciones del paquete actual."
          cta="Renovar manualmente"
          icon="↻"
          onAction={() => setRenewModal(true)}
          disabled={!canRenew || actionLoading}
        />
        {!canRenew && (
          <div className="mt-2 text-[11px] text-kore-burgundy/55">
            La renovación manual sólo aplica a suscripciones expiradas o canceladas.
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="mt-5">
        {deleteErr && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-rose-400/15 border border-rose-400/35 text-[12px] font-semibold text-rose-600">
            {deleteErr}
          </div>
        )}
        <SoftActionCard
          tone="danger"
          title="Eliminar suscripción"
          description="Borra la suscripción de forma permanente (junto con sus registros de pago y el vínculo de invitado, si tiene). Las sesiones agendadas se conservan pero pierden el vínculo a esta suscripción. Úsalo para deshacer una suscripción creada por error y poder crear la correcta."
          cta="Eliminar"
          onAction={() => setDeleteModal(true)}
          disabled={actionLoading}
        />
      </div>

      {renewModal && (
        <Modal
          title="Renovar suscripción"
          body={`Se registrará un pago manual y se extenderá la fecha de vencimiento ${selected.sessions_total} sesiones más, equivalente al paquete "${selected.package.title}".`}
          confirmLabel="Sí, renovar"
          loading={actionLoading}
          onClose={() => setRenewModal(false)}
          onConfirm={handleRenew}
        />
      )}

      {deleteModal && (
        <Modal
          title={`Eliminar suscripción #${selected.id}`}
          body={`Se eliminará permanentemente la suscripción de ${selected.customer_name || selected.customer_email} (paquete "${selected.package.title}"), incluidos sus registros de pago. Esta acción no se puede deshacer.`}
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
