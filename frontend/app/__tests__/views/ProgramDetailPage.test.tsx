import { render, screen } from '@testing-library/react';
import ProgramDetailPage from '@/app/(app)/my-programs/program/[subscriptionId]/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

jest.mock('next/navigation', () => ({
  useParams: () => ({ subscriptionId: '123' }),
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
const mockFetchBookings = jest.fn();

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

const mockUser = {
  id: '22', email: 'cust@kore.com', first_name: 'Carlos',
  last_name: 'D', phone: '', role: 'customer', name: 'Carlos D',
};

const mockSubscription = {
  id: 123,
  customer_email: 'cust@kore.com',
  package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
  sessions_total: 4,
  sessions_used: 0,
  sessions_remaining: 4,
  status: 'active',
  starts_at: '2025-02-01T00:00:00Z',
  expires_at: '2025-03-01T00:00:00Z',
  next_billing_date: null,
};

describe('ProgramDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    mockedUseBookingStore.mockReturnValue({
      subscriptions: [mockSubscription],
      bookings: [],
      bookingsPagination: { count: 0, next: null, previous: null },
      loading: false,
      fetchSubscriptions: mockFetchSubscriptions,
      fetchBookings: mockFetchBookings,
    });
  });

  it('includes subscription query param in booking CTA', () => {
    render(<ProgramDetailPage />);
    const link = screen.getByRole('link', { name: 'Agendar sesión' });
    expect(link).toHaveAttribute('href', '/book-session?subscription=123');
  });
});
