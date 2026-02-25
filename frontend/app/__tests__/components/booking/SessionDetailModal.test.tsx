import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionDetailModal from '@/app/components/booking/SessionDetailModal';
import { useBookingStore } from '@/lib/stores/bookingStore';
import type { BookingData } from '@/lib/stores/bookingStore';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

const mockCancelBooking = jest.fn();

function buildBooking(hoursFromNow: number, status = 'confirmed'): BookingData {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: 100, customer_id: 22,
    package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
    slot: { id: 5, trainer_id: 1, starts_at: start.toISOString(), ends_at: end.toISOString(), is_active: true, is_blocked: false },
    trainer: { id: 1, user_id: 10, first_name: 'Germán', last_name: 'Franco', email: 'g@kore.com', specialty: '', bio: '', location: 'Studio A', session_duration_minutes: 60 },
    subscription_id_display: 2, status: status as 'pending' | 'confirmed' | 'canceled', notes: '', canceled_reason: '', created_at: '', updated_at: '',
  };
}

function setupStore(overrides = {}) {
  mockedUseBookingStore.mockReturnValue({
    loading: false,
    error: null,
    cancelBooking: mockCancelBooking,
    ...overrides,
  });
}

describe('SessionDetailModal', () => {
  const onClose = jest.fn();
  const onCanceled = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Detalle de Sesión" heading', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Detalle de Sesión')).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByLabelText('Cerrar')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    await user.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup();
    setupStore();
    const { container } = render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders trainer name', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders trainer location', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Studio A')).toBeInTheDocument();
  });

  it('renders package title', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('renders status badge "Confirmada"', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('renders Reprogramar and Cancelar buttons for future modifiable booking', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Reprogramar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('disables buttons when booking is within 24h', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(12)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Reprogramar')).toBeDisabled();
    expect(screen.getByText('Cancelar')).toBeDisabled();
  });

  it('does not show action buttons for canceled bookings', () => {
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48, 'canceled')} subscriptionId={2} onClose={onClose} />);
    expect(screen.queryByText('Reprogramar')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('opens cancel confirmation when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    await user.click(screen.getByText('Cancelar'));
    expect(screen.getByText('Cancelar sesión')).toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
  });

  it('navigates to /book-session when Reprogramar is clicked', async () => {
    const user = userEvent.setup();
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    await user.click(screen.getByText('Reprogramar'));
    expect(mockPush).toHaveBeenCalledWith('/book-session?reschedule=100&subscription=2');
  });

  it('renders error message when error is set', () => {
    setupStore({ error: 'No puedes cancelar con menos de 24 horas de anticipación.' });
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('No puedes cancelar con menos de 24 horas de anticipación.')).toBeInTheDocument();
  });

  it('calls cancelBooking and onCanceled on confirm', async () => {
    const user = userEvent.setup();
    mockCancelBooking.mockResolvedValue(true);
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} onCanceled={onCanceled} />);
    await user.click(screen.getByText('Cancelar'));
    await user.click(screen.getByText('Confirmar cancelación'));
    expect(mockCancelBooking).toHaveBeenCalledWith(100, '');
    expect(onCanceled).toHaveBeenCalledTimes(1);
  });

  it('passes typed cancel reason to cancelBooking', async () => {
    const user = userEvent.setup();
    mockCancelBooking.mockResolvedValue(true);
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} onCanceled={onCanceled} />);
    await user.click(screen.getByText('Cancelar'));
    const textarea = screen.getByPlaceholderText('Motivo de cancelación (opcional)');
    await user.type(textarea, 'Viaje imprevisto');
    await user.click(screen.getByText('Confirmar cancelación'));
    expect(mockCancelBooking).toHaveBeenCalledWith(100, 'Viaje imprevisto');
  });

  it('cancel confirm Volver goes back to action buttons', async () => {
    const user = userEvent.setup();
    setupStore();
    render(<SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />);
    await user.click(screen.getByText('Cancelar'));
    expect(screen.getByText('Cancelar sesión')).toBeInTheDocument();
    await user.click(screen.getByText('Volver'));
    expect(screen.queryByText('Cancelar sesión')).not.toBeInTheDocument();
    expect(screen.getByText('Reprogramar')).toBeInTheDocument();
  });

  it('renders dash for trainer name when trainer is null', () => {
    setupStore();
    const booking = { ...buildBooking(48), trainer: null };
    render(<SessionDetailModal booking={booking} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('does not render location row when trainer has no location', () => {
    setupStore();
    const booking = buildBooking(48);
    booking.trainer = { ...booking.trainer!, location: '' };
    render(<SessionDetailModal booking={booking} subscriptionId={2} onClose={onClose} />);
    expect(screen.queryByText('Studio A')).not.toBeInTheDocument();
  });

  it('renders canceled_reason when present', () => {
    setupStore();
    const booking = { ...buildBooking(48, 'canceled'), canceled_reason: 'No puedo asistir' };
    render(<SessionDetailModal booking={booking} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('No puedo asistir')).toBeInTheDocument();
  });

  it('falls back to pending badge for unknown booking status', () => {
    setupStore();
    const booking = { ...buildBooking(48), status: 'unknown' as 'confirmed' };
    render(<SessionDetailModal booking={booking} subscriptionId={2} onClose={onClose} />);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('shows Cancelando... label when loading inside cancel confirmation', async () => {
    const user = userEvent.setup();
    setupStore({ loading: false });
    const { rerender } = render(
      <SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />,
    );
    await user.click(screen.getByText('Cancelar'));
    expect(screen.getByText('Confirmar cancelación')).toBeInTheDocument();

    setupStore({ loading: true });
    rerender(
      <SessionDetailModal booking={buildBooking(48)} subscriptionId={2} onClose={onClose} />,
    );
    expect(screen.getByText('Cancelando...')).toBeInTheDocument();
  });
});
