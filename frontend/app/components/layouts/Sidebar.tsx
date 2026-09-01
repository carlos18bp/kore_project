'use client';

import { useEffect, useMemo } from 'react';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { usePendingAssessmentsStore } from '@/lib/stores/pendingAssessmentsStore';
import { WHATSAPP_URL } from '@/lib/constants';
import { GOAL_OPTIONS } from '@/app/components/profile/ProfileIcons';
import AppSidebar, {
  type SidebarBottomLink,
  type SidebarNavGroup,
} from './AppSidebar';

const ALLOWED_WITHOUT_SUBSCRIPTION = ['/subscription', '/profile'];

const iconProps = {
  className: 'w-[18px] h-[18px]',
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
const CreditsIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M9.5 10.5a2.5 2 0 0 1 5 0c0 1.5-2.5 1.3-2.5 3" />
  </svg>
);
const StoreIcon = (
  <svg {...iconProps}>
    <path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 13h6" />
  </svg>
);
const NutritionIcon = (
  <svg {...iconProps}>
    <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
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
const CardIcon = (
  <svg {...iconProps}>
    <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);
const ChatIcon = (
  <svg {...iconProps}>
    <path d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

export default function Sidebar() {
  const { user } = useAuthStore();
  const { profile } = useProfileStore();
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
    if (user && !pendingLoaded) {
      fetchPending();
    }
  }, [user, pendingLoaded, fetchPending]);

  const subscriptionExpired = subscriptions.length > 0 && !hasActiveSubscription;
  const userGoal = profile?.customer_profile?.primary_goal;
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === userGoal)?.label;

  const navGroups: SidebarNavGroup[] = useMemo(() => {
    const dot = (cond: boolean) => (cond ? ('dot' as const) : undefined);
    const isDisabled = (href: string) =>
      subscriptionExpired && !ALLOWED_WITHOUT_SUBSCRIPTION.some((p) => href.startsWith(p));
    const disabledHint = 'Renueva tu suscripción para acceder';

    return [
      {
        items: [
          { key: 'home', label: 'Inicio', href: '/dashboard', icon: HomeIcon, disabled: isDisabled('/dashboard'), disabledHint },
          { key: 'program', label: 'Mi Programa', href: '/mi-programa', icon: ProgramIcon, disabled: isDisabled('/mi-programa'), disabledHint },
          { key: 'nutrition', label: 'Mi Nutrición', href: '/my-nutrition', icon: NutritionIcon, badge: dot(nutritionDue), disabled: isDisabled('/my-nutrition'), disabledHint },
        ],
      },
      {
        label: 'Evaluaciones',
        items: [
          { key: 'anthro', label: 'Antropometría', href: '/my-diagnosis', icon: HeartIcon, badge: dot(anthropometryUnseen), disabled: isDisabled('/my-diagnosis'), disabledHint, onClick: () => markSeen('anthropometry') },
          { key: 'posture', label: 'Evaluación Postural', href: '/my-posturometry', icon: ShieldIcon, badge: dot(posturometryUnseen), disabled: isDisabled('/my-posturometry'), disabledHint, onClick: () => markSeen('posturometry') },
          { key: 'physical', label: 'Evaluación Física', href: '/my-physical-evaluation', icon: BarsIcon, badge: dot(physicalEvalUnseen), disabled: isDisabled('/my-physical-evaluation'), disabledHint, onClick: () => markSeen('physical_eval') },
          { key: 'parq', label: 'PAR-Q', href: '/my-parq', icon: ClipboardIcon, badge: dot(parqDue), disabled: isDisabled('/my-parq'), disabledHint },
        ],
      },
      {
        label: 'Cuenta',
        items: [
          { key: 'store', label: 'Tienda', href: '/tienda', icon: StoreIcon },
          { key: 'credits', label: 'Mis créditos', href: '/mis-creditos', icon: CreditsIcon },
          { key: 'subscription', label: 'Mi Suscripción', href: '/subscription', icon: CardIcon, badge: dot(subscriptionExpiring) },
        ],
      },
    ];
  }, [
    nutritionDue,
    parqDue,
    anthropometryUnseen,
    posturometryUnseen,
    physicalEvalUnseen,
    subscriptionExpiring,
    subscriptionExpired,
    markSeen,
  ]);

  const bottomLinks: SidebarBottomLink[] = [
    { key: 'support', label: 'Soporte', icon: ChatIcon, href: WHATSAPP_URL, external: true },
  ];

  return (
    <AppSidebar
      roleLabel="Cliente"
      homeHref="/dashboard"
      navGroups={navGroups}
      profileHref="/profile"
      userMetaLine={goalLabel || user?.email || undefined}
      bottomLinks={bottomLinks}
    />
  );
}
