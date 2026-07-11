jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: (_e: unknown, fb: string) => fb,
}));
jest.mock('js-cookie', () => ({ get: () => 'tok', set: jest.fn(), remove: jest.fn() }));

import { api } from '@/lib/services/http';
import { useTrainerTasksStore } from '@/lib/stores/trainerTasksStore';

const mockApi = api as jest.Mocked<typeof api>;

const ROW = {
  id: 7, action: 'workout_day', amount: 10, status: 'pending', description: 'x',
  reference_type: 'daily_log', reference_id: '5', review_deadline: null,
  created_at: '2026-07-10T10:00:00Z', customer_email: 'c@test.com',
  customer_name: 'Cliente', photo_url: '/a.jpg', photos: ['/a.jpg'],
};

beforeEach(() => {
  useTrainerTasksStore.setState({ creditReviews: [], loading: false, error: '' });
  jest.clearAllMocks();
});

test('fetchPendingCreditReviews populates creditReviews', async () => {
  mockApi.get.mockResolvedValue({ data: { count: 1, results: [ROW] } } as never);
  await useTrainerTasksStore.getState().fetchPendingCreditReviews();
  expect(mockApi.get).toHaveBeenCalledWith('/trainer/credits/pending-reviews/', expect.anything());
  expect(useTrainerTasksStore.getState().creditReviews).toHaveLength(1);
});

test('reviewCreditTransaction approve posts and removes the row', async () => {
  useTrainerTasksStore.setState({ creditReviews: [ROW] as never });
  mockApi.post.mockResolvedValue({ data: {} } as never);
  const ok = await useTrainerTasksStore.getState().reviewCreditTransaction(7, 'approve');
  expect(ok).toBe(true);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/trainer/credits/transactions/7/review/',
    { decision: 'approve', note: undefined },
    expect.anything(),
  );
  expect(useTrainerTasksStore.getState().creditReviews).toHaveLength(0);
});

test('reviewCreditTransaction failure sets error and returns false', async () => {
  useTrainerTasksStore.setState({ creditReviews: [ROW] as never });
  mockApi.post.mockRejectedValue(new Error('nope'));
  const ok = await useTrainerTasksStore.getState().reviewCreditTransaction(7, 'reject', 'motivo');
  expect(ok).toBe(false);
  expect(useTrainerTasksStore.getState().error).toBeTruthy();
  expect(useTrainerTasksStore.getState().creditReviews).toHaveLength(1);
});
