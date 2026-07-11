'use client';

import { useEffect, useMemo } from 'react';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { useTrainerTasksStore } from '@/lib/stores/trainerTasksStore';
import { useStoreStore } from '@/lib/stores/storeStore';
import AppSidebar, { type SidebarNavGroup } from './AppSidebar';

const iconProps = {
  className: 'w-[18px] h-[18px]',
  fill: 'none' as const,
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
  </svg>
);
const PeopleIcon = (
  <svg {...iconProps}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const BellIcon = (
  <svg {...iconProps}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const ChartIcon = (
  <svg {...iconProps}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 4 4 6-6" />
  </svg>
);
const FoodCatalogIcon = (
  <svg {...iconProps}>
    <path d="M3 6h18M3 12h18M3 18h12" />
    <circle cx="19" cy="18" r="2" />
    <path d="M19 4v12" />
  </svg>
);
const ChatIcon = (
  <svg {...iconProps}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const StoreIcon = (
  <svg {...iconProps}>
    <path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 13h6" />
  </svg>
);
const TasksIcon = (
  <svg {...iconProps}>
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
  </svg>
);

export default function TrainerSidebar() {
  const { riskDashboard } = useTrainerStore();
  const alertCount =
    (riskDashboard?.risk_summary?.alto ?? 0) +
    (riskDashboard?.risk_summary?.medio ?? 0);

  const creditReviewCount = useTrainerTasksStore((s) => s.creditReviews.length);
  const fetchCreditReviews = useTrainerTasksStore((s) => s.fetchPendingCreditReviews);
  const redemptionCount = useStoreStore((s) => s.pendingReviews.length);
  const fetchRedemptions = useStoreStore((s) => s.fetchPendingReviews);
  const taskCount = creditReviewCount + redemptionCount;

  useEffect(() => {
    fetchCreditReviews();
    fetchRedemptions();
  }, [fetchCreditReviews, fetchRedemptions]);

  const navGroups: SidebarNavGroup[] = useMemo(
    () => [
      {
        label: 'Operación',
        items: [
          { key: 'dashboard', label: 'Hoy', href: '/trainer/dashboard', icon: HomeIcon },
          { key: 'clients', label: 'Mis Clientes', href: '/trainer/clients', icon: PeopleIcon },
          { key: 'tasks', label: 'Tareas pendientes', href: '/trainer/tareas', icon: TasksIcon, badge: taskCount > 0 ? taskCount : undefined },
          { key: 'alerts', label: 'Alertas', href: '/trainer/alerts', icon: BellIcon, badge: alertCount > 0 ? alertCount : undefined },
          { key: 'metrics', label: 'Métricas', href: '/trainer/metrics', icon: ChartIcon },
          { key: 'nutrition-catalog', label: 'Catálogo comidas', href: '/trainer/nutrition-catalog', icon: FoodCatalogIcon },
          { key: 'store', label: 'Tienda', href: '/trainer/tienda', icon: StoreIcon },
          { key: 'messages', label: 'Mensajes', href: '/trainer/messages', icon: ChatIcon, soon: true },
        ],
      },
    ],
    [alertCount, taskCount],
  );

  return (
    <AppSidebar
      roleLabel="Entrenador"
      homeHref="/trainer/dashboard"
      navGroups={navGroups}
      profileHref="/profile"
    />
  );
}
