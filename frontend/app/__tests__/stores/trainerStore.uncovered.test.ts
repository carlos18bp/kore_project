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
    riskDashboard: null, riskDashboardLoading: false,
    clientKPIs: {}, kpiLoading: false,
    alerts: [], alertsLoading: false,
    clientAlerts: {}, clientAlertsLoading: false,
    trainerMessages: {}, messagesLoading: false,
    comparativeMetrics: null, comparativeLoading: false,
    clientDailyLogs: {}, dailyLogsLoading: false,
    clientNutritionLogs: {}, nutritionLogsLoading: false,
    clientSessionsFull: {}, sessionsFullLoading: false,
    programActionLoading: false,
  });
}

describe('trainerStore — intelligence center actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('tok');
  });

  describe('fetchRiskDashboard', () => {
    it('stores the risk dashboard on success', async () => {
      const dashboard = { risk_summary: { alto: 1, medio: 2, bajo: 0, sin_riesgo: 3 }, clients_by_risk: [] };
      mockedApi.get.mockResolvedValueOnce({ data: dashboard });

      await useTrainerStore.getState().fetchRiskDashboard();

      expect(useTrainerStore.getState().riskDashboard).toEqual(dashboard);
      expect(useTrainerStore.getState().riskDashboardLoading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/risk-dashboard/', { headers: { Authorization: 'Bearer tok' } });
    });

    it('stops loading without crashing on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('boom'));

      await useTrainerStore.getState().fetchRiskDashboard();

      expect(useTrainerStore.getState().riskDashboard).toBeNull();
      expect(useTrainerStore.getState().riskDashboardLoading).toBe(false);
    });
  });

  describe('fetchClientKPI', () => {
    it('keys the KPI payload by customer id', async () => {
      const kpi = { behavioral: { streak_current: 4 }, clinical: { kore_score: 72 } };
      mockedApi.get.mockResolvedValueOnce({ data: kpi });

      await useTrainerStore.getState().fetchClientKPI(7);

      expect(useTrainerStore.getState().clientKPIs[7]).toEqual(kpi);
    });
  });

  describe('fetchAlerts', () => {
    it('stores the alerts list from the response', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { alerts: [{ id: 1 }] } });

      await useTrainerStore.getState().fetchAlerts();

      expect(useTrainerStore.getState().alerts).toHaveLength(1);
      expect(useTrainerStore.getState().alertsLoading).toBe(false);
    });
  });

  describe('resolveAlert', () => {
    it('appends the resolution to the matching alert', async () => {
      useTrainerStore.setState({ alerts: [{ id: 5, resolutions: [] } as never] });
      mockedApi.post.mockResolvedValueOnce({ data: { id: 99, signal_type: 'no_logs' } });

      await useTrainerStore.getState().resolveAlert(5, { signal_type: 'no_logs', resolution_type: 'noted', note: 'ok' });

      const alert = useTrainerStore.getState().alerts.find((a) => a.id === 5)!;
      expect(alert.resolutions).toHaveLength(1);
      expect(mockedApi.post).toHaveBeenCalledWith('/trainer/alerts/5/resolve/', expect.objectContaining({ signal_type: 'no_logs' }), { headers: { Authorization: 'Bearer tok' } });
    });
  });

  describe('fetchTrainerMessages', () => {
    it('keys the messages by customer id', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { messages: [{ id: 1, message: 'hola' }] } });

      await useTrainerStore.getState().fetchTrainerMessages(3);

      expect(useTrainerStore.getState().trainerMessages[3]).toHaveLength(1);
      expect(useTrainerStore.getState().messagesLoading).toBe(false);
    });
  });

  describe('sendTrainerMessage', () => {
    it('posts the message then refetches the customer messages', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: {} });
      mockedApi.get.mockResolvedValueOnce({ data: { messages: [{ id: 1, message: 'hola' }] } });

      await useTrainerStore.getState().sendTrainerMessage(3, 'hola');

      expect(mockedApi.post).toHaveBeenCalledWith('/trainer/messages/', expect.objectContaining({ customer_id: 3, message: 'hola', trigger_type: 'manual' }), { headers: { Authorization: 'Bearer tok' } });
      expect(useTrainerStore.getState().trainerMessages[3]).toHaveLength(1);
    });
  });

  describe('fetchComparativeMetrics', () => {
    it('stores the comparative metrics payload', async () => {
      const metrics = { adherence_ranking: [], improved_this_week: [], worsened_this_week: [], global_patterns: {}, expired_evaluations: [] };
      mockedApi.get.mockResolvedValueOnce({ data: metrics });

      await useTrainerStore.getState().fetchComparativeMetrics();

      expect(useTrainerStore.getState().comparativeMetrics).toEqual(metrics);
      expect(useTrainerStore.getState().comparativeLoading).toBe(false);
    });
  });

  describe('pauseProgram', () => {
    it('throws a friendly error when the request fails', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('boom'));

      await expect(useTrainerStore.getState().pauseProgram(2, 10, 'lesión')).rejects.toThrow('No se pudo pausar el programa.');
      expect(useTrainerStore.getState().programActionLoading).toBe(false);
    });
  });

  describe('fetchClientDailyLogs', () => {
    it('keys the daily logs by customer id', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { days: [{ date: '2026-04-01' }] } });

      await useTrainerStore.getState().fetchClientDailyLogs(4);

      expect(useTrainerStore.getState().clientDailyLogs[4]).toHaveLength(1);
      expect(useTrainerStore.getState().dailyLogsLoading).toBe(false);
    });
  });

  describe('fetchClientSessionsFull', () => {
    it('keys the full session list by customer id', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { sessions: [{ id: 1, status: 'pending' }] } });

      await useTrainerStore.getState().fetchClientSessionsFull(6);

      expect(useTrainerStore.getState().clientSessionsFull[6]).toHaveLength(1);
    });
  });

  describe('updateSessionObjective', () => {
    it('updates the objective on the matching keyed session', async () => {
      useTrainerStore.setState({ clientSessionsFull: { 6: [{ id: 11, status: 'pending', session_objective: '' } as never] } });
      mockedApi.patch.mockResolvedValueOnce({ data: {} });

      await useTrainerStore.getState().updateSessionObjective(6, 11, 'Foco en core');

      expect(useTrainerStore.getState().clientSessionsFull[6][0].session_objective).toBe('Foco en core');
    });

    it('swallows errors and leaves the sessions unchanged', async () => {
      useTrainerStore.setState({ clientSessionsFull: { 6: [{ id: 11, status: 'pending', session_objective: 'old' } as never] } });
      mockedApi.patch.mockRejectedValueOnce(new Error('boom'));

      await useTrainerStore.getState().updateSessionObjective(6, 11, 'new');

      expect(useTrainerStore.getState().clientSessionsFull[6][0].session_objective).toBe('old');
    });
  });

  describe('auth headers', () => {
    it('sends empty headers when no token is present', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: { risk_summary: {}, clients_by_risk: [] } });

      await useTrainerStore.getState().fetchRiskDashboard();

      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/risk-dashboard/', { headers: {} });
    });
  });
});
