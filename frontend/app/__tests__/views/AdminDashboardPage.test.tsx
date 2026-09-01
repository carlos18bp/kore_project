import { render, screen } from '@testing-library/react';
import AdminDashboardPage from '@/app/admin-platform/dashboard/page';
import { useAdminSubscriptionStore } from '@/lib/stores/adminSubscriptionStore';

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

jest.mock('@/lib/stores/adminSubscriptionStore', () => ({
  useAdminSubscriptionStore: jest.fn(),
}));

const mockedStore = useAdminSubscriptionStore as unknown as jest.Mock;
const mockFetchSubscriptions = jest.fn();

type Sub = { id: number; status: 'active' | 'expired' | 'canceled' };

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    subscriptions: [] as Sub[],
    totalCount: 0,
    loading: false,
    fetchSubscriptions: mockFetchSubscriptions,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/dashboard');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminDashboardPage', () => {
  it('renders the summary heading', () => {
    render(<AdminDashboardPage />);
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });

  it('fetches subscriptions on mount', () => {
    render(<AdminDashboardPage />);
    expect(mockFetchSubscriptions).toHaveBeenCalledWith({
      page: 1,
      search: '',
      status: '',
      category: '',
    });
  });

  it('renders the total subscriptions count from the store', () => {
    setStore({
      totalCount: 3,
      subscriptions: [
        { id: 1, status: 'active' },
        { id: 2, status: 'expired' },
        { id: 3, status: 'canceled' },
      ],
    });
    render(<AdminDashboardPage />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the count of active subscriptions', () => {
    setStore({
      totalCount: 4,
      subscriptions: [
        { id: 1, status: 'active' },
        { id: 2, status: 'active' },
        { id: 3, status: 'expired' },
        { id: 4, status: 'canceled' },
      ],
    });
    render(<AdminDashboardPage />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('links to the subscriptions management page', () => {
    render(<AdminDashboardPage />);
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/admin-platform/subscriptions',
    );
  });

  it('links to the users management page', () => {
    render(<AdminDashboardPage />);
    expect(screen.getByRole('link', { name: 'Ver usuarios' })).toHaveAttribute(
      'href',
      '/admin-platform/users',
    );
  });

  it('hides the total value while loading the first page of results', () => {
    setStore({ loading: true, subscriptions: [], totalCount: 0 });
    render(<AdminDashboardPage />);
    expect(screen.getByText('suscripciones cargadas')).toBeInTheDocument();
  });
});
