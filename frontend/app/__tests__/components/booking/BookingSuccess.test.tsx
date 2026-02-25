import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingSuccess from '@/app/components/booking/BookingSuccess';
import type { BookingData } from '@/lib/stores/bookingStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const MOCK_BOOKING: BookingData = {
  id: 100,
  customer_id: 22,
  package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
  slot: { id: 5, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false },
  trainer: { id: 1, user_id: 10, first_name: 'Germán', last_name: 'Franco', email: 'trainer@kore.com', specialty: 'Funcional', bio: '', location: 'Studio A', session_duration_minutes: 60 },
  subscription_id_display: 2,
  status: 'confirmed',
  notes: '',
  canceled_reason: '',
  created_at: '2025-02-15T12:00:00Z',
  updated_at: '2025-02-15T12:00:00Z',
};

describe('BookingSuccess', () => {
  const onReset = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders as a modal overlay with backdrop', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    const backdrop = screen.getByText('Tu entrenamiento está agendado').closest('[class*="fixed inset-0"]');
    expect(backdrop).toBeInTheDocument();
  });

  it('renders close button with aria-label', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByLabelText('Cerrar')).toBeInTheDocument();
  });

  it('calls onReset when close button clicked', async () => {
    const user = userEvent.setup();
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    await user.click(screen.getByLabelText('Cerrar'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('calls onReset when backdrop clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not call onReset when modal card clicked', async () => {
    const user = userEvent.setup();
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    await user.click(screen.getByText('Tu entrenamiento está agendado'));
    expect(onReset).not.toHaveBeenCalled();
  });

  it('renders success heading', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText('Tu entrenamiento está agendado')).toBeInTheDocument();
  });

  it('renders email notification text', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText(/correo electrónico/)).toBeInTheDocument();
  });

  it('renders trainer name in summary', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders "Entrenamiento Kóre" in summary', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText('Entrenamiento presencial')).toBeInTheDocument();
  });

  it('renders trainer name when available', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText('Germán Franco')).toBeInTheDocument();
  });

  it('renders program link for changes', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    const link = screen.getByText('tu programa');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/my-programs/program?id=2');
  });

  it('calls onReset when "Agendar otra sesión" clicked', async () => {
    const user = userEvent.setup();
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    await user.click(screen.getByText('Agendar otra sesión'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders link with empty subscription id when subscription_id_display is null', () => {
    const bookingNoSub = { ...MOCK_BOOKING, subscription_id_display: null };
    render(<BookingSuccess booking={bookingNoSub} onReset={onReset} />);
    const link = screen.getByText('tu programa');
    expect(link.closest('a')).toHaveAttribute('href', '/my-programs/program?id=');
  });

  it('does not render location row when trainer has no location', () => {
    const bookingNoLoc = { ...MOCK_BOOKING, trainer: { ...MOCK_BOOKING.trainer!, location: '' } };
    render(<BookingSuccess booking={bookingNoLoc} onReset={onReset} />);
    expect(screen.queryByText('Studio A')).not.toBeInTheDocument();
  });

  it('renders dash for trainer name when trainer is null', () => {
    const bookingNoTrainer = { ...MOCK_BOOKING, trainer: null };
    render(<BookingSuccess booking={bookingNoTrainer} onReset={onReset} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
