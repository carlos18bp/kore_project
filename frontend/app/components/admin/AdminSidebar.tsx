'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  soon?: boolean;
};

function Icon({ kind }: { kind: 'home' | 'people' | 'card' | 'box' | 'chart' | 'logout' }) {
  const props = {
    className: 'w-[18px] h-[18px]',
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case 'people':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'card':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'box':
      return (
        <svg {...props}>
          <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
          <path d="M3 8l9 5 9-5M12 13v10" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 6-6" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      );
  }
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Panel', href: '/admin/dashboard', icon: <Icon kind="home" /> },
  { key: 'users', label: 'Usuarios', href: '/admin/users', icon: <Icon kind="people" /> },
  { key: 'subscriptions', label: 'Suscripciones', href: '/admin/subscriptions', icon: <Icon kind="card" /> },
  { key: 'packages', label: 'Paquetes', href: '#', icon: <Icon kind="box" />, soon: true },
  { key: 'reports', label: 'Reportes', href: '#', icon: <Icon kind="chart" />, soon: true },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const isActive = (item: NavItem) => {
    if (item.soon) return false;
    if (item.key === 'dashboard') return pathname === '/admin/dashboard';
    return pathname?.startsWith(item.href);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const initials =
    [user?.first_name?.[0], user?.last_name?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || (user?.name?.charAt(0) ?? 'A');

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.name ||
    'Administrador';

  return (
    <aside className="fixed left-0 top-0 h-dvh w-[248px] bg-gradient-to-br from-kore-wine-deep via-kore-wine-mid to-kore-wine flex-col z-50 hidden xl:flex border-r border-kore-gold/10">
      {/* Logo */}
      <div className="px-6 pt-7 pb-5 border-b border-kore-gold/10">
        <Link href="/admin/dashboard" prefetch={false}>
          <span className="font-heading text-2xl font-bold tracking-[0.16em] text-kore-ivory">
            KÓRE
          </span>
        </Link>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.32em] text-kore-gold">
          Admin
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-[14px] pt-5 overflow-y-auto">
        <div className="px-3 pt-2 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-kore-gold/55">
          Operación
        </div>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const baseClasses =
              'flex items-center gap-3 px-[14px] py-[11px] rounded-[11px] text-[13px] transition-all duration-150';
            const stateClasses = active
              ? 'bg-gradient-to-br from-kore-petal/15 to-kore-gold/10 text-kore-ivory border border-kore-gold/30 font-semibold shadow-[0_4px_12px_-6px_rgba(231,200,160,0.30)]'
              : 'text-kore-ivory/70 border border-transparent font-medium hover:bg-kore-ivory/5';

            const content = (
              <>
                <span className={active ? 'text-kore-gold' : 'text-kore-gold/55'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-kore-gold/50">
                    Pronto
                  </span>
                )}
              </>
            );

            if (item.soon) {
              return (
                <li key={item.key}>
                  <span
                    aria-disabled="true"
                    className={`${baseClasses} ${stateClasses} opacity-55 cursor-not-allowed`}
                  >
                    {content}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.key}>
                <Link href={item.href} prefetch={false} className={`${baseClasses} ${stateClasses}`}>
                  {content}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User card */}
      <div className="px-[14px] pb-5 pt-3 border-t border-kore-gold/10">
        <div className="flex items-center gap-3 px-3 py-[10px] rounded-xl bg-black/40">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kore-petal to-kore-gold flex items-center justify-center font-heading text-sm font-bold text-kore-wine-deep flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-kore-ivory truncate">{fullName}</p>
            <p className="text-[10px] text-kore-gold/65">Administrador</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-kore-gold/55 hover:text-kore-ivory p-1 transition-colors"
          >
            <Icon kind="logout" />
          </button>
        </div>
      </div>
    </aside>
  );
}
