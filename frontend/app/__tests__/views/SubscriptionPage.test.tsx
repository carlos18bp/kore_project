import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionPage from '@/app/(app)/subscription/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { api } from '@/lib/services/http';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/subscription',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn().mockReturnValue('fake-token'),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const MOCK_SUBSCRIPTION = {
  id: 1,
  customer_email: 'test@kore.com',
  package: {
    id: 1,
    title: 'Semi Presencial FLW',
    sessions_count: 10,
    session_duration_minutes: 60,
    price: '300000.00',
    currency: 'COP',
    validity_days: 30,
  },
  sessions_total: 10,
  sessions_used: 3,
  sessions_remaining: 7,
  status: 'active' as const,
  starts_at: '2025-01-01T00:00:00Z',
  expires_at: '2025-01-31T00:00:00Z',
  next_billing_date: '2025-01-31',
  paused_at: null,
};

const MOCK_PAYMENTS = [
  {
    id: 1,
    amount: '300000.00',
    currency: 'COP',
    status: 'confirmed',
    provider: 'wompi',
    provider_reference: 'txn-001',
    created_at: '2025-01-01T00:00:00Z',
  },
];

describe('SubscriptionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: { id: '1', email: 'test@kore.com', first_name: 'Test', last_name: 'User', phone: '', role: 'customer', name: 'Test User' },
      accessToken: 'fake-token',
      isAuthenticated: true,
    });
    useSubscriptionStore.setState({
      subscriptions: [],
      activeSubscription: null,
      payments: [],
      loading: false,
      actionLoading: false,
      error: '',
    });
  });

  it('shows loading spinner while fetching', () => {
    useSubscriptionStore.setState({ loading: true });
    render(<SubscriptionPage />);
    expect(screen.queryByText('Mi Suscripción')).toBeInTheDocument();
  });

  it('shows no subscription state with link to programs', async () => {
    mockedApi.get.mockRejectedValue(new Error('no subs'));
    render(<SubscriptionPage />);
    // The fetchSubscriptions effect will run and fail; but initial state has no sub
    await waitFor(() => {
      expect(screen.getByText('Sin suscripción activa')).toBeInTheDocument();
    });
    expect(screen.getByText('Ver programas')).toHaveAttribute('href', '/programs');
  });

  it('renders subscription details when active subscription exists', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [MOCK_SUBSCRIPTION] } });
    });
    render(<SubscriptionPage />);

    await waitFor(() => {
      expect(screen.getByText('Semi Presencial FLW')).toBeInTheDocument();
    });
    expect(screen.getByText('3 / 10 usadas')).toBeInTheDocument();
  });

  it('shows pause button for active subscription', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [MOCK_SUBSCRIPTION] } });
    });
    render(<SubscriptionPage />);

    await waitFor(() => {
      expect(screen.getByText('Pausar suscripción')).toBeInTheDocument();
    });
  });

  it('shows resume button for paused subscription', async () => {
    const pausedSub = { ...MOCK_SUBSCRIPTION, status: 'paused' as const, paused_at: '2025-01-15T00:00:00Z', next_billing_date: null };
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [pausedSub] } });
    });
    render(<SubscriptionPage />);

    await waitFor(() => {
      expect(screen.getByText('Reanudar suscripción')).toBeInTheDocument();
    });
    expect(screen.getByText('Pausada')).toBeInTheDocument();
  });

  it('shows cancel confirmation dialog', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [MOCK_SUBSCRIPTION] } });
    });
    render(<SubscriptionPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Cancelar suscripción')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancelar suscripción'));
    expect(screen.getByText('¿Seguro que deseas cancelar?')).toBeInTheDocument();
    expect(screen.getByText('Sí, cancelar')).toBeInTheDocument();
    expect(screen.getByText('No, volver')).toBeInTheDocument();
  });

  it('dismisses cancel confirmation on "No, volver"', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [MOCK_SUBSCRIPTION] } });
    });
    render(<SubscriptionPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Cancelar suscripción')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancelar suscripción'));
    await user.click(screen.getByText('No, volver'));

    expect(screen.queryByText('¿Seguro que deseas cancelar?')).not.toBeInTheDocument();
  });

  it('renders payment history', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [MOCK_SUBSCRIPTION] } });
    });
    render(<SubscriptionPage />);

    await waitFor(() => {
      expect(screen.getByText('Historial de pagos')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Confirmado')).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('server error'));
    render(<SubscriptionPage />);
    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar las suscripciones.')).toBeInTheDocument();
    });
  });

  it('renders next billing date for active subscription', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/payments/')) return Promise.resolve({ data: MOCK_PAYMENTS });
      return Promise.resolve({ data: { results: [MOCK_SUBSCRIPTION] } });
    });
    render(<SubscriptionPage />);

    await waitFor(() => {
      expect(screen.getByText('Próximo cobro')).toBeInTheDocument();
    });
  });
});
