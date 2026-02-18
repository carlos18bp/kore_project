import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionExpiryReminder from '@/app/components/subscription/SubscriptionExpiryReminder';
import { useSubscriptionStore } from '@/lib/stores/subscriptionStore';
import { useAuthStore } from '@/lib/stores/authStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('@/lib/stores/subscriptionStore', () => ({
  useSubscriptionStore: jest.fn(),
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseSubscriptionStore = useSubscriptionStore as unknown as jest.Mock;
const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

const mockClearJustLoggedIn = jest.fn();
const mockFetchExpiryReminder = jest.fn();
const mockAcknowledgeExpiryReminder = jest.fn().mockResolvedValue(true);

function buildExpiryReminder(daysFromNow: number) {
  const expiresAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return {
    id: 50,
    customer_email: 'cust@kore.com',
    package: {
      id: 3,
      title: 'Semi Presencial',
      sessions_count: 10,
      session_duration_minutes: 60,
      price: '300000',
      currency: 'COP',
      validity_days: 30,
    },
    sessions_total: 10,
    sessions_used: 5,
    sessions_remaining: 5,
    status: 'active' as const,
    starts_at: '2025-02-01T00:00:00Z',
    expires_at: expiresAt.toISOString(),
    next_billing_date: null,
    is_recurring: false,
    payment_method_type: 'NEQUI',
  };
}

describe('SubscriptionExpiryReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockedUseAuthStore.mockReturnValue({
      justLoggedIn: true,
      clearJustLoggedIn: mockClearJustLoggedIn,
    });
  });

  it('renders nothing when no expiryReminder', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: null,
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    const { container } = render(<SubscriptionExpiryReminder />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when user is not just logged in', () => {
    mockedUseAuthStore.mockReturnValue({
      justLoggedIn: false,
      clearJustLoggedIn: mockClearJustLoggedIn,
    });
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(3),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    const { container } = render(<SubscriptionExpiryReminder />);
    expect(container.firstChild).toBeNull();
    expect(mockFetchExpiryReminder).not.toHaveBeenCalled();
  });

  it('renders modal when expiring subscription exists', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(3),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    expect(screen.getByText('Tu suscripción está por vencer')).toBeInTheDocument();
    expect(screen.getByText('Semi Presencial')).toBeInTheDocument();
  });

  it('calls fetchExpiryReminder on mount when justLoggedIn', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: null,
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    expect(mockFetchExpiryReminder).toHaveBeenCalledTimes(1);
  });

  it('hides modal and acknowledges when Cerrar is clicked', async () => {
    const user = userEvent.setup();
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(3),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    expect(screen.getByText('Tu suscripción está por vencer')).toBeInTheDocument();

    await user.click(screen.getByText('Cerrar'));
    expect(screen.queryByText('Tu suscripción está por vencer')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('kore_expiry_reminder_dismissed')).toBe('true');
    expect(mockAcknowledgeExpiryReminder).toHaveBeenCalledWith(50);
    expect(mockClearJustLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('does not show modal when sessionStorage has dismissed flag', () => {
    sessionStorage.setItem('kore_expiry_reminder_dismissed', 'true');
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(3),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    const { container } = render(<SubscriptionExpiryReminder />);
    expect(container.querySelector('.fixed')).toBeNull();
  });

  it('renders "Renovar ahora" link pointing to checkout with package id', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(3),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    const link = screen.getByText('Renovar ahora');
    expect(link.closest('a')).toHaveAttribute('href', '/checkout?package=3');
  });

  it('acknowledges and clears justLoggedIn when Renovar ahora is clicked', async () => {
    const user = userEvent.setup();
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(3),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);

    await user.click(screen.getByText('Renovar ahora'));
    expect(mockAcknowledgeExpiryReminder).toHaveBeenCalledWith(50);
    expect(mockClearJustLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('shows "Vence hoy" when daysLeft is 0', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(0),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    expect(screen.getByText(/Vence hoy/)).toBeInTheDocument();
  });

  it('shows "Queda 1 día" when daysLeft is 1', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(1),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    expect(screen.getByText(/Queda 1 día/)).toBeInTheDocument();
  });

  it('shows "Quedan N días" when daysLeft > 1', () => {
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: buildExpiryReminder(5),
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    expect(screen.getByText(/Quedan 5 días/)).toBeInTheDocument();
  });

  it('renders fallback link to /programs when package is null', () => {
    const reminder = { ...buildExpiryReminder(3), package: null };
    mockedUseSubscriptionStore.mockReturnValue({
      expiryReminder: reminder,
      fetchExpiryReminder: mockFetchExpiryReminder,
      acknowledgeExpiryReminder: mockAcknowledgeExpiryReminder,
    });
    render(<SubscriptionExpiryReminder />);
    const link = screen.getByText('Renovar ahora');
    expect(link.closest('a')).toHaveAttribute('href', '/programs');
  });
});
