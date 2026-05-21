'use client';

import Link from 'next/link';
import Pill from './Pill';

type Category = 'semi_personalizado' | 'personalizado' | 'terapeutico';

export type UserSubscriptionEntry = {
  id: number;
  package: { title: string; category: Category };
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  sessions_used: number;
  sessions_total: number;
  role: 'host' | 'guest' | 'individual';
};

const STATUS_LABEL = { active: 'Activa', expired: 'Expirada', canceled: 'Cancelada' } as const;
const STATUS_TONE = { active: 'sage', expired: 'neutral', canceled: 'neutral' } as const;

const CAT_TILE: Record<Category, { gradient: string; icon: string; label: string }> = {
  semi_personalizado: { gradient: 'from-kore-petal to-kore-ivory', icon: '♀♂', label: 'Pareja' },
  personalizado: { gradient: 'from-kore-gold to-kore-ivory', icon: '◐', label: 'Personalizada' },
  terapeutico: { gradient: 'from-kore-sage to-kore-ivory', icon: '⚕', label: 'Terapéutica' },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SubCardCompact({ sub }: { sub: UserSubscriptionEntry }) {
  const tile = CAT_TILE[sub.package.category];
  const sessionsPct =
    sub.sessions_total > 0 ? Math.min(100, (sub.sessions_used / sub.sessions_total) * 100) : 0;
  const roleLabel = sub.role === 'host' ? 'Anfitrión' : sub.role === 'guest' ? 'Invitado' : null;

  const tileEl = (
    <div
      className={`w-[42px] h-[42px] flex-shrink-0 rounded-xl bg-gradient-to-br ${tile.gradient} flex items-center justify-center font-heading text-sm text-kore-wine-deep`}
    >
      {tile.icon}
    </div>
  );

  const infoEl = (
    <div className="min-w-0">
      <div className="font-heading text-[13px] font-semibold text-kore-burgundy truncate">
        {sub.package.title}
      </div>
      <div className="text-[11px] text-kore-burgundy/65 mt-0.5">
        {tile.label}
        {roleLabel ? ` · ${roleLabel}` : ''} ·{' '}
        {sub.status === 'active'
          ? `vence ${fmtDate(sub.expires_at)}`
          : `venció ${fmtDate(sub.expires_at)}`}
      </div>
    </div>
  );

  const sessionsEl = (
    <div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-heading text-[13px] font-semibold text-kore-burgundy">
          {sub.sessions_used}
        </span>
        <span className="text-[10px] text-kore-burgundy/55">/ {sub.sessions_total} sesiones</span>
      </div>
      <div className="h-1 rounded-[3px] bg-kore-burgundy/8 overflow-hidden">
        <div
          className="h-full rounded-[3px] bg-gradient-to-r from-kore-petal to-kore-red"
          style={{ width: `${sessionsPct}%` }}
        />
      </div>
    </div>
  );

  const statusPill = (
    <Pill tone={STATUS_TONE[sub.status]} size="sm" dot>
      {STATUS_LABEL[sub.status]}
    </Pill>
  );

  return (
    <Link
      href={`/admin-platform/subscriptions/detail?id=${sub.id}`}
      prefetch={false}
      className="block px-4 py-3.5 rounded-xl bg-kore-cream/50 border border-kore-burgundy/8 hover:bg-white/95 hover:border-kore-red/20 transition-all duration-150"
    >
      {/* Desktop — fila de 5 columnas */}
      <div className="hidden sm:grid sm:grid-cols-[46px_1fr_auto_auto_auto] sm:gap-4 sm:items-center">
        {tileEl}
        {infoEl}
        <div className="w-[110px]">{sessionsEl}</div>
        {statusPill}
        <span className="text-[11px] font-semibold text-kore-burgundy/65 whitespace-nowrap">
          Ver detalle ›
        </span>
      </div>

      {/* Móvil — card apilada */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="flex items-center gap-3">
          {tileEl}
          <div className="flex-1 min-w-0">{infoEl}</div>
          {statusPill}
        </div>
        {sessionsEl}
      </div>
    </Link>
  );
}
