import { api } from '@/lib/services/http';
import { useTrainerSettingsStore } from '@/lib/stores/trainerSettingsStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), put: jest.fn() },
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'token') }));

const mockApi = api as unknown as { get: jest.Mock; put: jest.Mock };

const SETTINGS = {
  difficulty: 'medium' as const,
  action_values: { workout_day: 15, meal_photo: 5 },
  streak_bonuses: { '3': 20 },
  training_day_threshold: 0.7,
  nutrition_min_meals: 3,
  water_goal_glasses: 8,
  meal_review_days: 3,
  reschedule_window_hours: 24,
  require_workout_captures: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  useTrainerSettingsStore.setState({
    settings: null, loading: false, saving: false, error: '',
  });
});

test('fetchSettings stores the configuration', async () => {
  mockApi.get.mockResolvedValue({ data: SETTINGS });

  await useTrainerSettingsStore.getState().fetchSettings();

  expect(mockApi.get).toHaveBeenCalledWith('/credits/settings/', expect.anything());
  expect(useTrainerSettingsStore.getState().settings?.difficulty).toBe('medium');
  expect(useTrainerSettingsStore.getState().loading).toBe(false);
});

test('updateSettings PUTs the patch and keeps the response', async () => {
  useTrainerSettingsStore.setState({ settings: SETTINGS });
  mockApi.put.mockResolvedValue({
    data: { ...SETTINGS, reschedule_window_hours: 48 },
  });

  const ok = await useTrainerSettingsStore.getState().updateSettings({
    reschedule_window_hours: 48,
  });

  expect(ok).toBe(true);
  expect(mockApi.put).toHaveBeenCalledWith(
    '/credits/settings/',
    { reschedule_window_hours: 48 },
    expect.anything(),
  );
  expect(useTrainerSettingsStore.getState().settings?.reschedule_window_hours).toBe(48);
});

test('changing the difficulty sends empty maps so the backend reseeds them', async () => {
  useTrainerSettingsStore.setState({ settings: SETTINGS });
  mockApi.put.mockResolvedValue({
    data: { ...SETTINGS, difficulty: 'hard', action_values: { workout_day: 10 } },
  });

  await useTrainerSettingsStore.getState().updateSettings({
    difficulty: 'hard',
    action_values: {},
    streak_bonuses: {},
  });

  expect(mockApi.put).toHaveBeenCalledWith(
    '/credits/settings/',
    { difficulty: 'hard', action_values: {}, streak_bonuses: {} },
    expect.anything(),
  );
  expect(useTrainerSettingsStore.getState().settings?.action_values.workout_day).toBe(10);
});

test('updateSettings surfaces an error and returns false on failure', async () => {
  useTrainerSettingsStore.setState({ settings: SETTINGS });
  mockApi.put.mockRejectedValue(new Error('boom'));

  const ok = await useTrainerSettingsStore.getState().updateSettings({
    reschedule_window_hours: 200,
  });

  expect(ok).toBe(false);
  expect(useTrainerSettingsStore.getState().error).not.toBe('');
  expect(useTrainerSettingsStore.getState().saving).toBe(false);
});
