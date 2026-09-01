jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useBookingStore } from '@/lib/stores/bookingStore';

describe('bookingStore.confirmAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBookingStore.setState({ error: null });
  });

  it('posts the decision and returns the updated booking', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 5, attendance_status: 'attended', attendance_confirmed_at: '2026-07-15T15:00:00Z' },
    });
    const res = await useBookingStore.getState().confirmAttendance(5, true);
    expect(api.post).toHaveBeenCalledWith(
      '/bookings/5/confirm-attendance/',
      { attended: true },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(res?.attendance_status).toBe('attended');
  });

  it('stores the API detail message on failure and returns null', async () => {
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { detail: 'La sesión aún no ha iniciado.' } },
    });
    const res = await useBookingStore.getState().confirmAttendance(5, true);
    expect(res).toBeNull();
    expect(useBookingStore.getState().error).toBe('La sesión aún no ha iniciado.');
  });
});
