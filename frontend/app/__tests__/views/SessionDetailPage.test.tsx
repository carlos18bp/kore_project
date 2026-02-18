import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionDetailPage from '@/app/(app)/my-sessions/program/[subscriptionId]/session/[bookingId]/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ subscriptionId: '2', bookingId: '100' }),
  useRouter: () => ({ push: mockPush }),
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

const mockFetchBookingById = jest.fn();
const mockCancelBooking = jest.fn();

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

const mockUser = {
  id: '22', email: 'cust@kore.com', first_name: 'Carlos',
  last_name: 'D', phone: '', role: 'customer', name: 'Carlos D',
};

// A booking 48h in the future (can be modified)
function buildBooking(hoursFromNow: number, status = 'confirmed') {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: 100, customer_id: 22,
    package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
    slot: { id: 5, trainer_id: 1, starts_at: start.toISOString(), ends_at: end.toISOString(), is_active: true, is_blocked: false },
    trainer: { id: 1, user_id: 10, first_name: 'Germán', last_name: 'Franco', email: 'g@kore.com', specialty: '', bio: '', location: 'Studio A', session_duration_minutes: 60 },
    subscription_id_display: 2, status, notes: '', canceled_reason: '', created_at: '', updated_at: '',
  };
}

function setupStore(overrides = {}) {
  mockedUseBookingStore.mockReturnValue({
    bookings: [],
    bookingDetail: null,
    loading: false,
    error: null,
    fetchBookingById: mockFetchBookingById,
    cancelBooking: mockCancelBooking,
    ...overrides,
  });
}

describe('SessionDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
  });

  it('renders loading spinner when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    setupStore();
    const { container } = render(<SessionDetailPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders "Detalle de Sesión" heading', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Detalle de Sesión')).toBeInTheDocument();
  });

  it('renders details from bookingDetail when list is empty', () => {
    setupStore({ bookings: [], bookingDetail: buildBooking(48) });
    render(<SessionDetailPage />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders breadcrumb with links', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Mis Sesiones')).toBeInTheDocument();
    expect(screen.getAllByText('Programa').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sesión')).toBeInTheDocument();
  });

  it('renders "not found" when booking does not exist', () => {
    setupStore({ bookings: [] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Sesión no encontrada.')).toBeInTheDocument();
  });

  it('renders "not found" when bookingDetail subscription mismatches route', () => {
    setupStore({ bookings: [], bookingDetail: { ...buildBooking(48), subscription_id_display: 99 } });
    render(<SessionDetailPage />);
    expect(screen.getByText('Sesión no encontrada.')).toBeInTheDocument();
  });

  it('renders trainer name', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders trainer location', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Studio A')).toBeInTheDocument();
  });

  it('renders package title', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('renders status badge "Confirmada"', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('renders Reprogramar and Cancelar buttons for future modifiable booking', () => {
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Reprogramar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('disables buttons when booking is within 24h', () => {
    setupStore({ bookings: [buildBooking(12)] });
    render(<SessionDetailPage />);
    expect(screen.getByText('Reprogramar')).toBeDisabled();
    expect(screen.getByText('Cancelar')).toBeDisabled();
  });

  it('does not show action buttons for canceled bookings', () => {
    setupStore({ bookings: [buildBooking(48, 'canceled')] });
    render(<SessionDetailPage />);
    expect(screen.queryByText('Reprogramar')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('opens cancel modal when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    await user.click(screen.getByText('Cancelar'));
    expect(screen.getByText('Cancelar sesión')).toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
  });

  it('navigates to /book-session when Reprogramar is clicked', async () => {
    const user = userEvent.setup();
    setupStore({ bookings: [buildBooking(48)] });
    render(<SessionDetailPage />);
    await user.click(screen.getByText('Reprogramar'));
    expect(mockPush).toHaveBeenCalledWith('/book-session?reschedule=100&subscription=2');
  });

  it('renders error message when error is set', () => {
    setupStore({ bookings: [buildBooking(48)], error: 'No puedes cancelar con menos de 24 horas de anticipación.' });
    render(<SessionDetailPage />);
    expect(screen.getByText('No puedes cancelar con menos de 24 horas de anticipación.')).toBeInTheDocument();
  });

  it('calls fetchBookingById on mount', () => {
    setupStore();
    render(<SessionDetailPage />);
    expect(mockFetchBookingById).toHaveBeenCalledWith(100);
  });
});
