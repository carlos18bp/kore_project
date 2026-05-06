'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useAdminSubscriptionStore,
  type PatchSubscriptionPayload,
} from '@/lib/stores/adminSubscriptionStore';


const STATUS_OPTIONS = [
  { label: 'Activa', value: 'active' },
  { label: 'Expirada', value: 'expired' },
  { label: 'Cancelada', value: 'canceled' },
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

function toDatetimeLocal(iso: string) {
  return iso ? iso.slice(0, 16) : '';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminSubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { selected, loading, actionLoading, error, fetchById, patchSubscription, renewSubscription } =
    useAdminSubscriptionStore();

  const [form, setForm] = useState<PatchSubscriptionPayload>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState(false);
  const [renewedId, setRenewedId] = useState<number | null>(null);

  useEffect(() => {
    if (id) fetchById(id);
  }, [id, fetchById]);

  useEffect(() => {
    if (selected) {
      setForm({
        status: selected.status,
        sessions_total: selected.sessions_total,
        sessions_used: selected.sessions_used,
        expires_at: selected.expires_at,
        starts_at: selected.starts_at,
        is_recurring: selected.is_recurring,
      });
    }
  }, [selected]);

  const handleSave = async () => {
    setSaveSuccess(false);
    const ok = await patchSubscription(id, form);
    if (ok) setSaveSuccess(true);
  };

  const handleRenew = async () => {
    setRenewSuccess(false);
    const newSub = await renewSubscription(id);
    if (newSub) {
      setRenewSuccess(true);
      setRenewedId(newSub.id);
      await fetchById(id);
    }
  };

  if (loading && !selected) {
    return (
      <div className="px-4 py-20 flex justify-center">
        <div className="w-6 h-6 border-2 border-kore-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="px-4 py-20 text-center text-sm text-kore-gray-dark/40">
        Suscripción no encontrada.
      </div>
    );
  }

  const canRenew = selected.status === 'expired' || selected.status === 'canceled';

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5 pt-20 xl:pt-8">
      {/* Back */}
      <button
        onClick={() => router.push('/admin/subscriptions')}
        className="text-sm text-kore-gray-dark/50 hover:text-kore-red transition-colors"
      >
        ← Volver a suscripciones
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/40 mb-1">
            Suscripción #{selected.id}
          </p>
          <h1 className="text-xl font-bold text-kore-gray-dark">{selected.package.title}</h1>
        </div>
        <span
          className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_PILL[selected.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {STATUS_LABEL[selected.status] ?? selected.status}
        </span>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/40">
          Información del cliente
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-kore-gray-dark/40 mb-0.5">Nombre</p>
            <p className="font-medium text-kore-gray-dark">{selected.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-kore-gray-dark/40 mb-0.5">Email</p>
            <p className="font-medium text-kore-gray-dark">{selected.customer_email}</p>
          </div>
          <div>
            <p className="text-xs text-kore-gray-dark/40 mb-0.5">Precio del paquete</p>
            <p className="font-medium text-kore-gray-dark">
              {Number(selected.package.price).toLocaleString('es-CO', { style: 'currency', currency: selected.package.currency, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-kore-gray-dark/40 mb-0.5">Creada</p>
            <p className="font-medium text-kore-gray-dark">{formatDate(selected.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-kore-gray-dark/40">
          Editar suscripción
        </p>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-kore-gray-dark/60 mb-1.5">Estado</label>
          <select
            value={form.status ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PatchSubscriptionPayload['status'] }))}
            className="w-full rounded-xl border border-kore-gray-light/40 px-3 py-2 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Sessions */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-kore-gray-dark/60 mb-1.5">
              Sesiones totales
            </label>
            <input
              type="number"
              min={0}
              value={form.sessions_total ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sessions_total: Number(e.target.value) }))}
              className="w-full rounded-xl border border-kore-gray-light/40 px-3 py-2 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-kore-gray-dark/60 mb-1.5">
              Sesiones usadas
            </label>
            <input
              type="number"
              min={0}
              value={form.sessions_used ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sessions_used: Number(e.target.value) }))}
              className="w-full rounded-xl border border-kore-gray-light/40 px-3 py-2 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-kore-gray-dark/60 mb-1.5">
              Fecha de inicio
            </label>
            <input
              type="datetime-local"
              value={toDatetimeLocal(form.starts_at ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value + ':00Z' }))}
              className="w-full rounded-xl border border-kore-gray-light/40 px-3 py-2 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-kore-gray-dark/60 mb-1.5">
              Fecha de vencimiento
            </label>
            <input
              type="datetime-local"
              value={toDatetimeLocal(form.expires_at ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value + ':00Z' }))}
              className="w-full rounded-xl border border-kore-gray-light/40 px-3 py-2 text-sm text-kore-gray-dark focus:outline-none focus:ring-2 focus:ring-kore-red/20"
            />
          </div>
        </div>

        {/* Recurring */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!form.is_recurring}
            onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
            className="w-4 h-4 rounded accent-kore-red"
          />
          <span className="text-sm text-kore-gray-dark/70">Renovación automática activa</span>
        </label>

        {/* Error */}
        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{error}</p>
        )}

        {/* Success */}
        {saveSuccess && (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
            Cambios guardados correctamente.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={actionLoading}
          className="w-full bg-kore-red text-white rounded-xl py-2.5 font-medium text-sm hover:bg-kore-red/90 transition-colors disabled:opacity-50"
        >
          {actionLoading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {/* Manual Renew — admin privilege card */}
      {canRenew && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 shadow-lg space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
              Acción administrativa
            </p>
            <p className="text-base font-bold text-white">Renovar manualmente</p>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Crea una nueva suscripción activa registrando un pago en efectivo. La suscripción
              actual queda marcada como expirada.
            </p>
          </div>

          {renewSuccess && renewedId && (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3 py-2">
              <p className="text-xs text-emerald-300">
                Renovación exitosa. Nueva suscripción #{renewedId} creada.{' '}
                <button
                  onClick={() => router.push(`/admin/subscriptions/${renewedId}`)}
                  className="underline hover:no-underline"
                >
                  Ver →
                </button>
              </p>
            </div>
          )}

          <button
            onClick={handleRenew}
            disabled={actionLoading || renewSuccess}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl py-2.5 font-medium text-sm transition-colors disabled:opacity-40"
          >
            {actionLoading ? 'Renovando…' : 'Renovar manualmente (Efectivo)'}
          </button>
        </div>
      )}
    </div>
  );
}
