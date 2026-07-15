import { useTrainerEngagementStore } from '@/lib/stores/trainerEngagementStore';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn() },
  extractApiError: jest.fn(() => 'boom'),
}));

const mockedGet = api.get as jest.Mock;

const DATA = {
  summary: {
    clients_total: 2, active_streaks: 1, checked_in_today: 1, checked_in_today_pct: 50,
    credits_earned_30d: 30, credits_spent_30d: 10, attendance_rate_30d: 50,
  },
  roster: [
    { customer_id: 1, name: 'Ana', current_streak: 7, last_checkin: '2026-07-15', attendance_rate_30d: 100, average_rating: 5 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useTrainerEngagementStore.setState({ data: null, loading: false, error: null });
});

it('fetchEngagement loads data', async () => {
  mockedGet.mockResolvedValue({ data: DATA });
  await useTrainerEngagementStore.getState().fetchEngagement();
  expect(mockedGet).toHaveBeenCalledWith('/trainer/engagement/');
  expect(useTrainerEngagementStore.getState().data?.summary.active_streaks).toBe(1);
});

it('fetchEngagement sets error via extractApiError on failure', async () => {
  mockedGet.mockRejectedValue(new Error('x'));
  await useTrainerEngagementStore.getState().fetchEngagement();
  expect(useTrainerEngagementStore.getState().error).toBe('boom');
  expect(useTrainerEngagementStore.getState().loading).toBe(false);
});
