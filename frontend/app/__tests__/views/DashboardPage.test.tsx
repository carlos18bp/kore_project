import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(app)/dashboard/page';
import { useAuthStore } from '@/lib/stores/authStore';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/stores/bookingStore', () => {
  const fetchUpcomingReminder = jest.fn();
  const fetchBookings = jest.fn();

  return {
    useBookingStore: () => ({
      upcomingReminder: null,
      bookings: [],
      fetchUpcomingReminder,
      fetchBookings,
    }),
  };
});

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockRejectedValue(new Error('no subs')), post: jest.fn() },
}));

const mockUser = {
  id: '22',
  email: 'customer10@kore.com',
  first_name: 'Customer10',
  last_name: 'Kore',
  phone: '',
  role: 'customer',
  name: 'Customer10 Kore',
  profile_completed: false,
  avatar_url: '',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    const { container } = render(<DashboardPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders greeting with first name when user is present', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText(/Customer10/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders program info inside profile card', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText('Programa').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sin programa activo').length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress section', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText('Tu progreso').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders next session card with formatted date', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getByText('Tu siguiente paso')).toBeInTheDocument();
  });

  it('renders upcoming sessions section', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getByText('Próximas sesiones')).toBeInTheDocument();
  });

  it('renders activity history', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getByText('Historial reciente')).toBeInTheDocument();
    expect(screen.getByText('Sin sesiones completadas')).toBeInTheDocument();
  });

  it('renders profile card with user info', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText('Customer10 Kore').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('customer10@kore.com').length).toBeGreaterThanOrEqual(1);
  });

  it('renders estado de hoy section inside progress card', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    render(<DashboardPage />);
    expect(screen.getAllByText('Estado de hoy').length).toBeGreaterThanOrEqual(1);
  });

  it('renders session progress bar', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    const { container } = render(<DashboardPage />);
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeInTheDocument();
  });
});
