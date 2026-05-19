import { render, screen } from '@testing-library/react';
import MiniMonthCalendar from '@/app/components/program/MiniMonthCalendar';
import type { DayAdherence } from '@/lib/stores/progressStore';

function makeDayAdherence(date: string, combined_adherence: number): DayAdherence {
  return { date, combined_adherence, workout_done: combined_adherence >= 1, nutrition_done: false };
}

function makeBooking(starts_at: string, status: string) {
  return { status, starts_at };
}

// Fixed reference date: 2026-05-01 (Friday). May 2026 has 31 days, starts on Friday (Mon=0 → index 4).
const MAY_2026 = new Date(2026, 4, 1); // month is 0-indexed

describe('MiniMonthCalendar', () => {
  it('renders the localized month name in the header', () => {
    render(<MiniMonthCalendar weekDays={[]} bookings={[]} referenceDate={MAY_2026} />);

    // es-CO locale renders "mayo"
    expect(screen.getByText(/mayo/i)).toBeInTheDocument();
  });

  it('renders all 7 weekday header cells', () => {
    render(<MiniMonthCalendar weekDays={[]} bookings={[]} referenceDate={MAY_2026} />);

    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((header) => {
      expect(screen.getAllByText(header).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the correct number of day cells for May (31 days)', () => {
    render(<MiniMonthCalendar weekDays={[]} bookings={[]} referenceDate={MAY_2026} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    // Day 32 must not exist
    expect(screen.queryByText('32')).not.toBeInTheDocument();
  });

  it('renders a Check icon (aria-hidden) for a day with combined_adherence >= 0.70', () => {
    const weekDays = [makeDayAdherence('2026-05-10', 0.75)];
    const { container } = render(
      <MiniMonthCalendar weekDays={weekDays} bookings={[]} referenceDate={MAY_2026} />,
    );

    // Check icon is an SVG rendered by lucide-react inside the completed cell
    // The cell has title "10 · completado"
    const completedCell = container.querySelector('[title="10 · completado"]');
    expect(completedCell).not.toBeNull();
    expect(completedCell?.querySelector('svg')).not.toBeNull();
  });

  it('renders the day number for a day below the 0.70 adherence threshold', () => {
    const weekDays = [makeDayAdherence('2026-05-10', 0.5)];
    render(<MiniMonthCalendar weekDays={weekDays} bookings={[]} referenceDate={MAY_2026} />);

    // Day 10 should display the number, not be replaced by a Check
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('today cell has a title without completado when not completed', () => {
    // Use the real today so this test is deterministic relative to the component logic
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    const ref = new Date(year, month, 1);
    const { container } = render(
      <MiniMonthCalendar weekDays={[]} bookings={[]} referenceDate={ref} />,
    );

    const todayCell = container.querySelector(`[title="${day}"]`);
    expect(todayCell).not.toBeNull();
  });

  it('renders a booking indicator for a confirmed booking on the correct date', () => {
    const booking = makeBooking('2026-05-15T10:00:00Z', 'confirmed');
    render(<MiniMonthCalendar weekDays={[]} bookings={[booking]} referenceDate={MAY_2026} />);

    expect(screen.getByLabelText('sesión agendada')).toBeInTheDocument();
  });

  it('renders a booking indicator for a pending booking', () => {
    const booking = makeBooking('2026-05-20T10:00:00Z', 'pending');
    render(<MiniMonthCalendar weekDays={[]} bookings={[booking]} referenceDate={MAY_2026} />);

    expect(screen.getByLabelText('sesión agendada')).toBeInTheDocument();
  });

  it('does not render a booking indicator for a cancelled booking', () => {
    const booking = makeBooking('2026-05-20T10:00:00Z', 'cancelled');
    render(<MiniMonthCalendar weekDays={[]} bookings={[booking]} referenceDate={MAY_2026} />);

    expect(screen.queryByLabelText('sesión agendada')).not.toBeInTheDocument();
  });

  it('uses the referenceDate prop to display the correct month instead of today', () => {
    const jan2026 = new Date(2026, 0, 1); // January
    render(<MiniMonthCalendar weekDays={[]} bookings={[]} referenceDate={jan2026} />);

    expect(screen.getByText(/enero/i)).toBeInTheDocument();
  });
});
