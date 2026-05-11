'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTrainerStore } from '@/lib/stores/trainerStore';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Hoy',
    href: '/trainer/dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    key: 'clients',
    label: 'Mis Clientes',
    href: '/trainer/clients',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'alerts',
    label: 'Alertas',
    href: '/trainer/alerts',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    ),
    badge: true,
  },
  {
    key: 'metrics',
    label: 'Métricas',
    href: '/trainer/metrics',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 6-6" />
      </svg>
    ),
  },
  {
    key: 'evidence',
    label: 'Evidencia',
    href: '/trainer/evidence',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    key: 'nutrition-catalog',
    label: 'Catálogo comidas',
    href: '/trainer/nutrition-catalog',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M3 12h18M3 18h12"/><circle cx="19" cy="18" r="2"/><path d="M19 4v12"/>
      </svg>
    ),
  },
  {
    key: 'messages',
    label: 'Mensajes',
    href: '/trainer/messages',
    soon: true,
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function TrainerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { riskDashboard } = useTrainerStore();
  const alertBadge = (riskDashboard?.risk_summary?.alto ?? 0) + (riskDashboard?.risk_summary?.medio ?? 0);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const initials = user
    ? user.name.trim().split(/\s+/).slice(0, 2).map((s: string) => s[0] ?? '').join('').toUpperCase()
    : '?';

  return (
    <aside
      className="fixed left-0 top-0 h-dvh w-64 flex-col z-50 hidden xl:flex"
      style={{
        background: 'linear-gradient(170deg, #2D0F1A 0%, #4A1828 100%)',
        borderRight: '1px solid rgba(231,200,160,0.12)',
      }}
    >
      {/* Logo */}
      <div className="px-6 pt-7 pb-5" style={{ borderBottom: '1px solid rgba(231,200,160,0.10)' }}>
        <Link href="/trainer/dashboard" prefetch={false}>
          <span className="font-heading text-2xl font-bold tracking-[0.16em]" style={{ color: '#FFF8EC' }}>
            KÓRE
          </span>
        </Link>
        <p className="font-body text-[9px] font-semibold tracking-[0.32em] uppercase mt-1" style={{ color: '#E7C8A0' }}>
          Entrenador
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3.5 py-5 flex flex-col gap-1 overflow-y-auto">
        <p className="font-body text-[9px] font-bold tracking-[0.22em] uppercase px-3 py-2" style={{ color: 'rgba(231,200,160,0.55)' }}>
          Operación
        </p>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (!item.soon && item.href !== '/trainer/dashboard' && pathname.startsWith(item.href));
          const showBadge = item.badge && alertBadge > 0;

          return (
            <Link
              key={item.key}
              href={item.soon ? '#' : item.href}
              prefetch={false}
              onClick={item.soon ? (e) => e.preventDefault() : undefined}
              className="flex items-center gap-3 px-3.5 py-[11px] rounded-[11px] transition-all duration-150 font-body text-[13px]"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(244,199,199,0.16), rgba(231,200,160,0.10))'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(231,200,160,0.30)'
                  : '1px solid transparent',
                color: isActive ? '#FFF8EC' : 'rgba(255,248,236,0.72)',
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive ? '0 4px 12px -6px rgba(231,200,160,0.30)' : 'none',
                opacity: item.soon ? 0.55 : 1,
                cursor: item.soon ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ color: isActive ? '#E7C8A0' : 'rgba(231,200,160,0.55)' }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span
                  className="min-w-[20px] h-5 rounded-full flex items-center justify-center font-body text-[10px] font-bold text-white px-1.5"
                  style={{ background: '#9A0526' }}
                >
                  {alertBadge > 99 ? '99+' : alertBadge}
                </span>
              )}
              {item.soon && (
                <span className="font-body text-[8px] font-bold tracking-[0.18em] uppercase" style={{ color: 'rgba(231,200,160,0.50)' }}>
                  Pronto
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="px-3.5 pb-5" style={{ borderTop: '1px solid rgba(231,200,160,0.10)' }}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(20,5,12,0.40)' }}
        >
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-heading text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #F4C7C7, #E7C8A0)',
              color: '#5C2030',
            }}
          >
            {initials}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="font-body text-xs font-semibold truncate" style={{ color: '#FFF8EC' }}>
              {user?.name ?? 'Entrenador'}
            </p>
            <p className="font-body text-[10px] truncate" style={{ color: 'rgba(231,200,160,0.65)' }}>
              Entrenador
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: 'transparent', border: 'none', color: 'rgba(231,200,160,0.55)', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
