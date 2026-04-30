import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeSlotPicker from '@/app/components/booking/TimeSlotPicker';
import type { Slot } from '@/lib/stores/bookingStore';

const SLOTS: Slot[] = [
  { id: 1, trainer_id: 1, starts_at: '2025-03-01T10:00:00Z', ends_at: '2025-03-01T11:00:00Z', is_active: true, is_blocked: false },
  { id: 2, trainer_id: 1, starts_at: '2025-03-01T14:00:00Z', ends_at: '2025-03-01T15:00:00Z', is_active: true, is_blocked: false },
];

describe('TimeSlotPicker', () => {
  const onSelectSlot = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders slot buttons for each slot', () => {
    render(<TimeSlotPicker slots={SLOTS} selectedSlot={null} onSelectSlot={onSelectSlot} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('renders empty state when no slots', () => {
    render(<TimeSlotPicker slots={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);
    expect(screen.getByText(/No hay horarios disponibles/)).toBeInTheDocument();
  });

  it('calls onSelectSlot when clicking a slot', async () => {
    const user = userEvent.setup();
    render(<TimeSlotPicker slots={SLOTS} selectedSlot={null} onSelectSlot={onSelectSlot} />);
    await user.click(screen.getAllByRole('button')[0]);
    expect(onSelectSlot).toHaveBeenCalledWith(SLOTS[0]);
  });

  it('highlights selected slot with red styling', () => {
    render(<TimeSlotPicker slots={SLOTS} selectedSlot={SLOTS[0]} onSelectSlot={onSelectSlot} />);
    expect(screen.getAllByRole('button')[0]).toHaveClass('border-kore-red');
  });

  it('displays times in 12h AM/PM format', () => {
    render(<TimeSlotPicker slots={SLOTS} selectedSlot={null} onSelectSlot={onSelectSlot} />);
    expect(screen.getAllByText(/AM|PM/).length).toBeGreaterThan(0);
  });
});
