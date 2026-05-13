'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { BookingData } from '@/lib/stores/bookingStore';

type Props = {
  bookings: BookingData[];
  /** When provided, renders a close button (used when the card lives inside a modal). */
  onClose?: () => void;
  className?: string;
};

const STATUS_META: Record<BookingData['status'], { label: string; cls: string }> = {
  pending: { label: 'Agendada', cls: 'bg-amber-400/20 text-amber-600 border-amber-400/40' },
  confirmed: { label: 'Realizada', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  canceled: { label: 'Cancelada', cls: 'bg-rose-400/20 text-rose-500 border-rose-400/40' },
};

export default function UpcomingSessionsCard({ bookings, onClose, className = '' }: Props) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const now = Date.now();
  const upcoming = useMemo(
    () => bookings
      .filter((b) => b.status !== 'canceled' && new Date(b.starts_at).getTime() > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [bookings, now],
  );
  const past = useMemo(
    () => bookings
      .filter((b) => b.status === 'canceled' || new Date(b.starts_at).getTime() <= now)
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [bookings, now],
  );

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-kore-gray-light/40 shadow-sm p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-kore-gray-dark/45">Tus citas</p>
          <h3 className="font-heading text-lg font-semibold text-kore-gray-dark mt-0.5">Mis sesiones</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1 -m-1 rounded-lg text-kore-gray-dark/40 hover:text-kore-gray-dark transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-kore-gray-dark/[0.05] mb-4">
        {([
          ['upcoming', `Próximas (${upcoming.length})`],
          ['past', `Pasadas (${past.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`text-xs py-2 rounded-lg transition-all ${
              tab === k
                ? 'bg-white text-kore-gray-dark font-bold shadow-sm'
                : 'text-kore-gray-dark/50 font-medium hover:text-kore-gray-dark/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-center text-[13px] italic text-kore-gray-dark/40 py-8">
          {tab === 'upcoming' ? 'No tienes sesiones próximas.' : 'Aún no tienes sesiones pasadas.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
          {list.slice(0, 20).map((b) => {
            const d = new Date(b.starts_at);
            const meta = STATUS_META[b.status];
            const trainerName = b.trainer ? `${b.trainer.first_name} ${b.trainer.last_name}`.trim() : '';
            const dateStr = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
            return (
              <div
                key={b.id}
                data-testid={`upcoming-session-row-${b.id}`}
                className="flex items-center gap-3 rounded-xl bg-white border border-kore-gray-light/40 px-4 py-3"
              >
                <div className="w-9 h-9 rounded-lg bg-kore-red/10 grid place-items-center text-kore-red shrink-0">
                  <CalendarDays className="w-4 h-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-kore-gray-dark capitalize leading-tight">
                    {dateStr} · <span className="text-kore-red">{timeStr}</span>
                  </p>
                  {trainerName && (
                    <p className="text-[11px] text-kore-gray-dark/50 truncate mt-0.5">{trainerName}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
