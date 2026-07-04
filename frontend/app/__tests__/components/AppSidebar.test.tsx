import { render, screen, fireEvent } from '@testing-library/react';
import AppSidebar, {
  type SidebarNavGroup,
  type SidebarBottomLink,
} from '@/app/components/layouts/AppSidebar';
import { useAuthStore } from '@/lib/stores/authStore';

let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    prefetch?: boolean;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

function setupStore(overrides: Record<string, unknown> = {}) {
  const mockLogout = jest.fn();
  const state = {
    user: { first_name: 'Ana', last_name: 'Ruiz' },
    logout: mockLogout,
    ...overrides,
  };
  mockedUseAuthStore.mockImplementation((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  );
  return { mockLogout };
}

const navGroups: SidebarNavGroup[] = [
  {
    label: 'Principal',
    items: [
      { key: 'home', label: 'Inicio', href: '/dashboard', icon: <i /> },
      { key: 'bookings', label: 'Reservas', href: '/bookings', icon: <i />, badge: 3 },
      { key: 'alerts', label: 'Alertas', href: '/alerts', icon: <i />, badge: 'dot' },
      { key: 'soon', label: 'Nutrición', href: '/nutrition', icon: <i />, soon: true },
      {
        key: 'locked',
        label: 'Métricas',
        href: '/metrics',
        icon: <i />,
        disabled: true,
        disabledHint: 'Requiere plan activo',
      },
    ],
  },
];

function renderSidebar(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  return render(
    <AppSidebar
      roleLabel="Cliente"
      homeHref="/dashboard"
      navGroups={navGroups}
      {...props}
    />,
  );
}

describe('AppSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
  });

  it('renders the logo linking to the home href', () => {
    setupStore();
    renderSidebar();

    expect(screen.getByText('KÓRE').closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('renders the role label in the header', () => {
    setupStore();
    renderSidebar();

    expect(screen.getAllByText('Cliente').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the display name from first and last name', () => {
    setupStore();
    renderSidebar();

    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('renders the user initials when no avatar is present', () => {
    setupStore();
    renderSidebar();

    expect(screen.getByText('AR')).toBeInTheDocument();
  });

  it('renders an avatar image when the user has an avatar url', () => {
    setupStore({ user: { first_name: 'Ana', last_name: 'Ruiz', avatar_url: '/a.png' } });
    renderSidebar();

    expect(screen.getByRole('img', { name: 'Avatar' })).toBeInTheDocument();
  });

  it('does not render the user card when there is no user', () => {
    setupStore({ user: null });
    renderSidebar();

    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument();
  });

  it('renders a nav item as a link pointing to its href', () => {
    setupStore();
    renderSidebar();

    expect(screen.getByText('Reservas').closest('a')).toHaveAttribute('href', '/bookings');
  });

  it('renders a numeric badge for an item with a count', () => {
    setupStore();
    renderSidebar();

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders a "Pronto" label for an item marked as soon', () => {
    setupStore();
    renderSidebar();

    expect(screen.getByText('Pronto')).toBeInTheDocument();
  });

  it('renders a disabled item as a non-link with aria-disabled', () => {
    setupStore();
    renderSidebar();

    const disabled = screen.getByText('Métricas').closest('[aria-disabled="true"]');
    expect(disabled).toBeInTheDocument();
  });

  it('calls the nav item onClick when its link is clicked', () => {
    setupStore();
    const onClick = jest.fn();
    render(
      <AppSidebar
        roleLabel="Cliente"
        homeHref="/dashboard"
        navGroups={[{ items: [{ key: 'x', label: 'Perfil', href: '/profile', icon: <i />, onClick }] }]}
      />,
    );

    fireEvent.click(screen.getByText('Perfil'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls logout when the logout button is clicked', () => {
    const { mockLogout } = setupStore();
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders an external bottom link with a blank target', () => {
    setupStore();
    const bottomLinks: SidebarBottomLink[] = [
      { key: 'help', label: 'Ayuda', icon: <i />, href: 'https://kore.com/help', external: true },
    ];
    renderSidebar({ bottomLinks });

    const link = screen.getByText('Ayuda').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('calls the bottom link onClick when it is a button', () => {
    setupStore();
    const onClick = jest.fn();
    const bottomLinks: SidebarBottomLink[] = [
      { key: 'action', label: 'Contacto', icon: <i />, onClick },
    ];
    renderSidebar({ bottomLinks });

    fireEvent.click(screen.getByRole('button', { name: 'Contacto' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('links the user card to the profile href when provided', () => {
    setupStore();
    renderSidebar({ profileHref: '/profile' });

    expect(screen.getByText('Ana Ruiz').closest('a')).toHaveAttribute('href', '/profile');
  });
});
