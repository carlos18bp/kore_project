import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaMonthGrid from '@/app/components/trainer/AgendaMonthGrid';
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

describe('AgendaMonthGrid', () => {
  // Mes de referencia: mayo 2026.
  const monthRef = new Date(2026, 4, 1);

  it('renders a cell for every day of the month', () => {
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    // Mayo tiene 31 días. getAllByTestId acepta regex.
    expect(screen.getAllByTestId(/^month-day-\d+$/)).toHaveLength(31);
  });

  it('marks days that have sessions', () => {
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[makeSession(1, '2026-05-20T09:00:00-05:00')]}
        onSelectDay={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    const cell = screen.getByTestId('month-day-20');
    expect(within(cell).getByTestId('month-day-dot')).toBeInTheDocument();
  });

  it('calls onSelectDay with the clicked day', async () => {
    const onSelectDay = jest.fn();
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[]}
        onSelectDay={onSelectDay}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    await userEvent.click(screen.getByTestId('month-day-15'));
    expect((onSelectDay.mock.calls[0][0] as Date).getDate()).toBe(15);
  });

  it('calls onPrev and onNext from the nav arrows', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(
      <AgendaMonthGrid
        monthRef={monthRef}
        sessions={[]}
        onSelectDay={() => {}}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    await userEvent.click(screen.getByLabelText('Mes anterior'));
    await userEvent.click(screen.getByLabelText('Mes siguiente'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
