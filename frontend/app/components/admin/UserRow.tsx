'use client';

import Link from 'next/link';
import Avatar from './Avatar';
import Pill from './Pill';

export type AdminUserRowData = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
  sessions_used_total: number;
  sessions_total_total: number;
};

function relativeTime(iso: string | null): { rel: string; abs: string | null } {
  if (!iso) return { rel: 'Sin actividad', abs: null };
  const date = new Date(iso);
  if (isNaN(date.getTime())) return { rel: 'Sin actividad', abs: null };
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  let rel: string;
  if (diff < 60) rel = 'Hace un momento';
  else if (diff < 3600) rel = `Hace ${Math.round(diff / 60)} min`;
  else if (diff < 86400) rel = `Hace ${Math.round(diff / 3600)} h`;
  else if (diff < 86400 * 7) rel = `Hace ${Math.round(diff / 86400)} d`;
  else
    rel = date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  const abs = date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { rel, abs };
}

export default function UserRow({ user }: { user: AdminUserRowData }) {
  const isTrainer = user.role === 'trainer';
  const tone = isTrainer ? 'sage' : user.is_active ? 'sakura' : 'amber';
  const sessionsPct =
    user.sessions_total_total > 0
      ? Math.min(100, (user.sessions_used_total / user.sessions_total_total) * 100)
      : 0;
  const time = relativeTime(user.last_login);

  return (
    <Link
      href={`/admin/users/${user.id}`}
      prefetch={false}
      className="grid grid-cols-[52px_2.2fr_1fr_1.4fr_1.2fr_0.8fr_28px] gap-4 items-center px-5 py-4 rounded-2xl bg-white/65 border border-kore-burgundy/8 hover:bg-white/95 hover:border-kore-red/20 hover:-translate-y-px hover:shadow-[0_6px_18px_-10px_rgba(45,15,26,0.18)] transition-all duration-150 group"
    >
      <div className="relative">
        <Avatar name={user.full_name} size={42} tone={tone} />
        {user.must_change_password && (
          <span
            title="Debe cambiar contraseña"
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-kore-amber border-2 border-kore-ivory flex items-center justify-center text-[9px] font-bold text-kore-wine-deep"
          >
            !
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-kore-burgundy truncate">{user.full_name}</div>
        <div className="text-[11px] text-kore-burgundy/60 mt-0.5 truncate">{user.email}</div>
      </div>

      <div>
        {isTrainer ? (
          <Pill tone="sage" size="sm" dot>
            Entrenador
          </Pill>
        ) : (
          <Pill tone="sakura" size="sm" dot>
            Cliente
          </Pill>
        )}
      </div>

      <div>
        {user.sessions_total_total > 0 ? (
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-heading text-sm font-semibold text-kore-burgundy">
                {user.sessions_used_total}
              </span>
              <span className="text-[10px] text-kore-burgundy/55">/ {user.sessions_total_total}</span>
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
        ) : (
          <span className="text-[11px] italic text-kore-burgundy/55">Sin plan</span>
        )}
      </div>

      <div>
        <div className="text-xs font-medium text-kore-gray-dark">{time.rel}</div>
        {time.abs && <div className="text-[10px] text-kore-burgundy/55 mt-0.5">{time.abs}</div>}
      </div>

      <div>
        {user.is_active ? (
          <Pill tone="sage" size="sm" dot>
            Activo
          </Pill>
        ) : (
          <Pill tone="neutral" size="sm">
            Inactivo
          </Pill>
        )}
      </div>

      <div className="text-base text-kore-burgundy/55 group-hover:text-kore-red group-hover:translate-x-0.5 transition-all">
        ›
      </div>
    </Link>
  );
}
