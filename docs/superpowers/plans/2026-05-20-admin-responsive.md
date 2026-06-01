# Admin Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer usable el rol admin por debajo de 1280px — agregar barra de navegación móvil y colapsar las dos tablas-lista a cards apiladas.

**Architecture:** Reusar el componente compartido `AppMobileBottomNav` mediante un wrapper `AdminMobileBottomNav` (mismo patrón que `MobileBottomNav`/`TrainerMobileBottomNav`). Las filas `UserRow`/`SubRow` renderizan dos bloques en el mismo `<Link>`: el grid desktop actual (`hidden xl:grid`) y una card apilada (`xl:hidden`). Todo CSS-responsive con breakpoint único `xl`, sin JS de media-query.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind, Zustand, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-20-admin-responsive-design.md`

**Branch:** `fix/20052026-release-april-may-fixes` (ya creada y activa).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/app/components/layouts/AppMobileBottomNav.tsx` | Modificar | Soportar ítems inertes (`disabled`) en el sheet "Más" |
| `frontend/app/components/layouts/AdminMobileBottomNav.tsx` | Crear | Wrapper de `AppMobileBottomNav` con los 4 tabs admin + sheet |
| `frontend/app/admin-platform/layout.tsx` | Modificar | Montar `<AdminMobileBottomNav />` junto a `{children}` |
| `frontend/app/components/admin/UserRow.tsx` | Modificar | Bloque desktop + bloque card |
| `frontend/app/components/admin/SubRow.tsx` | Modificar | Bloque desktop + bloque card |
| `frontend/app/admin-platform/users/UsersListClient.tsx` | Modificar | Header de columnas → `hidden xl:grid` |
| `frontend/app/admin-platform/subscriptions/page.tsx` | Modificar | Header de columnas → `hidden xl:grid` |
| `frontend/app/__tests__/components/layouts/AppMobileBottomNav.test.tsx` | Crear | Cobertura del estado `disabled` |
| `frontend/app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx` | Crear | Cobertura del wrapper admin |
| `frontend/app/__tests__/views/AdminLayout.test.tsx` | Crear | Verifica que la nav queda montada en el layout |
| `frontend/app/__tests__/components/admin/UserRow.test.tsx` | Reescribir | Queries acotadas al bloque card (evita matches duplicados) |
| `frontend/app/__tests__/components/admin/SubRow.test.tsx` | Crear | Cobertura de `SubRow` (card + grid) |

Todos los comandos se ejecutan desde `frontend/` salvo los `git`.

---

## Task 1: Soporte de ítems `disabled` en `AppMobileBottomNav`

**Files:**
- Modify: `frontend/app/components/layouts/AppMobileBottomNav.tsx`
- Test: `frontend/app/__tests__/components/layouts/AppMobileBottomNav.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/components/layouts/AppMobileBottomNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppMobileBottomNav, {
  type MobileNavMoreItem,
  type MobileNavTab,
} from '@/app/components/layouts/AppMobileBottomNav';
import { useAuthStore } from '@/lib/stores/authStore';

let mockPathname = '/uno';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const Icon = <svg data-testid="icon" />;

const tabs: MobileNavTab[] = [
  { key: 't1', label: 'Uno', href: '/uno', icon: Icon, match: (p) => p === '/uno' },
];

describe('AppMobileBottomNav — disabled more-items', () => {
  beforeEach(() => {
    mockPathname = '/uno';
    useAuthStore.setState({ logout: jest.fn() });
  });

  it('renders a disabled more-item as inert with a "Pronto" tag', async () => {
    const disabledItem: MobileNavMoreItem = {
      key: 'rep',
      label: 'Reportes',
      icon: Icon,
      disabled: true,
    };
    render(<AppMobileBottomNav tabs={tabs} moreItems={[disabledItem]} />);

    await userEvent.click(screen.getByText('Más'));

    const label = screen.getByText('Reportes');
    expect(label).toBeInTheDocument();
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(label.closest('a')).toBeNull();
    expect(label.closest('button')).toBeNull();
    expect(label.closest('[aria-disabled="true"]')).not.toBeNull();
  });

  it('still renders an enabled more-item as a clickable button', async () => {
    const onClick = jest.fn();
    const item: MobileNavMoreItem = { key: 'x', label: 'Activo', icon: Icon, onClick };
    render(<AppMobileBottomNav tabs={tabs} moreItems={[item]} />);

    await userEvent.click(screen.getByText('Más'));
    const btn = screen.getByText('Activo').closest('button');
    expect(btn).not.toBeNull();
    await userEvent.click(btn as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/components/layouts/AppMobileBottomNav.test.tsx`
Expected: FALLA — el primer test falla porque hoy un `moreItem` sin `href`/`onClick` se renderiza como `<button>`, no como `<div aria-disabled>`, y `MobileNavMoreItem` ni siquiera acepta `disabled` (error de tipo TS).

- [ ] **Step 3: Agregar `disabled` a la interfaz `MobileNavMoreItem`**

En `frontend/app/components/layouts/AppMobileBottomNav.tsx`, en la interfaz `MobileNavMoreItem`, agregar el campo `disabled` (queda así):

```tsx
export interface MobileNavMoreItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: MobileNavBadge;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  /** Si es true, el ítem se muestra inerte con un tag "Pronto" (no navega ni dispara onClick). */
  disabled?: boolean;
}
```

- [ ] **Step 4: Renderizar los ítems `disabled` como inertes**

En el mismo archivo, dentro del JSX del sheet, reemplazar TODO el bloque `{moreItems?.map((item) => { ... })}` por:

```tsx
{moreItems?.map((item) => {
  const base =
    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150';
  const interactive = `${base} text-kore-ivory/70 hover:bg-kore-ivory/5 hover:text-kore-ivory`;
  const disabledCls = `${base} text-kore-ivory/40 cursor-not-allowed`;
  const body = (
    <>
      <span className="text-kore-gold/55">{item.icon}</span>
      <span className="flex-1 text-left">{item.label}</span>
      {item.disabled && (
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-kore-gold/50">
          Pronto
        </span>
      )}
      {item.badge === 'dot' && (
        <span
          className="w-2 h-2 rounded-full bg-kore-crimson animate-pulse"
          aria-hidden="true"
        />
      )}
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span className="min-w-[20px] h-5 rounded-full bg-kore-crimson text-kore-ivory text-[10px] font-bold flex items-center justify-center px-1.5">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </>
  );
  if (item.disabled) {
    return (
      <div key={item.key} aria-disabled="true" className={disabledCls}>
        {body}
      </div>
    );
  }
  if (item.href) {
    return item.external ? (
      <a
        key={item.key}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={interactive}
      >
        {body}
      </a>
    ) : (
      <Link key={item.key} href={item.href} prefetch={false} className={interactive}>
        {body}
      </Link>
    );
  }
  return (
    <button key={item.key} type="button" onClick={item.onClick} className={interactive}>
      {body}
    </button>
  );
})}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/components/layouts/AppMobileBottomNav.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Regresión — los wrappers existentes siguen verdes**

Run: `npm test -- app/__tests__/components/layouts/MobileBottomNav.test.tsx app/__tests__/components/layouts/TrainerMobileBottomNav.test.tsx`
Expected: PASS (cambio aditivo; `MobileBottomNav` y `TrainerMobileBottomNav` no usan `disabled`).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/components/layouts/AppMobileBottomNav.tsx frontend/app/__tests__/components/layouts/AppMobileBottomNav.test.tsx
git commit -m "feat(layouts): soporte de ítems inertes en el sheet de AppMobileBottomNav"
```

---

## Task 2: Componente `AdminMobileBottomNav`

**Files:**
- Create: `frontend/app/components/layouts/AdminMobileBottomNav.tsx`
- Test: `frontend/app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminMobileBottomNav from '@/app/components/layouts/AdminMobileBottomNav';
import { useAuthStore } from '@/lib/stores/authStore';

let mockPathname = '/admin-platform/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('AdminMobileBottomNav', () => {
  beforeEach(() => {
    mockPathname = '/admin-platform/dashboard';
    useAuthStore.setState({ logout: jest.fn() });
  });

  it('renders the 4 admin tabs and the "Más" trigger', () => {
    render(<AdminMobileBottomNav />);
    ['Panel', 'Usuarios', 'Suscrip.', 'Planes', 'Más'].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });

  it('highlights Panel only on the exact dashboard route', () => {
    mockPathname = '/admin-platform/dashboard';
    render(<AdminMobileBottomNav />);
    expect(screen.getByText('Panel').closest('a')).toHaveClass('text-kore-gold');
  });

  it('highlights Usuarios on a nested users route', () => {
    mockPathname = '/admin-platform/users/detail';
    render(<AdminMobileBottomNav />);
    expect(screen.getByText('Usuarios').closest('a')).toHaveClass('text-kore-gold');
  });

  it('shows Reportes (Pronto) and Cerrar sesión in the More sheet', async () => {
    render(<AdminMobileBottomNav />);
    await userEvent.click(screen.getByText('Más'));
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.getByText('Pronto')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx`
Expected: FALLA — `Cannot find module '@/app/components/layouts/AdminMobileBottomNav'`.

- [ ] **Step 3: Crear el componente**

Crear `frontend/app/components/layouts/AdminMobileBottomNav.tsx`:

```tsx
'use client';

import AppMobileBottomNav, {
  type MobileNavMoreItem,
  type MobileNavTab,
} from './AppMobileBottomNav';

const iconProps = {
  className: 'w-5 h-5',
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

const TABS: MobileNavTab[] = [
  {
    key: 'dashboard',
    label: 'Panel',
    href: '/admin-platform/dashboard',
    icon: HomeIcon,
    match: (p) => p === '/admin-platform/dashboard',
  },
  {
    key: 'users',
    label: 'Usuarios',
    href: '/admin-platform/users',
    icon: PeopleIcon,
    match: (p) => p.startsWith('/admin-platform/users'),
  },
  {
    key: 'subscriptions',
    label: 'Suscrip.',
    href: '/admin-platform/subscriptions',
    icon: CardIcon,
    match: (p) => p.startsWith('/admin-platform/subscriptions'),
  },
  {
    key: 'plans',
    label: 'Planes',
    href: '/admin-platform/plans',
    icon: PlansIcon,
    match: (p) => p.startsWith('/admin-platform/plans'),
  },
];

const MORE_ITEMS: MobileNavMoreItem[] = [
  { key: 'reports', label: 'Reportes', icon: ChartIcon, disabled: true },
];

export default function AdminMobileBottomNav() {
  return <AppMobileBottomNav tabs={TABS} moreItems={MORE_ITEMS} />;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/layouts/AdminMobileBottomNav.tsx frontend/app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx
git commit -m "feat(admin): componente AdminMobileBottomNav para navegación móvil"
```

---

## Task 3: Montar `AdminMobileBottomNav` en el layout admin

**Files:**
- Modify: `frontend/app/admin-platform/layout.tsx`
- Test: `frontend/app/__tests__/views/AdminLayout.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/views/AdminLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import AdminLayout from '@/app/admin-platform/layout';
import { useAuthStore, SPLASH_SHOWN_KEY } from '@/lib/stores/authStore';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin-platform/dashboard',
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

const adminUser = {
  id: '1',
  email: 'admin@kore.com',
  first_name: 'Admin',
  last_name: 'Kore',
  phone: '',
  role: 'admin',
  name: 'Admin Kore',
  must_change_password: false,
};

describe('AdminLayout — mobile nav wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
    useAuthStore.setState({
      user: adminUser,
      isAuthenticated: true,
      accessToken: 'token',
      hydrated: true,
      hydrate: jest.fn(),
      logout: jest.fn(),
    });
  });

  it('renders AdminMobileBottomNav alongside children for an admin user', () => {
    render(
      <AdminLayout>
        <div data-testid="admin-child">contenido</div>
      </AdminLayout>,
    );
    expect(screen.getByTestId('admin-child')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Suscrip.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/views/AdminLayout.test.tsx`
Expected: FALLA — el contenido hijo renderiza pero `getByText('Panel')` no encuentra nada (la nav aún no está montada).

- [ ] **Step 3: Montar la nav en el layout**

En `frontend/app/admin-platform/layout.tsx`, agregar el import después de la línea `import { useSplashGate } from '@/lib/hooks/useSplashGate';`:

```tsx
import AdminMobileBottomNav from '@/app/components/layouts/AdminMobileBottomNav';
```

Y reemplazar la línea final `return <>{children}</>;` por:

```tsx
  return (
    <>
      {children}
      <AdminMobileBottomNav />
    </>
  );
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/views/AdminLayout.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin-platform/layout.tsx frontend/app/__tests__/views/AdminLayout.test.tsx
git commit -m "feat(admin): monta la navegación móvil en el layout admin"
```

---

## Task 4: `UserRow` responsive + header de `/users`

**Files:**
- Modify: `frontend/app/components/admin/UserRow.tsx`
- Modify: `frontend/app/admin-platform/users/UsersListClient.tsx` (el `div` header de columnas)
- Test: `frontend/app/__tests__/components/admin/UserRow.test.tsx` (reescritura completa)

Nota: el `<Link>` renderiza dos bloques (desktop + card), por lo que el texto aparece dos veces en el DOM. Los tests se acotan al bloque card con `within(getByTestId('userrow-card'))` para evitar matches duplicados.

- [ ] **Step 1: Reescribir el test (debe fallar)**

Reemplazar TODO el contenido de `frontend/app/__tests__/components/admin/UserRow.test.tsx` por:

```tsx
import { render, screen, within } from '@testing-library/react';
import UserRow, { type AdminUserRowData } from '@/app/components/admin/UserRow';

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

function makeUser(overrides: Partial<AdminUserRowData> = {}): AdminUserRowData {
  return {
    id: 42,
    email: 'user@example.com',
    first_name: 'Carlos',
    last_name: 'López',
    full_name: 'Carlos López',
    role: 'customer',
    is_active: true,
    must_change_password: false,
    last_login: null,
    sessions_used_total: 0,
    sessions_total_total: 0,
    ...overrides,
  };
}

/** El componente renderiza dos bloques; las aserciones se acotan al bloque card. */
function card() {
  return within(screen.getByTestId('userrow-card'));
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('UserRow', () => {
  it('renders both a desktop block and a card block', () => {
    render(<UserRow user={makeUser()} />);
    expect(screen.getByTestId('userrow-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('userrow-card')).toBeInTheDocument();
  });

  it('renders the user full name', () => {
    render(<UserRow user={makeUser()} />);
    expect(card().getByText('Carlos López')).toBeInTheDocument();
  });

  it('renders the user email', () => {
    render(<UserRow user={makeUser()} />);
    expect(card().getByText('user@example.com')).toBeInTheDocument();
  });

  it('shows "Entrenador" pill when role is trainer', () => {
    render(<UserRow user={makeUser({ role: 'trainer' })} />);
    expect(card().getByText('Entrenador')).toBeInTheDocument();
  });

  it('shows "Cliente" pill when role is customer', () => {
    render(<UserRow user={makeUser({ role: 'customer' })} />);
    expect(card().getByText('Cliente')).toBeInTheDocument();
  });

  it('renders a "!" badge when must_change_password is true', () => {
    render(<UserRow user={makeUser({ must_change_password: true })} />);
    expect(card().getByTitle('Debe cambiar contraseña')).toBeInTheDocument();
    expect(card().getByText('!')).toBeInTheDocument();
  });

  it('does not render a "!" badge when must_change_password is false', () => {
    render(<UserRow user={makeUser({ must_change_password: false })} />);
    expect(card().queryByText('!')).not.toBeInTheDocument();
  });

  it('renders session counts when sessions_total_total is greater than 0', () => {
    render(<UserRow user={makeUser({ sessions_used_total: 3, sessions_total_total: 10 })} />);
    expect(card().getByText('3')).toBeInTheDocument();
    expect(card().getByText('/ 10')).toBeInTheDocument();
  });

  it('renders "Sin plan" when sessions_total_total is 0', () => {
    render(<UserRow user={makeUser({ sessions_total_total: 0 })} />);
    expect(card().getByText('Sin plan')).toBeInTheDocument();
  });

  it('shows "Activo" pill when is_active is true', () => {
    render(<UserRow user={makeUser({ is_active: true })} />);
    expect(card().getByText('Activo')).toBeInTheDocument();
  });

  it('shows "Inactivo" pill when is_active is false', () => {
    render(<UserRow user={makeUser({ is_active: false })} />);
    expect(card().getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders a link to the user detail page using user.id', () => {
    render(<UserRow user={makeUser({ id: 42 })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin-platform/users/detail?id=42');
  });

  it('shows "Sin actividad" when last_login is null', () => {
    render(<UserRow user={makeUser({ last_login: null })} />);
    expect(card().getByText('Sin actividad')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/components/admin/UserRow.test.tsx`
Expected: FALLA — `Unable to find an element by: [data-testid="userrow-card"]` (el componente aún no emite esos bloques).

- [ ] **Step 3: Reescribir `UserRow.tsx`**

Reemplazar TODO el contenido de `frontend/app/components/admin/UserRow.tsx` por:

```tsx
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

  const avatarEl = (
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
  );

  const identityEl = (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-kore-burgundy truncate">{user.full_name}</div>
      <div className="text-[11px] text-kore-burgundy/60 mt-0.5 truncate">{user.email}</div>
    </div>
  );

  const rolePill = isTrainer ? (
    <Pill tone="sage" size="sm" dot>
      Entrenador
    </Pill>
  ) : (
    <Pill tone="sakura" size="sm" dot>
      Cliente
    </Pill>
  );

  const sessionsEl =
    user.sessions_total_total > 0 ? (
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
    );

  const lastLoginEl = (
    <div>
      <div className="text-xs font-medium text-kore-gray-dark">{time.rel}</div>
      {time.abs && <div className="text-[10px] text-kore-burgundy/55 mt-0.5">{time.abs}</div>}
    </div>
  );

  const statusPill = user.is_active ? (
    <Pill tone="sage" size="sm" dot>
      Activo
    </Pill>
  ) : (
    <Pill tone="neutral" size="sm">
      Inactivo
    </Pill>
  );

  const chevron = (
    <div className="text-base text-kore-burgundy/55 group-hover:text-kore-red group-hover:translate-x-0.5 transition-all">
      ›
    </div>
  );

  return (
    <Link
      href={`/admin-platform/users/detail?id=${user.id}`}
      prefetch={false}
      className="block px-5 py-4 rounded-2xl bg-white/65 border border-kore-burgundy/8 hover:bg-white/95 hover:border-kore-red/20 hover:-translate-y-px hover:shadow-[0_6px_18px_-10px_rgba(45,15,26,0.18)] transition-all duration-150 group"
    >
      {/* Desktop — grid de 7 columnas (igual que antes) */}
      <div
        data-testid="userrow-desktop"
        className="hidden xl:grid xl:grid-cols-[52px_2.2fr_1fr_1.4fr_1.2fr_0.8fr_28px] xl:gap-4 xl:items-center"
      >
        {avatarEl}
        {identityEl}
        <div>{rolePill}</div>
        {sessionsEl}
        {lastLoginEl}
        <div>{statusPill}</div>
        {chevron}
      </div>

      {/* Móvil/tablet — card apilada */}
      <div data-testid="userrow-card" className="flex flex-col gap-3 xl:hidden">
        <div className="flex items-center gap-3">
          {avatarEl}
          <div className="flex-1 min-w-0">{identityEl}</div>
          {chevron}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-kore-burgundy/8">
          {rolePill}
          {statusPill}
          <div className="min-w-[96px]">{sessionsEl}</div>
          {lastLoginEl}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Ocultar el header de columnas en `/users` por debajo de `xl`**

En `frontend/app/admin-platform/users/UsersListClient.tsx`, localizar el `div` header de la tabla (la línea que empieza con `<div className="grid grid-cols-[52px_2.2fr_1fr_1.4fr_1.2fr_0.8fr_28px] gap-4 px-5`). Cambiar el inicio de su `className` de `grid grid-cols-[...]` a `hidden xl:grid grid-cols-[...]`. Queda:

```tsx
          <div className="hidden xl:grid grid-cols-[52px_2.2fr_1fr_1.4fr_1.2fr_0.8fr_28px] gap-4 px-5 text-[9px] font-bold uppercase tracking-[0.20em] text-kore-burgundy/55">
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/components/admin/UserRow.test.tsx`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/components/admin/UserRow.tsx frontend/app/admin-platform/users/UsersListClient.tsx frontend/app/__tests__/components/admin/UserRow.test.tsx
git commit -m "fix(admin): UserRow responsive — card apilada por debajo de xl"
```

---

## Task 5: `SubRow` responsive + header de `/subscriptions`

**Files:**
- Modify: `frontend/app/components/admin/SubRow.tsx`
- Modify: `frontend/app/admin-platform/subscriptions/page.tsx` (el `div` header de columnas)
- Test: `frontend/app/__tests__/components/admin/SubRow.test.tsx` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/components/admin/SubRow.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import SubRow, { type AdminSubRowData } from '@/app/components/admin/SubRow';

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

function makeSub(overrides: Partial<AdminSubRowData> = {}): AdminSubRowData {
  return {
    id: 7,
    customer_id: 100,
    customer_name: 'Ana Ruiz',
    customer_email: 'ana@example.com',
    package: { title: 'Plan Personalizado', category: 'personalizado' },
    status: 'active',
    starts_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-06-01T00:00:00Z',
    sessions_used: 4,
    sessions_total: 12,
    is_duo: false,
    guest_info: null,
    ...overrides,
  };
}

/** El componente renderiza dos bloques; las aserciones se acotan al bloque card. */
function card() {
  return within(screen.getByTestId('subrow-card'));
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('SubRow', () => {
  it('renders both a desktop block and a card block', () => {
    render(<SubRow sub={makeSub()} />);
    expect(screen.getByTestId('subrow-desktop')).toBeInTheDocument();
    expect(screen.getByTestId('subrow-card')).toBeInTheDocument();
  });

  it('renders the customer name', () => {
    render(<SubRow sub={makeSub()} />);
    expect(card().getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('renders the package title', () => {
    render(<SubRow sub={makeSub()} />);
    expect(card().getByText('Plan Personalizado')).toBeInTheDocument();
  });

  it('renders session counts', () => {
    render(<SubRow sub={makeSub({ sessions_used: 4, sessions_total: 12 })} />);
    expect(card().getByText('4')).toBeInTheDocument();
    expect(card().getByText('/ 12')).toBeInTheDocument();
  });

  it('renders the status pill', () => {
    render(<SubRow sub={makeSub({ status: 'active' })} />);
    expect(card().getByText('Activa')).toBeInTheDocument();
  });

  it('renders the customer email for a non-duo subscription', () => {
    render(<SubRow sub={makeSub({ is_duo: false })} />);
    expect(card().getByText('ana@example.com')).toBeInTheDocument();
  });

  it('renders a link to the subscription detail page using sub.id', () => {
    render(<SubRow sub={makeSub({ id: 7 })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin-platform/subscriptions/detail?id=7');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- app/__tests__/components/admin/SubRow.test.tsx`
Expected: FALLA — `Unable to find an element by: [data-testid="subrow-card"]`.

- [ ] **Step 3: Reescribir `SubRow.tsx`**

Reemplazar TODO el contenido de `frontend/app/components/admin/SubRow.tsx` por:

```tsx
'use client';

import Link from 'next/link';
import Avatar from './Avatar';
import Pill from './Pill';

type Category = 'semi_personalizado' | 'personalizado' | 'terapeutico';

export type AdminSubRowData = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  package: { title: string; category: Category };
  status: 'active' | 'expired' | 'canceled';
  starts_at: string;
  expires_at: string;
  sessions_used: number;
  sessions_total: number;
  is_duo?: boolean;
  guest_info?: {
    status: 'pending' | 'accepted' | 'revoked';
    invited_email: string;
    guest_name: string | null;
    guest_user_id: number | null;
    accepted_at?: string | null;
  } | null;
};

const STATUS_LABEL = { active: 'Activa', expired: 'Expirada', canceled: 'Cancelada' } as const;
const STATUS_TONE = { active: 'sage', expired: 'neutral', canceled: 'neutral' } as const;

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}

function GuestSubline({ sub }: { sub: AdminSubRowData }) {
  if (!sub.guest_info) {
    return <span className="text-[11px] italic text-kore-burgundy/55">Sin invitación</span>;
  }
  const g = sub.guest_info;
  if (g.status === 'accepted') {
    return (
      <span className="text-[11px] text-kore-burgundy/65">
        + <span className="text-kore-gray-dark font-medium">{g.guest_name ?? g.invited_email}</span>{' '}
        <span className="ml-1 text-[9px] tracking-[0.10em] uppercase text-kore-burgundy/50">
          invitado
        </span>
      </span>
    );
  }
  if (g.status === 'pending') {
    return <span className="text-[11px] text-kore-amber-deep">⏳ Esperando: {g.invited_email}</span>;
  }
  if (g.status === 'revoked') {
    return <span className="text-[11px] italic text-kore-burgundy/55">Invitación revocada</span>;
  }
  return null;
}

export default function SubRow({ sub }: { sub: AdminSubRowData }) {
  const isPair = sub.is_duo === true;
  const guestAccepted = isPair && sub.guest_info?.status === 'accepted';
  const sessionsPct =
    sub.sessions_total > 0 ? Math.min(100, (sub.sessions_used / sub.sessions_total) * 100) : 0;

  const customerTone =
    sub.package.category === 'semi_personalizado'
      ? 'sakura'
      : sub.package.category === 'terapeutico'
        ? 'sage'
        : 'amber';

  const customerEl = (
    <div className="flex items-center gap-3 min-w-0">
      {isPair && guestAccepted && sub.guest_info ? (
        <div className="flex relative w-14">
          <Avatar name={sub.customer_name} size={36} tone="sakura" />
          <div className="-ml-3.5">
            <Avatar
              name={sub.guest_info.guest_name ?? sub.guest_info.invited_email}
              size={36}
              tone="amber"
            />
          </div>
        </div>
      ) : (
        <Avatar name={sub.customer_name} size={36} tone={customerTone} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-kore-burgundy truncate">
          {sub.customer_name}
          {isPair && (
            <span className="ml-1.5 text-[9px] font-bold tracking-[0.16em] text-kore-burgundy/55 uppercase">
              · anfitrión
            </span>
          )}
        </div>
        {isPair ? (
          <div className="mt-0.5 truncate">
            <GuestSubline sub={sub} />
          </div>
        ) : (
          <div className="text-[11px] text-kore-burgundy/60 mt-0.5 truncate">
            {sub.customer_email}
          </div>
        )}
      </div>
    </div>
  );

  const packageEl = (
    <div className="min-w-0">
      <div className="font-heading text-[13px] font-semibold text-kore-burgundy truncate">
        {sub.package.title}
      </div>
      <div className="text-[10px] text-kore-burgundy/55 mt-1 tracking-[0.10em] uppercase">
        #{sub.id}
      </div>
    </div>
  );

  const sessionsEl = (
    <div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-heading text-sm font-semibold text-kore-burgundy">
          {sub.sessions_used}
        </span>
        <span className="text-[10px] text-kore-burgundy/55">/ {sub.sessions_total}</span>
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
  );

  const expiryEl = (
    <div className="text-xs font-medium text-kore-gray-dark">{fmtShortDate(sub.expires_at)}</div>
  );

  const statusPill = (
    <Pill tone={STATUS_TONE[sub.status]} size="sm" dot>
      {STATUS_LABEL[sub.status]}
    </Pill>
  );

  const chevron = (
    <div className="text-base text-kore-burgundy/55 group-hover:text-kore-red group-hover:translate-x-0.5 transition-all">
      ›
    </div>
  );

  return (
    <Link
      href={`/admin-platform/subscriptions/detail?id=${sub.id}`}
      prefetch={false}
      className="block px-5 py-3.5 rounded-2xl bg-white/65 border border-kore-burgundy/8 hover:bg-white/95 hover:border-kore-red/20 hover:-translate-y-px hover:shadow-[0_6px_18px_-10px_rgba(45,15,26,0.18)] transition-all duration-150 group"
    >
      {/* Desktop — grid de 6 columnas (igual que antes) */}
      <div
        data-testid="subrow-desktop"
        className="hidden xl:grid xl:grid-cols-[2fr_1.6fr_1.4fr_1fr_0.9fr_28px] xl:gap-4 xl:items-center"
      >
        {customerEl}
        {packageEl}
        {sessionsEl}
        {expiryEl}
        <div>{statusPill}</div>
        {chevron}
      </div>

      {/* Móvil/tablet — card apilada */}
      <div data-testid="subrow-card" className="flex flex-col gap-3 xl:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">{customerEl}</div>
          {chevron}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-kore-burgundy/8">
          <div className="min-w-[120px]">{packageEl}</div>
          <div className="min-w-[96px]">{sessionsEl}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.10em] text-kore-burgundy/45">
              Vence
            </span>
            {expiryEl}
          </div>
          {statusPill}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Ocultar el header de columnas en `/subscriptions` por debajo de `xl`**

En `frontend/app/admin-platform/subscriptions/page.tsx`, localizar el `div` header de la tabla (la línea que empieza con `<div className="grid grid-cols-[2fr_1.6fr_1.4fr_1fr_0.9fr_28px] gap-4 px-5`). Cambiar el inicio de su `className` de `grid grid-cols-[...]` a `hidden xl:grid grid-cols-[...]`. Queda:

```tsx
          <div className="hidden xl:grid grid-cols-[2fr_1.6fr_1.4fr_1fr_0.9fr_28px] gap-4 px-5 text-[9px] font-bold uppercase tracking-[0.20em] text-kore-burgundy/55">
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npm test -- app/__tests__/components/admin/SubRow.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Regresión del rol admin completo**

Run: `npm test -- app/__tests__/components/admin/ app/__tests__/components/layouts/AppMobileBottomNav.test.tsx app/__tests__/components/layouts/AdminMobileBottomNav.test.tsx`
Expected: PASS (incluye `AdminSidebar`, `UserRow`, `SubRow`, `UserRow` y los dos nav). Son < 20 tests, dentro del límite del proyecto.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/components/admin/SubRow.tsx frontend/app/admin-platform/subscriptions/page.tsx frontend/app/__tests__/components/admin/SubRow.test.tsx
git commit -m "fix(admin): SubRow responsive — card apilada por debajo de xl"
```

---

## Task 6: Verificación manual en navegador

**Files:** ninguno (sólo verificación).

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev`
Expected: Next.js arranca en `:3000`.

- [ ] **Step 2: Verificar a 375px (celular)**

Abrir DevTools → modo responsive 375px, autenticado como admin. Recorrer las 4 rutas:
- `/admin-platform/dashboard`, `/users`, `/subscriptions`, `/plans`.
- Confirmar: barra inferior con Panel · Usuarios · Suscrip. · Planes · Más; el tab activo resaltado en dorado según la ruta.
- Tap en "Más": el sheet abre con "Reportes" inerte + tag "Pronto" y "Cerrar sesión" funcional.
- En `/users` y `/subscriptions`: cada fila es una card apilada legible, sin scroll horizontal; los headers de columna no se ven.

- [ ] **Step 3: Verificar a 768px (tablet)**

Repetir a 768px. Mismo comportamiento (la barra y las cards viven debajo de `xl` = 1280px).

- [ ] **Step 4: Verificar a 1280px+ (desktop)**

A 1280px+: la barra inferior NO aparece; el sidebar se ve como siempre; `/users` y `/subscriptions` muestran las tablas con sus grids y headers de columna, idénticas a antes.

- [ ] **Step 5: Consola sin errores**

Confirmar que no hay errores de hydration ni warnings de React en la consola al cargar cada vista.

- [ ] **Step 6: Build de producción**

Run: `npm run build`
Expected: el static export termina sin errores ni warnings nuevos.

---

## Self-Review

**Cobertura del spec:**
- Spec §A "Navegación móvil del admin" → Tasks 1, 2, 3. ✓
- Spec §A "Extensión a AppMobileBottomNav (`disabled`)" → Task 1. ✓
- Spec §B "Tablas-lista responsive — `UserRow`" + header `/users` → Task 4. ✓
- Spec §B "Tablas-lista responsive — `SubRow`" + header `/subscriptions` → Task 5. ✓
- Spec "Criterios de aceptación" 1-6 → Task 6 (verificación manual) + tests de Tasks 1-5. ✓
- Spec "Verificación" (dev server, Jest, build) → Task 6 + steps de test por tarea. ✓

**Sin placeholders:** todos los steps de código muestran el contenido completo del archivo o el bloque exacto a reemplazar; comandos y resultados esperados explícitos.

**Consistencia de tipos:** `MobileNavTab` y `MobileNavMoreItem` se importan de `AppMobileBottomNav` (Task 2) y son los mismos que se extienden en Task 1 (`disabled?: boolean`). `AdminUserRowData` y `AdminSubRowData` conservan su forma exacta — no se tocan, sólo se reorganiza el JSX. Los `data-testid` (`userrow-desktop`/`userrow-card`, `subrow-desktop`/`subrow-card`) que emiten los componentes en Tasks 4-5 coinciden con los que consultan sus tests.

**Decisión registrada:** Task 3 sí lleva test (integración del layout) — mockea auth store + splash gate y verifica que la nav queda montada. El label "Suscrip." (abreviado) es el aprobado en brainstorming para que el tab quepa en la barra de 5 slots.
