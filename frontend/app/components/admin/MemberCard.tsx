'use client';

import Link from 'next/link';
import Avatar from './Avatar';

type Role = 'Anfitrión' | 'Invitado' | 'Cliente';

type AvatarTone = 'sakura' | 'amber' | 'sage';

const TONE_BY_ROLE: Record<Role, AvatarTone> = {
  Anfitrión: 'sakura',
  Invitado: 'amber',
  Cliente: 'sage',
};

type Props = {
  role: Role;
  name: string;
  email: string;
  userId?: number | null;
  fullWidth?: boolean;
};

export default function MemberCard({ role, name, email, userId, fullWidth }: Props) {
  const inner = (
    <div
      className={`flex items-center gap-3.5 p-4 rounded-xl bg-kore-cream/55 border border-kore-burgundy/8 ${
        userId ? 'hover:bg-white/80 transition-colors' : ''
      }`}
    >
      <Avatar name={name} size={50} tone={TONE_BY_ROLE[role]} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
          {role}
        </div>
        <div className="font-heading text-[15px] font-semibold text-kore-burgundy mt-0.5 truncate">
          {name}
        </div>
        <div className="text-[11px] text-kore-burgundy/60 mt-0.5 truncate">{email}</div>
      </div>
      {userId && <span className="text-base text-kore-burgundy/55">›</span>}
    </div>
  );
  const widthClass = fullWidth ? 'block' : '';
  if (userId) {
    return (
      <Link href={`/admin/users/${userId}`} prefetch={false} className={widthClass}>
        {inner}
      </Link>
    );
  }
  return <div className={widthClass}>{inner}</div>;
}

export function PendingMemberCard({ email }: { email: string }) {
  return (
    <div className="p-4 rounded-xl bg-kore-amber/10 border border-dashed border-kore-amber/45">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-amber-deep">
        Invitación pendiente
      </div>
      <div className="font-heading text-sm font-semibold text-kore-burgundy mt-1.5">
        Esperando aceptación
      </div>
      <div className="text-[11px] text-kore-burgundy/60 mt-1">{email}</div>
    </div>
  );
}

export function RevokedMemberCard({ name }: { name: string }) {
  return (
    <div className="p-4 rounded-xl bg-kore-burgundy/4 border border-dashed border-kore-burgundy/15 opacity-70">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
        Invitación revocada
      </div>
      <div className="text-xs italic text-kore-burgundy/65 mt-1.5">{name}</div>
    </div>
  );
}

export function NoGuestCard() {
  return (
    <div className="p-4 rounded-xl bg-kore-burgundy/4 border border-dashed border-kore-burgundy/15">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
        Sin invitación
      </div>
      <div className="text-xs text-kore-burgundy/65 mt-1.5">
        El anfitrión aún no ha enviado invitación.
      </div>
    </div>
  );
}
