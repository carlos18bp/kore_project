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

  it('renders success heading', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText('Esta reunión está programada')).toBeInTheDocument();
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
    expect(screen.getByText('Entrenamiento Kóre')).toBeInTheDocument();
  });

  it('renders trainer location when available', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    expect(screen.getByText('Studio A')).toBeInTheDocument();
  });

  it('renders reschedule/cancel link pointing to session detail', () => {
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    const link = screen.getByText('Reprogramar o Cancelar');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/my-sessions/program/2/session/100');
  });

  it('calls onReset when "Agendar otra sesión" clicked', async () => {
    const user = userEvent.setup();
    render(<BookingSuccess booking={MOCK_BOOKING} onReset={onReset} />);
    await user.click(screen.getByText('Agendar otra sesión'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders dash for trainer name when trainer is null', () => {
    const bookingNoTrainer = { ...MOCK_BOOKING, trainer: null };
    render(<BookingSuccess booking={bookingNoTrainer} onReset={onReset} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
