import { render, screen, fireEvent } from '@testing-library/react';
import SessionMiniCalendar from '@/app/components/trainer/SessionMiniCalendar';
import type { ClientSession } from '@/lib/stores/trainerStore';

function makeSession(over: Partial<ClientSession> = {}): ClientSession {
  return {
    id: 1,
    status: 'pending',
    package_title: 'Personalizada',
    starts_at: '2026-05-15T10:00:00',
    ends_at: '2026-05-15T11:00:00',
    notes: '',
    canceled_reason: '',
    session_objective: '',
    session_notes_for_customer: '',
    created_at: '2026-05-01T00:00:00',
    ...over,
  };
}

describe('SessionMiniCalendar', () => {
  it('renders the month label of the first session', () => {
    render(<SessionMiniCalendar sessions={[makeSession()]} selectedSessionId={null} onSelectSession={jest.fn()} />);
    expect(screen.getByText(/mayo de 2026/i)).toBeInTheDocument();
  });

  it('renders the seven weekday header letters', () => {
    render(<SessionMiniCalendar sessions={[makeSession()]} selectedSessionId={null} onSelectSession={jest.fn()} />);
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('calls onSelectSession with the session id when its day is clicked', () => {
    const onSelectSession = jest.fn();
    render(
      <SessionMiniCalendar
        sessions={[makeSession({ id: 42, starts_at: '2026-05-15T10:00:00' })]}
        selectedSessionId={null}
        onSelectSession={onSelectSession}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    expect(onSelectSession).toHaveBeenCalledWith(42);
  });

  it('disables a day that has no session', () => {
    render(<SessionMiniCalendar sessions={[makeSession({ starts_at: '2026-05-15T10:00:00' })]} selectedSessionId={null} onSelectSession={jest.fn()} />);
    expect(screen.getByRole('button', { name: '20' })).toBeDisabled();
  });

  it('advances to the next month when the next-month arrow is clicked', () => {
    render(<SessionMiniCalendar sessions={[makeSession()]} selectedSessionId={null} onSelectSession={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText(/junio de 2026/i)).toBeInTheDocument();
  });

  it('goes to the previous month when the previous-month arrow is clicked', () => {
    render(<SessionMiniCalendar sessions={[makeSession()]} selectedSessionId={null} onSelectSession={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText(/abril de 2026/i)).toBeInTheDocument();
  });

  it('renders a saved-note marker on a day whose session has an objective', () => {
    render(
      <SessionMiniCalendar
        sessions={[makeSession({ starts_at: '2026-05-15T10:00:00', session_objective: 'Foco en core' })]}
        selectedSessionId={null}
        onSelectSession={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('con nota')).toBeInTheDocument();
  });
});
