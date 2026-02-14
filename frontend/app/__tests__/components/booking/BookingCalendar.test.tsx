import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingCalendar from '@/app/components/booking/BookingCalendar';

describe('BookingCalendar', () => {
  const onSelectDate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders day name headers', () => {
    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Vie')).toBeInTheDocument();
    expect(screen.getByText('Dom')).toBeInTheDocument();
  });

  it('renders month label', () => {
    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );
    // Current month should be visible as a heading
    const now = new Date();
    const expected = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders next/prev month navigation buttons', () => {
    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );
    expect(screen.getByLabelText('Mes anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Mes siguiente')).toBeInTheDocument();
  });

  it('navigates to next month when clicking next button', async () => {
    const user = userEvent.setup();
    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );
    const nextBtn = screen.getByLabelText('Mes siguiente');
    await user.click(nextBtn);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const expected = nextMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('calls onSelectDate when clicking an available day', async () => {
    const user = userEvent.setup();
    // Use a future date to ensure it's not disabled
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const y = futureDate.getFullYear();
    const m = String(futureDate.getMonth() + 1).padStart(2, '0');
    const d = String(futureDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    render(
      <BookingCalendar
        availableDates={new Set([dateStr])}
        selectedDate={null}
        onSelectDate={onSelectDate}
      />
    );

    // Find the day button by its text content
    const dayButtons = screen.getAllByRole('button');
    const targetBtn = dayButtons.find((btn) => btn.textContent === String(futureDate.getDate()));
    expect(targetBtn).toBeDefined();
    await user.click(targetBtn!);
    expect(onSelectDate).toHaveBeenCalledWith(dateStr);
  });

  it('navigates to previous month crossing year boundary (Jan → Dec)', async () => {
    const user = userEvent.setup();
    // Mock Date so "today" is January 2025
    const realDate = Date;
    const jan2025 = new Date(2025, 0, 15);
    jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return jan2025;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (realDate as any)(...args);
    });

    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );
    const expected = jan2025.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    expect(screen.getByText(expected)).toBeInTheDocument();

    await user.click(screen.getByLabelText('Mes anterior'));

    const dec2024 = new realDate(2024, 11);
    const expectedPrev = dec2024.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    expect(screen.getByText(expectedPrev)).toBeInTheDocument();

    jest.restoreAllMocks();
  });

  it('navigates to next month crossing year boundary (Dec → Jan)', async () => {
    const user = userEvent.setup();
    const realDate = Date;
    const dec2025 = new Date(2025, 11, 15);
    jest.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return dec2025;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (realDate as any)(...args);
    });

    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );

    await user.click(screen.getByLabelText('Mes siguiente'));

    const jan2026 = new realDate(2026, 0);
    const expectedNext = jan2026.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    expect(screen.getByText(expectedNext)).toBeInTheDocument();

    jest.restoreAllMocks();
  });

  it('navigates to previous month within same year', async () => {
    const user = userEvent.setup();
    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );

    // Click prev then next to go back to current — this ensures the else branch (non-January) is hit
    await user.click(screen.getByLabelText('Mes siguiente'));
    await user.click(screen.getByLabelText('Mes anterior'));

    // Should be back to current month
    const now = new Date();
    const expected = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('applies selected styling (bg-kore-red) when selectedDate matches a day', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const y = futureDate.getFullYear();
    const m = String(futureDate.getMonth() + 1).padStart(2, '0');
    const d = String(futureDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    render(
      <BookingCalendar availableDates={new Set([dateStr])} selectedDate={dateStr} onSelectDate={onSelectDate} />
    );

    const dayButtons = screen.getAllByRole('button');
    const selectedBtn = dayButtons.find((btn) => btn.textContent === String(futureDate.getDate()));
    expect(selectedBtn).toBeDefined();
    expect(selectedBtn!.className).toContain('bg-kore-red');
  });

  it('disables days without available slots', () => {
    render(
      <BookingCalendar availableDates={new Set()} selectedDate={null} onSelectDate={onSelectDate} />
    );
    // All day buttons should be disabled since no available dates
    const buttons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label') !== 'Mes anterior' && btn.getAttribute('aria-label') !== 'Mes siguiente'
    );
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
