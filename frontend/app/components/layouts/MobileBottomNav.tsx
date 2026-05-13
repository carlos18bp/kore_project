'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';

const tabs = [
  {
    label: 'Inicio',
    href: '/dashboard',
    match: (p: string) => p === '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: 'Programa',
    href: '/mi-programa',
    match: (p: string) => p === '/mi-programa' || p.startsWith('/mi-programa'),
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
  },
  {
    label: 'Nutrición',
    href: '/my-nutrition',
    match: (p: string) => p === '/my-nutrition' || p.startsWith('/my-nutrition'),
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    label: 'Perfil',
    href: '/profile',
    match: (p: string) => p === '/profile' || p.startsWith('/profile'),
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { hasActiveSubscription, subscriptions } = useSubscriptionStore();
  const {
    nutritionDue, parqDue,
    anthropometryUnseen, posturometryUnseen, physicalEvalUnseen,
    subscriptionExpiring,
  } = usePendingAssessmentsStore();

  const subscriptionExpired = subscriptions.length > 0 && !hasActiveSubscription;

  const hasProfileBadge =
    anthropometryUnseen ||
    posturometryUnseen ||
    physicalEvalUnseen ||
    parqDue ||
    subscriptionExpiring ||
    nutritionDue;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-white/95 backdrop-blur-md border-t border-kore-gray-light/40 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname);
          const isAllowed =
            !subscriptionExpired ||
            tab.href === '/subscription' ||
            tab.href === '/profile';

          const baseClass = `relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors active:scale-95 transition-transform duration-100`;
          const colorClass = !isAllowed
            ? 'text-kore-gray-dark/20 pointer-events-none'
            : isActive
            ? 'text-kore-red'
            : 'text-kore-gray-dark/40';

          return (
            <Link
              key={tab.href}
              href={isAllowed ? tab.href : '#'}
              prefetch={false}
              className={`${baseClass} ${colorClass}`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              {tab.href === '/profile' && hasProfileBadge && (
                <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full bg-kore-red animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
