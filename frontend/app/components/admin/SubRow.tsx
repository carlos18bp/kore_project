'use client';

import Link from 'next/link';
import Avatar from './Avatar';
import Pill from './Pill';

type Category = 'semi_personalizado' | 'personalizado' | 'terapeutico';

export type AdminSubRowData = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  package: { title: string; category: Category };
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  sessions_used: number;
  sessions_total: number;
  is_duo?: boolean;
  guest_info?: {
    status: 'pending' | 'accepted' | 'revoked';
    invited_email: string;
    guest_name: string | null;
    guest_user_id: number | null;
    accepted_at?: string | null;
  } | null;
};

const STATUS_LABEL = { active: 'Activa', expired: 'Expirada', canceled: 'Cancelada' } as const;
const STATUS_TONE = { active: 'sage', expired: 'neutral', canceled: 'neutral' } as const;

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}

function GuestSubline({ sub }: { sub: AdminSubRowData }) {
  if (!sub.guest_info) {
    return <span className="text-[11px] italic text-kore-burgundy/55">Sin invitación</span>;
  }
  const g = sub.guest_info;
  if (g.status === 'accepted') {
    return (
      <span className="text-[11px] text-kore-burgundy/65">
        + <span className="text-kore-gray-dark font-medium">{g.guest_name ?? g.invited_email}</span>{' '}
        <span className="ml-1 text-[9px] tracking-[0.10em] uppercase text-kore-burgundy/50">
          invitado
        </span>
      </span>
    );
  }
  if (g.status === 'pending') {
    return <span className="text-[11px] text-kore-amber-deep">⏳ Esperando: {g.invited_email}</span>;
  }
  if (g.status === 'revoked') {
    return <span className="text-[11px] italic text-kore-burgundy/55">Invitación revocada</span>;
  }
  return null;
}

export default function SubRow({ sub }: { sub: AdminSubRowData }) {
  const isPair = sub.is_duo === true;
  const guestAccepted = isPair && sub.guest_info?.status === 'accepted';
  const sessionsPct =
    sub.sessions_total > 0 ? Math.min(100, (sub.sessions_used / sub.sessions_total) * 100) : 0;

  const customerTone =
    sub.package.category === 'semi_personalizado'
      ? 'sakura'
      : sub.package.category === 'terapeutico'
        ? 'sage'
        : 'amber';

  const customerEl = (
    <div className="flex items-center gap-3 min-w-0">
      {isPair && guestAccepted && sub.guest_info ? (
        <div className="flex relative w-14">
          <Avatar name={sub.customer_name} size={36} tone="sakura" />
          <div className="-ml-3.5">
            <Avatar
              name={sub.guest_info.guest_name ?? sub.guest_info.invited_email}
              size={36}
              tone="amber"
            />
          </div>
        </div>
      ) : (
        <Avatar name={sub.customer_name} size={36} tone={customerTone} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-kore-burgundy truncate">
          {sub.customer_name}
          {isPair && (
            <span className="ml-1.5 text-[9px] font-bold tracking-[0.16em] text-kore-burgundy/55 uppercase">
              · anfitrión
            </span>
          )}
        </div>
        {isPair ? (
          <div className="mt-0.5 truncate">
            <GuestSubline sub={sub} />
          </div>
        ) : (
          <div className="text-[11px] text-kore-burgundy/60 mt-0.5 truncate">
            {sub.customer_email}
          </div>
        )}
      </div>
    </div>
  );

  const packageEl = (
    <div className="min-w-0">
      <div className="font-heading text-[13px] font-semibold text-kore-burgundy truncate">
        {sub.package.title}
      </div>
      <div className="text-[10px] text-kore-burgundy/55 mt-1 tracking-[0.10em] uppercase">
        #{sub.id}
      </div>
    </div>
  );

  const sessionsEl = (
    <div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-heading text-sm font-semibold text-kore-burgundy">
          {sub.sessions_used}
        </span>
        <span className="text-[10px] text-kore-burgundy/55">/ {sub.sessions_total}</span>
      </div>
      <div className="h-1 rounded-[3px] bg-kore-burgundy/8 overflow-hidden">
        <div
          className={`h-full rounded-[3px] transition-all duration-700 ${
            sessionsPct >= 80
              ? 'bg-gradient-to-r from-kore-amber to-kore-amber-deep'
              : 'bg-gradient-to-r from-kore-petal to-kore-red'
          }`}
          style={{ width: `${sessionsPct}%` }}
        />
      </div>
    </div>
  );

  const expiryEl = (
    <div className="text-xs font-medium text-kore-gray-dark">{fmtShortDate(sub.expires_at)}</div>
  );

  const statusPill = (
    <Pill tone={STATUS_TONE[sub.status]} size="sm" dot>
      {STATUS_LABEL[sub.status]}
    </Pill>
  );

  const chevron = (
    <div className="text-base text-kore-burgundy/55 group-hover:text-kore-red group-hover:translate-x-0.5 transition-all">
      ›
    </div>
  );

  return (
    <Link
      href={`/admin-platform/subscriptions/detail?id=${sub.id}`}
      prefetch={false}
      className="block px-5 py-3.5 rounded-2xl bg-white/65 border border-kore-burgundy/8 hover:bg-white/95 hover:border-kore-red/20 hover:-translate-y-px hover:shadow-[0_6px_18px_-10px_rgba(45,15,26,0.18)] transition-all duration-150 group"
    >
      {/* Desktop — grid de 6 columnas (igual que antes) */}
      <div
        data-testid="subrow-desktop"
        className="hidden xl:grid xl:grid-cols-[2fr_1.6fr_1.4fr_1fr_0.9fr_28px] xl:gap-4 xl:items-center"
      >
        {customerEl}
        {packageEl}
        {sessionsEl}
        {expiryEl}
        <div>{statusPill}</div>
        {chevron}
      </div>

      {/* Móvil/tablet — card apilada */}
      <div data-testid="subrow-card" className="flex flex-col gap-3 xl:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">{customerEl}</div>
          {chevron}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-kore-burgundy/8">
          <div className="min-w-[120px]">{packageEl}</div>
          <div className="min-w-[96px]">{sessionsEl}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.10em] text-kore-burgundy/45">
              Vence
            </span>
            {expiryEl}
          </div>
          {statusPill}
        </div>
      </div>
    </Link>
  );
}
