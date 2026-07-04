import { render, screen, fireEvent } from '@testing-library/react';
import AgendaCard from '@/app/components/trainer/AgendaCard';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import type { UpcomingSession } from '@/lib/stores/trainerStore';

jest.mock('@/lib/stores/trainerStore', () => ({ useTrainerStore: jest.fn() }));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock('@/app/components/trainer/AgendaWeekStrip', () => ({
  __esModule: true,
  default: () => <div data-testid="week-strip" />,
}));
jest.mock('@/app/components/trainer/AgendaMonthGrid', () => ({
  __esModule: true,
  default: () => <div data-testid="month-grid" />,
}));
jest.mock('@/app/components/trainer/AgendaDayModal', () => ({
  __esModule: true,
  default: () => <div data-testid="day-modal" />,
}));

const mStore = useTrainerStore as unknown as jest.Mock;

function makeSession(over: Partial<UpcomingSession> = {}): UpcomingSession {
  return {
    id: 1,
    customer_name: 'Ana Ruiz',
    customer_id: 10,
    package_title: 'Personalizada',
    starts_at: '2026-05-20T09:00:00',
    ends_at: '2026-05-20T10:00:00',
    status: 'confirmed',
    ...over,
  };
}

function setup(over: { agendaSessions?: UpcomingSession[]; fetchAgendaSessions?: jest.Mock; fetchBlockedDates?: jest.Mock } = {}) {
  const fetchAgendaSessions = over.fetchAgendaSessions ?? jest.fn();
  const fetchBlockedDates = over.fetchBlockedDates ?? jest.fn();
  mStore.mockReturnValue({
    agendaSessions: over.agendaSessions ?? [],
    fetchAgendaSessions,
    blockedDates: [],
    fetchBlockedDates,
  });
  return { fetchAgendaSessions, fetchBlockedDates };
}

describe('AgendaCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the day-view session in the timeline', () => {
    setup({ agendaSessions: [makeSession()] });
    render(<AgendaCard />);
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
  });

  it('shows the empty-day message when there are no sessions', () => {
    setup({ agendaSessions: [] });
    render(<AgendaCard />);
    expect(screen.getByText('Sin sesiones programadas hoy.')).toBeInTheDocument();
  });

  it('fetches agenda sessions on mount', () => {
    const { fetchAgendaSessions } = setup();
    render(<AgendaCard />);
    expect(fetchAgendaSessions).toHaveBeenCalled();
  });

  it('renders the week strip when the semana view is selected', () => {
    setup();
    render(<AgendaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(screen.getByTestId('week-strip')).toBeInTheDocument();
  });

  it('renders the month grid when the mes view is selected', () => {
    setup();
    render(<AgendaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
  });

  it('links a day-view session row to the client detail', () => {
    setup({ agendaSessions: [makeSession({ customer_id: 77 })] });
    render(<AgendaCard />);
    expect(screen.getByText('Ana Ruiz').closest('a')).toHaveAttribute('href', '/trainer/clients/client?id=77');
  });
});
