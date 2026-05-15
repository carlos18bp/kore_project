'use client';

import { useMemo } from 'react';
import { useTrainerStore } from '@/lib/stores/trainerStore';
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

export default function TrainerSidebar() {
  const { riskDashboard } = useTrainerStore();
  const alertCount =
    (riskDashboard?.risk_summary?.alto ?? 0) +
    (riskDashboard?.risk_summary?.medio ?? 0);

  const navGroups: SidebarNavGroup[] = useMemo(
    () => [
      {
        label: 'Operación',
        items: [
          { key: 'dashboard', label: 'Hoy', href: '/trainer/dashboard', icon: HomeIcon },
          { key: 'clients', label: 'Mis Clientes', href: '/trainer/clients', icon: PeopleIcon },
          { key: 'alerts', label: 'Alertas', href: '/trainer/alerts', icon: BellIcon, badge: alertCount > 0 ? alertCount : undefined },
          { key: 'metrics', label: 'Métricas', href: '/trainer/metrics', icon: ChartIcon },
          { key: 'nutrition-catalog', label: 'Catálogo comidas', href: '/trainer/nutrition-catalog', icon: FoodCatalogIcon },
          { key: 'messages', label: 'Mensajes', href: '/trainer/messages', icon: ChatIcon, soon: true },
        ],
      },
    ],
    [alertCount],
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
