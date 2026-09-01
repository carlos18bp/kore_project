import { render, screen } from '@testing-library/react';
import AdminSubscriptionsPage from '@/app/admin-platform/subscriptions/page';
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
const mockFetchCategoryCounts = jest.fn();
const mockSetFilters = jest.fn();

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    customer_id: 100,
    customer_name: 'Ana Ruiz',
    customer_email: 'ana@example.com',
    package: { title: 'Plan Pareja', category: 'semi_personalizado' },
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

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    subscriptions: [],
    totalCount: 0,
    categoryCounts: { semi_personalizado: 0, personalizado: 0, terapeutico: 0 },
    filters: { search: '', status: '', category: 'semi_personalizado', page: 1 },
    loading: false,
    fetchSubscriptions: mockFetchSubscriptions,
    fetchCategoryCounts: mockFetchCategoryCounts,
    setFilters: mockSetFilters,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/subscriptions');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminSubscriptionsPage', () => {
  it('renders the subscriptions management heading', () => {
    render(<AdminSubscriptionsPage />);
    expect(screen.getByRole('heading', { name: 'Gestión de suscripciones' })).toBeInTheDocument();
  });

  it('fetches subscriptions on mount', () => {
    render(<AdminSubscriptionsPage />);
    expect(mockFetchSubscriptions).toHaveBeenCalled();
  });

  it('fetches category counts on mount', () => {
    render(<AdminSubscriptionsPage />);
    expect(mockFetchCategoryCounts).toHaveBeenCalledTimes(1);
  });

  it('renders a row for each subscription returned by the store', () => {
    setStore({ subscriptions: [makeSub({ customer_name: 'Ana Ruiz' })], totalCount: 1 });
    render(<AdminSubscriptionsPage />);
    expect(screen.getAllByText('Ana Ruiz').length).toBeGreaterThan(0);
  });

  it('renders the empty state when there are no subscriptions', () => {
    setStore({ subscriptions: [], totalCount: 0, loading: false });
    render(<AdminSubscriptionsPage />);
    expect(screen.getByText('Sin suscripciones')).toBeInTheDocument();
  });

  it('links to the create subscription page', () => {
    render(<AdminSubscriptionsPage />);
    expect(screen.getByRole('link', { name: /Crear suscripción/ })).toHaveAttribute(
      'href',
      '/admin-platform/subscriptions/new',
    );
  });

  it('renders the singular total label when there is exactly one subscription', () => {
    setStore({ subscriptions: [makeSub()], totalCount: 1 });
    render(<AdminSubscriptionsPage />);
    expect(screen.getByText('1 suscripcion')).toBeInTheDocument();
  });
});
