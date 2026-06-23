import { render, screen } from '@testing-library/react';
import SubscriptionPage from '@/app/(app)/subscription/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, prefetch: _prefetch, ...rest }: { children: React.ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/app/composables/useScrollAnimations', () => ({
  useHeroAnimation: jest.fn(),
}));

const mockFetchSubscriptions = jest.fn();
const mockFetchBookings = jest.fn();
const mockSetSelectedSubscriptionId = jest.fn();
const mockFetchPaymentHistory = jest.fn();
const mockFetchRenewalHistory = jest.fn().mockResolvedValue([]);
const mockCancelSubscription = jest.fn();
// These mirror the store's stable action references. They MUST be stable across
// renders: the mount effect depends on fetchPendingInvitation, so a fresh ref
// each render would re-fire it and double-count fetchSubscriptions/fetchBookings.
const mockFetchPendingInvitation = jest.fn().mockResolvedValue(undefined);
const mockAcceptPendingInvitation = jest.fn().mockResolvedValue({ success: false });
const mockInviteGuest = jest.fn().mockResolvedValue({ success: true });
const mockRevokeGuest = jest.fn().mockResolvedValue(true);

jest.mock('@/lib/stores/subscriptionStore', () => ({
  useSubscriptionStore: jest.fn(),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseSubscriptionStore = useSubscriptionStore as unknown as jest.Mock;
const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

const mockUser = {
  id: '22',
  email: 'cust@kore.com',
  first_name: 'Carlos',
  last_name: 'D',
  phone: '',
  role: 'customer',
  name: 'Carlos D',
};

const baseSubscription = {
  id: 2,
  customer_email: 'cust@kore.com',
  package: {
    id: 1,
    title: 'Gold',
    sessions_count: 12,
    session_duration_minutes: 60,
    price: '500000',
    currency: 'COP',
    validity_days: 30,
  },
  sessions_total: 12,
  sessions_used: 3,
  sessions_remaining: 9,
  status: 'active' as const,
  starts_at: '2025-02-01T00:00:00Z',
  expires_at: '2025-03-01T00:00:00Z',
  next_billing_date: null,
  is_recurring: false,
  billing_failed_at: null,
};

function defaultSubscriptionState(overrides: Record<string, unknown> = {}) {
  return {
    subscriptions: [] as typeof baseSubscription[],
    activeSubscription: null as typeof baseSubscription | null,
    hasOwnActiveSubscription: false,
    subscriptionsLoaded: false,
    pendingInvitation: null,
    selectedSubscriptionId: null as number | null,
    payments: [],
    loading: false,
    actionLoading: false,
    error: '',
    fetchSubscriptions: mockFetchSubscriptions,
    setSelectedSubscriptionId: mockSetSelectedSubscriptionId,
    cancelSubscription: mockCancelSubscription,
    fetchPaymentHistory: mockFetchPaymentHistory,
    fetchRenewalHistory: mockFetchRenewalHistory,
    fetchPendingInvitation: mockFetchPendingInvitation,
    acceptPendingInvitation: mockAcceptPendingInvitation,
    inviteGuest: mockInviteGuest,
    revokeGuest: mockRevokeGuest,
    ...overrides,
  };
}

function defaultBookingState(overrides: Record<string, unknown> = {}) {
  return {
    bookings: [],
    fetchBookings: mockFetchBookings,
    ...overrides,
  };
}

describe('SubscriptionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    mockedUseSubscriptionStore.mockImplementation(() => defaultSubscriptionState());
    mockedUseBookingStore.mockImplementation(() => defaultBookingState());
  });

  it('renders loading spinner when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    render(<SubscriptionPage />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders page heading Mi Suscripción', () => {
    render(<SubscriptionPage />);
    expect(screen.getByText('Mi Suscripción')).toBeInTheDocument();
  });

  it('calls fetchSubscriptions and fetchBookings on mount', () => {
    render(<SubscriptionPage />);
    expect(mockFetchSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockFetchBookings).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no subscriptions', () => {
    render(<SubscriptionPage />);
    expect(screen.getByText('Sin suscripción activa')).toBeInTheDocument();
    expect(screen.getByText(/Ver programas/)).toBeInTheDocument();
  });

  it('renders loading spinner when subscriptions loading', () => {
    mockedUseSubscriptionStore.mockImplementation(() =>
      defaultSubscriptionState({ loading: true }),
    );
    render(<SubscriptionPage />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('renders subscription card with package title', () => {
    mockedUseSubscriptionStore.mockImplementation(() =>
      defaultSubscriptionState({
        subscriptions: [baseSubscription],
        activeSubscription: baseSubscription,
        selectedSubscriptionId: 2,
      }),
    );
    render(<SubscriptionPage />);
    expect(screen.getAllByText('Gold').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Activa status label for active subscription', () => {
    mockedUseSubscriptionStore.mockImplementation(() =>
      defaultSubscriptionState({
        subscriptions: [baseSubscription],
        activeSubscription: baseSubscription,
        selectedSubscriptionId: 2,
      }),
    );
    render(<SubscriptionPage />);
    expect(screen.getAllByText(/Activa/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders sessions used count and progress percentage', () => {
    mockedUseSubscriptionStore.mockImplementation(() =>
      defaultSubscriptionState({
        subscriptions: [baseSubscription],
        activeSubscription: baseSubscription,
        selectedSubscriptionId: 2,
      }),
    );
    render(<SubscriptionPage />);
    expect(screen.getAllByText(/3 de 12/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText((_, el) => el?.textContent === '25%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Expirada badge for expired subscription', () => {
    const expired = {
      ...baseSubscription,
      id: 3,
      status: 'expired' as const,
      sessions_used: 12,
      sessions_remaining: 0,
    };
    mockedUseSubscriptionStore.mockImplementation(() =>
      defaultSubscriptionState({
        subscriptions: [expired],
        activeSubscription: null,
        selectedSubscriptionId: 3,
      }),
    );
    render(<SubscriptionPage />);
    expect(screen.getAllByText(/Expirada/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Agendar link to book-session when detail is visible', () => {
    mockedUseSubscriptionStore.mockImplementation(() =>
      defaultSubscriptionState({
        subscriptions: [baseSubscription],
        activeSubscription: baseSubscription,
        selectedSubscriptionId: 2,
      }),
    );
    render(<SubscriptionPage />);
    const link = screen.getByRole('link', { name: /Agendar/ });
    expect(link).toHaveAttribute('href', '/book-session');
  });
});
