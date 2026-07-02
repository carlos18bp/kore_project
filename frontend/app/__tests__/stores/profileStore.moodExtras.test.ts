jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useProfileStore } from '@/lib/stores/profileStore';

describe('profileStore.submitMood extras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({ todayMood: null, profile: null });
  });

  it('posts the check-in extras alongside score', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {
      score: 8, notes: '', date: '2026-07-15',
      energy_level: 4, pain: false, ready_to_train: true,
    } });
    const res = await useProfileStore.getState().submitMood(8, undefined, {
      energy_level: 4, pain: false, ready_to_train: true,
    });
    expect(api.post).toHaveBeenCalledWith('/auth/mood/', {
      score: 8, energy_level: 4, pain: false, ready_to_train: true,
    }, expect.any(Object));
    expect(res.success).toBe(true);
    expect(useProfileStore.getState().todayMood?.energy_level).toBe(4);
  });

  it('score-only call keeps the old payload shape', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { score: 7, notes: '', date: '2026-07-15' } });
    await useProfileStore.getState().submitMood(7);
    expect(api.post).toHaveBeenCalledWith('/auth/mood/', { score: 7 }, expect.any(Object));
  });
});
