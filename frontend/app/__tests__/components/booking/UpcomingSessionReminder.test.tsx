import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpcomingSessionReminder from '@/app/components/booking/UpcomingSessionReminder';
import { useBookingStore } from '@/lib/stores/bookingStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

const mockedUseBookingStore = useBookingStore as unknown as jest.Mock;

function buildReminder(hoursFromNow: number) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id: 100,
    customer_id: 22,
    package: { id: 1, title: 'Gold', sessions_count: 12, session_duration_minutes: 60, price: '500000', currency: 'COP', validity_days: 30 },
    slot: { id: 5, trainer_id: 1, starts_at: start.toISOString(), ends_at: end.toISOString(), is_active: true, is_blocked: false },
    trainer: { id: 1, user_id: 10, first_name: 'Germán', last_name: 'Franco', email: 'g@kore.com', specialty: '', bio: '', location: '', session_duration_minutes: 60 },
    subscription_id_display: 2,
    status: 'confirmed' as const,
    notes: '',
    canceled_reason: '',
    created_at: '2025-02-15T12:00:00Z',
    updated_at: '2025-02-15T12:00:00Z',
  };
}

describe('UpcomingSessionReminder', () => {
  const fetchUpcomingReminder = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no upcoming reminder', () => {
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: null, fetchUpcomingReminder });
    const { container } = render(<UpcomingSessionReminder />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when booking is within 48h', () => {
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: buildReminder(12), fetchUpcomingReminder });
    render(<UpcomingSessionReminder />);
    expect(screen.getByText('¡Tienes una sesión próxima!')).toBeInTheDocument();
  });

  it('renders nothing when booking is more than 48h away', () => {
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: buildReminder(72), fetchUpcomingReminder });
    const { container } = render(<UpcomingSessionReminder />);
    expect(container.querySelector('.fixed')).toBeNull();
  });

  it('calls fetchUpcomingReminder on mount', () => {
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: null, fetchUpcomingReminder });
    render(<UpcomingSessionReminder />);
    expect(fetchUpcomingReminder).toHaveBeenCalledTimes(1);
  });

  it('hides modal when Cerrar is clicked', async () => {
    const user = userEvent.setup();
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: buildReminder(12), fetchUpcomingReminder });
    render(<UpcomingSessionReminder />);
    expect(screen.getByText('¡Tienes una sesión próxima!')).toBeInTheDocument();

    await user.click(screen.getByText('Cerrar'));
    expect(screen.queryByText('¡Tienes una sesión próxima!')).not.toBeInTheDocument();
  });

  it('renders "Ver detalle" link pointing to session detail', () => {
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: buildReminder(12), fetchUpcomingReminder });
    render(<UpcomingSessionReminder />);
    const link = screen.getByText('Ver detalle');
    expect(link.closest('a')).toHaveAttribute('href', '/my-sessions/program/2/session/100');
  });

  it('renders fallback link to /my-sessions when subscription_id_display is null', () => {
    const reminder = { ...buildReminder(12), subscription_id_display: null };
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: reminder, fetchUpcomingReminder });
    render(<UpcomingSessionReminder />);
    const link = screen.getByText('Ver detalle');
    expect(link.closest('a')).toHaveAttribute('href', '/my-sessions');
  });

  it('renders nothing when booking is in the past (hoursUntil < 0)', () => {
    mockedUseBookingStore.mockReturnValue({ upcomingReminder: buildReminder(-2), fetchUpcomingReminder });
    const { container } = render(<UpcomingSessionReminder />);
    expect(container.querySelector('.fixed')).toBeNull();
  });
});
