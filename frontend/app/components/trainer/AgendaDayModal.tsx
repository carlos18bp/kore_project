'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTrainerStore, type UpcomingSession } from '@/lib/stores/trainerStore';
import ResponsiveSheet from './ResponsiveSheet';

type Props = {
  date: Date;
  sessions: UpcomingSession[];
  onClose: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  pending: 'Pendiente',
  canceled: 'Cancelada',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AgendaDayModal({ date, sessions, onClose }: Props) {
  const dateKey = localDateKey(date);
  const blockedDates = useTrainerStore((s) => s.blockedDates);
  const blockedReasons = useTrainerStore((s) => s.blockedReasons);
  const blockDate = useTrainerStore((s) => s.blockDate);
  const unblockDate = useTrainerStore((s) => s.unblockDate);

  const isBlocked = blockedDates.has(dateKey);
  const existingReason = blockedReasons[dateKey] ?? '';

  const isPast = new Date(`${dateKey}T23:59:59`) < new Date(new Date().toDateString());

  const [editingBlock, setEditingBlock] = useState(false);
  const [reasonDraft, setReasonDraft] = useState(existingReason);
  const [submitting, setSubmitting] = useState(false);

  const longDate = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const ordered = [...sessions].sort((a, b) =>
    (a.starts_at ?? '').localeCompare(b.starts_at ?? ''),
  );

  async function handleBlock() {
    setSubmitting(true);
    const ok = await blockDate(dateKey, reasonDraft.trim() || undefined);
    setSubmitting(false);
    if (ok) setEditingBlock(false);
  }

  async function handleUnblock() {
    setSubmitting(true);
    await unblockDate(dateKey);
    setSubmitting(false);
  }

  return (
    <ResponsiveSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-6 xl:pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-heading text-[16px] font-semibold text-kore-wine-dark capitalize">
              {longDate}
            </div>
            <div className="font-body text-[12px] text-kore-wine-dark/55 mt-0.5">
              {ordered.length} {ordered.length === 1 ? 'sesión' : 'sesiones'}
              {isBlocked && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-kore-crimson/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-kore-crimson">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                  </svg>
                  Día bloqueado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Block / Unblock controls — hidden for past dates */}
        {!isPast && (
          <div className="rounded-xl border border-kore-wine-dark/10 bg-kore-cream/40 px-3.5 py-3">
            {isBlocked ? (
              <div className="space-y-2">
                <p className="font-body text-[11px] font-bold uppercase tracking-wide text-kore-wine-dark/55">
                  Bloqueo activo
                </p>
                {existingReason && (
                  <p className="font-body text-[12px] text-kore-wine-dark/65">
                    {existingReason}
                  </p>
                )}
                <p className="font-body text-[11px] text-kore-wine-dark/45">
                  Ningún cliente podrá agendar nuevas sesiones este día.
                  {ordered.length > 0 && ' Las sesiones ya agendadas siguen vigentes.'}
                </p>
                <button
                  onClick={handleUnblock}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 rounded-full bg-white border border-kore-wine-dark/15 px-3 py-1 text-[11px] font-semibold text-kore-wine-dark hover:bg-kore-cream transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Desbloqueando…' : 'Desbloquear este día'}
                </button>
              </div>
            ) : editingBlock ? (
              <div className="space-y-2">
                <p className="font-body text-[11px] font-bold uppercase tracking-wide text-kore-wine-dark/55">
                  Bloquear este día
                </p>
                <textarea
                  value={reasonDraft}
                  onChange={(e) => setReasonDraft(e.target.value)}
                  rows={2}
                  placeholder="Motivo (opcional, sólo visible para ti)…"
                  className="w-full rounded-lg border border-kore-wine-dark/15 bg-white px-3 py-2 text-[12px] text-kore-wine-dark placeholder:text-kore-wine-dark/30 focus:outline-none focus:border-kore-red/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingBlock(false); setReasonDraft(''); }}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-white border border-kore-wine-dark/15 py-2 text-[12px] font-semibold text-kore-wine-dark hover:bg-kore-cream transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBlock}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-kore-crimson text-white py-2 text-[12px] font-semibold hover:bg-kore-crimson/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Bloqueando…' : 'Confirmar bloqueo'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-[12px] text-kore-wine-dark/65">
                  ¿No vas a atender este día? Bloquéalo para que ningún cliente pueda agendar nuevos slots.
                </p>
                <button
                  onClick={() => setEditingBlock(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-kore-crimson/10 px-3 py-1 text-[11px] font-semibold text-kore-crimson hover:bg-kore-crimson/15 transition-colors whitespace-nowrap"
                >
                  Bloquear día
                </button>
              </div>
            )}
          </div>
        )}

        {ordered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-kore-wine-dark/15 bg-kore-cream/50 px-4 py-8 text-center">
            <p className="font-body text-[13px] text-kore-wine-dark/55">
              Sin sesiones este día
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ordered.map((s) => (
              <Link
                key={s.id}
                href={`/trainer/clients/client?id=${s.customer_id}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-xl border border-kore-wine-dark/8 bg-kore-cream/50 px-3.5 py-3 transition-colors hover:bg-white"
              >
                <span className="font-heading text-[13px] font-semibold text-kore-wine-dark w-12 flex-shrink-0">
                  {fmtTime(s.starts_at)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[13px] font-semibold text-kore-gray-dark truncate">
                    {s.customer_name}
                  </p>
                  <p className="font-body text-[11px] text-kore-wine-dark/55 truncate">
                    {s.package_title}
                  </p>
                </div>
                <span className="font-body text-[10px] font-bold uppercase tracking-wide text-kore-wine-dark/45 flex-shrink-0">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
