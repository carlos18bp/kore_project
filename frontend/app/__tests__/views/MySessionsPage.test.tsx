import { render, screen } from '@testing-library/react';
import MySessionsPage from '@/app/(app)/my-sessions/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
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

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

const mockUser = {
  id: '22', email: 'cust@kore.com', first_name: 'Carlos',
  last_name: 'D', phone: '', role: 'customer', name: 'Carlos D',
};

const MOCK_SUB = {
  id: 2, customer_email: 'cust@kore.com',
  package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
  sessions_total: 12, sessions_used: 3, sessions_remaining: 9,
  status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
};

describe('MySessionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
  });

  it('renders loading spinner when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    mockedUseBookingStore.mockReturnValue({ subscriptions: [], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    const { container } = render(<MySessionsPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders page heading "Mis Programas"', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText('Mis Programas')).toBeInTheDocument();
  });

  it('calls fetchSubscriptions on mount', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(mockFetchSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no subscriptions', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText('No tienes programas aún')).toBeInTheDocument();
    expect(screen.getByText('Agendar sesión')).toBeInTheDocument();
  });

  it('renders subscription card with package title', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [MOCK_SUB], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('renders subscription status badge', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [MOCK_SUB], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders sessions used count', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [MOCK_SUB], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText(/3 \/ 12/)).toBeInTheDocument();
  });

  it('renders sessions remaining count', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [MOCK_SUB], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('subscription card links to program detail', () => {
    mockedUseBookingStore.mockReturnValue({ subscriptions: [MOCK_SUB], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    const link = screen.getByText('Gold').closest('a');
    expect(link).toHaveAttribute('href', '/my-sessions/program/2');
  });

  it('renders expired badge for expired subscription', () => {
    const expiredSub = { ...MOCK_SUB, id: 3, status: 'expired' };
    mockedUseBookingStore.mockReturnValue({ subscriptions: [expiredSub], loading: false, fetchSubscriptions: mockFetchSubscriptions });
    render(<MySessionsPage />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });
});
