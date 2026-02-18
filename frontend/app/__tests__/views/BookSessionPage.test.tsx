import { render, screen, waitFor } from '@testing-library/react';
import BookSessionPage from '@/app/(app)/book-session/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/app/composables/useScrollAnimations', () => ({
  useHeroAnimation: jest.fn(),
}));

const mockFetchTrainers = jest.fn();
const mockFetchMonthSlots = jest.fn();
const mockFetchSubscriptions = jest.fn();
const mockFetchBookings = jest.fn();
const mockCreateBooking = jest.fn();
const mockReset = jest.fn();
const mockSetStep = jest.fn();
const mockSetSelectedDate = jest.fn();
const mockSetSelectedSlot = jest.fn();

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

const mockUser = {
  id: '22', email: 'customer10@kore.com', first_name: 'Customer10',
  last_name: 'Kore', phone: '', role: 'customer', name: 'Customer10 Kore',
};

function setupStore(overrides = {}) {
  mockedUseBookingStore.mockReturnValue({
    step: 1,
    setStep: mockSetStep,
    selectedDate: null,
    setSelectedDate: mockSetSelectedDate,
    selectedSlot: null,
    setSelectedSlot: mockSetSelectedSlot,
    trainer: null,
    subscription: null,
    bookingResult: null,
    monthSlots: [],
    loading: false,
    error: null,
    fetchTrainers: mockFetchTrainers,
    fetchMonthSlots: mockFetchMonthSlots,
    fetchSubscriptions: mockFetchSubscriptions,
    fetchBookings: mockFetchBookings,
    bookings: [],
    createBooking: mockCreateBooking,
    reset: mockReset,
    subscriptions: [],
    ...overrides,
  });
}

describe('BookSessionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'token' });
    setupStore();
  });

  it('renders loading spinner when user is null', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, accessToken: null });
    const { container } = render(<BookSessionPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders page heading "Agenda tu sesión"', () => {
    render(<BookSessionPage />);
    expect(screen.getByText('Agenda tu sesión')).toBeInTheDocument();
  });

  it('calls fetchTrainers and fetchSubscriptions on mount', () => {
    render(<BookSessionPage />);
    expect(mockFetchTrainers).toHaveBeenCalledTimes(1);
    expect(mockFetchSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('renders step indicator with steps 1 and 2', () => {
    render(<BookSessionPage />);
    expect(screen.getByText('Seleccionar horario')).toBeInTheDocument();
    expect(screen.getByText('Confirmar')).toBeInTheDocument();
  });

  it('preselects subscription from query param in normal flow', () => {
    mockSearchParams = new URLSearchParams({ subscription: '2' });
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 1, sessions_remaining: 3,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
      {
        id: 2, customer_email: 'cust@kore.com',
        package: { id: 2, title: 'Silver', sessions_count: 8, session_duration_minutes: 60, price: '800000', currency: 'COP', validity_days: 60 },
        sessions_total: 8, sessions_used: 2, sessions_remaining: 6,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-04-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    expect(mockFetchBookings).toHaveBeenCalledWith(2);
  });

  it('renders "Selecciona un día" prompt when no date selected', () => {
    render(<BookSessionPage />);
    expect(screen.getByText('Selecciona un día')).toBeInTheDocument();
  });

  it('renders placeholder text when no date selected', () => {
    render(<BookSessionPage />);
    expect(screen.getByText(/Selecciona una fecha en el calendario/)).toBeInTheDocument();
  });

  it('renders BookingConfirmation at step 2', () => {
    const slot = { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false };
    setupStore({ step: 2, selectedSlot: slot });
    render(<BookSessionPage />);
    expect(screen.getByText('Confirmar reserva')).toBeInTheDocument();
  });

  it('renders BookingSuccess at step 3', () => {
    const booking = {
      id: 100, customer_id: 22,
      package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
      slot: { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false },
      trainer: { id: 1, user_id: 10, first_name: 'G', last_name: 'F', email: 'g@k.com', specialty: '', bio: '', location: '', session_duration_minutes: 60 },
      subscription_id_display: 2, status: 'confirmed', notes: '', canceled_reason: '', created_at: '', updated_at: '',
    };
    setupStore({ step: 3, bookingResult: booking });
    render(<BookSessionPage />);
    expect(screen.getByText('Esta reunión está programada')).toBeInTheDocument();
  });

  it('resets stale success state on mount when not rescheduling', async () => {
    const booking = {
      id: 100, customer_id: 22,
      package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
      slot: { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false },
      trainer: { id: 1, user_id: 10, first_name: 'G', last_name: 'F', email: 'g@k.com', specialty: '', bio: '', location: '', session_duration_minutes: 60 },
      subscription_id_display: 2, status: 'confirmed', notes: '', canceled_reason: '', created_at: '', updated_at: '',
    };
    setupStore({ step: 3, bookingResult: booking });
    render(<BookSessionPage />);
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
  });

  it('resets stale success state on mount during reschedule flow', async () => {
    mockSearchParams = new URLSearchParams({ reschedule: '533', subscription: '1' });
    const staleBooking = {
      id: 99, customer_id: 22,
      package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
      slot: { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false },
      trainer: { id: 1, user_id: 10, first_name: 'G', last_name: 'F', email: 'g@k.com', specialty: '', bio: '', location: '', session_duration_minutes: 60 },
      subscription_id_display: 1, status: 'confirmed', notes: '', canceled_reason: '', created_at: '', updated_at: '',
    };
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 3, sessions_remaining: 1,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ step: 3, bookingResult: staleBooking, subscriptions });
    render(<BookSessionPage />);
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
  });

  it('does not show step indicator at step 3', () => {
    const booking = {
      id: 100, customer_id: 22,
      package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
      slot: { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false },
      trainer: null, subscription_id_display: 2, status: 'confirmed', notes: '', canceled_reason: '', created_at: '', updated_at: '',
    };
    setupStore({ step: 3, bookingResult: booking });
    render(<BookSessionPage />);
    expect(screen.queryByText('Seleccionar horario')).not.toBeInTheDocument();
  });

  it('renders subscription selector when active subscriptions exist', () => {
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 3, sessions_remaining: 1,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    expect(screen.getByText('Selecciona tu programa:')).toBeInTheDocument();
  });

  it('renders session details with correct session number', () => {
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 3, sessions_remaining: 1,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    expect(screen.getByText(/Sesión 4 de 4/)).toBeInTheDocument();
    expect(screen.getByText(/1 sesión restante/)).toBeInTheDocument();
  });

  it('renders NoSessionsModal when selected subscription has no remaining sessions', () => {
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 4, sessions_remaining: 0,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    expect(screen.getByText('Sin sesiones disponibles')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('does not show NoSessionsModal during reschedule flow', () => {
    mockSearchParams = new URLSearchParams({ reschedule: '100', subscription: '1' });
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 4, sessions_remaining: 0,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    expect(screen.queryByText('Sin sesiones disponibles')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows reschedule no-availability message when no slots fit the window', () => {
    mockSearchParams = new URLSearchParams({ reschedule: '100', subscription: '1' });
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 4, sessions_remaining: 0,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    const bookings = [
      {
        id: 100,
        customer_id: 22,
        package: subscriptions[0].package,
        slot: { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: true },
        trainer: null,
        subscription_id_display: 1,
        status: 'confirmed',
        notes: '',
        canceled_reason: '',
        created_at: '',
        updated_at: '',
      },
    ];
    setupStore({ subscriptions, bookings, monthSlots: [] });
    render(<BookSessionPage />);
    expect(screen.getByText(/Por el momento no hay disponibilidad horaria/)).toBeInTheDocument();
    expect(screen.getByText('+57 301 4645272')).toBeInTheDocument();
  });

  it('does not show subscription selector when no active subscriptions', () => {
    setupStore({ subscriptions: [] });
    render(<BookSessionPage />);
    expect(screen.queryByText('Selecciona tu programa:')).not.toBeInTheDocument();
  });

  it('filters out subscriptions with no remaining sessions in normal flow', () => {
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 4, sessions_remaining: 0,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
      {
        id: 2, customer_email: 'cust@kore.com',
        package: { id: 2, title: 'Silver', sessions_count: 8, session_duration_minutes: 60, price: '800000', currency: 'COP', validity_days: 60 },
        sessions_total: 8, sessions_used: 1, sessions_remaining: 7,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-04-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    expect(screen.queryByText(/Gold — 0 sesiones restantes/)).not.toBeInTheDocument();
    expect(screen.getByText(/Silver — 7 sesiones restantes/)).toBeInTheDocument();
  });

  it('renders multiple subscriptions in selector dropdown', () => {
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 2, sessions_remaining: 2,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
      {
        id: 2, customer_email: 'cust@kore.com',
        package: { id: 2, title: 'Silver', sessions_count: 8, session_duration_minutes: 60, price: '800000', currency: 'COP', validity_days: 60 },
        sessions_total: 8, sessions_used: 1, sessions_remaining: 7,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-04-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/Gold — 2 sesiones restantes/)).toBeInTheDocument();
    expect(screen.getByText(/Silver — 7 sesiones restantes/)).toBeInTheDocument();
  });

  it('fetches bookings when subscription is selected', () => {
    const subscriptions = [
      {
        id: 1, customer_email: 'cust@kore.com',
        package: { id: 1, title: 'Gold', sessions_count: 4, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
        sessions_total: 4, sessions_used: 1, sessions_remaining: 3,
        status: 'active', starts_at: '2025-02-01T00:00:00Z', expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];
    setupStore({ subscriptions });
    render(<BookSessionPage />);
    // fetchBookings is called with selected subscription ID
    expect(mockFetchBookings).toHaveBeenCalled();
  });
});
