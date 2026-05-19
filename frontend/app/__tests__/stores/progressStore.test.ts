import Cookies from 'js-cookie';
import { useProgressStore } from '@/lib/stores/progressStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useProgressStore.setState({
    weeklySummary: null,
    projection: null,
    monthlySummary: null,
    weeklyLoading: false,
    projectionLoading: false,
    monthlyLoading: false,
  });
}

describe('progressStore — empty-state contract (200 + null)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  describe('fetchWeeklySummary', () => {
    it('stores null when backend returns 200 null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });

      await useProgressStore.getState().fetchWeeklySummary();

      const state = useProgressStore.getState();
      expect(state.weeklySummary).toBeNull();
      expect(state.weeklyLoading).toBe(false);
    });

    it('stores payload when backend returns a summary', async () => {
      const summary = { week_number: 1, days: [], week_average: 0, streak: { current: 0, longest: 0, start_date: null } };
      mockedApi.get.mockResolvedValueOnce({ data: summary });

      await useProgressStore.getState().fetchWeeklySummary(1);

      const state = useProgressStore.getState();
      expect(state.weeklySummary).toEqual(summary);
      // Confirm query param plumbing.
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/my-program/weekly-summary/?week=1',
        expect.any(Object),
      );
    });

    it('resets to null and stops loading on error', async () => {
      useProgressStore.setState({ weeklySummary: { week_number: 1, days: [], week_average: 0, streak: { current: 0, longest: 0, start_date: null } } });
      mockedApi.get.mockRejectedValueOnce(new Error('boom'));

      await useProgressStore.getState().fetchWeeklySummary();

      const state = useProgressStore.getState();
      expect(state.weeklySummary).toBeNull();
      expect(state.weeklyLoading).toBe(false);
    });
  });

  describe('fetchProjection', () => {
    it('stores null when backend returns 200 null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });

      await useProgressStore.getState().fetchProjection();

      const state = useProgressStore.getState();
      expect(state.projection).toBeNull();
      expect(state.projectionLoading).toBe(false);
    });
  });

  describe('fetchMonthlySummary', () => {
    it('stores null when backend returns 200 null', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });

      await useProgressStore.getState().fetchMonthlySummary();

      const state = useProgressStore.getState();
      expect(state.monthlySummary).toBeNull();
      expect(state.monthlyLoading).toBe(false);
    });

    it('forwards program param when provided', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });

      await useProgressStore.getState().fetchMonthlySummary(42);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/my-program/monthly-summary/?program=42',
        expect.any(Object),
      );
    });
  });
});
