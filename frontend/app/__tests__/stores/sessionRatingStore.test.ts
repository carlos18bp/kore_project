import { api } from '@/lib/services/http';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'token') }));

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock };

const PENDING = {
  count: 1,
  results: [{ id: 7, starts_at: '2026-07-13T15:00:00Z', trainer_name: 'Tina Trainer' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  useSessionRatingStore.setState({ pending: [], summary: null, loading: false, error: '' });
});

test('fetchPending stores the sessions awaiting a rating', async () => {
  mockApi.get.mockResolvedValue({ data: PENDING });

  await useSessionRatingStore.getState().fetchPending();

  expect(mockApi.get).toHaveBeenCalledWith('/bookings/pending-rating/', expect.anything());
  expect(useSessionRatingStore.getState().pending).toHaveLength(1);
  expect(useSessionRatingStore.getState().pending[0].trainer_name).toBe('Tina Trainer');
});

test('submitRating posts the score and drops the session from the pending list', async () => {
  useSessionRatingStore.setState({ pending: PENDING.results });
  mockApi.post.mockResolvedValue({ data: { id: 1, score: 5 } });

  const ok = await useSessionRatingStore.getState().submitRating(7, 5, 'Buena');

  expect(ok).toBe(true);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/bookings/7/rate/',
    { score: 5, comment: 'Buena' },
    expect.anything(),
  );
  expect(useSessionRatingStore.getState().pending).toHaveLength(0);
});

test('submitRating surfaces an error and keeps the session pending on failure', async () => {
  useSessionRatingStore.setState({ pending: PENDING.results });
  mockApi.post.mockRejectedValue(new Error('boom'));

  const ok = await useSessionRatingStore.getState().submitRating(7, 5);

  expect(ok).toBe(false);
  expect(useSessionRatingStore.getState().pending).toHaveLength(1);
  expect(useSessionRatingStore.getState().error).not.toBe('');
});

test('fetchSummary stores the trainer average', async () => {
  mockApi.get.mockResolvedValue({
    data: {
      average: 4.5,
      count: 2,
      recent: [
        { score: 5, comment: 'Top', customer_name: 'Ana', created_at: '2026-07-13T15:00:00Z' },
      ],
    },
  });

  await useSessionRatingStore.getState().fetchSummary();

  expect(mockApi.get).toHaveBeenCalledWith('/trainer/ratings/summary/', expect.anything());
  expect(useSessionRatingStore.getState().summary?.average).toBe(4.5);
});
