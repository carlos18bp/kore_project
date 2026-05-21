'use client';

import Link from 'next/link';
import type { UpcomingSession } from '@/lib/stores/trainerStore';
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

export default function AgendaDayModal({ date, sessions, onClose }: Props) {
  const longDate = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const ordered = [...sessions].sort((a, b) =>
    (a.starts_at ?? '').localeCompare(b.starts_at ?? ''),
  );

  return (
    <ResponsiveSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-6 xl:pt-5 space-y-4">
        <div>
          <div className="font-heading text-[16px] font-semibold text-kore-wine-dark capitalize">
            {longDate}
          </div>
          <div className="font-body text-[12px] text-kore-wine-dark/55 mt-0.5">
            {ordered.length} {ordered.length === 1 ? 'sesión' : 'sesiones'}
          </div>
        </div>

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
