jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(), extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useBookingStore } from '@/lib/stores/bookingStore';

describe('bookingStore session grants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBookingStore.setState({ sessionGrants: [] });
  });

  it('fetchSessionGrants stores active grants', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 1, sessions_total: 3, sessions_used: 1, sessions_remaining: 2, expires_at: '2026-08-05T00:00:00Z' }] });
    await useBookingStore.getState().fetchSessionGrants();
    expect(useBookingStore.getState().sessionGrants).toHaveLength(1);
    expect(useBookingStore.getState().sessionGrants[0].sessions_remaining).toBe(2);
  });
});
