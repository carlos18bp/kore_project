import { render, screen } from '@testing-library/react';
import AdminUsersPage from '@/app/admin-platform/users/page';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';

const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: jest.fn() }),
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

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  first_name: 'Ana',
  last_name: 'García',
  role: 'ADMIN',
  name: 'Ana García',
};

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: typeof mockUser; logout: () => void }) => unknown) => {
    const state = { user: mockUser, logout: jest.fn() };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('@/lib/stores/adminUserStore', () => ({
  useAdminUserStore: jest.fn(),
}));

const mockedStore = useAdminUserStore as unknown as jest.Mock;
const mockFetchUsers = jest.fn();
const mockSetFilters = jest.fn();
const mockFetchAssignmentSummary = jest.fn();

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    email: 'carlos@example.com',
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

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    users: [],
    totalCount: 0,
    filters: { search: '', role: 'all', page: 1 },
    loading: false,
    fetchUsers: mockFetchUsers,
    setFilters: mockSetFilters,
    assignmentSummary: null,
    fetchAssignmentSummary: mockFetchAssignmentSummary,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/users');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminUsersPage', () => {
  it('renders the users management heading', () => {
    render(<AdminUsersPage />);
    expect(screen.getByRole('heading', { name: 'Gestión de usuarios' })).toBeInTheDocument();
  });

  it('fetches users on mount', () => {
    render(<AdminUsersPage />);
    expect(mockFetchUsers).toHaveBeenCalledTimes(1);
  });

  it('renders a row for each user returned by the store', () => {
    setStore({ users: [makeRow({ id: 42, full_name: 'Carlos López' })], totalCount: 1 });
    render(<AdminUsersPage />);
    expect(screen.getAllByText('Carlos López').length).toBeGreaterThan(0);
  });

  it('renders the empty state when there are no users and no filters', () => {
    setStore({ users: [], totalCount: 0, filters: { search: '', role: 'all', page: 1 } });
    render(<AdminUsersPage />);
    expect(screen.getByText('Sin usuarios')).toBeInTheDocument();
  });

  it('renders the no-results state when filters are applied but no user matches', () => {
    setStore({ users: [], totalCount: 0, filters: { search: 'zzz', role: 'all', page: 1 } });
    render(<AdminUsersPage />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('links to the new user enrollment page', () => {
    render(<AdminUsersPage />);
    const link = screen.getAllByRole('link').find(
      (a) => (a as HTMLAnchorElement).getAttribute('href') === '/admin-platform/users/new',
    );
    expect(link).toBeDefined();
  });

  it('renders the pluralized total count in the footer', () => {
    setStore({ users: [makeRow()], totalCount: 3 });
    render(<AdminUsersPage />);
    expect(screen.getByText(/3 usuarios/)).toBeInTheDocument();
  });
});
