import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpcomingSessionsCard from '@/app/components/booking/UpcomingSessionsCard';
import type { BookingData } from '@/lib/stores/bookingStore';

function makeBooking(over: Partial<BookingData> & { id: number; status: BookingData['status']; startsAt: string }): BookingData {
  const { startsAt, ...rest } = over;
  const start = new Date(startsAt);
  return {
    id: over.id,
    customer_id: 1,
    package: { id: 1, title: 'P', category: 'personalizado', sessions_count: 10, session_duration_minutes: 60, price: '1', currency: 'COP', validity_days: 30 } as BookingData['package'],
    slot: { id: over.id, trainer_id: 1, starts_at: startsAt, ends_at: new Date(start.getTime() + 3600_000).toISOString(), is_active: true, is_blocked: true },
    trainer: { id: 1, user_id: 1, first_name: 'Germán', last_name: 'Franco', email: '', specialty: '', bio: '', location: '', session_duration_minutes: 60 },
    subscription_id_display: 1,
    status: over.status,
    notes: '',
    canceled_reason: '',
    session_objective: '',
    session_notes_for_customer: '',
    program_day_exercises: [],
    created_at: startsAt,
    updated_at: startsAt,
    ...rest,
  } as BookingData;
}

describe('UpcomingSessionsCard', () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

  const bookings: BookingData[] = [
    makeBooking({ id: 1, status: 'pending', startsAt: inDays(3) }),
    makeBooking({ id: 2, status: 'pending', startsAt: inDays(10) }),
    makeBooking({ id: 3, status: 'confirmed', startsAt: daysAgo(5) }),
    makeBooking({ id: 4, status: 'canceled', startsAt: inDays(2) }),
  ];

  it('renders the "Mis sesiones" header', () => {
    render(<UpcomingSessionsCard bookings={bookings} />);
    expect(screen.getByText('Mis sesiones')).toBeInTheDocument();
  });

  it('shows upcoming and past counts in the tabs (canceled excluded from upcoming)', () => {
    render(<UpcomingSessionsCard bookings={bookings} />);
    expect(screen.getByText('Próximas (2)')).toBeInTheDocument();
    // past = the confirmed (past) one + the canceled one
    expect(screen.getByText('Pasadas (2)')).toBeInTheDocument();
  });

  it('lists upcoming bookings by default and shows past ones after switching tab', async () => {
    const user = userEvent.setup();
    render(<UpcomingSessionsCard bookings={bookings} />);

    expect(screen.getByTestId('upcoming-session-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-session-row-2')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-session-row-3')).not.toBeInTheDocument();

    await user.click(screen.getByText('Pasadas (2)'));
    expect(screen.getByTestId('upcoming-session-row-3')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-session-row-4')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-session-row-1')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no bookings for the active tab', () => {
    render(<UpcomingSessionsCard bookings={[]} />);
    expect(screen.getByText('No tienes sesiones próximas.')).toBeInTheDocument();
  });

  it('renders a close button only when onClose is provided and calls it', async () => {
    const onClose = jest.fn();
    const { rerender } = render(<UpcomingSessionsCard bookings={bookings} />);
    expect(screen.queryByLabelText('Cerrar')).not.toBeInTheDocument();

    rerender(<UpcomingSessionsCard bookings={bookings} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
