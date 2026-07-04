import { render, screen, act, fireEvent } from '@testing-library/react';
import TrainerBookingDialog from '@/app/components/trainer/TrainerBookingDialog';
import { useBookingStore } from '@/lib/stores/bookingStore';

jest.mock('@/lib/stores/bookingStore', () => {
  const fn = jest.fn();
  (fn as unknown as { getState: jest.Mock }).getState = jest.fn(() => ({ error: null }));
  return { useBookingStore: fn };
});

jest.mock('@/app/components/booking/BookingCalendar', () => ({
  __esModule: true,
  default: ({ availableDates, onSelectDate }: { availableDates: Set<string>; onSelectDate: (d: string) => void }) => (
    <div>
      {[...availableDates].map((d) => (
        <button key={d} type="button" onClick={() => onSelectDate(d)}>{`day-${d}`}</button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/components/booking/TimeSlotPicker', () => ({
  __esModule: true,
  default: ({ slots, onSelect }: { slots: string[]; onSelect: (s: string) => void }) => (
    <div>
      {slots.map((s) => (
        <button key={s} type="button" onClick={() => onSelect(s)}>{`slot-${s}`}</button>
      ))}
    </div>
  ),
}));

const mStore = useBookingStore as unknown as jest.Mock & { getState: jest.Mock };

const DATE = '2026-06-01';
const SLOT = '2026-06-01T09:00:00';

function setup(over: {
  availability?: Record<string, string[]>;
  availabilityLoading?: boolean;
  createBooking?: jest.Mock;
  rescheduleBooking?: jest.Mock;
  error?: string | null;
} = {}) {
  const createBooking = over.createBooking ?? jest.fn().mockResolvedValue({ id: 1 });
  const rescheduleBooking = over.rescheduleBooking ?? jest.fn().mockResolvedValue({ id: 1 });
  mStore.mockReturnValue({
    availability: over.availability ?? { [DATE]: [SLOT] },
    availabilityLoading: over.availabilityLoading ?? false,
    fetchAvailability: jest.fn(),
    createBooking,
    rescheduleBooking,
    error: over.error ?? null,
  });
  return { createBooking, rescheduleBooking };
}

function renderCreate(over: Partial<React.ComponentProps<typeof TrainerBookingDialog>> = {}) {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(
    <TrainerBookingDialog
      mode="create"
      customerId={7}
      customerName="Ana Ruiz"
      packageId={3}
      subscriptionId={12}
      onClose={onClose}
      onSuccess={onSuccess}
      {...(over as object)}
    />,
  );
  return { onClose, onSuccess };
}

async function stepToConfirm() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: `day-${DATE}` })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: `slot-${SLOT}` })); });
}

describe('TrainerBookingDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mStore.getState.mockReturnValue({ error: null });
  });

  it('renders the create-mode header title', () => {
    setup();
    renderCreate();
    expect(screen.getByText('Agendar sesión')).toBeInTheDocument();
  });

  it('renders the reschedule-mode header title', () => {
    setup();
    render(
      <TrainerBookingDialog
        mode="reschedule"
        customerId={7}
        customerName="Ana Ruiz"
        bookingId={99}
        currentStartsAt="2026-06-01T09:00:00"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    expect(screen.getByText('Reprogramar sesión')).toBeInTheDocument();
  });

  it('shows the loading message while availability is loading', () => {
    setup({ availabilityLoading: true, availability: {} });
    renderCreate();
    expect(screen.getByText('Cargando horarios…')).toBeInTheDocument();
  });

  it('shows the no-availability message when there are no available dates', () => {
    setup({ availability: {}, availabilityLoading: false });
    renderCreate();
    expect(screen.getByText('No hay disponibilidad en los próximos 30 días.')).toBeInTheDocument();
  });

  it('creates the booking with the selected slot and shows the success screen', async () => {
    const { createBooking } = setup();
    renderCreate();
    await stepToConfirm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar y agendar' })); });
    expect(createBooking).toHaveBeenCalledWith(expect.objectContaining({ package_id: 3, starts_at: SLOT, customer_id: 7 }));
    expect(screen.getByText('¡Sesión agendada!')).toBeInTheDocument();
  });

  it('shows an error message when the booking creation fails', async () => {
    setup({ createBooking: jest.fn().mockResolvedValue(null) });
    mStore.getState.mockReturnValue({ error: 'Cupo no disponible.' });
    renderCreate();
    await stepToConfirm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar y agendar' })); });
    expect(screen.getByText('Cupo no disponible.')).toBeInTheDocument();
  });

  it('warns when creating a booking for a client without an active subscription', async () => {
    setup();
    renderCreate({ subscriptionId: null } as Partial<React.ComponentProps<typeof TrainerBookingDialog>>);
    await stepToConfirm();
    expect(screen.getByText(/no tiene una suscripción activa/i)).toBeInTheDocument();
  });

  it('closes the dialog through onSuccess when Listo is clicked after success', async () => {
    setup();
    const { onClose, onSuccess } = renderCreate();
    await stepToConfirm();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar y agendar' })); });
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
