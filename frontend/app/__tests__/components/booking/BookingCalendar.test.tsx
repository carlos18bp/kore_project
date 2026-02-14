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
