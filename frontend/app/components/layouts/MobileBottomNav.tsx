'use client';

import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import AppMobileBottomNav, {
  type MobileNavMoreItem,
  type MobileNavTab,
} from './AppMobileBottomNav';

const iconProps = {
  className: 'w-5 h-5',
  fill: 'none' as const,
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);
const ProgramIcon = (
  <svg {...iconProps}>
    <path d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
  </svg>
);
const NutritionIcon = (
  <svg {...iconProps}>
    <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
  </svg>
);
const ProfileIcon = (
  <svg {...iconProps}>
    <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const EvaluationsIcon = (
  <svg {...iconProps}>
    <path d="M3.75 12h3l2-5 4 10 2-5h5.5" />
  </svg>
);
const HeartIcon = (
  <svg {...iconProps}>
    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);
const ShieldIcon = (
  <svg {...iconProps}>
    <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
const BarsIcon = (
  <svg {...iconProps}>
    <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const ClipboardIcon = (
  <svg {...iconProps}>
    <path d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
  </svg>
);

export default function MobileBottomNav() {
  const { user } = useAuthStore();
  const { hasActiveSubscription, subscriptions } = useSubscriptionStore();
  const {
    nutritionDue,
    parqDue,
    anthropometryUnseen,
    posturometryUnseen,
    physicalEvalUnseen,
    subscriptionExpiring,
    loaded: pendingLoaded,
    fetchPending,
    markSeen,
  } = usePendingAssessmentsStore();

  useEffect(() => {
    if (user && !pendingLoaded) fetchPending();
  }, [user, pendingLoaded, fetchPending]);

  const subscriptionExpired = subscriptions.length > 0 && !hasActiveSubscription;
  const dot = (cond: boolean) => (cond ? ('dot' as const) : undefined);

  const tabs: MobileNavTab[] = useMemo(() => {
    const locked = (href: string) =>
      subscriptionExpired && href !== '/subscription' && href !== '/profile';
    return [
      { key: 'home', label: 'Inicio', href: '/dashboard', icon: HomeIcon, match: (p) => p === '/dashboard', disabled: locked('/dashboard') },
      { key: 'program', label: 'Programa', href: '/mi-programa', icon: ProgramIcon, match: (p) => p.startsWith('/mi-programa'), disabled: locked('/mi-programa') },
      { key: 'nutrition', label: 'Nutrición', href: '/my-nutrition', icon: NutritionIcon, match: (p) => p.startsWith('/my-nutrition'), badge: dot(nutritionDue), disabled: locked('/my-nutrition') },
      { key: 'profile', label: 'Perfil', href: '/profile', icon: ProfileIcon, match: (p) => p.startsWith('/profile'), badge: dot(subscriptionExpiring) },
    ];
  }, [subscriptionExpired, nutritionDue, subscriptionExpiring]);

  const evalsPendingBadge = dot(
    anthropometryUnseen || posturometryUnseen || physicalEvalUnseen || parqDue,
  );

  const moreItems: MobileNavMoreItem[] = useMemo(() => {
    const locked = (href: string) =>
      subscriptionExpired && href !== '/subscription' && href !== '/profile';
    return [
      {
        key: 'anthro',
        label: 'Antropometría',
        icon: HeartIcon,
        href: '/my-diagnosis',
        badge: dot(anthropometryUnseen),
        onClick: locked('/my-diagnosis') ? undefined : () => markSeen('anthropometry'),
      },
      {
        key: 'posture',
        label: 'Evaluación Postural',
        icon: ShieldIcon,
        href: '/my-posturometry',
        badge: dot(posturometryUnseen),
        onClick: locked('/my-posturometry') ? undefined : () => markSeen('posturometry'),
      },
      {
        key: 'physical',
        label: 'Evaluación Física',
        icon: BarsIcon,
        href: '/my-physical-evaluation',
        badge: dot(physicalEvalUnseen),
        onClick: locked('/my-physical-evaluation') ? undefined : () => markSeen('physical_eval'),
      },
      {
        key: 'parq',
        label: 'PAR-Q',
        icon: ClipboardIcon,
        href: '/my-parq',
        badge: dot(parqDue),
      },
    ];
  }, [
    anthropometryUnseen,
    posturometryUnseen,
    physicalEvalUnseen,
    parqDue,
    subscriptionExpired,
    markSeen,
  ]);

  return (
    <AppMobileBottomNav
      tabs={tabs}
      moreItems={moreItems}
      moreLabel="Evaluaciones"
      moreIcon={EvaluationsIcon}
      moreTabAt={3}
      moreTabBadge={evalsPendingBadge}
      showLogout={false}
    />
  );
}
