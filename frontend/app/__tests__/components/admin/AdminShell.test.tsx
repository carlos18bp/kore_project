import { render, screen } from '@testing-library/react';
import AdminShell from '@/app/components/admin/AdminShell';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: jest.fn() }),
}));

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
  useAuthStore: (selector?: (state: { user: typeof mockUser; logout: () => void }) => unknown) => {
    const state = { user: mockUser, logout: jest.fn() };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

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

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminShell', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/admin-platform/dashboard');
  });

  it('renders the page title in the topbar heading', () => {
    render(
      <AdminShell title="Resumen">
        <div data-testid="content">contenido</div>
      </AdminShell>,
    );
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });

  it('renders the provided children inside the main region', () => {
    render(
      <AdminShell title="Resumen">
        <div data-testid="content">contenido</div>
      </AdminShell>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders the sidebar navigation alongside the content', () => {
    render(
      <AdminShell title="Resumen">
        <div data-testid="content">contenido</div>
      </AdminShell>,
    );
    expect(screen.getByText('Panel')).toBeInTheDocument();
  });

  it('renders the breadcrumb trail passed to the topbar', () => {
    render(
      <AdminShell title="Detalle" breadcrumb={[{ label: 'Ficha del cliente' }]}>
        <div>x</div>
      </AdminShell>,
    );
    expect(screen.getByText('Ficha del cliente')).toBeInTheDocument();
  });
});
