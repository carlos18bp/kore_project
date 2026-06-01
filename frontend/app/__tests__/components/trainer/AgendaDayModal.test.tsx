import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaDayModal from '@/app/components/trainer/AgendaDayModal';
import type { UpcomingSession } from '@/lib/stores/trainerStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, prefetch: _p, ...rest }: { children: React.ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function makeSession(over: Partial<UpcomingSession> = {}): UpcomingSession {
  return {
    id: 1,
    customer_name: 'Ana Ruiz',
    customer_id: 10,
    package_title: 'Personalizada',
    starts_at: '2026-05-20T09:00:00-05:00',
    ends_at: '2026-05-20T10:00:00-05:00',
    status: 'confirmed',
    ...over,
  };
}

describe('AgendaDayModal', () => {
  it('renders the session list for the day', () => {
    render(
      <AgendaDayModal
        date={new Date(2026, 4, 20)}
        sessions={[makeSession(), makeSession({ id: 2, customer_name: 'Luis P.' })]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Luis P.')).toBeInTheDocument();
    expect(screen.getByText('2 sesiones')).toBeInTheDocument();
  });

  it('links each row to the client detail', () => {
    render(
      <AgendaDayModal
        date={new Date(2026, 4, 20)}
        sessions={[makeSession({ customer_id: 77 })]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Ana Ruiz').closest('a')).toHaveAttribute(
      'href', '/trainer/clients/client?id=77',
    );
  });

  it('shows an empty state when the day has no sessions', () => {
    render(<AgendaDayModal date={new Date(2026, 4, 20)} sessions={[]} onClose={() => {}} />);
    expect(screen.getByText('Sin sesiones este día')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = jest.fn();
    render(<AgendaDayModal date={new Date(2026, 4, 20)} sessions={[]} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
