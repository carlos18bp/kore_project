import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionDashboardToast from '@/app/components/subscription/SubscriptionDashboardToast';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('@/lib/stores/subscriptionStore', () => ({
  useSubscriptionStore: jest.fn(),
}));

const mockedUseSubscriptionStore = useSubscriptionStore as unknown as jest.Mock;

function mockStore(overrides: Record<string, unknown> = {}) {
  mockedUseSubscriptionStore.mockReturnValue({
    activeSubscription: null,
    fetchSubscriptions: jest.fn(),
    ...overrides,
  });
}

function futureDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('SubscriptionDashboardToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders nothing when no active subscription', () => {
    mockStore({ activeSubscription: null });
    const { container } = render(<SubscriptionDashboardToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when subscription status is not active', () => {
    mockStore({
      activeSubscription: { status: 'expired', is_recurring: false, expires_at: futureDays(3) },
    });
    const { container } = render(<SubscriptionDashboardToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders billing failed toast when billing_failed_at is set', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: '2024-01-01T00:00:00Z',
        is_recurring: true,
        package: { id: 5 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText('No pudimos procesar tu pago')).toBeInTheDocument();
    expect(screen.getByText('Actualizar pago')).toHaveAttribute('href', '/checkout?package=5');
  });

  it('renders billing failed toast with /programs link when no package id', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: '2024-01-01T00:00:00Z',
        is_recurring: true,
        package: null,
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText('Actualizar pago')).toHaveAttribute('href', '/programs');
  });

  it('dismisses billing failed toast on close button click', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: '2024-01-01T00:00:00Z',
        is_recurring: true,
        package: { id: 1 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText('No pudimos procesar tu pago')).toBeInTheDocument();

    const laterBtn = screen.getByRole('button', { name: /Más tarde/i });
    fireEvent.click(laterBtn);

    expect(screen.queryByText('No pudimos procesar tu pago')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('kore_dashboard_toast_dismissed')).toBe('billing_failed');
  });

  it('renders expiry toast when non-recurring and expires within 7 days', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(3),
        package: { id: 2 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText(/tu suscripción vence en 3 días/i)).toBeInTheDocument();
    expect(screen.getByText('Renovar ahora')).toHaveAttribute('href', '/checkout?package=2');
  });

  it('shows "Vence hoy" when expiry is today', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(0),
        package: { id: 2 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText(/vence hoy/i)).toBeInTheDocument();
  });

  it('shows "Vence mañana" when expiry is tomorrow', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(1),
        package: { id: 2 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText(/vence mañana/i)).toBeInTheDocument();
  });

  it('renders nothing when non-recurring but expires in more than 7 days', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(15),
        package: { id: 2 },
      },
    });
    const { container } = render(<SubscriptionDashboardToast />);
    expect(container.querySelector('.fixed')).toBeNull();
  });

  it('dismisses expiry toast and stores in sessionStorage', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(5),
        package: { id: 2 },
      },
    });
    render(<SubscriptionDashboardToast />);

    const laterBtn = screen.getByRole('button', { name: /Más tarde/i });
    fireEvent.click(laterBtn);

    expect(screen.queryByText(/tu suscripción/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('kore_dashboard_toast_dismissed')).toBe('expiry');
  });

  it('does not show billing toast if already dismissed in session', () => {
    sessionStorage.setItem('kore_dashboard_toast_dismissed', 'billing_failed');
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: '2024-01-01T00:00:00Z',
        is_recurring: true,
        package: { id: 1 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.queryByText('No pudimos procesar tu pago')).not.toBeInTheDocument();
  });

  it('does not show expiry toast if already dismissed in session', () => {
    sessionStorage.setItem('kore_dashboard_toast_dismissed', 'expiry');
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(3),
        package: { id: 2 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.queryByText(/tu suscripción/i)).not.toBeInTheDocument();
  });

  it('renders expiry toast with /programs link when no package id', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(3),
        package: null,
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText('Renovar ahora')).toHaveAttribute('href', '/programs');
  });

  it('dismisses billing failed toast via close icon button', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: '2024-01-01T00:00:00Z',
        is_recurring: true,
        package: { id: 1 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText('No pudimos procesar tu pago')).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button');
    const closeIconBtn = closeButtons.find(
      (btn) => btn.textContent === '' || !btn.textContent?.includes('Más tarde'),
    );
    expect(closeIconBtn).toBeTruthy();
    fireEvent.click(closeIconBtn!);

    expect(screen.queryByText('No pudimos procesar tu pago')).not.toBeInTheDocument();
  });

  it('dismisses expiry toast via close icon button', () => {
    mockStore({
      activeSubscription: {
        status: 'active',
        billing_failed_at: null,
        is_recurring: false,
        expires_at: futureDays(5),
        package: { id: 2 },
      },
    });
    render(<SubscriptionDashboardToast />);

    expect(screen.getByText(/tu suscripción/i)).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button');
    const closeIconBtn = closeButtons.find(
      (btn) => btn.textContent === '' || !btn.textContent?.includes('Más tarde'),
    );
    expect(closeIconBtn).toBeTruthy();
    fireEvent.click(closeIconBtn!);

    expect(screen.queryByText(/tu suscripción/i)).not.toBeInTheDocument();
  });

  it('calls fetchSubscriptions on mount', () => {
    const mockFetch = jest.fn();
    mockedUseSubscriptionStore.mockReturnValue({
      activeSubscription: null,
      fetchSubscriptions: mockFetch,
    });
    render(<SubscriptionDashboardToast />);

    expect(mockFetch).toHaveBeenCalled();
  });
});
