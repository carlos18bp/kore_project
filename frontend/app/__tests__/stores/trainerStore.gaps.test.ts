import Cookies from 'js-cookie';
import { useTrainerStore } from '@/lib/stores/trainerStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({ get: jest.fn(), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  useTrainerStore.setState({
    clientAlerts: {},
    clientAlertsLoading: false,
    clientNutritionLogs: {},
    nutritionLogsLoading: false,
    programActionLoading: false,
  });
}

describe('trainerStore — gap actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('tok');
  });

  describe('fetchClientAlerts', () => {
    it('keys the alerts array by customerId in clientAlerts', async () => {
      const alertsData = [{ id: 1, customer_id: 3, level: 'alto' }];
      mockedApi.get.mockResolvedValueOnce({ data: { alerts: alertsData } });

      await useTrainerStore.getState().fetchClientAlerts(3);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/my-clients/3/alerts/',
        expect.anything(),
      );
      expect(useTrainerStore.getState().clientAlerts[3]).toEqual(alertsData);
      expect(useTrainerStore.getState().clientAlertsLoading).toBe(false);
    });

    it('stops loading without crashing on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      await useTrainerStore.getState().fetchClientAlerts(3);

      expect(useTrainerStore.getState().clientAlertsLoading).toBe(false);
    });
  });

  describe('resumeProgram', () => {
    it('POSTs to resume endpoint and clears programActionLoading', async () => {
      mockedApi.post.mockResolvedValueOnce({});

      await useTrainerStore.getState().resumeProgram(3, 42);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/my-clients/3/program/42/resume/',
        {},
        expect.anything(),
      );
      expect(useTrainerStore.getState().programActionLoading).toBe(false);
    });

    it('throws an error when the API call fails', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Server error'));

      await expect(useTrainerStore.getState().resumeProgram(3, 42)).rejects.toThrow(
        'No se pudo reanudar el programa.',
      );
      expect(useTrainerStore.getState().programActionLoading).toBe(false);
    });
  });

  describe('fetchClientNutritionLogs', () => {
    it('keys the days array by customerId with default 7 days', async () => {
      const days = [{ date: '2026-05-10', adherence: 0.8, is_closed: true, meals: [] }];
      mockedApi.get.mockResolvedValueOnce({ data: { days } });

      await useTrainerStore.getState().fetchClientNutritionLogs(3);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/my-clients/3/nutrition-logs/?days=7',
        expect.anything(),
      );
      expect(useTrainerStore.getState().clientNutritionLogs[3]).toEqual(days);
      expect(useTrainerStore.getState().nutritionLogsLoading).toBe(false);
    });

    it('passes custom days parameter', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { days: [] } });

      await useTrainerStore.getState().fetchClientNutritionLogs(3, 14);

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/trainer/my-clients/3/nutrition-logs/?days=14',
        expect.anything(),
      );
    });

    it('stops loading without crashing on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      await useTrainerStore.getState().fetchClientNutritionLogs(3);

      expect(useTrainerStore.getState().nutritionLogsLoading).toBe(false);
    });
  });
});
