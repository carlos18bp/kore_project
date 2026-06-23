'use client';

import type { RenewalHistoryItem } from '@/lib/stores/adminSubscriptionStore';

const KIND_LABEL: Record<RenewalHistoryItem['kind'], string> = {
  initial: 'Compra inicial',
  manual: 'Renovación manual',
  automatic: 'Renovación automática',
  plan_change: 'Cambio de plan',
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RenewalHistory({ items }: { items: RenewalHistoryItem[] }) {
  // Defensive: the endpoint may yield a non-array payload (e.g. an error body
  // or a mocked catch-all in tests). Never let it crash the whole page.
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return (
      <p className="text-[12px] text-kore-burgundy/55">
        Sin renovaciones todavía.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {list.map((it, i) => (
        <li
          key={`${it.period_start}-${i}`}
          className="rounded-2xl border border-kore-burgundy/10 bg-white/70 backdrop-blur-sm p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-kore-burgundy/65">
              {KIND_LABEL[it.kind] ?? it.kind}
            </span>
            <span className="text-[11px] text-kore-burgundy/55">
              {fmt(it.period_start)} → {fmt(it.period_end)}
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-kore-burgundy/80">
            {it.package_title} · {it.sessions_granted} sesiones
            {it.payment && (
              <> · {it.payment.amount} {it.payment.currency} ({it.payment.provider})</>
            )}
          </div>
          {it.actor_email && (
            <div className="mt-0.5 text-[11px] text-kore-burgundy/45">
              Registrada por {it.actor_email}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
