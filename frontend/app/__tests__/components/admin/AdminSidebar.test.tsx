import { render, screen, fireEvent } from '@testing-library/react';
import AdminSidebar from '@/app/components/admin/AdminSidebar';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
}));

const mockLogout = jest.fn();
const mockUser = {
  id: '1',
  email: 'admin@example.com',
  first_name: 'Ana',
  last_name: 'García',
  phone: '',
  role: 'ADMIN',
  name: 'Ana García',
  profile_completed: true,
  avatar_url: null,
  must_change_password: false,
  assigned_trainer: null,
};

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: typeof mockUser; logout: typeof mockLogout }) => unknown) => {
    const state = { user: mockUser, logout: mockLogout };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSidebar() {
  return render(<AdminSidebar />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminSidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/admin-platform/dashboard');
  });

  it('renders navigation item Panel', () => {
    renderSidebar();
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });

  it('renders navigation item Usuarios', () => {
    renderSidebar();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('renders navigation item Suscripciones', () => {
    renderSidebar();
    expect(screen.getByText('Suscripciones')).toBeInTheDocument();
  });

  it('renders navigation item Planes', () => {
    renderSidebar();
    expect(screen.getByText('Planes')).toBeInTheDocument();
  });

  it('renders the Reportes item as an active link to the reports page', () => {
    renderSidebar();
    // "Reportes" was activated in Parte 11a — now a real link, no longer soon.
    const link = screen.getByText('Reportes').closest('a');
    expect(link).toHaveAttribute('href', '/admin-platform/reports');
  });

  it('renders the logout button', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('calls logout() when the logout button is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders user full name in the user card', () => {
    renderSidebar();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
  });

  it('renders initials derived from first_name and last_name', () => {
    renderSidebar();
    expect(screen.getByText('AG')).toBeInTheDocument();
  });

  it('renders the role label "Admin" in the user card', () => {
    renderSidebar();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('marks the active nav item when pathname matches the dashboard route', () => {
    mockUsePathname.mockReturnValue('/admin-platform/dashboard');
    renderSidebar();
    // Active items receive ITEM_ACTIVE (font-semibold); inactive ones use font-medium.
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveClass('font-semibold');
  });
});
