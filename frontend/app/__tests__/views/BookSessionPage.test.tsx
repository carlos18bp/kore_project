import { render, screen } from '@testing-library/react';
import BookSessionPage from '@/app/(app)/book-session/page';
import { useAuthStore } from '@/lib/stores/authStore';
import { useBookingStore } from '@/lib/stores/bookingStore';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
const mockFetchSubscriptions = jest.fn();
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
    slots: [],
    loading: false,
    error: null,
    fetchTrainers: mockFetchTrainers,
    fetchSlots: mockFetchSlots,
    fetchSubscriptions: mockFetchSubscriptions,
    createBooking: mockCreateBooking,
    reset: mockReset,
    subscriptions: [],
    ...overrides,
  });
}

describe('BookSessionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
