import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import AttendanceActions from '@/app/components/trainer/AttendanceActions';

const FROZEN = new Date('2026-07-15T15:00:00Z');

// Freeze only Date for determinism; real timers stay so waitFor can poll.
beforeAll(() => jest.useFakeTimers({ now: FROZEN, doNotFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'queueMicrotask'] }));
afterAll(() => jest.useRealTimers());

const base = { id: 9, status: 'confirmed' as const };

describe('AttendanceActions', () => {
  it('renders nothing for future sessions', () => {
    const { container } = render(
      <AttendanceActions session={{ ...base, starts_at: '2026-07-16T10:00:00Z', attendance_status: 'unset' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders confirm buttons for a started, unconfirmed session', () => {
    render(<AttendanceActions session={{ ...base, starts_at: '2026-07-15T13:00:00Z', attendance_status: 'unset' }} />);
    expect(screen.getByRole('button', { name: /Asistió/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No asistió/ })).toBeInTheDocument();
  });

  it('shows a badge when attendance is already set', () => {
    render(<AttendanceActions session={{ ...base, starts_at: '2026-07-15T13:00:00Z', attendance_status: 'attended' }} />);
    expect(screen.getByText('Asistió')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('posts the decision and swaps to the badge', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 9, attendance_status: 'attended', attendance_confirmed_at: FROZEN.toISOString() },
    });
    render(<AttendanceActions session={{ ...base, starts_at: '2026-07-15T13:00:00Z', attendance_status: 'unset' }} />);
    fireEvent.click(screen.getByRole('button', { name: /✓ Asistió/ }));
    await waitFor(() => expect(screen.getByText('Asistió')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/bookings/9/confirm-attendance/', { attended: true }, expect.any(Object));
  });
});
