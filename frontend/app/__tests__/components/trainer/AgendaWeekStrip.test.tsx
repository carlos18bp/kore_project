import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaWeekStrip from '@/app/components/trainer/AgendaWeekStrip';
import type { UpcomingSession } from '@/lib/stores/trainerStore';

function makeSession(id: number, starts_at: string): UpcomingSession {
  return {
    id,
    customer_name: `Cliente ${id}`,
    customer_id: id,
    package_title: 'Plan',
    starts_at,
    ends_at: starts_at,
    status: 'confirmed',
  };
}

describe('AgendaWeekStrip', () => {
  // Semana del lunes 2026-05-18 al domingo 2026-05-24.
  const weekStart = new Date(2026, 4, 18);

  it('renders 7 day cells', () => {
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getAllByTestId('week-day-cell')).toHaveLength(7);
  });

  it('shows a session count on days that have sessions', () => {
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[
          makeSession(1, '2026-05-20T09:00:00-05:00'),
          makeSession(2, '2026-05-20T11:00:00-05:00'),
        ]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    // El miércoles 20 es la 3ª celda (Lun=18, Mar=19, Mié=20).
    const cells = screen.getAllByTestId('week-day-cell');
    expect(within(cells[2]).getByText('2')).toBeInTheDocument();
  });

  it('calls onSelectDay with the clicked day', async () => {
    const onSelectDay = jest.fn();
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[]}
        onSelectDay={onSelectDay}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    await userEvent.click(screen.getAllByTestId('week-day-cell')[2]);
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect((onSelectDay.mock.calls[0][0] as Date).getDate()).toBe(20);
  });

  it('calls onPrev and onNext from the nav arrows', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(
      <AgendaWeekStrip
        weekStart={weekStart}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByLabelText('Semana anterior'));
    await userEvent.click(screen.getByLabelText('Semana siguiente'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
