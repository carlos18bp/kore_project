jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

describe('creditValuesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCreditValuesStore.setState({
      actionValues: {}, streakBonuses: {}, waterGoalGlasses: 8,
      requireWorkoutCaptures: false, loaded: false,
    });
  });

  it('fetches values once and exposes them via value()', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: {
      action_values: { checkin: 5, workout_day: 15 },
      streak_bonuses: { '7': 50 },
      water_goal_glasses: 8,
      meal_review_days: 3,
      require_workout_captures: true,
    } });
    await useCreditValuesStore.getState().fetchValues();
    const s = useCreditValuesStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.value('checkin')).toBe(5);
    expect(s.requireWorkoutCaptures).toBe(true);
    await s.fetchValues(); // second call is a no-op
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('value() returns null while not loaded', () => {
    expect(useCreditValuesStore.getState().value('checkin')).toBeNull();
  });
});
