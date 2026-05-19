'use client';

import AppSidebar, { type SidebarNavGroup } from '../layouts/AppSidebar';

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
const CardIcon = (
  <svg {...iconProps}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
const PlansIcon = (
  <svg {...iconProps}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 3v3h6V3" />
    <path d="M8 11h8M8 15h8M8 19h5" />
  </svg>
);
const ChartIcon = (
  <svg {...iconProps}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 4 4 6-6" />
  </svg>
);

const NAV_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Operación',
    items: [
      { key: 'dashboard', label: 'Panel', href: '/admin-platform/dashboard', icon: HomeIcon },
      { key: 'users', label: 'Usuarios', href: '/admin-platform/users', icon: PeopleIcon },
      { key: 'subscriptions', label: 'Suscripciones', href: '/admin-platform/subscriptions', icon: CardIcon },
      { key: 'plans', label: 'Planes', href: '/admin-platform/plans', icon: PlansIcon },
      { key: 'reports', label: 'Reportes', href: '#', icon: ChartIcon, soon: true },
    ],
  },
];

export default function AdminSidebar() {
  return (
    <AppSidebar
      roleLabel="Admin"
      homeHref="/admin-platform/dashboard"
      navGroups={NAV_GROUPS}
    />
  );
}
