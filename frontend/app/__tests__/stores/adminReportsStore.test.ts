import { useAdminReportsStore } from '@/lib/stores/adminReportsStore';
import { api } from '@/lib/services/http';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn() },
  extractApiError: jest.fn(() => 'boom'),
}));

const mockedGet = api.get as jest.Mock;

const REPORT = {
  window: '30d',
  revenue: { total_cop: 120000, subscriptions_cop: 100000, credits_cop: 20000, trend: [] },
  subscriptions: { active: 2, expired: 1, canceled: 0, with_nutrition: 1, with_nutrition_pct: 50 },
  credits: { earned: 30, spent: 10, redemptions_by_status: { pending: 1, fulfilled: 0, rejected: 0 } },
  quality: { average_score: 4.5, rated_count: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 2 } },
};

beforeEach(() => {
  jest.clearAllMocks();
  useAdminReportsStore.setState({ window: '30d', data: null, loading: false, error: null });
});

it('fetchReport loads data and stores the window', async () => {
  mockedGet.mockResolvedValue({ data: REPORT });
  await useAdminReportsStore.getState().fetchReport('90d');
  expect(mockedGet).toHaveBeenCalledWith('/admin/reports/?window=90d');
  expect(useAdminReportsStore.getState().data?.revenue.total_cop).toBe(120000);
  expect(useAdminReportsStore.getState().window).toBe('90d');
});

it('fetchReport sets error via extractApiError on failure', async () => {
  mockedGet.mockRejectedValue(new Error('x'));
  await useAdminReportsStore.getState().fetchReport('30d');
  expect(useAdminReportsStore.getState().error).toBe('boom');
  expect(useAdminReportsStore.getState().loading).toBe(false);
});
