import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';

const SLOTS: string[] = [
  '2025-03-01T10:00:00Z',
  '2025-03-01T14:00:00Z',
];

describe('TimeSlotPicker', () => {
  const onSelect = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders a button for each slot', () => {
    render(<TimeSlotPicker slots={SLOTS} selectedStartsAt={null} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('renders empty state when no slots', () => {
    render(<TimeSlotPicker slots={[]} selectedStartsAt={null} onSelect={onSelect} />);
    expect(screen.getByText(/No hay horarios disponibles/)).toBeInTheDocument();
  });

  it('calls onSelect with the ISO string when clicking a slot', async () => {
    const user = userEvent.setup();
    render(<TimeSlotPicker slots={SLOTS} selectedStartsAt={null} onSelect={onSelect} />);
    await user.click(screen.getAllByRole('button')[0]);
    expect(onSelect).toHaveBeenCalledWith(SLOTS[0]);
  });

  it('highlights selected slot with red styling', () => {
    render(<TimeSlotPicker slots={SLOTS} selectedStartsAt={SLOTS[0]} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')[0]).toHaveClass('border-kore-red');
  });

  it('displays times in 12h format', () => {
    render(<TimeSlotPicker slots={SLOTS} selectedStartsAt={null} onSelect={onSelect} />);
    // es-CO locale uses "a. m." / "p. m." notation
    expect(screen.getAllByText(/a\. m\.|p\. m\./i).length).toBeGreaterThan(0);
  });
});
