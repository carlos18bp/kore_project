import { render, screen, fireEvent } from '@testing-library/react';
import AdminSubscriptionDetailPage from '@/app/admin-platform/subscriptions/detail/page';
import { useAdminSubscriptionStore } from '@/lib/stores/adminSubscriptionStore';

const mockPush = jest.fn();
const mockUsePathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => '9' }),
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
const mockFetchById = jest.fn();
const mockPatchSubscription = jest.fn();
const mockRenewSubscription = jest.fn();
const mockDeleteSubscription = jest.fn();
const mockFetchRenewalHistory = jest.fn().mockResolvedValue([]);

function makeSelected(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    customer_id: 100,
    customer_email: 'ana@example.com',
    customer_name: 'Ana Ruiz',
    package: {
      id: 1,
      title: 'Plan Gold',
      category: 'personalizado',
      sessions_count: 12,
      session_duration_minutes: 60,
      price: '400000',
      currency: 'COP',
      validity_days: 30,
    },
    sessions_total: 12,
    sessions_used: 4,
    sessions_remaining: 8,
    status: 'active',
    starts_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-06-01T00:00:00Z',
    is_recurring: false,
    next_billing_date: null,
    billing_failed_at: null,
    is_duo: false,
    guest_info: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setStore(overrides: Record<string, unknown> = {}) {
  mockedStore.mockReturnValue({
    selected: makeSelected(),
    loading: false,
    actionLoading: false,
    error: '',
    fetchById: mockFetchById,
    patchSubscription: mockPatchSubscription,
    renewSubscription: mockRenewSubscription,
    deleteSubscription: mockDeleteSubscription,
    fetchRenewalHistory: mockFetchRenewalHistory,
    ...overrides,
  });
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/admin-platform/subscriptions/detail');
  setStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdminSubscriptionDetailPage', () => {
  it('fetches the subscription by id on mount', () => {
    render(<AdminSubscriptionDetailPage />);
    expect(mockFetchById).toHaveBeenCalledWith(9);
  });

  it('renders the loading state when no subscription is selected', () => {
    setStore({ selected: null, loading: true });
    render(<AdminSubscriptionDetailPage />);
    expect(screen.getByRole('heading', { name: 'Cargando…' })).toBeInTheDocument();
  });

  it('renders the package title as the page title', () => {
    render(<AdminSubscriptionDetailPage />);
    expect(screen.getByRole('heading', { name: 'Plan Gold' })).toBeInTheDocument();
  });

  it('renders the customer information card for a non-duo subscription', () => {
    render(<AdminSubscriptionDetailPage />);
    expect(screen.getAllByText('Ana Ruiz').length).toBeGreaterThan(0);
  });

  it('disables manual renewal for an active subscription', () => {
    render(<AdminSubscriptionDetailPage />);
    expect(
      screen.getByText('La renovación manual sólo aplica a suscripciones expiradas o canceladas.'),
    ).toBeInTheDocument();
  });

  it('opens the renew modal for an expired subscription', () => {
    setStore({ selected: makeSelected({ status: 'expired' }) });
    render(<AdminSubscriptionDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Renovar manualmente' }));
    expect(screen.getByRole('heading', { name: 'Renovar suscripción' })).toBeInTheDocument();
  });

  it('opens the delete confirmation modal when the delete action is clicked', () => {
    render(<AdminSubscriptionDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByRole('heading', { name: 'Eliminar suscripción #9' })).toBeInTheDocument();
  });
});
