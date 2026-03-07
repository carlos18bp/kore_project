import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const mockFetchSlots = jest.fn();
const mockFetchTrainerDayBookings = jest.fn();
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
    dayBookedSlots: [],
    dayAvailabilityLoading: false,
    loading: false,
    error: null,
    fetchTrainers: mockFetchTrainers,
    fetchSlots: mockFetchSlots,
    fetchTrainerDayBookings: mockFetchTrainerDayBookings,
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

  afterEach(() => {
    jest.useRealTimers();
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

  it('renders calendar without month preloading state', () => {
    render(<BookSessionPage />);
    expect(screen.queryByText('Cargando disponibilidad...')).not.toBeInTheDocument();
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
    expect(screen.getByText('Tu entrenamiento está agendado')).toBeInTheDocument();
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

  it('renders session progress when active subscriptions exist', () => {
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
    expect(screen.getAllByText(/Sesión 4 de 4/).length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText(/Sesión 4 de 4/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/3 completadas/).length).toBeGreaterThanOrEqual(1);
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
    setupStore({
      subscriptions,
      bookings,
      selectedDate: '2000-01-03',
      dayBookedSlots: [],
      dayAvailabilityLoading: false,
    });
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
    expect(screen.getAllByText(/Silver/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Sesión 2 de 8/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders session info for the first selectable subscription', () => {
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
    expect(screen.getAllByText(/Sesión 3 de 4/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Gold/).length).toBeGreaterThanOrEqual(1);
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

  it('includes Saturday dates in available calendar days', () => {
    jest.useFakeTimers();
    // Monday March 2, 2026
    jest.setSystemTime(new Date(2026, 2, 2, 12, 0, 0));

    const trainerData = {
      id: 1, user_id: 10, first_name: 'G', last_name: 'F',
      email: 'g@k.com', specialty: '', bio: '', location: '',
      session_duration_minutes: 60,
    };
    setupStore({ trainer: trainerData });
    render(<BookSessionPage />);

    // Saturday March 7 should be enabled (day 7)
    const satBtn = screen.getByRole('button', { name: '7' });
    expect(satBtn).not.toBeDisabled();

    jest.useRealTimers();
  });

  it('excludes Sunday dates from available calendar days', () => {
    jest.useFakeTimers();
    // Monday March 2, 2026
    jest.setSystemTime(new Date(2026, 2, 2, 12, 0, 0));

    const trainerData = {
      id: 1, user_id: 10, first_name: 'G', last_name: 'F',
      email: 'g@k.com', specialty: '', bio: '', location: '',
      session_duration_minutes: 60,
    };
    setupStore({ trainer: trainerData });
    render(<BookSessionPage />);

    // Sunday March 8 should be disabled (day 8)
    const sunBtn = screen.getByRole('button', { name: '8' });
    expect(sunBtn).toBeDisabled();

    jest.useRealTimers();
  });

  it('limits available dates to 30-day horizon', () => {
    jest.useFakeTimers();
    // Wednesday March 4, 2026
    jest.setSystemTime(new Date(2026, 2, 4, 12, 0, 0));

    const trainerData = {
      id: 1, user_id: 10, first_name: 'G', last_name: 'F',
      email: 'g@k.com', specialty: '', bio: '', location: '',
      session_duration_minutes: 60,
    };
    setupStore({ trainer: trainerData });
    render(<BookSessionPage />);

    // March 4 + 29 days = April 2, so last included day is April 2 (Thursday).
    // March 31 (offset=27, Tuesday) should be enabled.
    const day31Btn = screen.getByRole('button', { name: '31' });
    expect(day31Btn).not.toBeDisabled();

    // March 5 (offset=1, Thursday) should be enabled.
    const day5Btn = screen.getByRole('button', { name: '5' });
    expect(day5Btn).not.toBeDisabled();

    // March 1 is before today (March 4) so it should be disabled.
    const day1Btn = screen.getByRole('button', { name: '1' });
    expect(day1Btn).toBeDisabled();

    jest.useRealTimers();
  });

  it('generates Saturday slots with 06:00-13:00 window when Saturday selected', () => {
    jest.useFakeTimers();
    // Set time to very early Saturday March 7, 2026
    jest.setSystemTime(new Date(2026, 2, 7, 0, 0, 0));

    const trainerData = {
      id: 1, user_id: 10, first_name: 'G', last_name: 'F',
      email: 'g@k.com', specialty: '', bio: '', location: '',
      session_duration_minutes: 60,
    };
    setupStore({
      trainer: trainerData,
      selectedDate: '2026-03-07',
      dayBookedSlots: [],
      dayAvailabilityLoading: false,
    });
    render(<BookSessionPage />);

    // TimeSlotPicker defaults to 24h format
    // Should show 06:00 slot (first Saturday slot)
    expect(screen.getByText(/^06:00/)).toBeInTheDocument();
    // Should show 12:00 (last full slot: 12:00-13:00)
    expect(screen.getByText(/^12:00/)).toBeInTheDocument();
    // Should NOT show 05:00 (Saturday starts at 06:00, not 05:00)
    expect(screen.queryByText(/^05:00/)).not.toBeInTheDocument();
    // Should NOT show 16:00 (Saturday has no evening window)
    expect(screen.queryByText(/^16:00/)).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('allows confirmation request even when global loading is true', async () => {
    const slot = {
      id: 5,
      trainer_id: 1,
      starts_at: '2025-03-01T10:00:00Z',
      ends_at: '2025-03-01T11:00:00Z',
      is_active: true,
      is_blocked: false,
    };
    const subscriptions = [
      {
        id: 1,
        customer_email: 'cust@kore.com',
        package: {
          id: 1,
          title: 'Gold',
          sessions_count: 4,
          session_duration_minutes: 60,
          price: '500000',
          currency: 'COP',
          validity_days: 30,
        },
        sessions_total: 4,
        sessions_used: 1,
        sessions_remaining: 3,
        status: 'active',
        starts_at: '2025-02-01T00:00:00Z',
        expires_at: '2025-03-01T00:00:00Z',
        next_billing_date: null,
      },
    ];

    setupStore({
      step: 2,
      selectedSlot: slot,
      subscriptions,
      loading: true,
    });

    render(<BookSessionPage />);

    const confirmButton = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCreateBooking).toHaveBeenCalledTimes(1);
    });
  });
});
